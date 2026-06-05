-- ═══════════════════════════════════════════════════════════════
-- Punchlist — RLS leak fix
--
-- The `quotes_public_read` policy was USING (share_token IS NOT NULL)
-- which PostgREST applied for BOTH the anon role (the intent — let
-- unauthenticated customer-portal visitors read a quote by share
-- token) AND for every signed-in authenticated user — so any
-- contractor with an account could SELECT every row in public.quotes
-- that has a share_token (which every quote does, assigned at
-- INSERT). Same hole on invoices and the line-item / invoice-item
-- helper policies.
--
-- They could SELECT but couldn't DELETE (FOR ALL is gated by
-- auth.uid() = user_id), so the symptom was: a contractor deleted
-- their account, recreated it with the same email, then saw 9 stale
-- "drafts" they couldn't remove — those were other people's quotes
-- (or orphaned rows from a partial wipe) leaking through this
-- public-read policy.
--
-- Fix: re-create each `*_public_read` / `*_public_update` policy
-- with an explicit TO anon clause so it only grants access to
-- unauthenticated visitors. Authenticated users still match the
-- corresponding `*_own` policy when they own the row, and get
-- nothing back when they don't.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── quotes ──
DROP POLICY IF EXISTS "quotes_public_read"   ON public.quotes;
DROP POLICY IF EXISTS "quotes_public_update" ON public.quotes;
CREATE POLICY "quotes_public_read"
  ON public.quotes FOR SELECT TO anon
  USING (share_token IS NOT NULL);
CREATE POLICY "quotes_public_update"
  ON public.quotes FOR UPDATE TO anon
  USING (share_token IS NOT NULL)
  WITH CHECK (share_token IS NOT NULL);

-- ── line_items (via parent quote's share_token) ──
DROP POLICY IF EXISTS "line_items_public_read"   ON public.line_items;
DROP POLICY IF EXISTS "line_items_public_update" ON public.line_items;
CREATE POLICY "line_items_public_read"
  ON public.line_items FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.share_token IS NOT NULL));
CREATE POLICY "line_items_public_update"
  ON public.line_items FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.share_token IS NOT NULL));

-- ── invoices ──
DROP POLICY IF EXISTS "invoices_public_read" ON public.invoices;
CREATE POLICY "invoices_public_read"
  ON public.invoices FOR SELECT TO anon
  USING (share_token IS NOT NULL);

-- ── invoice_items (via parent invoice's share_token) ──
DROP POLICY IF EXISTS "inv_items_public_read" ON public.invoice_items;
CREATE POLICY "inv_items_public_read"
  ON public.invoice_items FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.share_token IS NOT NULL));

-- ── additional_work_requests (defensive — same pattern) ──
DROP POLICY IF EXISTS "awr_public_read" ON public.additional_work_requests;
CREATE POLICY "awr_public_read"
  ON public.additional_work_requests FOR SELECT TO anon
  USING (share_token IS NOT NULL);

COMMIT;

-- After running this, every contractor's Quotes / Invoices list
-- should only show their own rows. If a contractor was previously
-- seeing other people's quotes, those will disappear on the next
-- listQuotes() — they were never theirs to delete in the first place.
