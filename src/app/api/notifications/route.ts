import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-server'

export const runtime = 'nodejs'

/** Devuelve las últimas N notificaciones + contador de no leídas. */
const PAGE_SIZE = 20

export async function GET() {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      select: {
        id: true,
        kind: true,
        trackId: true,
        versionId: true,
        commentId: true,
        readAt: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true, level: true } },
      },
    }),
    prisma.notification.count({
      where: { recipientId: user.id, readAt: null },
    }),
  ])

  // Carga los títulos de las pistas referenciadas en una sola consulta.
  const trackIds = Array.from(
    new Set(items.map((n) => n.trackId).filter((id): id is string => Boolean(id))),
  )
  const tracks = trackIds.length
    ? await prisma.track.findMany({
        where: { id: { in: trackIds } },
        select: { id: true, title: true },
      })
    : []
  const titleById = new Map(tracks.map((t) => [t.id, t.title]))

  const notifications = items.map((n) => ({
    id: n.id,
    kind: n.kind,
    trackId: n.trackId,
    trackTitle: n.trackId ? (titleById.get(n.trackId) ?? null) : null,
    versionId: n.versionId,
    commentId: n.commentId,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    actor: {
      id: n.actor.id,
      name: n.actor.name ?? n.actor.email?.split('@')[0] ?? 'Usuario',
      level: n.actor.level,
    },
  }))

  return NextResponse.json({ notifications, unreadCount })
}
