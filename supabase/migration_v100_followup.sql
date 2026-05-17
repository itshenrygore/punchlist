-- ═══════════════════════════════════════════════════════════════
-- Punchlist v100 — Workstream A Part 1: Follow-up & message templates
-- Spec: PHASE4-V100-PLAN.md §3.1, §3.2
-- Shipped in: M2 (templates foundation)
--
-- Forward migration only. Rollback (if ever needed):
--   DROP TABLE IF EXISTS public.message_templates;
--   ALTER TABLE public.quotes DROP COLUMN IF EXISTS last_followup_at,
--                             DROP COLUMN IF EXISTS followup_count,
--                             DROP COLUMN IF EXISTS views_since_followup;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS followup_cadence_days;
--
-- Safe to re-run: every statement uses IF NOT EXISTS / IF EXISTS.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. quotes: follow-up event tracking ──────────────────────────
-- Note: distinct from the existing `follow_up_at` column, which is a
-- *scheduled* reminder date. `last_followup_at` is an *actual* send
-- timestamp. `views_since_followup` resets to 0 on each follow-up so
-- the dashboard can signal "they looked again after your last nudge".
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS last_followup_at     timestamptz,
  ADD COLUMN IF NOT EXISTS followup_count       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_since_followup integer DEFAULT 0;

-- Backfill for existing rows (NULL count looks noisy in dashboards)
UPDATE public.quotes
   SET followup_count = 0
 WHERE followup_count IS NULL;

UPDATE public.quotes
   SET views_since_followup = 0
 WHERE views_since_followup IS NULL;

-- Index to support the dashboard "Needs follow-up" feed (§3.6).
CREATE INDEX IF NOT EXISTS idx_quotes_followup_feed
  ON public.quotes (user_id, status, last_followup_at)
  WHERE status IN ('sent', 'viewed');

-- ── 2. profiles: per-user cadence override ───────────────────────
-- Defaults bake in the 48h / 4d / 7d rhythm per §9.2.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS followup_cadence_days jsonb
    DEFAULT '{"nudge_1": 2, "nudge_2": 4, "nudge_3": 7}'::jsonb;

-- Backfill rows that existed before the column was added (DEFAULT
-- only applies to new rows).
UPDATE public.profiles
   SET followup_cadence_days = '{"nudge_1": 2, "nudge_2": 4, "nudge_3": 7}'::jsonb
 WHERE followup_cadence_days IS NULL;

-- ── 3. message_templates: per-user customizable SMS bodies ───────
CREATE TABLE IF NOT EXISTS public.message_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  locale       text NOT NULL DEFAULT 'en',   -- §9.3 future-proofing for FR
  body         text NOT NULL,
  is_custom    boolean NOT NULL DEFAULT false,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_key, locale)
);

CREATE INDEX IF NOT EXISTS idx_message_templates_user
  ON public.message_templates (user_id, locale);

-- RLS: contractors only see and edit their own templates.
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_templates_own" ON public.message_templates;
CREATE POLICY "message_templates_own" ON public.message_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Keep updated_at honest on edits.
CREATE OR REPLACE FUNCTION public.touch_message_templates_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_message_templates_touch ON public.message_templates;
CREATE TRIGGER trg_message_templates_touch
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_message_templates_updated_at();

-- ── 4. record_quote_view: also bump views_since_followup ─────────
-- The existing RPC (schema.sql:935) increments view_count. We keep
-- that behaviour and additively bump views_since_followup, which the
-- follow-up send RPC (M3) will reset to 0.
--
-- This is idempotent — re-running the CREATE OR REPLACE replaces the
-- body. If the RPC didn't exist, we'd no-op per spec; it does exist
-- in schema.sql, so we update it.
CREATE OR REPLACE FUNCTION public.record_quote_view(
  p_quote_id uuid,
  p_ip       text DEFAULT NULL,
  p_ua       text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.quote_views (quote_id, viewer_ip, user_agent)
  VALUES (p_quote_id, p_ip, p_ua);

  UPDATE public.quotes SET
    view_count           = coalesce(view_count, 0) + 1,
    views_since_followup = coalesce(views_since_followup, 0) + 1,
    first_viewed_at      = coalesce(first_viewed_at, now()),
    last_viewed_at       = now(),
    status               = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
  WHERE id = p_quote_id;
END; $$;

COMMIT;
