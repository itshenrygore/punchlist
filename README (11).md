-- Punchlist v71 fixes migration
-- Run this on your Supabase database to add missing columns

-- H4: Ensure conversation column exists for customer questions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'conversation') THEN
    ALTER TABLE quotes ADD COLUMN conversation jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Ensure declined_at column exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'declined_at') THEN
    ALTER TABLE quotes ADD COLUMN declined_at timestamptz;
  END IF;
END $$;

-- Ensure time_to_view_seconds and time_to_respond_seconds exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'time_to_view_seconds') THEN
    ALTER TABLE quotes ADD COLUMN time_to_view_seconds integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'time_to_respond_seconds') THEN
    ALTER TABLE quotes ADD COLUMN time_to_respond_seconds integer;
  END IF;
END $$;

-- Create index for expiry checks (used by expireStaleDrafts and public-quote inline expiry)
CREATE INDEX IF NOT EXISTS idx_quotes_expires_at_status ON quotes (expires_at, status) WHERE expires_at IS NOT NULL;

-- Create index for monthly send count (billing enforcement)
CREATE INDEX IF NOT EXISTS idx_quotes_sent_at_user ON quotes (user_id, sent_at) WHERE sent_at IS NOT NULL;
