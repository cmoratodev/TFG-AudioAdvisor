import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, publicAudioUrl, TRACKS_BUCKET } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-server'
import { awardXp } from '@/lib/xp'
import { processAudioBuffer, serializeAnalysisForDb } from '@/lib/audio-processing'
import type { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB
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

export async function GET() {
  // Public feed for the Explore page.
  const tracks = await prisma.track.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      author: { select: { id: true, name: true, email: true } },
      _count: { select: { comments: true } },
    },
  })
  return NextResponse.json({ tracks })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })
  }

  const file = form.get('file')
  const title = form.get('title')
  const genre = form.get('genre')
  const durationRaw = form.get('duration')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo de audio.' }, { status: 400 })
  }
  if (typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Falta el título.' }, { status: 400 })
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

  const ext = extensionFor(file.type, file.name)
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  // Decode + peaks + analysis all in one pass — decoding is the expensive
  // step. Failures are non-fatal: missing peaks → flat placeholder waveform;
  // missing analysis → panel shows "Sin análisis disponible". We do this
  // BEFORE the Storage upload so a decode failure doesn't leave an orphan.
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
    return NextResponse.json(
      { error: 'No se pudo subir el archivo a Storage.' },
      { status: 500 },
    )
  }

  try {
    const previousCount = await prisma.track.count({ where: { authorId: user.id } })
    const audioUrl = publicAudioUrl(storagePath)

    const track = await prisma.$transaction(async (tx) => {
      const created = await tx.track.create({
        data: {
          title: title.trim().slice(0, 120),
          genre: typeof genre === 'string' && genre.trim() ? genre.trim().slice(0, 40) : null,
          audioUrl,
          duration,
          authorId: user.id,
          versions: {
            create: {
              versionNumber: 1,
              audioUrl,
              duration,
              peaks,
              analysis: analysisJson,
            },
          },
        },
        select: {
          id: true,
          title: true,
          genre: true,
          audioUrl: true,
          duration: true,
          createdAt: true,
        },
      })
      return created
    })

    const xpAward = await awardXp(
      user.id,
      previousCount === 0 ? 'track:first-upload' : 'track:upload',
    )

    return NextResponse.json({ track, xpAward }, { status: 201 })
  } catch (e) {
    // Roll back the upload if the DB insert fails.
    await supabaseAdmin.storage.from(TRACKS_BUCKET).remove([storagePath])
    console.error('Track DB insert failed:', e)
    return NextResponse.json({ error: 'No se pudo guardar la pista.' }, { status: 500 })
  }
}
