import type { UserLevel } from '@prisma/client'
import { tierFromKey, tierFromXp, rankProgress } from '@/lib/ranks'
import { cn } from '@/lib/utils'

interface BaseProps {
  /** Visual size variant. */
  size?: 'xs' | 'sm' | 'md'
  /** Show the textual rank name. */
  showName?: boolean
  className?: string
}

type Props =
  | (BaseProps & { level: UserLevel; xp?: never })
  | (BaseProps & { xp: number; level?: never })

/**
 * Pill-shaped badge displaying a player's current rank.
 * Provide either `level` (UserLevel enum) or `xp` (the helper resolves the tier).
 */
export function RankBadge({ size = 'sm', showName = true, className, ...rest }: Props) {
  const tier = 'level' in rest && rest.level !== undefined ? tierFromKey(rest.level) : tierFromXp(rest.xp ?? 0)

  const sizing =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.5 gap-1'
      : size === 'md'
        ? 'text-sm px-2.5 py-1 gap-1.5'
        : 'text-xs px-2 py-0.5 gap-1'

  return (
    <span
      title={tier.name}
      className={cn(
        'inline-flex items-center rounded-full border bg-white font-semibold tracking-wide whitespace-nowrap',
        tier.classes.bg,
        tier.classes.text,
        tier.classes.border,
        sizing,
        className,
      )}
    >
      <span aria-hidden>{tier.icon}</span>
      {showName && <span>{tier.name}</span>}
    </span>
  )
}

interface RankProgressBarProps {
  xp: number
  className?: string
}

/** Slim progress bar showing how close the user is to the next tier. */
export function RankProgressBar({ xp, className }: RankProgressBarProps) {
  const progress = rankProgress(xp)

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1">
        <span>{progress.current.name.toUpperCase()}</span>
        {progress.next ? (
          <span>
            {progress.xp} / {progress.next.minXp} XP
          </span>
        ) : (
          <span>{progress.xp} XP · MAX</span>
        )}
      </div>
      <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progress.percent}%`,
            backgroundColor: (progress.next ?? progress.current).color,
          }}
        />
      </div>
    </div>
  )
}
