import { create } from 'zustand'

/**
 * Lightweight toast system — no extra deps. Each `push()` adds a toast to a
 * Zustand-managed queue, schedules its own dismissal, and the global
 * `<ToastViewport />` (mounted from the root layout) renders the queue.
 *
 * Why home-grown instead of `sonner` / `react-hot-toast`: we only need three
 * variants (success / error / info), no positioning gymnastics, and we
 * already have Zustand installed for the player. Total cost: ~40 lines.
 */

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  variant: ToastVariant
  title: string
  /** Optional secondary line under the title. */
  description?: string
  /** Auto-dismiss delay in ms. `0` keeps it open until the user closes it. */
  durationMs: number
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => void
  dismiss: (id: string) => void
  clear: () => void
}

const DEFAULT_DURATION_MS = 4_000

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: ({ durationMs, ...rest }) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    const duration = durationMs ?? DEFAULT_DURATION_MS
    set((s) => ({ toasts: [...s.toasts, { id, durationMs: duration, ...rest }] }))
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration)
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

/**
 * Convenience callable wrappers so callers can write
 *   `toast.success('Pista publicada')`
 * without grabbing the store hook every time. The hook is only needed
 * inside React components when you also want to *read* toast state.
 */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore
      .getState()
      .push({ variant: 'error', title, description, durationMs: 6_000 }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: 'info', title, description }),
}
