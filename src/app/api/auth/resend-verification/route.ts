import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-server'
import { issueToken } from '@/lib/auth-tokens'
import { appBaseUrl, sendEmail } from '@/lib/email'
import { VerifyEmail } from '@/emails/VerifyEmail'

export const runtime = 'nodejs'

/**
 * Re-issue the verification email for the currently signed-in user.
 *
 * Triggered from the "Reenviar correo" button in the unverified banner —
 * gated to the session because anonymous resends would be an open mail
 * spammer otherwise.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true, emailVerified: true },
  })
  if (!row) return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 })
  if (row.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true })
  }

  try {
    const { token } = await issueToken('verify', row.email)
    const verifyUrl = `${appBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`

    await sendEmail({
      to: row.email,
      subject: 'Confirma tu cuenta — Audio Advisor',
      template: VerifyEmail({
        name: row.name ?? row.email.split('@')[0],
        verifyUrl,
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Surface the real reason (Resend rejection, missing env var, render
    // crash) so the caller can show it instead of a generic 500.
    const message = err instanceof Error ? err.message : 'Error desconocido al enviar el correo.'
    console.error('[resend-verification] failed:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
