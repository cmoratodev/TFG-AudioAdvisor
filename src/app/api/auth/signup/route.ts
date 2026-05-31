import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { issueToken } from '@/lib/auth-tokens'
import { appBaseUrl, sendEmail } from '@/lib/email'
import { VerifyEmail } from '@/emails/VerifyEmail'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 })
  }

  const { name, email, password } = body as Record<string, unknown>

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 8 caracteres.' },
      { status: 400 },
    )
  }
  if (name !== undefined && (typeof name !== 'string' || name.length > 80)) {
    return NextResponse.json({ error: 'Nombre inválido.' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json(
      { error: 'Ya existe una cuenta con ese email.' },
      { status: 409 },
    )
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: typeof name === 'string' ? name.trim() : null,
      password: hash,
    },
    select: { id: true, email: true, name: true },
  })

  // Fire-and-forget the verification email. We deliberately don't await:
  //  - The new user shouldn't be left staring at the signup form while
  //    SMTP roundtrips.
  //  - A Resend hiccup must not block account creation; the user can
  //    request a resend from the in-app banner.
  void (async () => {
    try {
      const { token } = await issueToken('verify', normalizedEmail)
      const verifyUrl = `${appBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`
      await sendEmail({
        to: normalizedEmail,
        subject: 'Confirma tu cuenta — Audio Advisor',
        template: VerifyEmail({
          name: user.name ?? normalizedEmail.split('@')[0],
          verifyUrl,
        }),
      })
    } catch (err) {
      console.error('[signup] verification email failed:', err)
    }
  })()

  return NextResponse.json({ user }, { status: 201 })
}
