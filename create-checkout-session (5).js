-- ================================================================
-- PUNCHLIST v51 — COMPLETE PRODUCTION SCHEMA
-- Includes all tables and columns from Phases 1-8
-- This is the ONE schema file. Paste into Supabase SQL Editor → RUN.
-- Safe on any database state. Fully idempotent.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ================================================================
-- 1. PROFILES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           text,
  company_name        text,
  trade               text        DEFAULT 'Other',
  province            text        DEFAULT 'ON',
  country             text        DEFAULT 'CA',
  phone               text,
  email               text,
  default_expiry_days integer     DEFAULT 14,
  logo_url            text        DEFAULT '',
  default_labour_rate numeric     DEFAULT 0,
  default_deposit_mode text       DEFAULT 'none',
  default_deposit_percent numeric(5,2) DEFAULT 0,
  default_deposit_amount numeric(10,2) DEFAULT 0,
  default_deposit_value numeric(10,2) DEFAULT 0,
  payment_methods     jsonb       DEFAULT '[]'::jsonb,
  payment_instructions text       DEFAULT '',
  etransfer_email     text        DEFAULT '',
  venmo_zelle_handle  text        DEFAULT '',
  square_payment_link text        DEFAULT '',
  paypal_link         text        DEFAULT '',
  stripe_invoices_enabled boolean DEFAULT false,
  invoice_note        text        DEFAULT '',
  invoice_due_days    integer     DEFAULT 14,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Safe column additions for existing databases
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trade text DEFAULT 'Other';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS province text DEFAULT 'ON';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text DEFAULT 'CA';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_expiry_days integer DEFAULT 14;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_labour_rate numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_deposit_mode text DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_deposit_percent numeric(5,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_deposit_amount numeric(10,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_deposit_value numeric(10,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_instructions text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS etransfer_email text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS venmo_zelle_handle text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS square_payment_link text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paypal_link text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_invoices_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invoice_note text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invoice_due_days integer DEFAULT 14;

-- Fix payment_methods type if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' 
      AND column_name = 'payment_methods' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN payment_methods TYPE jsonb
    USING CASE
      WHEN payment_methods IS NULL OR payment_methods = '' THEN '[]'::jsonb
      WHEN payment_methods ~ '^\[' THEN payment_methods::jsonb
      ELSE ('["' || payment_methods || '"]')::jsonb
    END;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_methods jsonb DEFAULT '[]'::jsonb;

-- ================================================================
-- 2. CUSTOMERS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  email       text,
  phone       text,
  address     text,
  notes       text,
  archived_at timestamptz,
  last_quote_at timestamptz,
  total_quoted numeric(12,2) DEFAULT 0,
  total_approved numeric(12,2) DEFAULT 0,
  quote_count integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_quote_at timestamptz;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_quoted numeric(12,2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_approved numeric(12,2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS quote_count integer DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;

-- ================================================================
-- 3. QUOTES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id               uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  title                     text,
  description               text,
  scope_summary             text,
  assumptions               text,
  exclusions                text,
  internal_notes            text,
  quick_notes               text,
  schedule_window           text,
  revision_summary          text,
  status                    text          NOT NULL DEFAULT 'draft',
  subtotal                  numeric(10,2) NOT NULL DEFAULT 0,
  tax                       numeric(10,2) NOT NULL DEFAULT 0,
  total                     numeric(10,2) NOT NULL DEFAULT 0,
  discount                  numeric(10,2) DEFAULT 0,
  trade                     text,
  province                  text          DEFAULT 'ON',
  country                   text          DEFAULT 'CA',
  deposit_required          boolean       DEFAULT false,
  deposit_amount            numeric(10,2) DEFAULT 0,
  deposit_percent           numeric(5,2)  DEFAULT 0,
  deposit_status            text          DEFAULT 'not_required',
  deposit_paid_at           timestamptz,
  deposit_session_id        text,
  deposit_payment_intent_id text,
  delivery_method           text          DEFAULT 'email',
  expiry_days               integer       DEFAULT 14,
  expires_at                timestamptz,
  follow_up_at              timestamptz,
  share_token               text          NOT NULL DEFAULT uuid_generate_v4()::text,
  revision_number           integer       DEFAULT 1,
  confidence_score          integer,
  view_count                integer       DEFAULT 0,
  first_viewed_at           timestamptz,
  last_viewed_at            timestamptz,
  photos                    jsonb         DEFAULT '[]'::jsonb,
  approved_at               timestamptz,
  declined_at               timestamptz,
  time_to_view_seconds      integer,
  time_to_respond_seconds   integer,
  helper_context            jsonb         DEFAULT '{}'::jsonb,
  last_suggestion_run_at    timestamptz,
  helper_job_code           text,
  helper_summary            jsonb         DEFAULT '{}'::jsonb,
  helper_sections           jsonb         DEFAULT '[]'::jsonb,
  helper_last_run_at        timestamptz,
  created_at                timestamptz   DEFAULT now(),
  updated_at                timestamptz   DEFAULT now()
);

-- Safe column additions
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS scope_summary text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS assumptions text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS exclusions text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quick_notes text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS schedule_window text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS revision_summary text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS trade text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS province text DEFAULT 'ON';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS country text DEFAULT 'CA';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deposit_required boolean DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deposit_percent numeric(5,2) DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deposit_status text DEFAULT 'not_required';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deposit_session_id text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deposit_payment_intent_id text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'email';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS expiry_days integer DEFAULT 14;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS share_token text DEFAULT uuid_generate_v4()::text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS revision_number integer DEFAULT 1;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS confidence_score integer;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS discount numeric(10,2) DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS time_to_view_seconds integer;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS time_to_respond_seconds integer;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS helper_context jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS last_suggestion_run_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS helper_job_code text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS helper_summary jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS helper_sections jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS helper_last_run_at timestamptz;
-- v42: Signature + archive
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signature_data text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_name text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_ip text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- ================================================================
-- 4. LINE ITEMS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.line_items (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id                uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  sort_order              integer       DEFAULT 0,
  name                    text          NOT NULL DEFAULT '',
  quantity                numeric(10,2) DEFAULT 1,
  unit_price              numeric(10,2) DEFAULT 0,
  notes                   text,
  category                text,
  included                boolean       DEFAULT true,
  item_type               text          DEFAULT 'included',
  pricing_basis           text,
  typical_range_low       numeric(10,2),
  typical_range_high      numeric(10,2),
  source_hint             text,
  price_note              text,
  source_detail           text,
  was_suggested           boolean       DEFAULT false,
  suggestion_confidence   text,
  created_at              timestamptz   DEFAULT now()
);

ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS included boolean DEFAULT true;
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'included';
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS pricing_basis text;
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS typical_range_low numeric(10,2);
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS typical_range_high numeric(10,2);
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS source_hint text;
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS price_note text;
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS source_detail text;
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS was_suggested boolean DEFAULT false;
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS suggestion_confidence text;

-- ================================================================
-- 5. BOOKINGS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id      uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  quote_id         uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  scheduled_for    timestamptz NOT NULL,
  duration_minutes integer     DEFAULT 120,
  notes            text,
  status           text NOT NULL DEFAULT 'scheduled',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 120;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notify_customer boolean DEFAULT false;

-- ================================================================
-- 6. AI USAGE
-- ================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL DEFAULT 'scope_build',
  tokens_used integer DEFAULT 0,
  model       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS tokens_used integer DEFAULT 0;
ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS model text;

-- ================================================================
-- 7. QUOTE VIEWS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.quote_views (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id   uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  viewer_ip  text,
  user_agent text,
  viewed_at  timestamptz DEFAULT now()
);

-- ================================================================
-- 8. INVOICES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id          uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id       uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_number    text,
  title             text,
  description       text,
  subtotal          numeric(10,2) NOT NULL DEFAULT 0,
  tax               numeric(10,2) NOT NULL DEFAULT 0,
  total             numeric(10,2) NOT NULL DEFAULT 0,
  province          text DEFAULT 'ON',
  country           text DEFAULT 'CA',
  status            text NOT NULL DEFAULT 'draft',
  issued_at         timestamptz,
  due_at            timestamptz,
  paid_at           timestamptz,
  payment_method    text,
  payment_notes     text,
  payment_methods   jsonb DEFAULT '[]'::jsonb,
  payment_instructions text DEFAULT '',
  share_token       text NOT NULL DEFAULT gen_random_uuid()::text,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_methods jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_instructions text DEFAULT '';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deposit_credited numeric(10,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sort_order  integer DEFAULT 0,
  name        text NOT NULL DEFAULT '',
  quantity    numeric(10,2) DEFAULT 1,
  unit_price  numeric(10,2) DEFAULT 0,
  notes       text,
  category    text,
  included    boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ================================================================
-- 9. ADDITIONAL WORK
-- ================================================================
CREATE TABLE IF NOT EXISTS public.additional_work_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id         uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  booking_id       uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_id      uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  title            text NOT NULL DEFAULT 'Additional Work',
  reason           text,
  status           text NOT NULL DEFAULT 'draft',
  subtotal         numeric(10,2) NOT NULL DEFAULT 0,
  tax              numeric(10,2) NOT NULL DEFAULT 0,
  total            numeric(10,2) NOT NULL DEFAULT 0,
  province         text DEFAULT 'ON',
  country          text DEFAULT 'CA',
  revision_number  integer DEFAULT 1,
  share_token      text NOT NULL DEFAULT gen_random_uuid()::text,
  sent_at          timestamptz,
  viewed_at        timestamptz,
  approved_at      timestamptz,
  declined_at      timestamptz,
  customer_message text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.additional_work_items (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  additional_work_request_id uuid NOT NULL REFERENCES public.additional_work_requests(id) ON DELETE CASCADE,
  sort_order                 integer DEFAULT 0,
  name                       text NOT NULL DEFAULT '',
  quantity                   numeric(10,2) DEFAULT 1,
  unit_price                 numeric(10,2) DEFAULT 0,
  notes                      text,
  category                   text,
  created_at                 timestamptz DEFAULT now()
);

ALTER TABLE public.additional_work_requests ADD COLUMN IF NOT EXISTS country text DEFAULT 'CA';

-- ================================================================
-- 10. CO-PILOT TABLES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.company_catalog_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade                    text,
  category                 text,
  item_name                text NOT NULL,
  normalized_name          text GENERATED ALWAYS AS (lower(trim(item_name))) STORED,
  short_description        text,
  item_type                text DEFAULT 'service',
  last_price               numeric(10,2) DEFAULT 0,
  avg_price                numeric(10,2) DEFAULT 0,
  usage_count              integer DEFAULT 1,
  synonyms                 jsonb DEFAULT '[]'::jsonb,
  tags                     jsonb DEFAULT '[]'::jsonb,
  source                   text DEFAULT 'manual',
  linked_system_catalog_id text,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.helper_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id            uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id         uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  session_type        text DEFAULT 'scope_check',
  current_trade       text,
  current_job_summary text,
  current_context     jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.helper_messages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  helper_session_id  uuid NOT NULL REFERENCES public.helper_sessions(id) ON DELETE CASCADE,
  role               text NOT NULL DEFAULT 'user',
  message_text       text,
  structured_payload jsonb,
  action_payload     jsonb,
  created_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_item_suggestions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id             uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type          text DEFAULT 'rule_engine',
  source_ref_id        text,
  title                text NOT NULL,
  short_description    text,
  category             text,
  item_type            text DEFAULT 'service',
  suggested_price_low  numeric(10,2),
  suggested_price_high numeric(10,2),
  suggested_price      numeric(10,2),
  rationale            text,
  suggestion_tag       text,
  confidence_score     integer,
  is_grouped           boolean DEFAULT false,
  group_key            text,
  status               text DEFAULT 'suggested',
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ================================================================
-- 11. SYSTEM CATALOG (read-only reference)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.system_catalog_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade                 text NOT NULL,
  category              text NOT NULL,
  item_name             text NOT NULL,
  normalized_name       text GENERATED ALWAYS AS (lower(trim(item_name))) STORED,
  short_description     text,
  item_type             text DEFAULT 'service',
  default_unit          text DEFAULT 'each',
  typical_price_low     numeric(10,2),
  typical_price_high    numeric(10,2),
  pricing_confidence    text DEFAULT 'medium',
  synonyms              jsonb DEFAULT '[]'::jsonb,
  tags                  jsonb DEFAULT '[]'::jsonb,
  source                text DEFAULT 'system',
  sort_priority         integer DEFAULT 50,
  region_scope          text DEFAULT 'canada_us_general',
  usage_hint            text,
  follow_on_suggestions jsonb DEFAULT '[]'::jsonb,
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ================================================================
-- 12. HELPER ACTION LOGGING
-- ================================================================
CREATE TABLE IF NOT EXISTS public.quote_helper_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  item_name    text NOT NULL,
  helper_group text NOT NULL,
  action_type  text NOT NULL,
  unit_price   numeric(10,2),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_scope_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  job_code     text,
  job_label    text,
  scope_status text,
  scope_score  integer,
  sections     jsonb DEFAULT '[]'::jsonb,
  reviewed_at  timestamptz DEFAULT now()
);

-- ================================================================
-- BACKFILLS
-- ================================================================
UPDATE public.quotes SET share_token = uuid_generate_v4()::text WHERE share_token IS NULL;

-- ================================================================
-- PHASE 1-8: ADDITIONAL COLUMNS ON EXISTING TABLES
-- ================================================================

-- Quotes: v42 signature + archive
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signature_data text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signed_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_name text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_ip text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- Quotes: Phase 2 — conversation thread + optional selections
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS conversation jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS selected_optional_ids jsonb DEFAULT '[]'::jsonb;

-- Quotes: Phase 6 — sequential quote number
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_number integer;

-- Quotes: v70 — photo URL for job site photos
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS photo_url text;

-- Profiles: Phase 2 — terms and conditions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_conditions text DEFAULT '';

-- Profiles: v70 — Stripe payment link
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_payment_link text DEFAULT '';

-- Profiles: Phase 7 — push + digest
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_subscription jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz;

-- Profiles: Phase 8 — subscription/billing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_active boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Bookings: v42 — notify preference
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notify_customer boolean DEFAULT false;

-- Invoices: Phase 5 — editing, Stripe, reminders
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount numeric(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS reminder_schedule jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deposit_credited numeric(10,2) DEFAULT 0;

-- ================================================================
-- PHASE 3: AMENDMENTS TABLE
-- ================================================================
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

-- ================================================================
-- PHASE 4: NOTIFICATIONS TABLE
-- ================================================================
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

-- ================================================================
-- PHASE 5: PAYMENTS TABLE (partial payments)
-- ================================================================
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

-- ================================================================
-- CONSTRAINTS
-- ================================================================
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('draft','sent','viewed','revision_requested','declined',
    'approved','approved_pending_deposit','scheduled','completed',
    'invoiced','paid','expired'));

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_deposit_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_deposit_status_check
  CHECK (deposit_status IN ('not_required','requested','pending','paid'));

ALTER TABLE public.line_items DROP CONSTRAINT IF EXISTS line_items_item_type_check;
ALTER TABLE public.line_items ADD CONSTRAINT line_items_item_type_check
  CHECK (item_type IN ('included','optional','recommended','allowance'));

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('scheduled','confirmed','completed','cancelled'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft','sent','viewed','partial','paid','overdue','cancelled'));

ALTER TABLE public.additional_work_requests DROP CONSTRAINT IF EXISTS awr_status_check;
ALTER TABLE public.additional_work_requests ADD CONSTRAINT awr_status_check
  CHECK (status IN ('draft','sent','viewed','approved','needs_review','declined','cancelled'));

ALTER TABLE public.company_catalog_items DROP CONSTRAINT IF EXISTS cci_source_check;
ALTER TABLE public.company_catalog_items ADD CONSTRAINT cci_source_check
  CHECK (source IN ('manual','ai_generated','imported','derived_from_quote'));

ALTER TABLE public.company_catalog_items DROP CONSTRAINT IF EXISTS cci_item_type_check;
ALTER TABLE public.company_catalog_items ADD CONSTRAINT cci_item_type_check
  CHECK (item_type IN ('service','material','diagnostic','finishing','optional','upgrade','labour'));

ALTER TABLE public.helper_sessions DROP CONSTRAINT IF EXISTS hs_session_type_check;
ALTER TABLE public.helper_sessions ADD CONSTRAINT hs_session_type_check
  CHECK (session_type IN ('scope_check','troubleshoot','build','helper_chat'));

ALTER TABLE public.helper_messages DROP CONSTRAINT IF EXISTS hm_role_check;
ALTER TABLE public.helper_messages ADD CONSTRAINT hm_role_check
  CHECK (role IN ('user','assistant','system'));

ALTER TABLE public.quote_item_suggestions DROP CONSTRAINT IF EXISTS qis_status_check;
ALTER TABLE public.quote_item_suggestions ADD CONSTRAINT qis_status_check
  CHECK (status IN ('suggested','accepted','dismissed','converted'));

ALTER TABLE public.quote_item_suggestions DROP CONSTRAINT IF EXISTS qis_source_type_check;
ALTER TABLE public.quote_item_suggestions ADD CONSTRAINT qis_source_type_check
  CHECK (source_type IN ('rule_engine','ai','catalog','helper'));

ALTER TABLE public.ai_usage DROP CONSTRAINT IF EXISTS ai_usage_action_check;

-- Phase 3: Amendments
ALTER TABLE public.amendments DROP CONSTRAINT IF EXISTS amendments_status_check;
ALTER TABLE public.amendments ADD CONSTRAINT amendments_status_check
  CHECK (status IN ('draft','sent','viewed','approved','declined'));

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON public.customers USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_share_token ON public.quotes(share_token);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_deposit_status ON public.quotes(deposit_status);
CREATE INDEX IF NOT EXISTS idx_quotes_updated_at ON public.quotes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_expires_at ON public.quotes(expires_at);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_line_items_quote_id ON public.line_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_line_items_sort ON public.line_items(quote_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON public.bookings(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON public.ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_views_quote_id ON public.quote_views(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON public.invoices(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_share_token ON public.invoices(share_token);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_awr_user_id ON public.additional_work_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_awr_quote_id ON public.additional_work_requests(quote_id);
CREATE INDEX IF NOT EXISTS idx_awr_customer_id ON public.additional_work_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_awr_share_token ON public.additional_work_requests(share_token);
CREATE INDEX IF NOT EXISTS idx_awr_status ON public.additional_work_requests(status);
CREATE INDEX IF NOT EXISTS idx_awi_request_id ON public.additional_work_items(additional_work_request_id);
CREATE INDEX IF NOT EXISTS idx_awi_sort ON public.additional_work_items(additional_work_request_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cci_user_id ON public.company_catalog_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cci_trade ON public.company_catalog_items(trade);
CREATE INDEX IF NOT EXISTS idx_cci_normalized ON public.company_catalog_items(normalized_name);
CREATE INDEX IF NOT EXISTS idx_cci_usage ON public.company_catalog_items(user_id, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_hs_user_id ON public.helper_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_hs_quote_id ON public.helper_sessions(quote_id);
CREATE INDEX IF NOT EXISTS idx_hm_session_id ON public.helper_messages(helper_session_id);
CREATE INDEX IF NOT EXISTS idx_qis_quote_id ON public.quote_item_suggestions(quote_id);
CREATE INDEX IF NOT EXISTS idx_qis_user_id ON public.quote_item_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_qis_status ON public.quote_item_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_sci_trade ON public.system_catalog_items(trade);
CREATE INDEX IF NOT EXISTS idx_sci_normalized ON public.system_catalog_items(normalized_name);
CREATE INDEX IF NOT EXISTS idx_sci_name_trgm ON public.system_catalog_items USING gin(item_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sci_active ON public.system_catalog_items(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_qha_quote_id ON public.quote_helper_actions(quote_id);
CREATE INDEX IF NOT EXISTS idx_qsr_quote_id ON public.quote_scope_reviews(quote_id);
-- Phase 3: Amendments
CREATE INDEX IF NOT EXISTS idx_amendments_quote_id ON public.amendments(quote_id);
CREATE INDEX IF NOT EXISTS idx_amendments_user_id ON public.amendments(user_id);
CREATE INDEX IF NOT EXISTS idx_amendments_status ON public.amendments(status);
CREATE INDEX IF NOT EXISTS idx_amendments_share_token ON public.amendments(share_token);
-- Phase 4: Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
-- Phase 5: Payments
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at DESC);
-- Phase 6: Quote numbering
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON public.quotes(user_id, quote_number);
-- Prevent duplicate quote numbers per user (race condition safety)
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_user_quote_number_unique;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_user_quote_number_unique UNIQUE (user_id, quote_number);
-- Phase 8: Stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.additional_work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.additional_work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helper_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helper_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_item_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_helper_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_scope_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
DROP POLICY IF EXISTS "customers_own" ON public.customers;
DROP POLICY IF EXISTS "quotes_own" ON public.quotes;
DROP POLICY IF EXISTS "quotes_public_read" ON public.quotes;
DROP POLICY IF EXISTS "quotes_public_update" ON public.quotes;
DROP POLICY IF EXISTS "line_items_own" ON public.line_items;
DROP POLICY IF EXISTS "line_items_public_read" ON public.line_items;
DROP POLICY IF EXISTS "line_items_public_update" ON public.line_items;
DROP POLICY IF EXISTS "bookings_own" ON public.bookings;
DROP POLICY IF EXISTS "ai_usage_own" ON public.ai_usage;
DROP POLICY IF EXISTS "quote_views_public_insert" ON public.quote_views;
DROP POLICY IF EXISTS "quote_views_owner_read" ON public.quote_views;
DROP POLICY IF EXISTS "invoices_own" ON public.invoices;
DROP POLICY IF EXISTS "invoices_public_read" ON public.invoices;
DROP POLICY IF EXISTS "inv_items_own" ON public.invoice_items;
DROP POLICY IF EXISTS "inv_items_public_read" ON public.invoice_items;
DROP POLICY IF EXISTS "awr_own" ON public.additional_work_requests;
DROP POLICY IF EXISTS "awr_public_read" ON public.additional_work_requests;
DROP POLICY IF EXISTS "awr_public_update" ON public.additional_work_requests;
DROP POLICY IF EXISTS "awi_own" ON public.additional_work_items;
DROP POLICY IF EXISTS "awi_public_read" ON public.additional_work_items;
DROP POLICY IF EXISTS "cci_own" ON public.company_catalog_items;
DROP POLICY IF EXISTS "hs_own" ON public.helper_sessions;
DROP POLICY IF EXISTS "hm_own" ON public.helper_messages;
DROP POLICY IF EXISTS "qis_own" ON public.quote_item_suggestions;
DROP POLICY IF EXISTS "sci_read" ON public.system_catalog_items;
DROP POLICY IF EXISTS "Users own helper actions" ON public.quote_helper_actions;
DROP POLICY IF EXISTS "Users own scope reviews" ON public.quote_scope_reviews;

-- Create policies
CREATE POLICY "profiles_own" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "customers_own" ON public.customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quotes_own" ON public.quotes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quotes_public_read" ON public.quotes FOR SELECT USING (share_token IS NOT NULL);
CREATE POLICY "quotes_public_update" ON public.quotes FOR UPDATE USING (share_token IS NOT NULL) WITH CHECK (share_token IS NOT NULL);
CREATE POLICY "line_items_own" ON public.line_items FOR ALL USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));
CREATE POLICY "line_items_public_read" ON public.line_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.share_token IS NOT NULL));
CREATE POLICY "line_items_public_update" ON public.line_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.share_token IS NOT NULL));
CREATE POLICY "bookings_own" ON public.bookings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_usage_own" ON public.ai_usage FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quote_views_public_insert" ON public.quote_views FOR INSERT WITH CHECK (true);
CREATE POLICY "quote_views_owner_read" ON public.quote_views FOR SELECT USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));
CREATE POLICY "invoices_own" ON public.invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_public_read" ON public.invoices FOR SELECT USING (share_token IS NOT NULL);
CREATE POLICY "inv_items_own" ON public.invoice_items FOR ALL USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));
CREATE POLICY "inv_items_public_read" ON public.invoice_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.share_token IS NOT NULL));
CREATE POLICY "awr_own" ON public.additional_work_requests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "awr_public_read" ON public.additional_work_requests FOR SELECT USING (share_token IS NOT NULL);
CREATE POLICY "awr_public_update" ON public.additional_work_requests FOR UPDATE USING (share_token IS NOT NULL) WITH CHECK (share_token IS NOT NULL);
CREATE POLICY "awi_own" ON public.additional_work_items FOR ALL USING (EXISTS (SELECT 1 FROM public.additional_work_requests r WHERE r.id = additional_work_request_id AND r.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.additional_work_requests r WHERE r.id = additional_work_request_id AND r.user_id = auth.uid()));
CREATE POLICY "awi_public_read" ON public.additional_work_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.additional_work_requests r WHERE r.id = additional_work_request_id AND r.share_token IS NOT NULL));
CREATE POLICY "cci_own" ON public.company_catalog_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "hs_own" ON public.helper_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "hm_own" ON public.helper_messages FOR ALL USING (EXISTS (SELECT 1 FROM public.helper_sessions hs WHERE hs.id = helper_session_id AND hs.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.helper_sessions hs WHERE hs.id = helper_session_id AND hs.user_id = auth.uid()));
CREATE POLICY "qis_own" ON public.quote_item_suggestions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sci_read" ON public.system_catalog_items FOR SELECT USING (true);
CREATE POLICY "Users own helper actions" ON public.quote_helper_actions FOR ALL USING (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));
CREATE POLICY "Users own scope reviews" ON public.quote_scope_reviews FOR ALL USING (quote_id IN (SELECT id FROM public.quotes WHERE user_id = auth.uid()));

