-- ══════════════════════════════════════════════════════════════════
-- v100 M4 — Dashboard migration
-- Adds: profiles.dashboard_version  (feature flag for dashv2 rollout)
--        public.dismissed_dashboard_items  (per-user dismiss state,
--        replaces the localStorage hack so it persists across devices)
--
-- Run: psql $DATABASE_URL -f supabase/migration_v100_dashboard.sql
-- Rollback:
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS dashboard_version;
--   DROP TABLE IF EXISTS public.dismissed_dashboard_items;
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. profiles.dashboard_version ──────────────────────────────
-- 'v2' = new dashboard (default for all users per §9.4 decision)
-- 'v1' = classic view (contractor opted out)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_version text NOT NULL DEFAULT 'v2'
    CHECK (dashboard_version IN ('v1','v2'));

COMMENT ON COLUMN public.profiles.dashboard_version IS
  'Controls which dashboard layout the user sees. v2 is the default '
  '(shipped v100). v1 is the escape-hatch "Classic view" for 30 days '
  'post-release. Auto-reverted to v2 if opt-out rate exceeds 20% in '
  'first 24h (monitored via telemetry.dashboard_downgrade events).';

-- ── 2. dismissed_dashboard_items ────────────────────────────────
-- Replaces the ephemeral localStorage approach. Persists across
-- devices. Items auto-expire after 7 days (matches the old behavior).
CREATE TABLE IF NOT EXISTS public.dismissed_dashboard_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id    uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, quote_id)
);

-- RLS
ALTER TABLE public.dismissed_dashboard_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dismissed_dashboard_items_owner"
  ON public.dismissed_dashboard_items
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for the per-user fetch
CREATE INDEX IF NOT EXISTS dismissed_dashboard_items_user_id_idx
  ON public.dismissed_dashboard_items (user_id);

-- Auto-cleanup: dismissed items older than 7 days are ignored client-side
-- but we also purge them weekly to keep the table small.
-- Schedule this in Supabase's pg_cron or call from a background job.
-- Example (run after table is created):
-- SELECT cron.schedule('purge-dismissed-dash', '0 3 * * 0',
--   $$DELETE FROM public.dismissed_dashboard_items WHERE dismissed_at < now() - interval '7 days'$$);

COMMIT;

-- ── Verify ───────────────────────────────────────────────────────
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'profiles' AND column_name = 'dashboard_version';
--
-- SELECT tablename FROM pg_tables WHERE tablename = 'dismissed_dashboard_items';
