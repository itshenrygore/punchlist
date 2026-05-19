-- ================================================================
-- PUNCHLIST — PHASE 5 LIFECYCLE MIGRATION
-- Invoicing & Payments
--
-- Run this in Supabase SQL Editor after deploying Phase 5.
-- Safe to run multiple times (idempotent).
-- ================================================================

-- ── 5A: Invoice editing — add discount column ──
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount numeric(10,2) DEFAULT 0;

-- ── 5B: Stripe invoice payment tracking ──
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- ── 5C: Automated payment reminders ──
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS reminder_schedule jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

-- ── 5E: Payments table (partial payments) ──
CREATE TABLE IF NOT EXISTS public.payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     numeric(10,2) NOT NULL DEFAULT 0,
  method     text,
  notes      text,
  paid_at    timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Safe column additions for existing payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes text;

-- ── Update invoices status constraint to include 'partial' ──
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft','sent','viewed','partial','paid','overdue','cancelled'));

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at DESC);

-- ── RLS ──
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_own" ON public.payments;
CREATE POLICY "payments_own" ON public.payments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public read for payments (via invoice share_token lookup in API)
DROP POLICY IF EXISTS "payments_public_read" ON public.payments;
CREATE POLICY "payments_public_read" ON public.payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices i 
    WHERE i.id = invoice_id AND i.share_token IS NOT NULL
  ));

-- ── Force PostgREST schema cache reload ──
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- DONE.
-- 1. Wait 10 seconds for PostgREST cache to reload
-- 2. Deploy Phase 5 zip to Vercel
-- 3. UAT checklist:
--    [ ] Create an invoice. Edit it (change amount, add discount, change due date). Verify changes persist.
--    [ ] As customer, click "Pay Online" on invoice. Complete Stripe checkout. Verify paid.
--    [ ] As contractor, record a partial payment ($500 of $1200). Verify balance shows $700.
--    [ ] Record remaining payment. Verify status becomes "Paid".
--    [ ] Check dashboard for receivables widget. Verify numbers match.
--    [ ] Enable auto-reminders on overdue invoice. Revisit page after period. Verify email fires.
-- ================================================================
