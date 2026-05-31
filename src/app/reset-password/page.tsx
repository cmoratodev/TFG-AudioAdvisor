'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div
        role="alert"
        className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm text-sm text-zinc-700"
      >
        Falta el token de reseteo. Solicita un nuevo enlace desde{' '}
        <Link href="/forgot-password" className="font-semibold text-zinc-950 underline">
          Recuperar contraseña
        </Link>
        .
      </div>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'No se pudo restablecer la contraseña.')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/signin'), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-3 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
          <CheckCircle2 size={22} />
        </div>
        <h2 className="font-semibold text-zinc-950">Contraseña restablecida</h2>
        <p className="text-sm text-zinc-600">
          Te redirigimos a iniciar sesión en un momento…
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-4"
    >
      <div>
        <label
          htmlFor="password"
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5"
        >
          Nueva contraseña{' '}
          <span className="text-zinc-400 normal-case font-normal tracking-normal">
            (mín. 8 caracteres)
          </span>
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
        />
      </div>
      <div>
        <label
          htmlFor="confirm"
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5"
        >
          Confirma la contraseña
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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

      <button
        type="submit"
        disabled={loading}
        className="w-full h-10 rounded-lg bg-zinc-950 text-white font-medium hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? 'Guardando…' : 'Restablecer contraseña'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Nueva contraseña"
      subtitle="Elige una contraseña que recuerdes."
      footer={
        <>
          ¿Has terminado?{' '}
          <Link href="/signin" className="font-semibold text-zinc-950 hover:underline">
            Volver al inicio de sesión
          </Link>
        </>
      }
    >
      <Suspense
        fallback={
          <div className="h-64 bg-white border border-zinc-200 rounded-xl shadow-sm animate-pulse" />
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
