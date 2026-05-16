-- ================================================================
-- PUNCHLIST — CONSOLIDATED LIFECYCLE MIGRATION (v42 through Phase 8)
-- 
-- Run this ONCE on your live Supabase DB to bring it up to date.
-- Safe to run multiple times (fully idempotent).
-- Covers all columns, tables, constraints, indexes, RLS, and triggers
-- added in Phases 1-8.
-- ================================================================

-- ═══════════════════════════════════════════
-- QUOTES TABLE — new columns
-- ═══════════════════════════════════════════
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signature_data text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_name text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_ip text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS conversation jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS selected_optional_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_number integer;

-- ═══════════════════════════════════════════
-- PROFILES TABLE — new columns
-- ═══════════════════════════════════════════
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_conditions text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_subscription jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_active boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- ═══════════════════════════════════════════
-- BOOKINGS TABLE — new columns
-- ═══════════════════════════════════════════
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notify_customer boolean DEFAULT false;

-- ═══════════════════════════════════════════
-- CUSTOMERS TABLE — Phase 6 columns
-- ═══════════════════════════════════════════
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;

-- ═══════════════════════════════════════════
-- INVOICES TABLE — new columns
-- ═══════════════════════════════════════════
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount numeric(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS reminder_schedule jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deposit_credited numeric(10,2) DEFAULT 0;

-- ═══════════════════════════════════════════
-- AMENDMENTS TABLE (Phase 3)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.amendments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'Amendment',
  reason          text DEFAULT '',
  status          text NOT NULL DEFAULT 'draft',
  items           jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal        numeric(10,2) NOT NULL DEFAULT 0,
  tax             numeric(10,2) NOT NULL DEFAULT 0,
  total           numeric(10,2) NOT NULL DEFAULT 0,
  province        text DEFAULT 'ON',
  country         text DEFAULT 'CA',
  share_token     text NOT NULL DEFAULT gen_random_uuid()::text,
  signature_data  text,
  signed_at       timestamptz,
  signer_name     text,
  signer_ip       text,
  sent_at         timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.amendments DROP CONSTRAINT IF EXISTS amendments_status_check;
ALTER TABLE public.amendments ADD CONSTRAINT amendments_status_check
  CHECK (status IN ('draft','sent','viewed','approved','declined'));

-- ═══════════════════════════════════════════
-- NOTIFICATIONS TABLE (Phase 4)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'general',
  title      text NOT NULL DEFAULT '',
  body       text DEFAULT '',
  read       boolean NOT NULL DEFAULT false,
  link       text,
  created_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════
-- PAYMENTS TABLE (Phase 5)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     numeric(10,2) NOT NULL DEFAULT 0,
  method     text,
  notes      text,
  paid_at    timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════
-- UPDATE CONSTRAINTS
-- ═══════════════════════════════════════════
-- Invoices: add 'partial' status
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft','sent','viewed','partial','paid','overdue','cancelled'));

-- ═══════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_amendments_quote_id ON public.amendments(quote_id);
CREATE INDEX IF NOT EXISTS idx_amendments_user_id ON public.amendments(user_id);
CREATE INDEX IF NOT EXISTS idx_amendments_status ON public.amendments(status);
CREATE INDEX IF NOT EXISTS idx_amendments_share_token ON public.amendments(share_token);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON public.quotes(user_id, quote_number);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ═══════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════
ALTER TABLE public.amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amendments_own" ON public.amendments;
DROP POLICY IF EXISTS "amendments_public_read" ON public.amendments;
DROP POLICY IF EXISTS "amendments_public_update" ON public.amendments;
CREATE POLICY "amendments_own" ON public.amendments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "amendments_public_read" ON public.amendments FOR SELECT
  USING (share_token IS NOT NULL);
CREATE POLICY "amendments_public_update" ON public.amendments FOR UPDATE
  USING (share_token IS NOT NULL) WITH CHECK (share_token IS NOT NULL);

DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payments_own" ON public.payments;
DROP POLICY IF EXISTS "payments_public_read" ON public.payments;
CREATE POLICY "payments_own" ON public.payments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payments_public_read" ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.share_token IS NOT NULL));

-- ═══════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_amendments_updated_at ON public.amendments;
CREATE TRIGGER trg_amendments_updated_at BEFORE UPDATE ON public.amendments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Quote number auto-increment
CREATE OR REPLACE FUNCTION public.assign_quote_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE next_num integer;
BEGIN
  IF NEW.quote_number IS NULL THEN
    SELECT COALESCE(MAX(quote_number), 0) + 1 INTO next_num
    FROM public.quotes WHERE user_id = NEW.user_id;
    NEW.quote_number := next_num;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_quotes_quote_number ON public.quotes;
CREATE TRIGGER trg_quotes_quote_number BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.assign_quote_number();

-- Backfill quote numbers for existing quotes
DO $$
DECLARE uid uuid;
BEGIN
  FOR uid IN (
    SELECT DISTINCT user_id FROM public.quotes WHERE quote_number IS NULL
  ) LOOP
    UPDATE public.quotes q
    SET quote_number = ranked.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
      FROM public.quotes WHERE user_id = uid AND quote_number IS NULL
    ) ranked
    WHERE q.id = ranked.id;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════
-- REALTIME (for notification center)
-- ═══════════════════════════════════════════
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ═══════════════════════════════════════════
-- RELOAD SCHEMA CACHE
-- ═══════════════════════════════════════════
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- DONE.
-- 1. Wait 10-15 seconds for PostgREST cache to reload
-- 2. Deploy v51 zip to Vercel
-- 3. Test all flows end-to-end
-- ================================================================
