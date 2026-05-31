-- ════════════════════════════════════════════════════════════════
-- Punchlist — default city for permit/code questions
--
-- Some permitting rules and inspection authorities differ by
-- municipality, not just by province. When the contractor saves
-- their primary city in Settings, Foreman uses it as the default
-- jurisdiction context — no need to ask "which city?" every time.
-- The contractor can still tell Foreman a different city for a
-- specific job; this just gives a sane default.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_city text;

NOTIFY pgrst, 'reload schema';
