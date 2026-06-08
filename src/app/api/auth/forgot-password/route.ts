import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { issueToken } from '@/lib/auth-tokens'
import { appBaseUrl, sendEmail } from '@/lib/email'
import { ResetPassword } from '@/emails/ResetPassword'

export const runtime = 'nodejs'

/**
 * Start a password-reset flow.
 *
 * Always returns 200 with the same shape regardless of whether the email
 * exists in our DB — this prevents the endpoint from being used as an
 * email-enumeration oracle. The mail itself only goes out if the user
 * actually exists.
 */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido.' }, { status: 400 })
  }
  const rawEmail = (body as { email?: unknown }).email
  if (typeof rawEmail !== 'string' || rawEmail.trim().length === 0) {
    return NextResponse.json({ ok: false, error: 'Falta el email.' }, { status: 400 })
  }
  const email = rawEmail.trim().toLowerCase()

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, password: true },
  })

  // Respuesta uniforme: se contesta lo mismo exista o no la cuenta para
  // no permitir enumeración. El envío sólo ocurre si ambas condiciones se
  // cumplen.
  if (user && user.password) {
    try {
      const { token, ttlMinutes } = await issueToken('reset', email)
      const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`
      await sendEmail({
        to: email,
        subject: 'Restablece tu contraseña — Audio Advisor',
        template: ResetPassword({
          name: user.name ?? email.split('@')[0],
          resetUrl,
          expiresInMinutes: ttlMinutes,
        }),
      })
    } catch (err) {
      // Se registra pero no se expone para evitar enumeración de cuentas.
      console.error('[forgot-password] email send failed:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
