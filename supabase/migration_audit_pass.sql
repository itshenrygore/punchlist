-- ============================================================================
-- PUNCHLIST — audit-pass migration
--
-- Adds the columns + indexes the app code reads/writes but schema.sql
-- never declared. Without these, the column-drift safety net in
-- src/lib/api/profile.js silently dropped the value on retry and the
-- toggle in Settings "saved" but didn't persist.
--
-- Also adds:
--   • Unique index on payments.stripe_session_id so the Stripe webhook
--     can use an upsert (atomic dedupe) instead of select-then-insert,
--     which was race-prone on Stripe's retries.
--   • Unique partial index on invoices(user_id, parent_invoice_id,
--     billing_period_start) so two cron invocations can't both
--     generate the next recurring invoice for the same period.
--   • rpc_prepend_internal_note: atomic concat on quotes.internal_notes
--     so two concurrent addInternalNote calls don't drop one of the
--     notes via read-modify-write.
--
-- Run ONCE in the Supabase SQL editor. Idempotent.
-- ============================================================================

BEGIN;

-- ── 1. profiles columns referenced by app but absent from schema ─────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS platform_fee_percent       numeric(5,2) DEFAULT 2.50,
  ADD COLUMN IF NOT EXISTS payments_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS payments_terms_version     text,
  ADD COLUMN IF NOT EXISTS payments_terms_ip          text,
  ADD COLUMN IF NOT EXISTS last_activation_email      integer DEFAULT -1,
  ADD COLUMN IF NOT EXISTS last_activation_email_at   timestamptz,
  ADD COLUMN IF NOT EXISTS late_fee_percent           numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_days              integer      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_notifications        boolean      DEFAULT true;

-- ── 2. quotes columns referenced by approval optionals flow ──────────────
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS approved_total           numeric(10,2),
  ADD COLUMN IF NOT EXISTS original_total           numeric(10,2),
  ADD COLUMN IF NOT EXISTS stripe_connect_session_id text;

-- ── 3. invoices columns referenced by Stripe Connect + recurring ─────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_connect_session_id  text,
  ADD COLUMN IF NOT EXISTS parent_invoice_id          uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_period_start       date;

-- ── 4. payments dedup index for the Stripe webhook ───────────────────────
-- The webhook handler currently does ilike-on-notes to spot duplicates,
-- which races on Stripe retries. With this column + index the handler
-- can use an INSERT ... ON CONFLICT upsert.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_session_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_stripe_session_id
  ON public.payments(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- ── 5. Recurring-invoice dedup index ─────────────────────────────────────
-- Prevents two concurrent cron runs from both creating "the same" next
-- invoice. Partial because the constraint only applies to recurring rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_recurring_period
  ON public.invoices(user_id, parent_invoice_id, billing_period_start)
  WHERE parent_invoice_id IS NOT NULL AND billing_period_start IS NOT NULL;

-- ── 6. rpc_prepend_internal_note ─────────────────────────────────────────
-- Atomic concat on quotes.internal_notes. The previous JS implementation
-- read the existing value, prepended, then wrote — two concurrent calls
-- (e.g. a customer asking a question while an automated rule fires)
-- would lose one of the notes via last-write-wins.
DROP FUNCTION IF EXISTS public.rpc_prepend_internal_note(uuid, text);
CREATE OR REPLACE FUNCTION public.rpc_prepend_internal_note(
  p_quote_id uuid,
  p_note     text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_result  text;
BEGIN
  -- Ownership check (SECURITY DEFINER bypasses RLS; enforce manually).
  SELECT user_id INTO v_user_id FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quote_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;

  UPDATE public.quotes
     SET internal_notes = p_note ||
         CASE WHEN COALESCE(internal_notes, '') = '' THEN '' ELSE E'\n' || internal_notes END,
         updated_at     = now()
   WHERE id = p_quote_id
  RETURNING internal_notes INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_prepend_internal_note(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_prepend_internal_note(uuid, text) TO authenticated;

-- ── 7. Force PostgREST schema cache reload ───────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verify ───────────────────────────────────────────────────────────────
--   SELECT table_name, column_name FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND ((table_name='profiles' AND column_name IN
--             ('platform_fee_percent','payments_terms_accepted_at',
--              'payments_terms_version','payments_terms_ip',
--              'last_activation_email','last_activation_email_at',
--              'late_fee_percent','late_fee_days','email_notifications'))
--        OR (table_name='quotes' AND column_name IN
--             ('approved_total','original_total','stripe_connect_session_id'))
--        OR (table_name='invoices' AND column_name IN
--             ('stripe_connect_session_id','parent_invoice_id','billing_period_start'))
--        OR (table_name='payments' AND column_name = 'stripe_session_id'))
--    ORDER BY table_name, column_name;
--   -- Expect 16 rows.
--
--   SELECT proname FROM pg_proc WHERE proname = 'rpc_prepend_internal_note';
--   -- Expect 1 row.
