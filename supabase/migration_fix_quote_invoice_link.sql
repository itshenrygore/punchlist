-- ================================================================
-- PUNCHLIST — fix: quotes.invoice_id + invoices.remaining_balance
--
-- Why this exists:
--   The app code writes quotes.invoice_id and invoices.remaining_balance
--   (see src/lib/api/quotes.js and src/lib/api/invoices.js), but the
--   original schema never added those columns. The Postgres error that
--   surfaces is along the lines of:
--     column "invoice_id" of relation "quotes" does not exist
--     (where invoice_id is expected to be a uuid)
--   …which bubbles up to the browser as a 500 the next time anything
--   touches the affected row — including the public quote share link
--   when the quote has been converted to an invoice.
--
-- Run this ONCE in the Supabase SQL editor. Safe to re-run: every
-- statement uses IF NOT EXISTS / OR REPLACE.
-- ================================================================

BEGIN;

-- ── 1. quotes ← invoice link ─────────────────────────────────────
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS invoice_id uuid
    REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_invoice_id
  ON public.quotes(invoice_id);

-- ── 2. invoices: balance + lifecycle columns the app expects ─────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS remaining_balance  numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_at            timestamptz,
  ADD COLUMN IF NOT EXISTS recurring_interval text;

-- Backfill remaining_balance for existing rows so dashboards don't
-- show NULL where they expect a number.
UPDATE public.invoices
   SET remaining_balance = GREATEST(
         0,
         COALESCE(total, 0) - COALESCE(deposit_credited, 0)
       )
 WHERE remaining_balance IS NULL;

-- ── 3. Profiles: Stripe Connect columns referenced by the public
--      quote endpoint (api/public-quote.js). If migration_stripe_connect.sql
--      was never applied, the select silently nulls the contractor block
--      — adding them here keeps the SELECT happy regardless.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded  boolean DEFAULT false;

-- ── 4. quotes_status_check: app code transitions to statuses the
--      original constraint never allowed (converted_to_invoice,
--      deposit_paid, question_asked). An UPDATE that violates the check
--      throws and surfaces as a 500 on the public quote endpoint.
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN (
    'draft','sent','viewed','question_asked','revision_requested','declined',
    'approved','approved_pending_deposit','deposit_paid','scheduled','completed',
    'invoiced','converted_to_invoice','paid','expired'
  ));

-- ── 5. Force PostgREST schema cache reload so the new columns are
--      visible to the REST API immediately.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verify (run after ~10s for the PostgREST cache to settle) ────
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND ((table_name = 'quotes'   AND column_name = 'invoice_id')
--        OR (table_name = 'invoices' AND column_name IN
--             ('remaining_balance','sent_at','recurring_interval'))
--        OR (table_name = 'profiles' AND column_name IN
--             ('stripe_connect_account_id','stripe_connect_onboarded')));
--   -- Expect 6 rows.
