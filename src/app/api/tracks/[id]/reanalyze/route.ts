import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, TRACKS_BUCKET } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-server'
import { processAudioBuffer, serializeAnalysisForDb } from '@/lib/audio-processing'
import type { Prisma } from '@prisma/client'

export const runtime = 'nodejs'
// Reprocesses EVERY version of a track sequentially. Easily blows past the
// default 10 s on tracks with multiple versions. Vercel Hobby caps at 60 s.
export const maxDuration = 60

interface RouteContext {
  params: Promise<{ id: string }>
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${TRACKS_BUCKET}/`
  const idx = url.indexOf(marker)
  return idx >= 0 ? url.slice(idx + marker.length) : null
}

/**
 * Re-run the server-side audio pipeline (peaks + analysis) for every version
 * of a track. Owner-only.
 *
 * Use case: the FFT detectors or the spectral thresholds get tweaked in
 * code and the producer wants the existing track to benefit from the
 * improved analysis without re-uploading. Equivalent to running
 * `scripts/backfill-audio-processing.mts` for one track only.
 *
 * Heavy operation: each version downloads the full audio from Storage and
 * decodes it. We re-process versions sequentially (one at a time) to keep
 * memory predictable; a 5-min track at 44.1 kHz / stereo is ~50 MB in RAM
 * while decoded.
 */
export async function POST(_req: Request, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id: trackId } = await context.params
  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: {
      id: true,
      authorId: true,
      versions: {
        orderBy: { versionNumber: 'asc' },
        select: { id: true, versionNumber: true, audioUrl: true },
      },
    },
  })

  if (!track) {
    return NextResponse.json({ error: 'Pista no encontrada.' }, { status: 404 })
  }
  if (track.authorId !== user.id) {
    return NextResponse.json({ error: 'No tienes permiso.' }, { status: 403 })
  }
  if (track.versions.length === 0) {
    return NextResponse.json({ error: 'La pista no tiene versiones.' }, { status: 400 })
  }

  let ok = 0
  let failed = 0
  for (const v of track.versions) {
    const path = storagePathFromUrl(v.audioUrl)
    if (!path) {
      failed++
      continue
    }
    try {
      const { data, error } = await supabaseAdmin.storage.from(TRACKS_BUCKET).download(path)
      if (error || !data) throw error ?? new Error('No data')

      const buffer = Buffer.from(await data.arrayBuffer())
      const { peaks, analysis } = await processAudioBuffer(buffer)

      await prisma.trackVersion.update({
        where: { id: v.id },
        data: analysis
          ? {
              peaks,
              analysis: serializeAnalysisForDb(analysis) as Prisma.InputJsonValue,
            }
          : { peaks },
      })
      ok++
    } catch (err) {
      console.error(`[reanalyze] V${v.versionNumber} failed:`, err)
      failed++
    }
  }

  if (ok === 0) {
    return NextResponse.json(
      { error: 'No se pudo re-analizar ninguna versión.' },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok, failed, total: track.versions.length })
}
