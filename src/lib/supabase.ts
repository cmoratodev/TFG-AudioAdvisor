import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

declare global {
  var supabaseAdminGlobal: SupabaseClient | undefined
}

export const TRACKS_BUCKET = 'tracks'

function buildAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase env vars. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
    )
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const supabaseAdmin: SupabaseClient =
  globalThis.supabaseAdminGlobal ?? buildAdminClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.supabaseAdminGlobal = supabaseAdmin
}

/**
 * Build the public URL for a stored file. Cached client-side by the CDN.
 */
export function publicAudioUrl(storagePath: string): string {
  const { data } = supabaseAdmin.storage.from(TRACKS_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}
