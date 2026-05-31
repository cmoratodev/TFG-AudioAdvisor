import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { consumeToken } from '@/lib/auth-tokens'

export const runtime = 'nodejs'

const MIN_PASSWORD_LENGTH = 8

/**
 * Finish the password-reset flow.
 *
 * Validates the token + new password, hashes with bcrypt (same cost as
 * signup so a re-hashed user keeps the same security profile), and clears
 * any other live reset tokens for the same account so an attacker who
 * snooped a parallel email can't replay them.
 */
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
  const { token, password } = body as { token?: unknown; password?: unknown }
  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
      { status: 400 },
    )
  }

  const email = await consumeToken('reset', token)
  if (!email) {
    return NextResponse.json(
      { error: 'El enlace ha caducado o ya se ha usado. Solicita uno nuevo.' },
      { status: 400 },
    )
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: passwordHash },
  })

  // Sweep any other reset tokens issued for this email so previous emails
  // become inert immediately.
  await prisma.verificationToken
    .deleteMany({ where: { identifier: `reset:${email}` } })
    .catch(() => {})

  return NextResponse.json({ ok: true })
}
