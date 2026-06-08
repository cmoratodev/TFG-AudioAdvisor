import 'server-only'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

/**
 * Tokens de un solo uso para verificación de email y reset de contraseña.
 * Se reutiliza la tabla `VerificationToken` de NextAuth, particionando por
 * prefijo en el campo identifier: "verify:<email>" y "reset:<email>".
 */

export type TokenPurpose = 'verify' | 'reset'

const PURPOSE_TTL_MINUTES: Record<TokenPurpose, number> = {
  // 24 h: el correo puede abrirse mucho después.
  verify: 60 * 24,
  // 30 min: enlace sensible, corto a propósito.
  reset: 30,
}

function identifierFor(purpose: TokenPurpose, email: string): string {
  return `${purpose}:${email.toLowerCase()}`
}

function generateOpaqueToken(): string {
  // 32 bytes aleatorios codificados como 64 caracteres hex (URL-safe).
  return randomBytes(32).toString('hex')
}

export interface IssuedToken {
  token: string
  expires: Date
  ttlMinutes: number
}

/**
 * Genera y persiste un token nuevo, invalidando los previos del mismo
 * (purpose, email) para que una nueva solicitud anule el enlace antiguo.
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
 * Valida y consume un token. Devuelve el email asociado o null si es
 * desconocido, expirado o no coincide con el purpose. Los tokens son
 * de un solo uso: se borran tanto en consumo exitoso como por expiración.
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
