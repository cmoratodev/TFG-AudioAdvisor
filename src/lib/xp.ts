import 'server-only'
import { prisma } from '@/lib/prisma'
import { tierFromXp } from '@/lib/ranks'
import type { UserLevel } from '@prisma/client'

export type XpReason =
  | 'track:first-upload'
  | 'track:upload'
  | 'comment:create'
  | 'vote:useful-received'

export const XP_REWARDS: Record<XpReason, number> = {
  'track:first-upload': 50,
  'track:upload': 5,
  'comment:create': 1,
  'vote:useful-received': 25,
}

export interface AwardResult {
  xp: number
  level: UserLevel
  /** True if the user reached a new tier with this award. */
  leveledUp: boolean
  /** The award that was applied (0 if user did not exist). */
  awarded: number
}

/**
 * Adds XP to a user atomically and recomputes their `level` based on the new XP
 * total. Returns the updated state plus a `leveledUp` flag for UI feedback.
 */
export async function awardXp(userId: string, reason: XpReason): Promise<AwardResult | null> {
  const amount = XP_REWARDS[reason]
  if (!Number.isFinite(amount) || amount <= 0) return null

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true },
    })
    if (!user) return null

    const newXp = user.xp + amount
    const newTier = tierFromXp(newXp)
    const leveledUp = newTier.key !== user.level

    await tx.user.update({
      where: { id: userId },
      data: { xp: newXp, level: newTier.key },
    })

    return { xp: newXp, level: newTier.key, leveledUp, awarded: amount }
  })

  return result
}
