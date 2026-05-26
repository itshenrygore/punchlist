-- ════════════════════════════════════════════════════════════════
-- Punchlist — auto follow-up opt-in flag
--
-- Adds the per-contractor switch that api/send-followup.js (the cron)
-- checks before sending any automated nudge. Defaults to FALSE so the
-- behavior is strictly opt-in — no contractor starts auto-texting
-- customers without explicitly turning it on in Settings → Messages.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_followup_enabled boolean NOT NULL DEFAULT false;

-- Reload PostgREST so the column is queryable immediately.
NOTIFY pgrst, 'reload schema';
