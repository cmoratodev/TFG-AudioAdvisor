import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-server'

export async function GET() {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const tracks = await prisma.track.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      genre: true,
      audioUrl: true,
      duration: true,
      createdAt: true,
      _count: { select: { comments: true } },
    },
  })

  return NextResponse.json({ tracks })
}
