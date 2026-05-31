import type { ReactNode } from 'react'
import Link from 'next/link'

interface Props {
  title: string
  description?: string
  /** Optional CTA — internal route (Next `<Link>`) or external (anchor). */
  action?: {
    label: string
    href: string
    variant?: 'primary' | 'secondary'
  }
  /** Second-row note shown smaller below the description (e.g. "or browse →"). */
  secondaryAction?: {
    label: string
    href: string
  }
  /** Override the visual on the left. Defaults to the brand waveform SVG. */
  visual?: ReactNode
}

/**
 * Reusable "nothing here yet" state for empty lists, missing filters, fresh
 * accounts, etc. The default visual is a small SVG of vertical bars echoing
 * the waveform motif used in the auth panel and the 3D Hero — so a blank
 * page still feels like part of the product.
 */
export function EmptyState({ title, description, action, secondaryAction, visual }: Props) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="mb-6 text-violet-400" aria-hidden>
        {visual ?? <WaveformIllustration />}
      </div>
      <h3 className="font-bold text-lg text-zinc-950 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-zinc-500 leading-relaxed max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className={
            action.variant === 'secondary'
              ? 'inline-flex items-center gap-2 bg-white text-zinc-950 border border-zinc-200 px-5 py-2 rounded-full text-sm font-semibold hover:border-zinc-950 transition-colors'
              : 'inline-flex items-center gap-2 bg-zinc-950 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-zinc-800 transition-colors'
          }
        >
          {action.label}
        </Link>
      )}
      {secondaryAction && (
        <Link
          href={secondaryAction.href}
          className="mt-3 text-xs font-medium text-zinc-500 hover:text-zinc-950 underline transition-colors"
        >
          {secondaryAction.label}
        </Link>
      )}
    </div>
  )
}

/**
 * Decorative waveform built with SVG (16 vertical bars, deterministic
 * heights so SSR and client renders match). Plenty large to anchor a page,
 * not so large that it competes with the message.
 */
function WaveformIllustration() {
  const bars = [22, 38, 30, 60, 48, 76, 56, 80, 58, 72, 44, 64, 36, 52, 28, 18]
  return (
    <svg
      width="140"
      height="86"
      viewBox="0 0 140 86"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ilustración de onda de audio"
    >
      {bars.map((h, i) => {
        const x = 4 + i * 8
        const y = (86 - h) / 2
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="4"
            height={h}
            rx="1.5"
            fill="currentColor"
            opacity={0.25 + (h / 80) * 0.55}
          />
        )
      })}
    </svg>
  )
}
