import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, TRACKS_BUCKET } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-server'

export const runtime = 'nodejs'

/**
 * Permanently delete the signed-in user's account.
 *
 * Right-to-be-forgotten endpoint (Art. 17 GDPR). Wipes everything tied to
 * the user:
 *   - DB: Prisma cascades through Track / Comment / Vote / Notification /
 *     Session / Account / TrackVersion via `onDelete: Cascade` in the
 *     schema, so a single `user.delete` covers the database side.
 *   - Storage: best-effort removal of every audio / cover / avatar file
 *     under the user's folder in the bucket. Failures are logged but the
 *     account deletion still proceeds — we'd rather leave orphan blobs
 *     than block a user from exercising their right.
 *
 * Requires password confirmation in the body. Trades a little UX friction
 * for protection against accidental clicks and CSRF-ish replays.
 */
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  const password = (body as { password?: unknown })?.password
  if (typeof password !== 'string' || password.length === 0) {
    return NextResponse.json(
      { error: 'Introduce tu contraseña para confirmar.' },
      { status: 400 },
    )
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, password: true },
  })
  if (!row || !row.password) {
    return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 })
  }

  const ok = await bcrypt.compare(password, row.password)
  if (!ok) {
    return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 })
  }

  // Storage cleanup BEFORE the DB delete so a failed list call surfaces
  // before we wipe the row. Supabase's `list()` is shallow — we paginate
  // through all subfolders (root, covers, avatar) to gather paths.
  const folders = [user.id, `${user.id}/covers`, `${user.id}/avatar`]
  const filesToDelete: string[] = []
  for (const folder of folders) {
    const { data, error } = await supabaseAdmin.storage
      .from(TRACKS_BUCKET)
      .list(folder, { limit: 1000 })
    if (error) {
      console.warn(`[delete-account] list ${folder} failed:`, error.message)
      continue
    }
    if (data) {
      for (const item of data) {
        // `list` returns folder entries as well — skip those (no metadata).
        if (item.id) filesToDelete.push(`${folder}/${item.name}`)
      }
    }
  }
  if (filesToDelete.length > 0) {
    const { error: rmError } = await supabaseAdmin.storage
      .from(TRACKS_BUCKET)
      .remove(filesToDelete)
    if (rmError) {
      console.warn('[delete-account] remove failed:', rmError.message)
    }
  }

  await prisma.user.delete({ where: { id: user.id } })

  return NextResponse.json({ ok: true })
}
