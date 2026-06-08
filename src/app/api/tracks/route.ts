import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, publicAudioUrl, TRACKS_BUCKET } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-server'
import { awardXp } from '@/lib/xp'
import { processAudioBuffer, serializeAnalysisForDb } from '@/lib/audio-processing'
import type { Prisma } from '@prisma/client'

export const runtime = 'nodejs'
// El análisis FFT puede prolongarse en WAVs largos; ampliamos a 60 s.
export const maxDuration = 60

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB (audio)
const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
])

const MAX_COVER_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_COVER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function extensionFor(mime: string, fallbackName: string): string {
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('wav') || mime.includes('wave')) return 'wav'
  const dot = fallbackName.lastIndexOf('.')
  return dot >= 0 ? fallbackName.slice(dot + 1).toLowerCase() : 'bin'
}

function coverExtensionFor(mime: string, fallbackName: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
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
  const cover = form.get('cover')
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

  // La portada es opcional; si no se aporta se aplica la del género.
  if (cover !== null && !(cover instanceof File)) {
    return NextResponse.json({ error: 'Portada inválida.' }, { status: 400 })
  }
  const coverFile = cover instanceof File && cover.size > 0 ? cover : null
  if (coverFile) {
    if (coverFile.size > MAX_COVER_BYTES) {
      return NextResponse.json(
        { error: 'La portada supera 5 MB.' },
        { status: 413 },
      )
    }
    if (!ALLOWED_COVER_MIME.has(coverFile.type)) {
      return NextResponse.json(
        {
          error: `Portada en formato no soportado (${coverFile.type || 'desconocido'}). Usa JPG, PNG o WebP.`,
        },
        { status: 415 },
      )
    }
  }

  const duration = typeof durationRaw === 'string' ? Number(durationRaw) : NaN
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'Duración inválida.' }, { status: 400 })
  }

  const ext = extensionFor(file.type, file.name)
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  // Decodificación + picos + análisis en una sola pasada (antes del upload
  // a Storage para no dejar archivos huérfanos si la decodificación falla).
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

  // Upload de la portada. Si falla, se revierte también el audio.
  let coverPath: string | null = null
  let coverUrl: string | null = null
  if (coverFile) {
    const coverExt = coverExtensionFor(coverFile.type, coverFile.name)
    coverPath = `${user.id}/covers/${crypto.randomUUID()}.${coverExt}`
    const coverBytes = Buffer.from(await coverFile.arrayBuffer())
    const { error: coverUploadError } = await supabaseAdmin.storage
      .from(TRACKS_BUCKET)
      .upload(coverPath, coverBytes, {
        contentType: coverFile.type,
        cacheControl: '3600',
        upsert: false,
      })
    if (coverUploadError) {
      console.error(
        '[upload-cover] Storage upload failed:',
        coverUploadError.message,
        coverUploadError,
      )
      // Revertir el upload de audio para evitar archivos huérfanos.
      await supabaseAdmin.storage.from(TRACKS_BUCKET).remove([storagePath]).catch(() => {})
      return NextResponse.json(
        {
          error: `No se pudo subir la portada: ${coverUploadError.message}. Revisa la configuración del bucket en Supabase.`,
        },
        { status: 500 },
      )
    }
    coverUrl = publicAudioUrl(coverPath)
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
          coverUrl,
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
          coverUrl: true,
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
    // Revertir ambos uploads si falla la inserción en BD.
    const toRemove = coverPath ? [storagePath, coverPath] : [storagePath]
    await supabaseAdmin.storage.from(TRACKS_BUCKET).remove(toRemove)
    console.error('Track DB insert failed:', e)
    return NextResponse.json({ error: 'No se pudo guardar la pista.' }, { status: 500 })
  }
}
