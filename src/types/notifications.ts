import type { NotificationKind, UserLevel } from '@prisma/client'

export interface NotificationEntry {
  id: string
  kind: NotificationKind
  trackId: string | null
  trackTitle: string | null
  versionId: string | null
  commentId: string | null
  readAt: string | null
  createdAt: string
  actor: {
    id: string
    name: string
    level: UserLevel
  }
}
