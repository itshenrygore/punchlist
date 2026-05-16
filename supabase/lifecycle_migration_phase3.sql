-- ================================================================
-- PUNCHLIST — PHASE 3 LIFECYCLE MIGRATION
-- Amendment Workflow
--
-- Run this in Supabase SQL Editor after deploying Phase 3.
-- Safe to run multiple times (idempotent).
-- ================================================================

-- ── 3A: Amendments table ──
CREATE TABLE IF NOT EXISTS public.amendments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'Amendment',
  reason          text DEFAULT '',
  status          text NOT NULL DEFAULT 'draft',
  items           jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal        numeric(10,2) NOT NULL DEFAULT 0,
  tax             numeric(10,2) NOT NULL DEFAULT 0,
  total           numeric(10,2) NOT NULL DEFAULT 0,
  province        text DEFAULT 'ON',
  country         text DEFAULT 'CA',
  share_token     text NOT NULL DEFAULT gen_random_uuid()::text,
  signature_data  text,
  signed_at       timestamptz,
  signer_name     text,
  signer_ip       text,
  sent_at         timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Safe column additions for existing tables
ALTER TABLE public.amendments ADD COLUMN IF NOT EXISTS reason text DEFAULT '';
ALTER TABLE public.amendments ADD COLUMN IF NOT EXISTS province text DEFAULT 'ON';
ALTER TABLE public.amendments ADD COLUMN IF NOT EXISTS country text DEFAULT 'CA';
ALTER TABLE public.amendments ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.amendments ADD COLUMN IF NOT EXISTS signer_ip text;

-- ── Constraints ──
ALTER TABLE public.amendments DROP CONSTRAINT IF EXISTS amendments_status_check;
ALTER TABLE public.amendments ADD CONSTRAINT amendments_status_check
  CHECK (status IN ('draft','sent','viewed','approved','declined'));

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_amendments_quote_id ON public.amendments(quote_id);
CREATE INDEX IF NOT EXISTS idx_amendments_user_id ON public.amendments(user_id);
CREATE INDEX IF NOT EXISTS idx_amendments_status ON public.amendments(status);
CREATE INDEX IF NOT EXISTS idx_amendments_share_token ON public.amendments(share_token);

-- ── RLS ──
ALTER TABLE public.amendments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amendments_own" ON public.amendments;
CREATE POLICY "amendments_own" ON public.amendments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "amendments_public_read" ON public.amendments;
CREATE POLICY "amendments_public_read" ON public.amendments FOR SELECT
  USING (share_token IS NOT NULL);

DROP POLICY IF EXISTS "amendments_public_update" ON public.amendments;
CREATE POLICY "amendments_public_update" ON public.amendments FOR UPDATE
  USING (share_token IS NOT NULL) WITH CHECK (share_token IS NOT NULL);

-- ── Trigger for updated_at ──
DROP TRIGGER IF EXISTS trg_amendments_updated_at ON public.amendments;
CREATE TRIGGER trg_amendments_updated_at
  BEFORE UPDATE ON public.amendments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Force PostgREST schema cache reload ──
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- DONE.
-- 1. Wait 10 seconds for PostgREST cache to reload
-- 2. Deploy Phase 3 zip to Vercel
-- 3. UAT checklist:
--    [ ] Sign a quote as customer. As contractor, click "Propose Amendment"
--    [ ] Add items, send to customer. Customer sees original signed scope + amendment
--    [ ] Customer signs amendment. Contractor sees approved amendment on quote detail
--    [ ] Create invoice from quote with approved amendment — both sections appear
--    [ ] Decline an amendment as customer — original quote unchanged
--    [ ] On non-signed approved quote, "Request Additional Work" still works
-- ================================================================
