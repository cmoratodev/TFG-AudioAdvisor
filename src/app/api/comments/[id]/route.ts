import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-server'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Hydrate a single comment with the joined fields needed to render it in the
 * UI (author + level + current vote state). Used by the realtime hook after
 * receiving an INSERT event — the raw payload from Supabase Realtime lacks
 * relations, so we re-fetch here.
 */
export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params

  const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true, level: true } },
      votes: { select: { voterId: true } },
    },
  })
  if (!comment) {
    return NextResponse.json({ error: 'Comentario no encontrado.' }, { status: 404 })
  }

  const viewer = await getCurrentUser()

  return NextResponse.json({
    comment: {
      id: comment.id,
      content: comment.content,
      timestamp: comment.timestamp,
      versionId: comment.versionId,
      parentId: comment.parentId,
      createdAt: comment.createdAt.toISOString(),
      author: {
        id: comment.author.id,
        name: comment.author.name,
        email: comment.author.email,
        level: comment.author.level,
      },
      votes: comment.votes.length,
      votedByViewer: viewer?.id ? comment.votes.some((v) => v.voterId === viewer.id) : false,
    },
  })
}

export async function DELETE(_req: Request, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id } = await context.params
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, authorId: true, track: { select: { authorId: true } } },
  })

  if (!comment) {
    return NextResponse.json({ error: 'Comentario no encontrado.' }, { status: 404 })
  }

  // Either the comment author or the track owner can delete.
  const canDelete = comment.authorId === user.id || comment.track.authorId === user.id
  if (!canDelete) {
    return NextResponse.json({ error: 'No tienes permiso.' }, { status: 403 })
  }

  await prisma.comment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
