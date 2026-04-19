-- ================================================================
-- PAYMENTS ONBOARDING — Terms Acceptance Tracking
-- Adds legal acknowledgment columns to profiles
-- Safe & idempotent — run in Supabase SQL Editor
-- ================================================================

-- Timestamp of when the contractor accepted payment responsibility terms
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payments_terms_accepted_at timestamptz;

-- Version string of the terms they accepted (e.g. '2026-04-07')
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payments_terms_version text;

-- IP address at time of acceptance (for legal records)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payments_terms_ip text;
