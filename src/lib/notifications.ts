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
 * Persiste una notificación. Ignora auto-notificaciones y captura errores
 * para no romper la acción que la disparó (comentario, voto, etc.). La
 * entrega en tiempo real la gestiona Supabase Realtime sobre el INSERT.
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
