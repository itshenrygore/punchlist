-- ================================================================
-- STRIPE CONNECT MIGRATION
-- Adds connected account support to profiles table
-- Safe & idempotent — run in Supabase SQL Editor
-- ================================================================

-- Connected account ID from Stripe Express onboarding
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

-- Whether onboarding is complete (charges_enabled = true)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_connect_onboarded boolean DEFAULT false;

-- Platform fee percentage (default 2.5%). Allows per-contractor customization later.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS platform_fee_percent numeric(5,2) DEFAULT 2.50;

-- Index for fast lookup during payment flow
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_account
  ON public.profiles(stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

-- ================================================================
-- QUOTES: track Stripe Connect payment sessions
-- ================================================================
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS stripe_connect_session_id text;

-- ================================================================
-- INVOICES: track Connect payment sessions (supplements existing stripe_session_id)
-- ================================================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_connect_session_id text;
