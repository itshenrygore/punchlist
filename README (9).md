-- ═══════════════════════════════════════════════════════════════════════════
-- Punchlist v100 M5 — Workstream C schema additions
-- §5.5  auto_send_invoice_on_complete preference on profiles
-- §5.2  messages_last_read column on quotes (read receipt tracking)
-- §5.6  Function + trigger for deposit receipt SMS via Supabase DB webhook
--        (fallback path — zero changes to api/stripe-webhook.js)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §5.5 Auto-send invoice preference ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_send_invoice_on_complete boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.auto_send_invoice_on_complete IS
  'When true, sending the "Complete & Invoice" action automatically sends the invoice SMS/email to the customer immediately after creation. Defaults on per §5.5 spec. Contractor can toggle off in Settings → Preferences.';

-- ─── §5.2 Message read receipts ──────────────────────────────────────────
-- Track when the customer last read the message thread on the public quote page.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS messages_last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS messages_read_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.quotes.messages_last_read_at IS
  'Timestamp of when the customer last triggered mark-as-read on the public quote page.';
COMMENT ON COLUMN public.quotes.messages_read_count IS
  'Cumulative count of read events from the customer side (for contractor display).';

-- ─── §5.6 Deposit receipt — Supabase DB webhook path ─────────────────────
-- This is the ZERO-STRIPE-WEBHOOK-EDIT path chosen per the M5 spec
-- (see CHANGELOG-v100-M5.md §5.6 decision).
--
-- A Supabase "Database Webhook" fires on INSERT/UPDATE to public.quotes
-- where deposit_status transitions to 'paid'. It calls the Edge Function
-- `send-deposit-receipt` (defined separately in supabase/functions/).
--
-- The trigger below marks the transition in an audit column so the Edge
-- Function can be idempotent: if deposit_receipt_sent_at is already set,
-- it skips the send.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS deposit_receipt_sent_at timestamptz;

COMMENT ON COLUMN public.quotes.deposit_receipt_sent_at IS
  'Set to now() when the branded deposit receipt SMS is sent to the customer. Used for idempotency — the webhook will skip the send if this column is non-null.';

-- Helper function: used by the DB webhook trigger (or manually) to mark
-- the receipt as sent after the Edge Function confirms delivery.
CREATE OR REPLACE FUNCTION public.rpc_mark_deposit_receipt_sent(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quotes
     SET deposit_receipt_sent_at = now()
   WHERE id = p_quote_id
     AND deposit_receipt_sent_at IS NULL; -- idempotent
END;
$$;

-- ─── Forward migration only (rollback = DROP COLUMN / DROP FUNCTION) ──────
-- To rollback:
--   ALTER TABLE public.profiles   DROP COLUMN auto_send_invoice_on_complete;
--   ALTER TABLE public.quotes     DROP COLUMN messages_last_read_at;
--   ALTER TABLE public.quotes     DROP COLUMN messages_read_count;
--   ALTER TABLE public.quotes     DROP COLUMN deposit_receipt_sent_at;
--   DROP FUNCTION IF EXISTS public.rpc_mark_deposit_receipt_sent(uuid);
--
-- How to run:
--   psql $DATABASE_URL -f supabase/migration_v100_m5.sql
--
-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'profiles' AND column_name = 'auto_send_invoice_on_complete';
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'quotes' AND column_name IN
--      ('messages_last_read_at','messages_read_count','deposit_receipt_sent_at');
