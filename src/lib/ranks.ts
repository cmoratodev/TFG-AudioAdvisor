import type { UserLevel } from '@prisma/client'

export interface RankTier {
  /** DB enum value */
  key: UserLevel
  /** Display name in Spanish */
  name: string
  /** XP threshold to reach this tier (inclusive lower bound) */
  minXp: number
  /** Single emoji used as visual icon */
  icon: string
  /** Brand color (Tailwind shade name) */
  color: string
  /** Pre-built Tailwind classes for a light-themed badge */
  classes: {
    bg: string
    text: string
    border: string
    ring: string
  }
}

// Order matters — sorted by minXp ascending.
export const RANK_TIERS: readonly RankTier[] = [
  {
    key: 'IRON',
    name: 'Hierro',
    minXp: 0,
    icon: '⚫',
    color: '#71717A',
    classes: {
      bg: 'bg-zinc-50',
      text: 'text-zinc-700',
      border: 'border-zinc-300',
      ring: 'ring-zinc-300/40',
    },
  },
  {
    key: 'BRONZE',
    name: 'Bronce',
    minXp: 100,
    icon: '🟫',
    color: '#A16207',
    classes: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-300',
      ring: 'ring-amber-300/40',
    },
  },
  {
    key: 'SILVER',
    name: 'Plata',
    minXp: 300,
    icon: '⬜',
    color: '#94A3B8',
    classes: {
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      border: 'border-slate-300',
      ring: 'ring-slate-300/40',
    },
  },
  {
    key: 'GOLD',
    name: 'Oro',
    minXp: 800,
    icon: '🟨',
    color: '#EAB308',
    classes: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
      border: 'border-yellow-300',
      ring: 'ring-yellow-300/40',
    },
  },
  {
    key: 'PLATINUM',
    name: 'Platino',
    minXp: 2_000,
    icon: '🔷',
    color: '#06B6D4',
    classes: {
      bg: 'bg-cyan-50',
      text: 'text-cyan-700',
      border: 'border-cyan-300',
      ring: 'ring-cyan-300/40',
    },
  },
  {
    key: 'DIAMOND',
    name: 'Diamante',
    minXp: 5_000,
    icon: '💎',
    color: '#A855F7',
    classes: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-300',
      ring: 'ring-purple-300/40',
    },
  },
  {
    key: 'LEGEND',
    name: 'Leyenda',
    minXp: 12_000,
    icon: '👑',
    color: '#EC4899',
    classes: {
      bg: 'bg-pink-50',
      text: 'text-pink-700',
      border: 'border-pink-300',
      ring: 'ring-pink-300/40',
    },
  },
] as const

const TIER_BY_KEY: Record<UserLevel, RankTier> = Object.fromEntries(
  RANK_TIERS.map((t) => [t.key, t]),
) as Record<UserLevel, RankTier>

export function tierFromKey(level: UserLevel): RankTier {
  return TIER_BY_KEY[level] ?? RANK_TIERS[0]
}

/** Compute the highest tier reached for a given XP. */
export function tierFromXp(xp: number): RankTier {
  const safeXp = Number.isFinite(xp) ? Math.max(0, xp) : 0
  let best = RANK_TIERS[0]
  for (const t of RANK_TIERS) {
    if (safeXp >= t.minXp) best = t
  }
  return best
}

export interface RankProgress {
  current: RankTier
  next: RankTier | null
  xp: number
  xpIntoTier: number
  xpForNext: number | null
  percent: number
}

/** Progress info usable in a progress bar (% to next tier). */
export function rankProgress(xp: number): RankProgress {
  const safeXp = Number.isFinite(xp) ? Math.max(0, xp) : 0
  const current = tierFromXp(safeXp)
  const idx = RANK_TIERS.findIndex((t) => t.key === current.key)
  const next = idx >= 0 && idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null

  const xpIntoTier = safeXp - current.minXp
  const xpForNext = next ? next.minXp - current.minXp : null
  const percent =
    next && xpForNext && xpForNext > 0 ? Math.min(100, Math.round((xpIntoTier / xpForNext) * 100)) : 100

  return { current, next, xp: safeXp, xpIntoTier, xpForNext, percent }
}
