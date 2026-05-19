-- ================================================================
-- PUNCHLIST — PHASE 4 LIFECYCLE MIGRATION
-- Scheduling & Notifications
--
-- Run this in Supabase SQL Editor after deploying Phase 4.
-- Safe to run multiple times (idempotent).
-- ================================================================

-- ── 4A: Notifications table ──
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'general',
  title      text NOT NULL DEFAULT '',
  body       text DEFAULT '',
  read       boolean NOT NULL DEFAULT false,
  link       text,
  created_at timestamptz DEFAULT now()
);

-- Safe column additions for existing tables
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ── RLS ──
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role needs to insert notifications from API endpoints (public-quote-action, etc.)
-- The service role bypasses RLS by default, so no additional policy needed.

-- ── Enable Realtime for notifications table ──
-- This allows the client to subscribe to INSERT events for instant notification updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ── Force PostgREST schema cache reload ──
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- DONE.
-- 1. Wait 10 seconds for PostgREST cache to reload
-- 2. Deploy Phase 4 zip to Vercel
-- 3. UAT checklist:
--    [ ] Approve a quote as customer → check contractor bell icon for notification
--    [ ] Decline a quote → verify notification appears
--    [ ] Ask a question on public quote → verify notification appears
--    [ ] Schedule a job → customer receives automated email (not mailto)
--    [ ] Reschedule a job → customer receives reschedule email automatically
--    [ ] Cancel a job → customer receives cancellation email automatically
--    [ ] Schedule two overlapping jobs → conflict warning appears
--    [ ] Click "Add to calendar" on booking → .ics file downloads
--    [ ] Send a quote, wait → check follow-up card for smart advice
--    [ ] Mark all notifications read → badge disappears
-- ================================================================
