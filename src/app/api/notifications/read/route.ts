import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-server'

export const runtime = 'nodejs'

/**
 * Mark notifications as read. Two modes:
 *
 *   - `{ all: true }` — clears the badge by marking every unread row for the
 *     current user. Bound to the "Marcar todas como leídas" header button.
 *   - `{ ids: ["..."] }` — used when the user clicks a single row, so only
 *     that one drops out of the unread set.
 *
 * Always scoped to the current user via `recipientId` — a malicious payload
 * with someone else's IDs is a no-op.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
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

  const { all, ids } = body as { all?: unknown; ids?: unknown }
  const now = new Date()

  if (all === true) {
    const { count } = await prisma.notification.updateMany({
      where: { recipientId: user.id, readAt: null },
      data: { readAt: now },
    })
    return NextResponse.json({ updated: count })
  }

  if (Array.isArray(ids) && ids.every((x) => typeof x === 'string')) {
    const { count } = await prisma.notification.updateMany({
      where: { recipientId: user.id, id: { in: ids as string[] }, readAt: null },
      data: { readAt: now },
    })
    return NextResponse.json({ updated: count })
  }

  return NextResponse.json(
    { error: 'Indica `all: true` o `ids: string[]`.' },
    { status: 400 },
  )
}
