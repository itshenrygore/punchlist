-- ═══════════════════════════════════════════════════════════
-- Phase 4 — User milestones migration
-- Adds milestone columns to the profiles table.
-- These replace 13 scattered localStorage keys with a single
-- cross-device source of truth.
--
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to run multiple times — uses IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════

-- Milestone timestamps (all nullable — null = hasn't happened yet)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_build_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_send_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_describe_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coachmarks_dismissed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cmdk_tip_seen timestamptz;

-- Add a comment for documentation
COMMENT ON COLUMN public.profiles.onboarded_at IS 'When the user completed the onboarding wizard (replaces pl_onboarded localStorage key)';
COMMENT ON COLUMN public.profiles.first_build_at IS 'When the user first tapped Build Quote (replaces pl_has_built_quote localStorage key)';
COMMENT ON COLUMN public.profiles.first_send_at IS 'When the user first sent a quote (replaces pl_first_send_at, pl_has_sent_quote, pl_has_sent_quote_first localStorage keys)';
COMMENT ON COLUMN public.profiles.first_describe_at IS 'When the user first typed a job description (replaces pl_first_describe_at localStorage key)';
COMMENT ON COLUMN public.profiles.coachmarks_dismissed_at IS 'When the user dismissed builder coachmarks (replaces pl_coachmarks_dismissed localStorage key)';
COMMENT ON COLUMN public.profiles.cmdk_tip_seen IS 'When the user saw the Cmd+K tip toast (replaces pl_cmdk_tip_seen localStorage key)';
