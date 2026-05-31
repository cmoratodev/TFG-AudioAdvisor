import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, publicAudioUrl, TRACKS_BUCKET } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-server'
import { processAudioBuffer, serializeAnalysisForDb } from '@/lib/audio-processing'
import type { Prisma } from '@prisma/client'

export const runtime = 'nodejs'
// Same heavy audio pipeline as POST /api/tracks — see that file's note.
export const maxDuration = 60

const MAX_BYTES = 50 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
])

function extensionFor(mime: string, fallbackName: string): string {
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('wav') || mime.includes('wave')) return 'wav'
  const dot = fallbackName.lastIndexOf('.')
  return dot >= 0 ? fallbackName.slice(dot + 1).toLowerCase() : 'bin'
}

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Upload a new revision of an existing track. Only the owner can.
 * Comments from previous versions stay attached to their version (Option C
 * from the design — V2 starts with a clean comment list).
 *
 * The Track's denormalized `audioUrl`/`duration` are updated to point to the
 * brand-new latest version, so listings (My Tracks, Explore) keep working
 * without joins.
 */
export async function POST(req: Request, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id: trackId } = await context.params

  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: { id: true, authorId: true },
  })
  if (!track) {
    return NextResponse.json({ error: 'Pista no encontrada.' }, { status: 404 })
  }
  if (track.authorId !== user.id) {
    return NextResponse.json({ error: 'No tienes permiso.' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const file = form.get('file')
  const durationRaw = form.get('duration')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo de audio.' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo supera 50 MB.' }, { status: 413 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Formato no soportado (${file.type || 'desconocido'}). Usa .mp3 o .wav.` },
      { status: 415 },
    )
  }

  const duration = typeof durationRaw === 'string' ? Number(durationRaw) : NaN
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'Duración inválida.' }, { status: 400 })
  }

  // Find the next version number for this track.
  const latest = await prisma.trackVersion.findFirst({
    where: { trackId: track.id },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  })
  const nextVersion = (latest?.versionNumber ?? 0) + 1

  const ext = extensionFor(file.type, file.name)
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  // Decode + peaks + analysis in one pass. Non-fatal on failure (peaks empty
  // → flat waveform placeholder; analysis null → "Sin análisis disponible").
  const { peaks, analysis } = await processAudioBuffer(buffer)
  const analysisJson = analysis
    ? (serializeAnalysisForDb(analysis) as Prisma.InputJsonValue)
    : undefined

  const { error: uploadError } = await supabaseAdmin.storage
    .from(TRACKS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError) {
    console.error('Storage upload failed:', uploadError)
    return NextResponse.json({ error: 'No se pudo subir el archivo a Storage.' }, { status: 500 })
  }

  const audioUrl = publicAudioUrl(storagePath)

  try {
    const version = await prisma.$transaction(async (tx) => {
      const created = await tx.trackVersion.create({
        data: {
          trackId: track.id,
          versionNumber: nextVersion,
          audioUrl,
          duration,
          peaks,
          analysis: analysisJson,
        },
        select: {
          id: true,
          versionNumber: true,
          audioUrl: true,
          duration: true,
          createdAt: true,
        },
      })
      // Update the denormalized "latest" pointer.
      await tx.track.update({
        where: { id: track.id },
        data: { audioUrl, duration },
      })
      return created
    })
    return NextResponse.json({ version }, { status: 201 })
  } catch (e) {
    await supabaseAdmin.storage.from(TRACKS_BUCKET).remove([storagePath])
    console.error('TrackVersion insert failed:', e)
    return NextResponse.json({ error: 'No se pudo guardar la versión.' }, { status: 500 })
  }
}
