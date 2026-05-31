'use client'

import { CheckCircle2, AlertOctagon, Info, X } from 'lucide-react'
import { useToastStore, type ToastVariant } from '@/store/useToastStore'

/**
 * Renders the stack of active toasts. Mounted once in the root layout so
 * any component anywhere can `toast.success('...')` and the toast appears.
 *
 * Positioning: fixed bottom-right, but with extra bottom padding to clear
 * the global AudioPlayer (96 px) when a track is playing. We don't bother
 * detecting the player's presence at runtime — the gap is small enough
 * either way.
 */

const VARIANT_STYLES: Record<
  ToastVariant,
  { ring: string; icon: typeof CheckCircle2; iconColor: string }
> = {
  success: {
    ring: 'ring-emerald-500/40',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
  },
  error: {
    ring: 'ring-red-500/40',
    icon: AlertOctagon,
    iconColor: 'text-red-500',
  },
  info: {
    ring: 'ring-violet-500/40',
    icon: Info,
    iconColor: 'text-violet-500',
  },
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Notificaciones"
      className="fixed bottom-28 right-4 sm:right-6 z-[60] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const styles = VARIANT_STYLES[t.variant]
        const Icon = styles.icon
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto w-[320px] max-w-[calc(100vw-2rem)] bg-white border border-zinc-200 rounded-xl shadow-lg ring-1 ${styles.ring} px-4 py-3 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2`}
          >
            <Icon size={18} className={`shrink-0 mt-0.5 ${styles.iconColor}`} aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-950">{t.title}</p>
              {t.description && (
                <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar notificación"
              className="text-zinc-400 hover:text-zinc-950 shrink-0 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
