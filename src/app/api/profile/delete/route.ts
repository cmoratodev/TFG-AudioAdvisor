import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin, TRACKS_BUCKET } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-server'

export const runtime = 'nodejs'

/**
 * Borrado de cuenta (RGPD art. 17). Requiere contraseña en el cuerpo.
 * Prisma elimina en cascada todos los registros del usuario; los archivos
 * en Storage se intentan borrar tras el list.
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

  // Listado de archivos del usuario antes del DELETE en BD.
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
