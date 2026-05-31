'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react'
import { toast } from '@/store/useToastStore'

/**
 * Account-deletion controls rendered at the bottom of the owner's own
 * profile. Two-step UX:
 *
 *   1. A red panel sits at the bottom of the page (always visible to the
 *      owner, but understated — easy to ignore).
 *   2. Clicking "Borrar mi cuenta" pops a confirmation modal that asks for
 *      the password to make sure the destructive action was intentional.
 *
 * On success the user is signed out (NextAuth) and bounced to the home
 * page — by then the account row no longer exists in the DB anyway, so the
 * session JWT becomes inert on its next refresh too.
 */
export function DangerZone() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/profile/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'No se pudo borrar la cuenta.')
        return
      }
      toast.success('Cuenta eliminada')
      // Sign out + redirect. signOut already clears the session cookie.
      await signOut({ redirect: false })
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="bg-red-50 border border-red-200 rounded-xl p-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-100 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-red-950 mb-1">Zona de peligro</h2>
          <p className="text-sm text-red-900/80 mb-4 leading-relaxed">
            Borrar tu cuenta eliminará permanentemente tus pistas, comentarios, votos y
            notificaciones. Esta acción no se puede deshacer.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-white border border-red-300 hover:bg-red-700 hover:border-red-700 px-4 py-2 rounded-full transition-colors"
          >
            <Trash2 size={14} />
            Borrar mi cuenta
          </button>
        </div>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
        >
          <div
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => !submitting && setOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-zinc-200 p-6 animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              disabled={submitting}
              className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-950 transition-colors p-1 disabled:opacity-50"
            >
              <X size={16} />
            </button>

            <h2 id="delete-account-title" className="text-xl font-bold tracking-tight mb-1">
              ¿Borrar tu cuenta?
            </h2>
            <p className="text-sm text-zinc-600 mb-5 leading-relaxed">
              Esta acción es <strong>irreversible</strong>. Confirma con tu contraseña para
              continuar.
            </p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label
                  htmlFor="delete-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5"
                >
                  Contraseña
                </label>
                <input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="text-xs text-red-600 font-medium px-3 py-2 bg-red-50 border border-red-200 rounded-lg"
                >
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="px-4 h-10 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !password}
                  className="px-5 h-10 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? 'Borrando…' : 'Sí, borrar mi cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
