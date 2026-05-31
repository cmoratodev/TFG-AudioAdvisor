import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, XCircle, MailWarning } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'

export const metadata: Metadata = {
  title: 'Verificación de cuenta',
  description: 'Confirma tu correo electrónico para activar tu cuenta de Audio Advisor.',
}

/**
 * Landing page after the user clicks the verification link in their email.
 *
 * The link itself hits `GET /api/auth/verify-email?token=...` which does the
 * actual work and 302-redirects here with `?status=<ok|invalid|no-user>`.
 * Keeping the logic on the API route means we don't accidentally re-verify
 * on page refresh; this page is read-only state messaging.
 */
interface PageProps {
  searchParams: Promise<{ status?: string }>
}

const COPY = {
  ok: {
    icon: CheckCircle2,
    iconClass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    title: 'Cuenta verificada',
    body: 'Tu correo está confirmado. Ya puedes seguir usando la plataforma con normalidad.',
    cta: { href: '/explore', label: 'Ir a explorar' },
  },
  invalid: {
    icon: XCircle,
    iconClass: 'bg-red-50 border-red-200 text-red-700',
    title: 'Enlace no válido o caducado',
    body: 'Puede que ya hayas verificado, o que el enlace haya expirado (caducan a las 24h).',
    cta: { href: '/signin', label: 'Volver al inicio de sesión' },
  },
  'no-user': {
    icon: MailWarning,
    iconClass: 'bg-amber-50 border-amber-200 text-amber-700',
    title: 'Cuenta no encontrada',
    body: 'No encontramos una cuenta asociada a este enlace.',
    cta: { href: '/signup', label: 'Crear una cuenta' },
  },
} as const

type Status = keyof typeof COPY

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { status } = await searchParams
  const resolved: Status =
    status === 'ok' || status === 'invalid' || status === 'no-user' ? status : 'invalid'
  const copy = COPY[resolved]
  const Icon = copy.icon

  return (
    <AuthShell
      title="Verificación de cuenta"
      subtitle="Confirma tu correo para empezar."
      footer={
        <>
          ¿Necesitas ayuda?{' '}
          <Link href="/signin" className="font-semibold text-zinc-950 hover:underline">
            Volver al inicio
          </Link>
        </>
      }
    >
      <div className="bg-white border border-zinc-200 rounded-xl p-7 shadow-sm space-y-4 text-center">
        <div
          className={`w-14 h-14 mx-auto rounded-full border flex items-center justify-center ${copy.iconClass}`}
        >
          <Icon size={26} />
        </div>
        <h2 className="font-semibold text-zinc-950 text-lg">{copy.title}</h2>
        <p className="text-sm text-zinc-600 leading-relaxed">{copy.body}</p>
        <Link
          href={copy.cta.href}
          className="inline-block bg-zinc-950 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          {copy.cta.label}
        </Link>
      </div>
    </AuthShell>
  )
}
