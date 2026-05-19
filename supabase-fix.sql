-- ============================================================
-- PUNCHLIST — SCHEMA FIX (run this in Supabase SQL Editor)
--
-- Fixes two bugs that cause 500 errors and broken status flows:
--   1. Status constraint missing 'deposit_paid' & 'converted_to_invoice'
--   2. Missing invoice_id column on quotes table
-- ============================================================

-- ── 1. Fix the status CHECK constraint ──────────────────────
-- The original constraint was missing 'deposit_paid' and 'converted_to_invoice'
-- which the app uses. Any UPDATE on a row with those statuses would fail.

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;

ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN (
    'draft',
    'sent',
    'viewed',
    'question_asked',
    'revision_requested',
    'declined',
    'approved',
    'approved_pending_deposit',
    'deposit_paid',
    'converted_to_invoice',
    'scheduled',
    'completed',
    'invoiced',
    'paid',
    'expired'
  ));


-- ── 2. Add invoice_id column to quotes ──────────────────────
-- The app sets this when converting a quote to an invoice.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS invoice_id uuid
  REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_invoice_id
  ON public.quotes(invoice_id)
  WHERE invoice_id IS NOT NULL;


-- ── 3. Restore quotes that had statuses incorrectly migrated ─
-- If you ran the full consolidated schema, these UPDATE statements
-- at the bottom may have incorrectly collapsed your statuses:
--   viewed -> sent
--   approved_pending_deposit -> approved
--   etc.
--
-- We can't fully recover those (the original values are lost), but
-- we can at least re-derive 'viewed' for quotes that have view_count > 0
-- and are currently stuck as 'sent':

UPDATE public.quotes
SET status = 'viewed'
WHERE status = 'sent'
  AND view_count > 0
  AND first_viewed_at IS NOT NULL;


-- ── 4. Reload PostgREST cache ────────────────────────────────
NOTIFY pgrst, 'reload schema';


-- ── Verify ───────────────────────────────────────────────────
-- After running, check these return the expected results:
--
-- 1. Constraint includes deposit_paid and converted_to_invoice:
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'quotes_status_check';
--
-- 2. invoice_id column exists:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'quotes'
  AND column_name = 'invoice_id';
