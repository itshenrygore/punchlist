-- ================================================================
-- PUNCHLIST v51 — LIFECYCLE MIGRATION (Phase 8: Billing/Subscription)
--
-- Adds subscription tracking columns to profiles.
-- Safe to run multiple times (idempotent).
-- Run in Supabase SQL Editor after deploying v51.
-- ================================================================

-- Subscription plan: 'free', 'pro_monthly', 'pro_annual'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'free';

-- Stripe customer ID for portal management
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Trial support (reserved for future use)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_active boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Index for webhook lookups by stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
