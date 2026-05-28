import 'server-only'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Returns the current session on the server side, or null.
 * Use in Server Components and Route Handlers.
 */
export async function getSession() {
  return getServerSession(authOptions)
}

/**
 * Returns the current authenticated user (id + email + name) or null.
 */
export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}
