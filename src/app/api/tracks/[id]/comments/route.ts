import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-server'
import { awardXp } from '@/lib/xp'
import { createNotification } from '@/lib/notifications'

interface RouteContext {
  params: Promise<{ id: string }>
}

const MAX_CONTENT_LENGTH = 1000

export async function POST(req: Request, context: RouteContext) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id: trackId } = await context.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 })
  }
  const { content, timestamp, parentId, versionId: rawVersionId } = body as Record<string, unknown>

  if (typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'El contenido no puede estar vacío.' }, { status: 400 })
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `El comentario es demasiado largo (máx. ${MAX_CONTENT_LENGTH}).` },
      { status: 400 },
    )
  }

  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: { id: true, duration: true, authorId: true },
  })
  if (!track) {
    return NextResponse.json({ error: 'Pista no encontrada.' }, { status: 404 })
  }

  // Resolve the target version. If the client didn't specify, use the latest.
  let targetVersion: { id: string; duration: number } | null
  if (typeof rawVersionId === 'string' && rawVersionId.length > 0) {
    targetVersion = await prisma.trackVersion.findFirst({
      where: { id: rawVersionId, trackId },
      select: { id: true, duration: true },
    })
    if (!targetVersion) {
      return NextResponse.json(
        { error: 'La versión indicada no pertenece a esta pista.' },
        { status: 400 },
      )
    }
  } else {
    targetVersion = await prisma.trackVersion.findFirst({
      where: { trackId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, duration: true },
    })
    if (!targetVersion) {
      return NextResponse.json(
        { error: 'La pista no tiene versiones disponibles.' },
        { status: 500 },
      )
    }
  }

  let finalTimestamp: number
  let finalParentId: string | null = null
  let parentAuthorId: string | null = null

  if (parentId !== undefined && parentId !== null) {
    if (typeof parentId !== 'string') {
      return NextResponse.json({ error: 'parentId inválido.' }, { status: 400 })
    }
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        trackId: true,
        versionId: true,
        parentId: true,
        timestamp: true,
        authorId: true,
      },
    })
    if (!parent) {
      return NextResponse.json({ error: 'Comentario padre no encontrado.' }, { status: 404 })
    }
    if (parent.trackId !== trackId) {
      return NextResponse.json(
        { error: 'El comentario padre pertenece a otra pista.' },
        { status: 400 },
      )
    }
    if (parent.parentId !== null) {
      return NextResponse.json(
        { error: 'No se permite responder a una respuesta.' },
        { status: 400 },
      )
    }
    // Replies always live on the same version as their parent — keep the
    // conversation co-located with the audio it discusses.
    targetVersion = await prisma.trackVersion.findUnique({
      where: { id: parent.versionId },
      select: { id: true, duration: true },
    })
    if (!targetVersion) {
      return NextResponse.json({ error: 'Versión del padre no encontrada.' }, { status: 500 })
    }
    finalParentId = parent.id
    parentAuthorId = parent.authorId
    finalTimestamp = parent.timestamp
  } else {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp < 0) {
      return NextResponse.json({ error: 'Timestamp inválido.' }, { status: 400 })
    }
    if (timestamp > targetVersion.duration) {
      return NextResponse.json(
        { error: 'El timestamp está fuera de la duración de la versión.' },
        { status: 400 },
      )
    }
    finalTimestamp = timestamp
  }

  const comment = await prisma.comment.create({
    data: {
      content: content.trim(),
      timestamp: finalTimestamp,
      trackId,
      versionId: targetVersion.id,
      authorId: user.id,
      parentId: finalParentId,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  })

  const xpAward = await awardXp(user.id, 'comment:create')

  // Notifications: replies notify the parent author; top-level comments
  // notify the track producer. `createNotification` already skips
  // self-notifications, so no extra guard needed here.
  if (finalParentId && parentAuthorId) {
    await createNotification({
      recipientId: parentAuthorId,
      actorId: user.id,
      kind: 'reply',
      trackId,
      versionId: targetVersion.id,
      commentId: comment.id,
    })
  } else {
    await createNotification({
      recipientId: track.authorId,
      actorId: user.id,
      kind: 'comment',
      trackId,
      versionId: targetVersion.id,
      commentId: comment.id,
    })
  }

  return NextResponse.json({ comment, xpAward }, { status: 201 })
}
