-- ═══════════════════════════════════════════════════════════════
-- Punchlist — optional signature + optional job completion
--
-- Two additive columns. Both are safe to run multiple times.
--
-- 1. profiles.require_signature
--    Controls whether a customer must draw a signature to approve a
--    quote. Default FALSE = one-tap "Approve" (lower friction, more
--    approvals). Contractors who want a drawn signature on file flip
--    this on in Settings → Quote approval. Even with it off, approval
--    still records the signer's typed name, timestamp, and IP — a
--    legitimate "approved by X on {date}" record.
--
-- 2. quotes.completed_at
--    Optional marker for contractors who track job completion
--    separately from payment. Setting it does NOT gate invoicing or
--    payment — the money path (approve → invoice → paid) is unchanged.
--    Contractors who don't care can ignore it entirely.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS require_signature boolean DEFAULT false;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
