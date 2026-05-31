import type { DefaultSession } from 'next-auth'
import type { UserLevel } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      xp: number
      level: UserLevel
      /** Whether the user has confirmed the email shipped with their account. */
      emailVerified: boolean
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    xp?: number
    level?: UserLevel
    emailVerified?: boolean
  }
}
