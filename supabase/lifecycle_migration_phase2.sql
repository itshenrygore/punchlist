-- ================================================================
-- PUNCHLIST — PHASE 2 LIFECYCLE MIGRATION
-- Customer Experience Polish
--
-- Run this in Supabase SQL Editor after deploying Phase 2.
-- Safe to run multiple times (idempotent).
-- ================================================================

-- ── 2A: Terms & Conditions text on contractor profile ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_conditions text DEFAULT '';

-- ── 2B: Store which optional items the customer selected at approval ──
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS selected_optional_ids jsonb DEFAULT '[]'::jsonb;

-- ── 2C: Structured conversation thread (questions + contractor replies) ──
--   Replaces the old pattern of appending to internal_notes.
--   Schema: [{id, role, text, timestamp, name}, ...]
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS conversation jsonb DEFAULT '[]'::jsonb;

-- ── Force PostgREST schema cache reload ──
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- DONE.
-- 1. Wait 10 seconds for PostgREST cache to reload
-- 2. Deploy Phase 2 zip to Vercel
-- 3. UAT checklist:
--    [ ] Add T&C text in Settings → send a quote → as customer,
--        verify checkbox required before Sign button activates
--    [ ] Create quote with optional items → as customer, toggle some
--        on/off, sign → as contractor, verify selected_optional_ids
--        stored on quote row
--    [ ] As customer, ask a question → as contractor, reply from
--        quote detail → reload customer page, verify thread shows both
--    [ ] Schedule a job with a customer who has email → check inbox
--        for booking confirmation
--    [ ] Sign a quote as customer → verify "Download Signed Copy"
--        button appears and downloads PDF
-- ================================================================
