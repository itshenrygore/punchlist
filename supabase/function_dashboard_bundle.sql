-- ══════════════════════════════════════════════════════════════════
-- dashboard_bundle RPC
-- Returns everything the v2 dashboard needs in a single round-trip.
--
-- Benchmark query (run EXPLAIN ANALYZE against a seeded 100-quote user):
--   EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
--   SELECT public.rpc_dashboard_bundle(p_user_id := '<uuid>');
-- Target: p95 < 200ms. If over, add indexes noted below.
--
-- Run: psql $DATABASE_URL -f supabase/function_dashboard_bundle.sql
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_dashboard_bundle(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now           timestamptz := now();
  v_today_start   timestamptz := date_trunc('day', v_now AT TIME ZONE 'America/Edmonton');
  v_week_end      timestamptz := v_today_start + interval '7 days';
  v_month_start   timestamptz := date_trunc('month', v_now);
  v_last_month_s  timestamptz := date_trunc('month', v_now - interval '1 month');
  v_last_month_e  timestamptz := date_trunc('month', v_now);

  -- Security: verify caller owns the data
  v_caller uuid := auth.uid();

  v_today_actions     jsonb;
  v_pipeline_counts   jsonb;
  v_week_scheduled    jsonb;
  v_revenue_week      numeric := 0;
  v_revenue_month     numeric := 0;
  v_revenue_last      numeric := 0;
  v_headline          jsonb;
  v_insights          jsonb;
BEGIN
  -- Ownership guard (SECURITY DEFINER bypasses RLS so we enforce manually)
  IF v_caller IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;

  -- ── 1. TODAY ACTIONS ──────────────────────────────────────────
  -- Urgency-sorted merge of:
  --   a) overdue nudges (followup candidates)
  --   b) viewed-but-not-approved quotes
  --   c) jobs starting today / tomorrow
  --   d) invoices 14+ days unpaid
  SELECT jsonb_agg(item ORDER BY item->>'priority' ASC) INTO v_today_actions
  FROM (
    -- a) Overdue nudges — sent/viewed, last_followup_at 5+ days ago or null + sent 2+ days ago
    SELECT jsonb_build_object(
      'type',     'followup',
      'priority', CASE
        WHEN q.last_followup_at IS NOT NULL AND (v_now - q.last_followup_at) >= interval '5 days' THEN '0'
        WHEN q.last_followup_at IS NULL AND (v_now - q.sent_at) >= interval '2 days' THEN '1'
        ELSE '2'
      END,
      'quote_id', q.id,
      'title',    COALESCE(q.title, 'Untitled quote'),
      'total',    q.total,
      'customer_name', c.name,
      'customer_phone', c.phone,
      'customer_email', c.email,
      'view_count', q.view_count,
      'followup_count', q.followup_count,
      'last_followup_at', q.last_followup_at,
      'views_since_followup', q.views_since_followup,
      'urgency',  CASE
        WHEN q.last_followup_at IS NOT NULL AND (v_now - q.last_followup_at) >= interval '5 days' THEN 'red'
        WHEN q.last_followup_at IS NOT NULL AND (v_now - q.last_followup_at) >= interval '2 days' THEN 'amber'
        WHEN q.last_followup_at IS NULL AND (v_now - COALESCE(q.sent_at, q.created_at)) >= interval '4 days' THEN 'amber'
        ELSE 'neutral'
      END
    ) AS item
    FROM public.quotes q
    LEFT JOIN public.customers c ON c.id = q.customer_id
    WHERE q.user_id = p_user_id
      AND q.status IN ('sent','viewed','question_asked')
      AND q.archived_at IS NULL
      AND (
        (q.last_followup_at IS NOT NULL AND (v_now - q.last_followup_at) >= interval '2 days')
        OR
        (q.last_followup_at IS NULL AND (v_now - COALESCE(q.sent_at, q.created_at)) >= interval '2 days')
      )

    UNION ALL

    -- b) Viewed 2+ times but not approved
    SELECT jsonb_build_object(
      'type',     'viewed_hot',
      'priority', '1',
      'quote_id', q.id,
      'title',    COALESCE(q.title, 'Untitled quote'),
      'total',    q.total,
      'customer_name', c.name,
      'customer_phone', c.phone,
      'customer_email', c.email,
      'view_count', q.view_count,
      'last_viewed_at', q.last_viewed_at
    ) AS item
    FROM public.quotes q
    LEFT JOIN public.customers c ON c.id = q.customer_id
    WHERE q.user_id = p_user_id
      AND q.status IN ('viewed')
      AND q.view_count >= 2
      AND q.archived_at IS NULL

    UNION ALL

    -- c) Invoices 14+ days unpaid
    SELECT jsonb_build_object(
      'type',     'invoice_overdue',
      'priority', '0',
      'invoice_id', i.id,
      'title',    COALESCE(q.title, 'Invoice'),
      'total',    i.total,
      'customer_name', c.name,
      'due_at',   i.due_at,
      'days_overdue', EXTRACT(DAY FROM (v_now - i.due_at))::int
    ) AS item
    FROM public.invoices i
    LEFT JOIN public.quotes q ON q.id = i.quote_id
    LEFT JOIN public.customers c ON c.id = COALESCE(i.customer_id, q.customer_id)
    WHERE i.user_id = p_user_id
      AND i.status NOT IN ('paid','cancelled')
      AND i.due_at IS NOT NULL
      AND i.due_at < v_now - interval '14 days'

    UNION ALL

    -- d) Bookings starting today or tomorrow
    SELECT jsonb_build_object(
      'type',     'scheduled_today',
      'priority', '2',
      'booking_id', b.id,
      'quote_id', b.quote_id,
      'title',    COALESCE(q.title, 'Job'),
      'customer_name', c.name,
      'scheduled_for', b.scheduled_for
    ) AS item
    FROM public.bookings b
    LEFT JOIN public.quotes q ON q.id = b.quote_id
    LEFT JOIN public.customers c ON c.id = COALESCE(b.customer_id, q.customer_id)
    WHERE b.user_id = p_user_id
      AND b.status NOT IN ('cancelled','completed')
      AND b.scheduled_for >= v_today_start
      AND b.scheduled_for < v_today_start + interval '2 days'
  ) sub;

  -- ── 2. PIPELINE COUNTS ────────────────────────────────────────
  SELECT jsonb_build_object(
    'draft',     COUNT(*) FILTER (WHERE q.status = 'draft'),
    'sent',      COUNT(*) FILTER (WHERE q.status = 'sent' AND COALESCE(q.view_count,0) = 0),
    'viewed',    COUNT(*) FILTER (WHERE q.status IN ('viewed','question_asked')
                                     OR (q.status = 'sent' AND q.view_count > 0)),
    'approved',  COUNT(*) FILTER (WHERE q.status IN ('approved','approved_pending_deposit')),
    'scheduled', COUNT(*) FILTER (WHERE q.status = 'scheduled'),
    'completed', COUNT(*) FILTER (WHERE q.status IN ('completed','invoiced','paid')),
    'total_draft_value',    COALESCE(SUM(q.total) FILTER (WHERE q.status = 'draft'),0),
    'total_sent_value',     COALESCE(SUM(q.total) FILTER (WHERE q.status IN ('sent','viewed','question_asked')),0),
    'total_approved_value', COALESCE(SUM(q.total) FILTER (WHERE q.status IN ('approved','approved_pending_deposit','scheduled')),0)
  )
  INTO v_pipeline_counts
  FROM public.quotes q
  WHERE q.user_id = p_user_id AND q.archived_at IS NULL;

  -- ── 3. WEEK SCHEDULE ─────────────────────────────────────────
  SELECT jsonb_agg(
    jsonb_build_object(
      'booking_id',    b.id,
      'quote_id',      b.quote_id,
      'quote_title',   COALESCE(q.title, 'Job'),
      'customer_name', c.name,
      'customer_phone', c.phone,
      'scheduled_for', b.scheduled_for,
      'total',         q.total
    )
    ORDER BY b.scheduled_for ASC
  ) INTO v_week_scheduled
  FROM public.bookings b
  LEFT JOIN public.quotes q ON q.id = b.quote_id
  LEFT JOIN public.customers c ON c.id = COALESCE(b.customer_id, q.customer_id)
  WHERE b.user_id = p_user_id
    AND b.status NOT IN ('cancelled','completed')
    AND b.scheduled_for >= v_today_start
    AND b.scheduled_for < v_week_end;

  -- ── 4. REVENUE ───────────────────────────────────────────────
  -- This week: sum of quote totals for jobs with bookings in the 7-day window
  SELECT COALESCE(SUM(q.total), 0) INTO v_revenue_week
  FROM public.bookings b
  JOIN public.quotes q ON q.id = b.quote_id
  WHERE b.user_id = p_user_id
    AND b.status NOT IN ('cancelled')
    AND b.scheduled_for >= v_today_start
    AND b.scheduled_for < v_week_end;

  -- This month: revenue from approved/paid quotes
  SELECT COALESCE(SUM(q.total), 0) INTO v_revenue_month
  FROM public.quotes q
  WHERE q.user_id = p_user_id
    AND q.status IN ('approved','approved_pending_deposit','scheduled','completed','invoiced','paid')
    AND q.approved_at >= v_month_start;

  -- Last month comparison
  SELECT COALESCE(SUM(q.total), 0) INTO v_revenue_last
  FROM public.quotes q
  WHERE q.user_id = p_user_id
    AND q.status IN ('approved','approved_pending_deposit','scheduled','completed','invoiced','paid')
    AND q.approved_at >= v_last_month_s
    AND q.approved_at < v_last_month_e;

  -- ── 5. HEADLINE METRIC (priority function) ───────────────────
  -- Priority: overdue nudges > pending deposits > scheduled today > close rate trend
  DECLARE
    v_followup_count int;
    v_deposit_total  numeric;
    v_today_jobs_count int;
    v_close_rate     numeric;
    v_total_sent     int;
    v_total_approved int;
  BEGIN
    SELECT COUNT(*) INTO v_followup_count
    FROM public.quotes q
    WHERE q.user_id = p_user_id AND q.status IN ('sent','viewed','question_asked')
      AND q.archived_at IS NULL
      AND (
        (q.last_followup_at IS NOT NULL AND (v_now - q.last_followup_at) >= interval '2 days')
        OR (q.last_followup_at IS NULL AND (v_now - COALESCE(q.sent_at, q.created_at)) >= interval '2 days')
      );

    SELECT COALESCE(SUM(q.deposit_amount), 0) INTO v_deposit_total
    FROM public.quotes q
    WHERE q.user_id = p_user_id
      AND q.status IN ('approved','approved_pending_deposit')
      AND q.deposit_required = true AND q.deposit_status != 'paid';

    SELECT COUNT(*) INTO v_today_jobs_count
    FROM public.bookings b
    WHERE b.user_id = p_user_id AND b.status NOT IN ('cancelled','completed')
      AND b.scheduled_for >= v_today_start AND b.scheduled_for < v_today_start + interval '1 day';

    SELECT
      COUNT(*) FILTER (WHERE q.status != 'draft'),
      COUNT(*) FILTER (WHERE q.status IN ('approved','approved_pending_deposit','scheduled','completed','invoiced','paid'))
    INTO v_total_sent, v_total_approved
    FROM public.quotes q WHERE q.user_id = p_user_id;

    v_close_rate := CASE WHEN v_total_sent > 0 THEN ROUND((v_total_approved::numeric / v_total_sent) * 100) ELSE 0 END;

    v_headline := CASE
      WHEN v_followup_count > 0 THEN jsonb_build_object(
        'type', 'followups',
        'value', v_followup_count,
        'label', v_followup_count || ' quote' || CASE WHEN v_followup_count > 1 THEN 's' ELSE '' END || ' need follow-up',
        'tone', 'urgent'
      )
      WHEN v_deposit_total > 0 THEN jsonb_build_object(
        'type', 'deposits',
        'value', v_deposit_total,
        'label', '$' || to_char(v_deposit_total, 'FM999G999') || ' in pending deposits',
        'tone', 'warning'
      )
      WHEN v_today_jobs_count > 0 THEN jsonb_build_object(
        'type', 'scheduled',
        'value', v_today_jobs_count,
        'label', v_today_jobs_count || ' job' || CASE WHEN v_today_jobs_count > 1 THEN 's' ELSE '' END || ' on the schedule today',
        'tone', 'info'
      )
      ELSE jsonb_build_object(
        'type', 'close_rate',
        'value', v_close_rate,
        'label', v_close_rate || '% close rate',
        'tone', 'neutral'
      )
    END;
  END;

  -- ── 6. INSIGHTS (threshold-triggered) ────────────────────────
  DECLARE
    v_insight_list jsonb := '[]'::jsonb;
    v_avg_followup_days numeric;
    v_no_followup_expired int;
    v_close_rate_num numeric;
    v_total_s int;
    v_total_a int;
  BEGIN
    -- Average days to follow up (last 30 days)
    SELECT AVG(EXTRACT(EPOCH FROM (q.last_followup_at - q.sent_at)) / 86400)
    INTO v_avg_followup_days
    FROM public.quotes q
    WHERE q.user_id = p_user_id AND q.last_followup_at IS NOT NULL
      AND q.sent_at >= v_now - interval '30 days';

    IF v_avg_followup_days IS NOT NULL AND v_avg_followup_days > 2 THEN
      v_insight_list := v_insight_list || jsonb_build_array(jsonb_build_object(
        'type', 'followup_speed',
        'text', 'Your average follow-up takes ' || ROUND(v_avg_followup_days) || ' days. Under 2 days typically doubles close rate.',
        'cta', 'See quotes',
        'cta_url', '/app/quotes'
      ));
    END IF;

    -- Expired quotes with no follow-up this week
    SELECT COUNT(*) INTO v_no_followup_expired
    FROM public.quotes q
    WHERE q.user_id = p_user_id
      AND q.expires_at IS NOT NULL AND q.expires_at < v_now
      AND q.expires_at >= v_now - interval '7 days'
      AND q.last_followup_at IS NULL
      AND q.status NOT IN ('approved','approved_pending_deposit','scheduled','completed','invoiced','paid');

    IF v_no_followup_expired > 0 THEN
      v_insight_list := v_insight_list || jsonb_build_array(jsonb_build_object(
        'type', 'expired_no_followup',
        'text', v_no_followup_expired || ' quote' || CASE WHEN v_no_followup_expired > 1 THEN 's' ELSE '' END || ' expired this week without a follow-up. Extend and nudge?',
        'cta', 'Extend quotes',
        'cta_url', '/app/quotes'
      ));
    END IF;

    v_insights := v_insight_list;
  END;

  -- ── Return ────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'today_actions',      COALESCE(v_today_actions, '[]'::jsonb),
    'pipeline_counts',    COALESCE(v_pipeline_counts, '{}'::jsonb),
    'week_scheduled',     COALESCE(v_week_scheduled, '[]'::jsonb),
    'revenue_this_week',  v_revenue_week,
    'revenue_this_month', v_revenue_month,
    'revenue_last_period',v_revenue_last,
    'headline_metric',    COALESCE(v_headline, 'null'::jsonb),
    'insights',           COALESCE(v_insights, '[]'::jsonb),
    'generated_at',       v_now
  );
END;
$$;

-- ── Indexes for performance (add if EXPLAIN ANALYZE shows seq scans) ──
-- These should already exist from M2/M3, but are idempotent:
CREATE INDEX IF NOT EXISTS quotes_user_status_idx ON public.quotes (user_id, status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS quotes_user_followup_idx ON public.quotes (user_id, last_followup_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS bookings_user_scheduled_idx ON public.bookings (user_id, scheduled_for) WHERE status NOT IN ('cancelled','completed');
CREATE INDEX IF NOT EXISTS invoices_user_status_due_idx ON public.invoices (user_id, status, due_at);

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.rpc_dashboard_bundle(uuid) TO authenticated;

-- ── Verify ───────────────────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname = 'rpc_dashboard_bundle';
