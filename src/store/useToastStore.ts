import { create } from 'zustand'

/** Cola global de toasts gestionada por Zustand. */

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  /** Tiempo en ms hasta auto-cierre. 0 = persistente hasta cierre manual. */
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

/** Atajos invocables fuera de componentes React. */
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
