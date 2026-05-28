-- Phase 5: enable Supabase Realtime on Comment and Vote so the frontend can
-- subscribe to live changes (new comments, useful votes) without polling.
--
-- Realtime requires:
--   1) the table to be part of the `supabase_realtime` publication
--   2) an RLS policy that allows the `anon` / `authenticated` role to SELECT
--      the rows (Supabase checks RLS *before* streaming change events)
--
-- We open SELECT to all roles because comments and votes are public data
-- (visible on the track page to any visitor). Writes are still gated by our
-- API routes, which use the service_role and validate the NextAuth session.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'Comment'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Comment";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'Vote'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Vote";
  END IF;
END $$;

-- Public SELECT policies. Idempotent: drop+create.
DROP POLICY IF EXISTS "Comment_select_public" ON "Comment";
CREATE POLICY "Comment_select_public" ON "Comment" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Vote_select_public" ON "Vote";
CREATE POLICY "Vote_select_public" ON "Vote" FOR SELECT USING (true);
