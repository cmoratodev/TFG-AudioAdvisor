'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  /** We never differentiate "email exists" vs "email doesn't" to avoid the
   *  enumeration leak — the success card just says "if it's on file, we've
   *  sent you a link". */
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle="Te enviamos un enlace para restablecerla."
      footer={
        <>
          ¿Recuerdas tu contraseña?{' '}
          <Link href="/signin" className="font-semibold text-zinc-950 hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-3 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center">
            <MailCheck size={22} />
          </div>
          <h2 className="font-semibold text-zinc-950">Revisa tu correo</h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Si <strong>{email}</strong> está en nuestra base, te hemos enviado un enlace para
            restablecer la contraseña. El enlace caduca en 30 minutos.
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false)
              setEmail('')
            }}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-950 underline"
          >
            Enviar a otra dirección
          </button>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-zinc-950 text-white font-medium hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
