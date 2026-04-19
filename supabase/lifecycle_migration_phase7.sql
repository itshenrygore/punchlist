-- ================================================================
-- PUNCHLIST — PHASE 7 LIFECYCLE MIGRATION
-- Mobile, Performance & Integrations
--
-- Run this in Supabase SQL Editor after deploying Phase 7.
-- Safe to run multiple times (idempotent).
-- ================================================================

-- ── 7B: Push notification subscription storage ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_subscription jsonb;

-- ── 7E: Daily digest preferences ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz;

-- ── Force PostgREST schema cache reload ──
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- DONE.
-- 1. Wait 10 seconds for PostgREST cache to reload
-- 2. Deploy Phase 7 zip to Vercel
-- 3. UAT checklist:
--    [ ] Visit punchlist.ca on mobile → "Add to Home Screen" prompt appears
--    [ ] Open from home screen → standalone app experience
--    [ ] Enable push notifications in Settings → verify toggle works
--    [ ] Go to Settings → toggle daily digest on → save
--    [ ] Export all data → verify 4 CSV files download
--    [ ] Export QuickBooks CSV → verify format
--    [ ] Export Xero CSV → verify format
--    [ ] On quote detail, tap Share → native share sheet opens (mobile)
--    [ ] Turn off internet → offline indicator shows in header
--    [ ] Turn internet back on → indicator disappears
--    [ ] Delete account flow → double confirmation required
-- ================================================================
