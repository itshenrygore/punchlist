-- ════════════════════════════════════════════════════════════════
-- Punchlist — multi-trade support
--
-- Many contractors run multi-trade shops (e.g. plumbing + HVAC). We keep
-- the existing single `trade` column as the PRIMARY trade (back-compat for
-- pricing/AI defaults) and add `trades` to hold the full set they selected.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trades jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: seed trades from the existing primary trade for current users.
UPDATE public.profiles
   SET trades = jsonb_build_array(trade)
 WHERE (trades IS NULL OR trades = '[]'::jsonb)
   AND trade IS NOT NULL AND trade <> '' AND trade <> 'Other';

NOTIFY pgrst, 'reload schema';
