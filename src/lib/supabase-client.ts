import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser-side Supabase client using the publishable (anon) key.
 *
 * This is used ONLY for Realtime subscriptions — never for writes, never for
 * reading user-private data. The anon key is exposed to the browser by
 * design; RLS policies on the database decide which rows it can read.
 *
 * Auth is disabled because the app uses NextAuth, not Supabase Auth. The
 * realtime connection therefore authenticates as the `anon` role, which has
 * SELECT permission on Comment and Vote via the policies in the
 * `20260527230000_realtime_policies` migration.
 */

declare global {
  var supabaseBrowserGlobal: SupabaseClient | undefined
}

function buildClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    )
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  })
}

// Memoize across HMR reloads to avoid opening multiple WebSocket connections
// when the dev server hot-reloads modules.
export const supabaseBrowser: SupabaseClient =
  globalThis.supabaseBrowserGlobal ?? buildClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.supabaseBrowserGlobal = supabaseBrowser
}
