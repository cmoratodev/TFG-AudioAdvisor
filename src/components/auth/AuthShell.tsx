import type { ReactNode } from 'react'
import { RANK_TIERS } from '@/lib/ranks'

interface Props {
  title: string
  subtitle: string
  /** The form itself (sign-in or sign-up). Rendered in the left column. */
  children: ReactNode
  /** Slot below the form (e.g. "Already have an account?" link). */
  footer: ReactNode
}

/**
 * Split-layout shell for the auth pages.
 *
 *  - Left column (always visible): the form, capped at a comfortable width.
 *  - Right column (md+ only): brand panel with the 7-tier rank parade and a
 *    decorative waveform built from pure CSS. Hidden on mobile so the form
 *    keeps the spotlight on small screens.
 *
 * The panel is purely decorative — no images, no JS — so it loads instantly
 * and never blocks form interactivity.
 */
export function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex">
      {/* Left: form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">{title}</h1>
            <p className="text-zinc-500 font-medium">{subtitle}</p>
          </div>
          {children}
          <div className="mt-6 text-center text-sm text-zinc-600">{footer}</div>
        </div>
      </div>

      {/* Right: brand panel — hidden on mobile.
       *
       * Treated as a rounded "card" that floats over the white form column
       * instead of a flat half-screen slab. The generous border-radius on
       * the left edge curves the panel inwards, and a soft shadow gives it
       * subtle elevation. The hard vertical seam is gone — what the eye
       * sees is a shape, not a cut.
       *
       * Background layers (no masking — solid surface):
       *   1) Vertical fade `zinc-900 → zinc-950` so the panel isn't a flat
       *      block of black.
       *   2) Two radial violet glows for brand accent + ambient lighting. */}
      <aside
        aria-hidden
        className="hidden md:flex flex-1 relative overflow-hidden text-white px-12 py-16 flex-col justify-between rounded-l-[3rem] shadow-[-20px_0_80px_-30px_rgba(0,0,0,0.25)]"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse 60% 50% at 35% 30%, rgba(124, 58, 237, 0.22), transparent 70%)',
            'radial-gradient(ellipse 50% 60% at 90% 95%, rgba(124, 58, 237, 0.08), transparent 70%)',
            'linear-gradient(to bottom, #18181b 0%, #09090b 100%)',
          ].join(', '),
        }}
      >
        <DecorativeWaveform />

        <div className="relative z-10">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-violet-300 mb-3">
            Audio Advisor
          </p>
          <h2 className="text-3xl font-bold tracking-tight leading-tight mb-3 max-w-md">
            Feedback técnico que <span className="text-violet-400">sube tu nivel</span>.
          </h2>
          <p className="text-zinc-400 max-w-sm leading-relaxed">
            Sube tus pistas, recibe comentarios anclados al segundo y desbloquea rangos al ayudar a
            otros productores.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 mb-4">
            Rangos competitivos
          </p>
          <ul className="flex flex-wrap gap-2">
            {RANK_TIERS.map((tier) => (
              <li
                key={tier.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tier.color }}
                  aria-hidden
                />
                {tier.name}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

/**
 * Pure-CSS decorative waveform. Each `span` is a vertical bar with a random-
 * looking height encoded via inline style. We use a small static array
 * (not Math.random) so the server and client renders stay deterministic and
 * React doesn't warn about hydration mismatch.
 */
function DecorativeWaveform() {
  const bars = WAVE_HEIGHTS
  return (
    <div
      className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none select-none"
      aria-hidden
    >
      <div className="flex items-end gap-[3px] h-3/5 w-full px-8">
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 bg-violet-400 rounded-sm"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}

// 80 alturas deterministas para la onda decorativa del panel.
const WAVE_HEIGHTS = [
  18, 32, 24, 56, 41, 68, 50, 72, 60, 82, 70, 64, 78, 55, 88, 72, 60, 92, 68, 80,
  56, 74, 62, 84, 50, 66, 78, 58, 72, 64, 80, 70, 62, 86, 54, 76, 68, 90, 74, 60,
  82, 56, 70, 64, 78, 50, 72, 84, 66, 88, 60, 76, 54, 80, 68, 92, 58, 70, 62, 82,
  56, 74, 66, 86, 48, 72, 60, 78, 64, 88, 56, 70, 52, 80, 66, 84, 58, 76, 50, 68,
]
