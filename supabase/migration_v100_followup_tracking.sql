-- ================================================================
-- PUNCHLIST — v100 FOLLOW-UP TRACKING (consolidated, idempotent)
--
-- Run this ONCE in your Supabase SQL Editor.
-- Safe to re-run — every statement uses IF NOT EXISTS / OR REPLACE
-- and will not modify existing data.
--
-- This is what api/send-followup.js needs to function. Without it,
-- the endpoint returns 500 because the rpc_record_followup_send
-- function (or its dependent columns) doesn't exist.
--
-- Covers:
--   §1  Columns on quotes — followup_count, last_followup_at,
--       views_since_followup
--   §2  message_templates table + RLS + trigger
--   §3  rpc_record_followup_send() function
--   §4  Patched record_quote_view() that bumps views_since_followup
--   §5  PostgREST schema cache reload
-- ================================================================

-- ── §1. QUOTE COLUMNS ─────────────────────────────────────────
-- Tracks follow-up "nudges" sent to a customer about a quote.
-- followup_count and views_since_followup default to 0 so existing
-- rows are immediately usable without backfill.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS last_followup_at      timestamptz,
  ADD COLUMN IF NOT EXISTS followup_count        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_since_followup  integer NOT NULL DEFAULT 0;

-- Index used by the dashboard "needs follow-up" query.
CREATE INDEX IF NOT EXISTS idx_quotes_followup_lookup
  ON public.quotes (user_id, status, last_followup_at)
  WHERE status IN ('sent', 'viewed');

-- Optional: contractor-level cadence preference. Defaults match
-- the v100 spec (48h / 4d / 7d). Stored as jsonb for forward
-- compatibility (could grow to per-trade or per-customer-tier later).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS followup_cadence_days jsonb
  DEFAULT '{"nudge_1": 2, "nudge_2": 4, "nudge_3": 7}'::jsonb;


-- ── §2. MESSAGE TEMPLATES TABLE ───────────────────────────────
-- Stores per-user customized message bodies for SMS/email follow-ups.
-- The send-followup endpoint falls back to system defaults (defined
-- inline in the API code) if no row exists for the requested key.
CREATE TABLE IF NOT EXISTS public.message_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  locale       text NOT NULL DEFAULT 'en',
  body         text NOT NULL,
  is_custom    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_key, locale)
);

-- Allowed template keys. Easier to extend than a Postgres enum.
ALTER TABLE public.message_templates
  DROP CONSTRAINT IF EXISTS message_templates_key_check;
ALTER TABLE public.message_templates
  ADD CONSTRAINT message_templates_key_check
  CHECK (template_key IN (
    'initial_sms',
    'followup_1_sms',
    'followup_2_sms',
    'followup_3_sms',
    'approved_thanks_sms',
    'deposit_received_sms',
    'invoice_ready_sms',
    'job_complete_sms'
  ));

CREATE INDEX IF NOT EXISTS idx_message_templates_user
  ON public.message_templates(user_id);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_templates_own" ON public.message_templates;
CREATE POLICY "message_templates_own" ON public.message_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at trigger (re-uses the existing set_updated_at function
-- defined in the v17 base schema).
DROP TRIGGER IF EXISTS trg_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER trg_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── §3. RPC: rpc_record_followup_send ─────────────────────────
-- Atomically:
--   1. Verify the calling user owns the quote (auth.uid() = user_id)
--   2. Increment followup_count
--   3. Set last_followup_at = now()
--   4. Reset views_since_followup = 0
--   5. Return the new state for client reconciliation
--
-- SECURITY DEFINER so it can bypass RLS for the atomic update;
-- ownership is enforced manually in the function body. This is the
-- pattern PostgREST callable RPCs use when they need atomicity.
CREATE OR REPLACE FUNCTION public.rpc_record_followup_send(
  p_quote_id uuid,
  p_sent_at  timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          uuid;
  v_new_count        integer;
  v_new_followup_at  timestamptz;
BEGIN
  -- 1. Ownership check
  SELECT user_id INTO v_user_id
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

  -- 2-4. Atomic counter bump + timestamp + reset
  UPDATE public.quotes
  SET followup_count       = COALESCE(followup_count, 0) + 1,
      last_followup_at     = p_sent_at,
      views_since_followup = 0,
      updated_at           = now()
  WHERE id = p_quote_id
  RETURNING followup_count, last_followup_at
  INTO v_new_count, v_new_followup_at;

  -- 5. Return new state as jsonb for the API to forward to the client
  RETURN jsonb_build_object(
    'quote_id',             p_quote_id,
    'followup_count',       v_new_count,
    'last_followup_at',     v_new_followup_at,
    'views_since_followup', 0
  );
END;
$$;

-- Lock down execution to authenticated users only. Service role
-- inherits all privileges; api/send-followup.js calls this with a
-- user-scoped client (so auth.uid() resolves properly).
REVOKE ALL ON FUNCTION public.rpc_record_followup_send(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_record_followup_send(uuid, timestamptz) TO authenticated;


-- ── §4. record_quote_view (patched) ───────────────────────────
-- Same as before, but ALSO bumps views_since_followup so the
-- dashboard can show "viewed since you last nudged" indicators.
-- Existing callers see no behavior change — the new counter is
-- additive.
CREATE OR REPLACE FUNCTION public.record_quote_view(
  p_quote_id uuid,
  p_ip       text DEFAULT NULL,
  p_ua       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.quote_views (quote_id, viewer_ip, user_agent)
  VALUES (p_quote_id, p_ip, p_ua);

  UPDATE public.quotes
  SET view_count           = COALESCE(view_count, 0) + 1,
      views_since_followup = COALESCE(views_since_followup, 0) + 1,
      first_viewed_at      = COALESCE(first_viewed_at, now()),
      last_viewed_at       = now(),
      status               = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
  WHERE id = p_quote_id;
END;
$$;


-- ── §5. RELOAD POSTGREST SCHEMA CACHE ─────────────────────────
NOTIFY pgrst, 'reload schema';


-- ================================================================
-- VERIFICATION QUERIES (run these AFTER the migration completes,
-- waiting ~10 seconds for the PostgREST cache to reload):
--
--   -- 1. Confirm the columns exist
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'quotes'
--     AND column_name IN ('followup_count', 'last_followup_at', 'views_since_followup');
--   -- Expect 3 rows
--
--   -- 2. Confirm the function exists and is SECURITY DEFINER
--   SELECT proname, prosecdef FROM pg_proc
--   WHERE proname = 'rpc_record_followup_send';
--   -- Expect 1 row, prosecdef = true
--
--   -- 3. Confirm the message_templates table exists
--   SELECT count(*) FROM public.message_templates;
--   -- Expect 0 (empty until users customize, or you seed defaults)
--
-- ================================================================
-- ROLLBACK (only if something is wrong — all changes are additive
-- and shouldn't conflict with anything in your existing schema):
--
--   DROP FUNCTION IF EXISTS public.rpc_record_followup_send(uuid, timestamptz);
--   DROP TABLE  IF EXISTS public.message_templates;
--   ALTER TABLE public.quotes
--     DROP COLUMN IF EXISTS last_followup_at,
--     DROP COLUMN IF EXISTS followup_count,
--     DROP COLUMN IF EXISTS views_since_followup;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS followup_cadence_days;
--   -- (record_quote_view will revert to its previous definition only
--   --  if you re-run an earlier CREATE OR REPLACE for it)
-- ================================================================
