import 'server-only'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

/**
 * One-shot tokens for email verification and password reset.
 *
 * We reuse the NextAuth-shipped `VerificationToken` table for both purposes,
 * partitioning by a prefix on the `identifier` column:
 *   - "verify:<email>" → account email confirmation
 *   - "reset:<email>"  → password reset request
 *
 * Why one table: it already exists in the schema (no migration needed) and
 * its `@@unique([identifier, token])` index covers our access pattern. The
 * downside is leaking shape across two flows; the prefix keeps them clearly
 * separated and `consumeToken()` enforces the type on read.
 */

export type TokenPurpose = 'verify' | 'reset'

const PURPOSE_TTL_MINUTES: Record<TokenPurpose, number> = {
  // Generous: someone might click the email a day later.
  verify: 60 * 24,
  // Tight: a password-reset link is a credential — short-lived on purpose.
  reset: 30,
}

function identifierFor(purpose: TokenPurpose, email: string): string {
  return `${purpose}:${email.toLowerCase()}`
}

function generateOpaqueToken(): string {
  // 32 random bytes → 64-char hex. Far more entropy than NextAuth's defaults
  // and URL-safe without further encoding.
  return randomBytes(32).toString('hex')
}

export interface IssuedToken {
  token: string
  expires: Date
  ttlMinutes: number
}

/**
 * Create + persist a new token for the given email + purpose. Any previous
 * unused tokens for the same (purpose, email) pair are wiped so a fresh
 * request always invalidates the older link.
 */
export async function issueToken(
  purpose: TokenPurpose,
  email: string,
): Promise<IssuedToken> {
  const identifier = identifierFor(purpose, email)
  await prisma.verificationToken.deleteMany({ where: { identifier } })

  const ttlMinutes = PURPOSE_TTL_MINUTES[purpose]
  const token = generateOpaqueToken()
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000)

  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  })

  return { token, expires, ttlMinutes }
}

/**
 * Validate + consume a token. Returns the email it was issued for, or
 * `null` if the token is unknown, of the wrong purpose, or expired.
 *
 * Token is deleted on success — links are single-use. Expired tokens are
 * also cleaned up so the table doesn't grow forever.
 */
export async function consumeToken(
  purpose: TokenPurpose,
  token: string,
): Promise<string | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token } })
  if (!row) return null
  if (row.expires.getTime() < Date.now()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
    return null
  }
  if (!row.identifier.startsWith(`${purpose}:`)) return null

  const email = row.identifier.slice(purpose.length + 1)
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
  return email
}