-- Phase 3: Amendments
DROP POLICY IF EXISTS "amendments_own" ON public.amendments;
DROP POLICY IF EXISTS "amendments_public_read" ON public.amendments;
DROP POLICY IF EXISTS "amendments_public_update" ON public.amendments;
CREATE POLICY "amendments_own" ON public.amendments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "amendments_public_read" ON public.amendments FOR SELECT
  USING (share_token IS NOT NULL);
CREATE POLICY "amendments_public_update" ON public.amendments FOR UPDATE
  USING (share_token IS NOT NULL) WITH CHECK (share_token IS NOT NULL);

-- Phase 4: Notifications
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Phase 5: Payments
DROP POLICY IF EXISTS "payments_own" ON public.payments;
DROP POLICY IF EXISTS "payments_public_read" ON public.payments;
CREATE POLICY "payments_own" ON public.payments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payments_public_read" ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.share_token IS NOT NULL));

-- ================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS trg_quotes_updated_at ON public.quotes;
DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS trg_awr_updated_at ON public.additional_work_requests;
DROP TRIGGER IF EXISTS trg_cci_updated_at ON public.company_catalog_items;
DROP TRIGGER IF EXISTS trg_hs_updated_at ON public.helper_sessions;
DROP TRIGGER IF EXISTS trg_qis_updated_at ON public.quote_item_suggestions;
DROP TRIGGER IF EXISTS trg_sci_updated_at ON public.system_catalog_items;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_awr_updated_at BEFORE UPDATE ON public.additional_work_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cci_updated_at BEFORE UPDATE ON public.company_catalog_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_hs_updated_at BEFORE UPDATE ON public.helper_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_qis_updated_at BEFORE UPDATE ON public.quote_item_suggestions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sci_updated_at BEFORE UPDATE ON public.system_catalog_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Phase 3: Amendments updated_at trigger
DROP TRIGGER IF EXISTS trg_amendments_updated_at ON public.amendments;
CREATE TRIGGER trg_amendments_updated_at BEFORE UPDATE ON public.amendments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Phase 6: Auto-assign sequential quote numbers per contractor
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

