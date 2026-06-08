import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, publicAudioUrl, TRACKS_BUCKET } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-server'

export const runtime = 'nodejs'

const MAX_AVATAR_BYTES = 3 * 1024 * 1024 // 3 MB — avatars are small, this is plenty.
const ALLOWED_AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function avatarExtensionFor(mime: string, fallbackName: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  const dot = fallbackName.lastIndexOf('.')
  return dot >= 0 ? fallbackName.slice(dot + 1).toLowerCase() : 'bin'
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${TRACKS_BUCKET}/`
  const idx = url.indexOf(marker)
  return idx >= 0 ? url.slice(idx + marker.length) : null
}

/**
 * Sube (POST) o elimina (DELETE) el avatar del usuario actual.
 * El archivo anterior se borra tras persistir el nuevo en BD.
 */
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

  const file = form.get('avatar')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Falta la imagen.' }, { status: 400 })
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'La imagen supera 3 MB.' }, { status: 413 })
  }
  if (!ALLOWED_AVATAR_MIME.has(file.type)) {
    return NextResponse.json(
      {
        error: `Formato no soportado (${file.type || 'desconocido'}). Usa JPG, PNG o WebP.`,
      },
      { status: 415 },
    )
  }

  const previous = await prisma.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  })

  const ext = avatarExtensionFor(file.type, file.name)
  const newPath = `${user.id}/avatar/${crypto.randomUUID()}.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from(TRACKS_BUCKET)
    .upload(newPath, bytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError) {
    console.error('[avatar] Storage upload failed:', uploadError.message, uploadError)
    return NextResponse.json(
      { error: `No se pudo subir el avatar: ${uploadError.message}.` },
      { status: 500 },
    )
  }

  const imageUrl = publicAudioUrl(newPath)
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { image: imageUrl },
    })
  } catch (err) {
    await supabaseAdmin.storage.from(TRACKS_BUCKET).remove([newPath]).catch(() => {})
    console.error('[avatar] DB update failed:', err)
    return NextResponse.json({ error: 'No se pudo guardar el avatar.' }, { status: 500 })
  }

  // Borrar el avatar anterior tras confirmar el nuevo.
  if (previous?.image) {
    const oldPath = storagePathFromUrl(previous.image)
    if (oldPath && oldPath !== newPath) {
      await supabaseAdmin.storage.from(TRACKS_BUCKET).remove([oldPath]).catch(() => {})
    }
  }

  return NextResponse.json({ image: imageUrl })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { image: null },
  })

  if (row?.image) {
    const oldPath = storagePathFromUrl(row.image)
    if (oldPath) {
      await supabaseAdmin.storage.from(TRACKS_BUCKET).remove([oldPath]).catch(() => {})
    }
  }

  return NextResponse.json({ image: null })
}
