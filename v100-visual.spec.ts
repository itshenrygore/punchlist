-- ================================================================
-- PUNCHLIST v70 — Schema fixes for E2E test failures
-- Run this in your Supabase SQL Editor
-- ================================================================

-- 1. photo_url on quotes — CRITICAL
-- Without this column, every createQuote() call returns 400.
-- The buildQuotePayload function sends photo_url but the column doesn't exist.
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. stripe_payment_link on profiles
-- Settings page writes this field but the column was never added.
-- Saving settings with a Stripe link populated will silently fail.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_payment_link text DEFAULT '';

-- Verify: these should already exist but ensure they're present
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_conditions text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_subscription jsonb;

-- ================================================================
-- DONE — re-run your E2E tests after applying
-- ================================================================
