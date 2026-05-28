import { prisma } from '@/lib/prisma'
import type { NotificationKind } from '@prisma/client'

interface CreateNotificationInput {
  recipientId: string
  actorId: string
  kind: NotificationKind
  trackId?: string | null
  versionId?: string | null
  commentId?: string | null
}

/**
 * Persists a Notification, defensively skipping self-notifications and
 * swallowing errors so a logging hiccup never causes the user-visible action
 * (comment, vote) to fail. Realtime delivery is handled by Supabase: the
 * inserted row triggers the bell to refresh.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (input.recipientId === input.actorId) return
  try {
    await prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        actorId: input.actorId,
        kind: input.kind,
        trackId: input.trackId ?? null,
        versionId: input.versionId ?? null,
        commentId: input.commentId ?? null,
      },
    })
  } catch (err) {
    console.error('[notifications] create failed:', err)
  }
}
