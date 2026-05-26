-- ═══════════════════════════════════════════════════════════════════════
-- Review request after payment
-- Adds a contractor-configurable review link (e.g. their Google Business
-- "leave a review" URL). When set, the paid-in-full receipt email appends a
-- "How did we do?" CTA so satisfied customers can leave a review the moment
-- they pay — the #1 organic-growth lever for trades.
--
-- Safe to run repeatedly (IF NOT EXISTS). Code paths degrade gracefully when
-- the column is absent: updateProfile() strips unknown columns and retries,
-- and the webhook fetches this column in an isolated try/catch.
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS review_link text;

COMMENT ON COLUMN public.profiles.review_link IS
  'Contractor''s public review URL (Google Business, etc.). When set, the paid receipt email shows a "Leave a review" CTA.';
