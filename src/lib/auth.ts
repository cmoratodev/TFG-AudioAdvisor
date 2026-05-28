import type { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'

export const authOptions: AuthOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/signin',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })
        if (!user || !user.password) return null

        const ok = await bcrypt.compare(credentials.password, user.password)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // First sign-in: persist the user id in the JWT.
      if (user) {
        token.id = user.id
      }
      // On every JWT use (or explicit update()), refresh xp/level from DB so the
      // session reflects gamification changes without forcing the user to sign
      // out and back in. Wrapped in try/catch so a transient DB failure can't
      // break the entire sign-in flow.
      if (token.id) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { xp: true, level: true },
          })
          if (fresh) {
            token.xp = fresh.xp
            token.level = fresh.level
          }
        } catch (err) {
          console.error('[auth] Failed to refresh xp/level in JWT:', err)
        }
      }
      void trigger
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id as string
        if (typeof token.xp === 'number') session.user.xp = token.xp
        if (token.level) session.user.level = token.level
      }
      return session
    },
  },
}
