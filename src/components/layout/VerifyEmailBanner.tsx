'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { MailWarning, X, Loader2, CheckCircle2 } from 'lucide-react'

/**
 * Soft-verification banner.
 *
 *   - Only rendered for authenticated users whose `emailVerified` is false.
 *   - Dismissible per browser session (state, not localStorage — the next
 *     navigation brings it back, which is fine: we want occasional nudges
 *     without being annoying within a single session).
 *   - Hidden on the auth routes (signin/signup/forgot/reset/verify pages)
 *     and the dedicated email-verification landing so we don't double up.
 */
const HIDDEN_ROUTES = [
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

export function VerifyEmailBanner() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  if (status !== 'authenticated') return null
  if (session?.user?.emailVerified) return null
  if (dismissed) return null
  if (pathname && HIDDEN_ROUTES.includes(pathname)) return null

  const onResend = async () => {
    if (resending || resent) return
    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
      if (res.ok) setResent(true)
    } finally {
      setResending(false)
    }
  }

  return (
    <div
      role="status"
      className="bg-amber-50 border-b border-amber-200 text-amber-900"
    >
      <div className="container mx-auto max-w-6xl px-4 sm:px-8 py-2.5 flex items-center gap-3 text-sm">
        <MailWarning size={16} className="shrink-0" aria-hidden />
        <p className="flex-1 min-w-0">
          <span className="font-semibold">Confirma tu correo</span>{' '}
          <span className="text-amber-800/80">
            para evitar perder el acceso a tu cuenta. Hemos enviado un enlace a {session.user.email}.
          </span>
        </p>
        {resent ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold shrink-0">
            <CheckCircle2 size={14} />
            Reenviado
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void onResend()}
            disabled={resending}
            className="inline-flex items-center gap-1 text-xs font-semibold underline hover:no-underline disabled:opacity-60 shrink-0"
          >
            {resending && <Loader2 size={12} className="animate-spin" />}
            {resending ? 'Reenviando…' : 'Reenviar correo'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso"
          className="text-amber-700 hover:text-amber-900 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
