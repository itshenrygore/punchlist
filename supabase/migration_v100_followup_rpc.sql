-- ═══════════════════════════════════════════════════════════════════════════
-- PUNCHLIST v100 — M3 Migration: rpc_record_followup_send
-- Spec: PHASE4-V100-PLAN.md §3.5
-- Depends on: migration_v100_followup.sql (M2) — columns must already exist.
-- Run this AFTER migration_v100_followup.sql is applied.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Purpose: Atomic follow-up tracking — increments counters + returns new
-- state in a single RPC so api/send-followup.js can't double-count on retry.
-- The API calls this BEFORE the actual Twilio/Resend send, within a flow
-- that uses the returned `followup_count` to pick the right template.
-- If the send subsequently fails, the counters are already bumped — this is
-- intentional (a failed nudge attempt counts as a touch; the customer didn't
-- receive it, but the contractor tried and the system shouldn't retry silently).
--
-- Rollback (if needed):
--   DROP FUNCTION IF EXISTS public.rpc_record_followup_send(uuid, timestamptz);
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── rpc_record_followup_send ──────────────────────────────────────────────
-- Atomically:
--   1. Verify the calling user owns the quote (auth.uid() = user_id)
--   2. Increment followup_count
--   3. Set last_followup_at = p_sent_at (defaults to now())
--   4. Reset views_since_followup = 0
--   5. Return the updated row fields for client reconciliation
--
-- Returns a single JSON object with the new counter values.
-- Raises EXCEPTION if ownership check fails — treated as 403 by the API.
CREATE OR REPLACE FUNCTION public.rpc_record_followup_send(
  p_quote_id  uuid,
  p_sent_at   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as owner so it can bypass RLS for the atomic update
                   -- ownership is checked manually inside the function body
SET search_path = public
AS $$
DECLARE
  v_user_id           uuid;
  v_new_count         integer;
  v_new_followup_at   timestamptz;
BEGIN
  -- 1. Ownership check — compare quote.user_id to the authenticated caller.
  --    SECURITY DEFINER bypasses RLS, so we must enforce ownership here.
  SELECT user_id
    INTO v_user_id
    FROM public.quotes
   WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quote_not_found'
      USING ERRCODE = 'P0002',
            DETAIL  = 'No quote with id ' || p_quote_id::text;
  END IF;

  IF v_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_owner'
      USING ERRCODE = '42501',
            DETAIL  = 'Caller does not own this quote';
  END IF;

  -- 2–4. Atomic increment + timestamp + reset.
  UPDATE public.quotes
     SET followup_count        = COALESCE(followup_count, 0) + 1,
         last_followup_at      = p_sent_at,
         views_since_followup  = 0
   WHERE id = p_quote_id
  RETURNING followup_count, last_followup_at
        INTO v_new_count, v_new_followup_at;

  -- 5. Return new state so the API client can reconcile UI without a refetch.
  RETURN jsonb_build_object(
    'quote_id',            p_quote_id,
    'followup_count',      v_new_count,
    'last_followup_at',    v_new_followup_at,
    'views_since_followup', 0
  );
END;
$$;

-- Grant execute to authenticated users only (service role inherits all privs).
REVOKE ALL ON FUNCTION public.rpc_record_followup_send(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_followup_send(uuid, timestamptz) TO authenticated;

COMMIT;

-- ── How to run ────────────────────────────────────────────────────────────
-- In the Supabase dashboard → SQL Editor, paste and run this file.
-- Or via CLI:
--   supabase db push  (if using migrations directory)
--   psql $DATABASE_URL -f supabase/migration_v100_followup_rpc.sql
--
-- Verify with:
--   SELECT proname, prosecdef FROM pg_proc WHERE proname = 'rpc_record_followup_send';
--   -- prosecdef should be true (SECURITY DEFINER)
