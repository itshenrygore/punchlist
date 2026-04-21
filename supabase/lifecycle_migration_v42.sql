-- ================================================================
-- PUNCHLIST v42 — LIFECYCLE MIGRATION
-- Run this on your live Supabase DB after deploying v42
-- Safe to run multiple times (idempotent)
-- ================================================================

-- Signature fields on quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signature_data text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_name text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_ip text;

-- Archive support (soft delete for signed quotes)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Approved timestamp (if not already present)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS declined_at timestamptz;

-- Notify preference on bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notify_customer boolean DEFAULT false;
