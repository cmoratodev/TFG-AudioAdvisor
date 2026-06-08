import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, publicAudioUrl, TRACKS_BUCKET } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-server'

export const runtime = 'nodejs'

const MAX_COVER_BYTES = 5 * 1024 * 1024 // 5 MB — mirrors the upload route.
const ALLOWED_COVER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function coverExtensionFor(mime: string, fallbackName: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  const dot = fallbackName.lastIndexOf('.')
  return dot >= 0 ? fallbackName.slice(dot + 1).toLowerCase() : 'bin'
}

/**
 * Convert a previously-stored cover's public URL back into its bucket path
 * so we can delete the orphan after replacing it. Returns null when the URL
 * is from a different bucket / origin so we don't try to delete random
 * paths.
 */
function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${TRACKS_BUCKET}/`
  const idx = url.indexOf(marker)
  return idx >= 0 ? url.slice(idx + marker.length) : null
}

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Replace a track's cover image. Owner-only. Behaves idempotently: uploading
 * the same file twice produces two distinct Storage paths but only the
 * latest one is referenced from the DB, and the previous file is removed.
 *
 * To DELETE (revert to genre default), POST with no `cover` field — the
 * track's `coverUrl` is set back to NULL.
 */
export async function PATCH(req: Request, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id: trackId } = await context.params

  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: { id: true, authorId: true, coverUrl: true },
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

  const cover = form.get('cover')
  const remove = form.get('remove') === 'true'

  // Branch 1 — explicit "remove cover, fall back to genre default".
  if (remove) {
    await prisma.track.update({
      where: { id: track.id },
      data: { coverUrl: null },
    })
    if (track.coverUrl) {
      const oldPath = storagePathFromUrl(track.coverUrl)
      if (oldPath) {
        await supabaseAdmin.storage.from(TRACKS_BUCKET).remove([oldPath]).catch(() => {})
      }
    }
    return NextResponse.json({ coverUrl: null })
  }

  // Branch 2 — replace with a new image.
  if (!(cover instanceof File) || cover.size === 0) {
    return NextResponse.json(
      { error: 'Falta el archivo de portada.' },
      { status: 400 },
    )
  }
  if (cover.size > MAX_COVER_BYTES) {
    return NextResponse.json({ error: 'La portada supera 5 MB.' }, { status: 413 })
  }
  if (!ALLOWED_COVER_MIME.has(cover.type)) {
    return NextResponse.json(
      {
        error: `Portada en formato no soportado (${cover.type || 'desconocido'}). Usa JPG, PNG o WebP.`,
      },
      { status: 415 },
    )
  }

  const ext = coverExtensionFor(cover.type, cover.name)
  const newPath = `${user.id}/covers/${crypto.randomUUID()}.${ext}`
  const bytes = Buffer.from(await cover.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from(TRACKS_BUCKET)
    .upload(newPath, bytes, {
      contentType: cover.type,
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError) {
    console.error('[cover-patch] Storage upload failed:', uploadError.message, uploadError)
    return NextResponse.json(
      {
        error: `No se pudo subir la portada: ${uploadError.message}. Revisa la configuración del bucket en Supabase.`,
      },
      { status: 500 },
    )
  }

  const newCoverUrl = publicAudioUrl(newPath)

  try {
    await prisma.track.update({
      where: { id: track.id },
      data: { coverUrl: newCoverUrl },
    })
  } catch (err) {
    // Roll back the upload if the DB update fails — orphan otherwise.
    await supabaseAdmin.storage.from(TRACKS_BUCKET).remove([newPath]).catch(() => {})
    console.error('Cover DB update failed:', err)
    return NextResponse.json(
      { error: 'No se pudo guardar la portada.' },
      { status: 500 },
    )
  }

  // Borrar la portada anterior tras confirmar el cambio en BD.
  if (track.coverUrl) {
    const oldPath = storagePathFromUrl(track.coverUrl)
    if (oldPath && oldPath !== newPath) {
      await supabaseAdmin.storage.from(TRACKS_BUCKET).remove([oldPath]).catch(() => {})
    }
  }

  return NextResponse.json({ coverUrl: newCoverUrl })
}
