-- ═══════════════════════════════════════════════════════════════
-- Punchlist v79 — SMS Notification Support
-- Run against your Supabase database
-- ═══════════════════════════════════════════════════════════════

-- 1. Add SMS preference to contractor profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_notifications_enabled boolean DEFAULT false;

-- 2. SMS audit log — lightweight table for debugging and usage tracking
-- No PII stored (phone is masked to last 4 digits)
CREATE TABLE IF NOT EXISTS public.sms_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action        text NOT NULL,
  to_phone      text,              -- Masked: ****1234
  message_preview text,            -- First 60 chars only
  twilio_sid    text,
  quote_id      uuid,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);

-- Index for contractor usage queries
CREATE INDEX IF NOT EXISTS idx_sms_log_user ON public.sms_log (user_id, created_at DESC);

-- RLS: contractors can only see their own SMS log
ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own sms_log" ON public.sms_log;
CREATE POLICY "Users see own sms_log" ON public.sms_log
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (API endpoint uses service role)
DROP POLICY IF EXISTS "Service can insert sms_log" ON public.sms_log;
CREATE POLICY "Service can insert sms_log" ON public.sms_log
  FOR INSERT WITH CHECK (true);
