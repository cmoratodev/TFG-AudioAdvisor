-- Enable Supabase Realtime on Notification so the bell can subscribe to
-- inserts without polling.
--
-- The app uses NextAuth (not Supabase Auth), so `auth.uid()` on the
-- realtime channel is always NULL. That means RLS-based per-user gating
-- isn't possible: we open SELECT to all and the client filters by
-- `recipient_id=eq.<viewerId>`. Notifications carry only IDs (no comment
-- text, no email, no PII) — the actual content is fetched via authenticated
-- API routes — so the worst case from a leak is "user X received some
-- notification of kind Y", which is acceptable for this TFG.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'Notification'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Notification";
  END IF;
END $$;

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notification_select_public" ON "Notification";
CREATE POLICY "Notification_select_public" ON "Notification" FOR SELECT USING (true);
