import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  var prismaGlobal: PrismaClient | undefined
}

function buildClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Check your .env.local file.')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma = globalThis.prismaGlobal ?? buildClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}
