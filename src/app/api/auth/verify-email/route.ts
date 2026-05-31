import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumeToken } from '@/lib/auth-tokens'

export const runtime = 'nodejs'

/**
 * Confirm an account from the link in the verification email.
 *
 * Plays nicely with both link clicks (`GET` from the email client) and
 * page-side calls (`POST` from a one-shot effect). Both branches share
 * `verify()`. The GET branch redirects to a friendly landing page so the
 * user lands somewhere meaningful instead of staring at raw JSON.
 */

async function verify(token: string): Promise<'ok' | 'invalid' | 'no-user'> {
  const email = await consumeToken('verify', token)
  if (!email) return 'invalid'

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  })
  if (!user) return 'no-user'

  // Idempotent: a second click after a successful verification is fine.
  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    })
  }
  return 'ok'
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''
  const result = await verify(token)
  // Bounce back to a status page that handles the three outcomes — the
  // email client is not a great UX surface for richer messaging.
  const redirect = new URL('/verify-email', url.origin)
  redirect.searchParams.set('status', result)
  return NextResponse.redirect(redirect, 302)
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  const token = (body as { token?: unknown })?.token
  if (typeof token !== 'string') {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
  }
  const result = await verify(token)
  if (result !== 'ok') {
    return NextResponse.json(
      { error: 'El enlace ha caducado o no es válido.' },
      { status: 400 },
    )
  }
  return NextResponse.json({ ok: true })
}
