import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, TRACKS_BUCKET } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-server'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params

  const track = await prisma.track.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { timestamp: 'asc' },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  if (!track) {
    return NextResponse.json({ error: 'Pista no encontrada.' }, { status: 404 })
  }

  return NextResponse.json({ track })
}

const ALLOWED_GENRES = new Set([
  'Electrónica',
  'Pop',
  'Hip Hop',
  'Acústico',
  'Jazz',
  'Rock',
  'Otro',
])

/** Edita los metadatos editables de una pista (título y género). */
export async function PATCH(req: Request, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id } = await context.params
  const track = await prisma.track.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  })
  if (!track) {
    return NextResponse.json({ error: 'Pista no encontrada.' }, { status: 404 })
  }
  if (track.authorId !== user.id) {
    return NextResponse.json({ error: 'No tienes permiso.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 })
  }
  const { title, genre } = body as { title?: unknown; genre?: unknown }

  if (typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'El título no puede estar vacío.' }, { status: 400 })
  }
  if (title.trim().length > 120) {
    return NextResponse.json({ error: 'El título es demasiado largo (máx. 120).' }, { status: 400 })
  }
  // Género opcional; sólo se valida cuando viene definido.
  let nextGenre: string | null = null
  if (genre !== null && genre !== undefined) {
    if (typeof genre !== 'string') {
      return NextResponse.json({ error: 'Género inválido.' }, { status: 400 })
    }
    const trimmed = genre.trim()
    if (trimmed.length > 0) {
      if (!ALLOWED_GENRES.has(trimmed)) {
        return NextResponse.json({ error: 'Género no reconocido.' }, { status: 400 })
      }
      nextGenre = trimmed
    }
  }

  const updated = await prisma.track.update({
    where: { id: track.id },
    data: { title: title.trim().slice(0, 120), genre: nextGenre },
    select: { id: true, title: true, genre: true },
  })

  return NextResponse.json({ track: updated })
}

export async function DELETE(_req: Request, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id } = await context.params
  const track = await prisma.track.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      versions: { select: { audioUrl: true } },
    },
  })

  if (!track) {
    return NextResponse.json({ error: 'Pista no encontrada.' }, { status: 404 })
  }
  if (track.authorId !== user.id) {
    return NextResponse.json({ error: 'No tienes permiso.' }, { status: 403 })
  }

  // Reconstruir las rutas de Storage a partir de las URL públicas.
  const marker = `/object/public/${TRACKS_BUCKET}/`
  const paths = track.versions
    .map((v) => {
      const idx = v.audioUrl.indexOf(marker)
      return idx >= 0 ? v.audioUrl.slice(idx + marker.length) : null
    })
    .filter((p): p is string => p !== null)

  if (paths.length > 0) {
    const { error: rmError } = await supabaseAdmin.storage
      .from(TRACKS_BUCKET)
      .remove(paths)
    if (rmError) {
      console.error('Storage remove warning:', rmError)
    }
  }

  await prisma.track.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
