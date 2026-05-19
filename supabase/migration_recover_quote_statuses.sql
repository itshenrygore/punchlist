-- ============================================================================
-- PUNCHLIST — RECOVERY: quote statuses collapsed by the destructive
-- "Migration:" block in the consolidated schema paste.
--
-- The lines that did the damage (these had no IF / DO guard, so they all ran
-- on whatever rows matched):
--
--   UPDATE quotes SET status = 'draft'    WHERE status IN ('revision_requested','needs_review');
--   UPDATE quotes SET status = 'sent'     WHERE status = 'viewed';
--   UPDATE quotes SET status = 'approved' WHERE status IN ('approved_pending_deposit','scheduled','completed');
--   UPDATE quotes SET status = 'paid'     WHERE status IN ('invoiced','paid');
--
-- This file is idempotent: each UPDATE only fires on rows currently sitting
-- on the collapsed status AND with a strong surrounding signal that pins
-- down what the value should have been. Running it twice is a no-op.
--
-- It is NOT a perfect restore — Postgres has no audit trail of the prior
-- values. But on every row where the data points the same way, we put the
-- correct status back. Anything ambiguous stays where it is.
--
-- HOW TO USE:
--   1. Open Supabase SQL Editor
--   2. Paste this file
--   3. Run
--   4. Wait ~10 s for the PostgREST cache to reload (the NOTIFY at the end
--      does this for you)
-- ============================================================================

BEGIN;

-- ── 1. 'sent' → 'viewed' ────────────────────────────────────────────────
-- The destructive block did `viewed → sent`. Recover wherever we still have
-- proof the customer opened the quote.
UPDATE public.quotes
   SET status = 'viewed'
 WHERE status = 'sent'
   AND (COALESCE(view_count, 0) > 0 OR first_viewed_at IS NOT NULL);


-- ── 2. 'draft' → 'revision_requested' ───────────────────────────────────
-- The destructive block did `revision_requested → draft`. Recover wherever
-- public-quote-action.js wrote the customer's change-request note into
-- internal_notes — that's our only durable signal.
UPDATE public.quotes
   SET status = 'revision_requested'
 WHERE status = 'draft'
   AND internal_notes IS NOT NULL
   AND (internal_notes LIKE '%Change request:%'
     OR internal_notes LIKE '%Customer requested changes.%');


-- ── 3. 'approved' → {paid, invoiced, completed, scheduled,
--                     approved_pending_deposit, approved} ───────────────
-- The destructive block did `approved_pending_deposit / scheduled / completed
-- → approved`. We re-derive in priority order:
--   * linked invoice marked paid   → 'paid'
--   * any linked invoice           → 'invoiced'
--   * booking marked completed     → 'completed'
--   * any non-cancelled booking    → 'scheduled'
--   * deposit required, not paid   → 'approved_pending_deposit'
--   * otherwise                    → leave as 'approved'
UPDATE public.quotes q
   SET status = CASE
     WHEN EXISTS (
       SELECT 1 FROM public.invoices i
        WHERE i.quote_id = q.id AND i.status = 'paid'
     ) THEN 'paid'
     WHEN EXISTS (
       SELECT 1 FROM public.invoices i
        WHERE i.quote_id = q.id
     ) THEN 'invoiced'
     WHEN EXISTS (
       SELECT 1 FROM public.bookings b
        WHERE b.quote_id = q.id AND b.status = 'completed'
     ) THEN 'completed'
     WHEN EXISTS (
       SELECT 1 FROM public.bookings b
        WHERE b.quote_id = q.id AND b.status <> 'cancelled'
     ) THEN 'scheduled'
     WHEN q.deposit_required = true
          AND COALESCE(q.deposit_status, 'not_required') <> 'paid'
       THEN 'approved_pending_deposit'
     ELSE 'approved'
   END
 WHERE q.status = 'approved';


-- ── 4. 'paid' → 'invoiced' ──────────────────────────────────────────────
-- The destructive block did `invoiced → paid`. Push back to 'invoiced'
-- wherever the linked invoice is still unpaid.
UPDATE public.quotes q
   SET status = 'invoiced'
 WHERE q.status = 'paid'
   AND NOT EXISTS (
     SELECT 1 FROM public.invoices i
      WHERE i.quote_id = q.id AND i.status = 'paid'
   )
   AND EXISTS (
     SELECT 1 FROM public.invoices i WHERE i.quote_id = q.id
   );


-- ── 5. Surface the recovery counts so you can see what changed ─────────
-- (Optional — read the NOTICE output in the SQL editor.)
DO $$
DECLARE
  v_viewed   int;
  v_revrq    int;
  v_paid     int;
  v_invoiced int;
  v_sched    int;
  v_done     int;
  v_pdep     int;
BEGIN
  SELECT COUNT(*) INTO v_viewed   FROM public.quotes WHERE status = 'viewed';
  SELECT COUNT(*) INTO v_revrq    FROM public.quotes WHERE status = 'revision_requested';
  SELECT COUNT(*) INTO v_paid     FROM public.quotes WHERE status = 'paid';
  SELECT COUNT(*) INTO v_invoiced FROM public.quotes WHERE status = 'invoiced';
  SELECT COUNT(*) INTO v_sched    FROM public.quotes WHERE status = 'scheduled';
  SELECT COUNT(*) INTO v_done     FROM public.quotes WHERE status = 'completed';
  SELECT COUNT(*) INTO v_pdep     FROM public.quotes WHERE status = 'approved_pending_deposit';
  RAISE NOTICE 'Post-recovery counts — viewed:% revision_requested:% paid:% invoiced:% scheduled:% completed:% approved_pending_deposit:%',
    v_viewed, v_revrq, v_paid, v_invoiced, v_sched, v_done, v_pdep;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- WHAT THIS CAN'T RECOVER
--
--   * 'needs_review' rows (a status that isn't in our current check
--     constraint anyway) were merged into 'draft'. No signal to re-derive.
--   * Rows that were genuinely 'approved' before the migration are
--     indistinguishable from rows that got moved into 'approved'. The CASE
--     in §3 leaves a row on 'approved' if no other signal applies — same
--     status it had pre-recovery.
--   * 'declined', 'expired' were not touched by the destructive block, so
--     no recovery needed.
-- ============================================================================
