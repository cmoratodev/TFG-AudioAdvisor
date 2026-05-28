import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-server'

export const runtime = 'nodejs'

/**
 * The bell pulls the latest 20 notifications + the total unread count for
 * the badge. We hydrate the actor (name/level) and the linked track title
 * here so the dropdown can render labels and CTAs without a second roundtrip
 * per row.
 */
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

  // Hydrate track titles in a single query. We don't include the comment
  // body — the link takes the user to the track page where it's rendered
  // anyway, and keeping the payload small matters when the bell is opened
  // dozens of times per session.
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
