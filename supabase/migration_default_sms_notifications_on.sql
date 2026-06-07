-- ═══════════════════════════════════════════════════════════════
-- Punchlist — default SMS notifications ON
--
-- Contractors expect a text the moment a customer signs/approves/asks
-- a question. The original SMS column shipped with DEFAULT false, so
-- anyone who hadn't manually flipped Settings → Notifications got
-- silence (and assumed the feature was broken).
--
-- Flip the default to TRUE so every new contractor is auto-enrolled,
-- and backfill existing rows that haven't been touched. We DO NOT
-- overwrite contractors who have already toggled it (we can't reliably
-- distinguish "user picked false" from "never touched, took default
-- false") — instead we only flip rows whose phone is set AND whose
-- preference is NULL (truly never written). That's the safe set.
--
-- Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ALTER COLUMN sms_notifications_enabled SET DEFAULT true;

-- Backfill: anyone who has a phone on file AND no explicit preference
-- (column is NULL) — turn it on. Rows with an explicit false stay false.
UPDATE public.profiles
SET sms_notifications_enabled = true
WHERE sms_notifications_enabled IS NULL
  AND phone IS NOT NULL
  AND length(trim(phone)) > 0;
