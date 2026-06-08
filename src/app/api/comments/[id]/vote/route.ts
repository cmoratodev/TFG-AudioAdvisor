import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-server'
import { awardXp } from '@/lib/xp'
import { createNotification } from '@/lib/notifications'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Marca un comentario como "Útil" (sólo el dueño de la pista padre).
 * La acción es irreversible; otorga +25 XP al autor del comentario.
 */
export async function POST(_req: Request, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id: commentId } = await context.params

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      trackId: true,
      versionId: true,
      track: { select: { authorId: true } },
    },
  })
  if (!comment) {
    return NextResponse.json({ error: 'Comentario no encontrado.' }, { status: 404 })
  }

  if (comment.track.authorId !== user.id) {
    return NextResponse.json(
      { error: 'Solo el dueño de la pista puede marcar feedback como útil.' },
      { status: 403 },
    )
  }
  if (comment.authorId === user.id) {
    return NextResponse.json(
      { error: 'No puedes marcar útil tu propio comentario.' },
      { status: 400 },
    )
  }

  // Idempotente: si ya existe el voto, devuelve el estado actual.
  const existing = await prisma.vote.findUnique({
    where: { commentId_voterId: { commentId, voterId: user.id } },
    select: { id: true },
  })
  if (existing) {
    const count = await prisma.vote.count({ where: { commentId } })
    return NextResponse.json({ voted: true, count, xpAward: null })
  }

  await prisma.vote.create({
    data: { commentId, voterId: user.id },
  })

  const xpAward = await awardXp(comment.authorId, 'vote:useful-received')
  const count = await prisma.vote.count({ where: { commentId } })

  await createNotification({
    recipientId: comment.authorId,
    actorId: user.id,
    kind: 'vote',
    trackId: comment.trackId,
    versionId: comment.versionId,
    commentId,
  })

  return NextResponse.json({ voted: true, count, xpAward })
}