-- ================================================================
-- UTILITY FUNCTIONS
-- ================================================================
CREATE OR REPLACE FUNCTION public.auto_expire_quotes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.quotes SET status = 'expired'
  WHERE expires_at < now() AND status IN ('sent','viewed') AND expires_at IS NOT NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.ai_usage_count(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE cnt integer;
BEGIN
  SELECT count(*)::integer INTO cnt FROM public.ai_usage
  WHERE user_id = p_user_id AND created_at > now() - interval '30 days';
  RETURN coalesce(cnt, 0);
END; $$;

CREATE OR REPLACE FUNCTION public.record_quote_view(p_quote_id uuid, p_ip text DEFAULT NULL, p_ua text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.quote_views (quote_id, viewer_ip, user_agent) VALUES (p_quote_id, p_ip, p_ua);
  UPDATE public.quotes SET
    view_count = coalesce(view_count, 0) + 1,
    first_viewed_at = coalesce(first_viewed_at, now()),
    last_viewed_at = now(),
    status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
  WHERE id = p_quote_id;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    full_name = CASE WHEN excluded.full_name != '' THEN excluded.full_name ELSE profiles.full_name END;
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF new.email IS DISTINCT FROM old.email THEN
    UPDATE public.profiles SET email = new.email WHERE id = new.id;
  END IF;
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_change();

-- ================================================================
-- STORAGE BUCKETS
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('quote-photos', 'quote-photos', true, 10485760, '{"image/jpeg","image/png","image/webp","image/heic"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', true, 2097152, '{"image/png","image/jpeg","image/svg+xml","image/webp"}')
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Users can upload quote photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read quote photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete quote photos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read logos" ON storage.objects;
DROP POLICY IF EXISTS "Users update own logos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own logos" ON storage.objects;

CREATE POLICY "Users can upload quote photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'quote-photos');
CREATE POLICY "Public read quote photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'quote-photos');
CREATE POLICY "Users can delete quote photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'quote-photos');
CREATE POLICY "Users upload own logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Public read logos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'logos');
CREATE POLICY "Users update own logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ================================================================
-- FORCE POSTGREST SCHEMA CACHE RELOAD
-- ================================================================
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- DONE!
-- 1. Wait 10-15 seconds for PostgREST cache to reload
-- 2. Deploy: npx vercel --prod
-- 3. Test: create quote, save, send, open public link
-- ================================================================
