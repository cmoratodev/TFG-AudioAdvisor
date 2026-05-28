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

  // Best-effort: extract storage paths from each version's public URL.
  // Public URLs look like .../storage/v1/object/public/tracks/<path>
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
