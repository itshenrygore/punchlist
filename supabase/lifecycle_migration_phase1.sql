-- ================================================================
-- PUNCHLIST — PHASE 1 LIFECYCLE MIGRATION
-- Quote-to-Cash Friction Removal
--
-- Run this in Supabase SQL Editor after deploying Phase 1.
-- Safe to run multiple times (idempotent).
-- ================================================================

-- ── Signature fields (may already exist from v42 migration) ──
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signature_data text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_name text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_ip text;

-- ── Approval / decline timestamps ──
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS declined_at timestamptz;

-- ── Archive support ──
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- ── Booking notify preference ──
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notify_customer boolean DEFAULT false;

-- ── Force PostgREST schema cache reload ──
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- DONE.
-- 1. Wait 10 seconds for PostgREST cache to reload
-- 2. Deploy Phase 1 zip to Vercel
-- 3. UAT checklist:
--    [ ] Review page → "Save & Send" → send modal opens → send → stays on page with green banner
--    [ ] Mark job complete → "Create invoice now?" modal appears
--    [ ] Customer signs quote → customer receives confirmation email (check inbox)
--    [ ] Public quote page signature → "Draw" and "Type" tabs both work
--    [ ] Build scope with vague input → catalog items auto-appear below AI results
--    [ ] Catalog search on build scope → searchable dropdown works
-- ================================================================
