/**
 * Punchlist Dashboard — Rewrite
 *
 * Fixes from combined teardown:
 *   • Suppresses 0% close rate chip (HeadlineStat now returns null)
 *   • Hides revenue cards when both values are $0
 *   • Full-width job input with shorter placeholder that won't truncate
 *   • Pipeline bar hidden when only 1 item in 1 status (uninformative)
 *   • Empty states encourage instead of punish
 *   • No dead space below last section
 *   • Removed demo preview A/B test (was below fold, never seen)
 *
 * Data shape unchanged — rpc_dashboard_bundle remains the source.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Calendar, CheckCircle2, ChevronRight, Clock,
  DollarSign, TrendingUp, Zap,
} from 'lucide-react';
import AppShell from '../components/app-shell';
import OnboardingWizard from '../components/onboarding-wizard';
import UpgradePrompt, { shouldShowUpgrade, recordUpgradeShown } from '../components/upgrade-prompt';
import BookingDrawer from '../components/booking-drawer';
import { Card, RevealOnView } from '../components/ui';
import ActionListRow from '../components/dashboard/action-list-row';
import HeadlineStat from '../components/dashboard/headline-stat';
import EmptyState from '../components/dashboard/empty-state';
import { useToast } from '../components/toast';
import { useAuth } from '../hooks/use-auth';
import { haptic, usePullToRefresh } from '../hooks/use-mobile-ux';
import { supabase } from '../lib/supabase';
import {
  listQuotes, listBookings, listInvoices, listCustomers,
  updateQuoteStatus, createInvoiceFromQuoteWithAdditionalWork,
  getProfile, expireStaleDrafts, friendly, checkAndSendDigest,
} from '../lib/api';
import { isPro, countSentThisMonth, FREE_QUOTE_LIMIT } from '../lib/billing';
import { currency } from '../lib/format';
import { identify, trackQuoteFlowStarted, getVariant } from '../lib/analytics';

/* ──────────────────────────────────────────────────────────────
   HELPER: fetch dashboard bundle from Supabase RPC
────────────────────────────────────────────────────────────── */
async function fetchDashboardBundle(userId) {
  try {
    const { data, error } = await supabase.rpc('rpc_dashboard_bundle', { p_user_id: userId });
    if (error) throw error;
    return { source: 'rpc', data };
  } catch {
    return { source: 'fallback', data: null };
  }
}

/* ──────────────────────────────────────────────────────────────
   SKELETON
────────────────────────────────────────────────────────────── */
function CardSkeleton({ height = 72 }) {
  return (
    <div className="dv2-skeleton" style={{ '--skel-h': height + 'px' }} aria-hidden="true">
      <div className="dv2-skeleton-shimmer" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PIPELINE BAR — only shows when there's meaningful data
────────────────────────────────────────────────────────────── */
function PipelineBar({ counts, loading }) {
  if (loading) return <CardSkeleton height={52} />;
  if (!counts) return null;

  const segments = [
    { key: 'draft',     label: 'Draft',     color: 'var(--muted)',    filter: 'draft' },
    { key: 'sent',      label: 'Sent',      color: 'var(--blue)',     filter: 'sent' },
    { key: 'viewed',    label: 'Viewed',    color: 'var(--amber)',    filter: 'viewed' },
    { key: 'approved',  label: 'Approved',  color: 'var(--green)',    filter: 'approved' },
    { key: 'scheduled', label: 'Scheduled', color: 'var(--brand)',    filter: 'scheduled' },
  ].filter(s => (counts[s.key] || 0) > 0);

  // Don't show a pipeline bar with just 1 segment and 1 item — it's just a colored rectangle
  const totalCount = segments.reduce((sum, s) => sum + (counts[s.key] || 0), 0);
  if (segments.length === 0 || (segments.length === 1 && totalCount <= 1)) return null;

  return (
    <div className="dv2-pipeline">
      <div className="dv2-pipeline-bar" role="group" aria-label="Pipeline by status">
        {segments.map(s => (
          <Link
            key={s.key}
            className="dv2-pipeline-seg"
            to={`/app/quotes?filter=${s.filter}`}
            style={{ flex: counts[s.key] || 0, background: s.color }}
            title={`${counts[s.key]} ${s.label}`}
            aria-label={`${counts[s.key]} ${s.label}`}
          />
        ))}
      </div>
      <div className="dv2-pipeline-legend">
        {segments.map(s => (
          <Link key={s.key} className="dv2-pipeline-key" to={`/app/quotes?filter=${s.filter}`}>
            <span className="dv2-dot" style={{ background: s.color }} aria-hidden="true" />
            <span className="dv2-pipeline-key-num">{counts[s.key]}</span>
            <span>{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   WEEK SCHEDULE CARD
────────────────────────────────────────────────────────────── */
function WeekScheduleCard({ jobs, loading }) {
  if (loading) return <CardSkeleton height={120} />;

  const empty = !jobs || jobs.length === 0;

  const byDay = {};
  if (!empty) {
    jobs.forEach(j => {
      const d = new Date(j.scheduled_for);
      const key = d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
      (byDay[key] = byDay[key] || []).push(j);
    });
  }

  return (
    <Card className="dv2-week-card" padding="default">
      <div className="dv2-card-header">
        <Calendar size={13} className="dv2-card-icon" />
        <span className="dv2-card-label">This week</span>
        <Link to="/app/bookings" className="dv2-card-link">
          {empty ? 'Schedule' : 'All'} <ChevronRight size={11} />
        </Link>
      </div>
      {empty ? (
        <div className="dv2-card-empty">No jobs scheduled</div>
      ) : (
        <div className="dv2-week-days">
          {Object.entries(byDay).slice(0, 4).map(([day, dayJobs]) => (
            <div key={day} className="dv2-week-day">
              <span className="dv2-week-day-label">{day}</span>
              {dayJobs.slice(0, 2).map(j => (
                <Link
                  key={j.booking_id}
                  className="dv2-week-job"
                  to={j.quote_id ? `/app/quotes/${j.quote_id}` : '/app/bookings'}
                >
                  <span className="dv2-week-time">
                    {new Date(j.scheduled_for).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <span className="dv2-week-job-name">
                    {j.quote_title} · {(j.customer_name || 'Customer').split(' ')[0]}
                  </span>
                  {j.total > 0 && (
                    <span className="dv2-week-job-val">{currency(j.total)}</span>
                  )}
                </Link>
              ))}
              {dayJobs.length > 2 && (
                <span className="dv2-week-more">+{dayJobs.length - 2} more</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────
   REVENUE CARD — hidden when both values are $0
────────────────────────────────────────────────────────────── */
function RevenueCard({ week, month, lastPeriod, loading }) {
  if (loading) return <CardSkeleton height={120} />;

  // Don't show a revenue card that just says $0 / $0 — it's punishing
  if ((month || 0) === 0 && (week || 0) === 0) return null;

  const delta = lastPeriod > 0
    ? Math.round(((month - lastPeriod) / lastPeriod) * 100)
    : null;
  const positive = delta !== null && delta >= 0;

  return (
    <Card
      className="dv2-revenue-card"
      padding="default"
      as={Link}
      to="/app/analytics"
      interactive
    >
      <div className="dv2-card-header">
        <DollarSign size={13} className="dv2-card-icon" />
        <span className="dv2-card-label">Revenue</span>
        <span className="dv2-card-link">Analytics <ChevronRight size={11} /></span>
      </div>
      <div className="dv2-revenue-grid">
        <div className="dv2-revenue-stat">
          <span className="dv2-revenue-val">{currency(month)}</span>
          <span className="dv2-revenue-lbl">This month</span>
          {delta !== null && (
            <span className={`dv2-revenue-delta ${positive ? 'dv2-revenue-delta--up' : 'dv2-revenue-delta--down'}`}>
              {positive ? '+' : ''}{delta}% vs last
            </span>
          )}
        </div>
        <div className="dv2-revenue-stat">
          <span className="dv2-revenue-val">{currency(week)}</span>
          <span className="dv2-revenue-lbl">This week</span>
        </div>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────
   INSIGHTS ROW
────────────────────────────────────────────────────────────── */
function InsightsRow({ insights, loading }) {
  if (loading || !insights || insights.length === 0) return null;
  return (
    <div className="dv2-insights dv2-hairline-top">
      {insights.map((ins, i) => (
        <div key={i} className="dv2-insight">
          <Zap size={14} className="dv2-insight-icon" />
          <span className="dv2-insight-text">{ins.text}</span>
          {ins.cta && ins.cta_url && (
            <Link to={ins.cta_url} className="dv2-insight-cta">
              {ins.cta} <ChevronRight size={11} />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   MAIN COMPONENT
────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show: toast, showUndo } = useToast();

  /* ── Core state ── */
  const [bundleLoading, setBundleLoading] = useState(true);
  const [bundle, setBundle] = useState(null);

  /* ── Fallback state (when RPC not yet deployed) ── */
  const [quotes, setQuotes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [invoiceList, setInvoiceList] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [usingFallback, setUsingFallback] = useState(false);

  /* ── Profile / auth ── */
  const [userProfile, setUserProfile] = useState(null);
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState(null);

  /* ── Modals ── */
  const [scheduleQuote, setScheduleQuote] = useState(null);
  const [invoicePromptQuote, setInvoicePromptQuote] = useState(null);
  const [invoiceCreating, setInvoiceCreating] = useState(false);

  /* ── Dismiss state ── */
  const [dismissedIds, setDismissedIds] = useState(new Set());

  /* ── Job input ── */
  const jobInputRef = useRef(null);
  const [jobInput, setJobInput] = useState('');

  // Pull-to-refresh
  usePullToRefresh(() => {
    if (!user) return;
    setBundleLoading(true);
    Promise.all([fetchDashboardBundle(user.id), getProfile(user.id)])
      .then(([bundleResult, profile]) => {
        if (bundleResult.source === 'rpc' && bundleResult.data) {
          setBundle(bundleResult.data);
        } else {
          setUsingFallback(true);
          Promise.all([listQuotes(user.id), listBookings(user.id), listInvoices(user.id), listCustomers(user.id)])
            .then(([q, b, inv, c]) => { setQuotes(q || []); setBookings(b || []); setInvoiceList(inv || []); setAllCustomers(c || []); });
        }
        if (profile) setUserProfile(profile);
      })
      .finally(() => setBundleLoading(false));
  });

  /* ── Load dismissed items ── */
  useEffect(() => {
    if (!user) return;
    supabase
      .from('dismissed_dashboard_items')
      .select('quote_id')
      .eq('user_id', user.id)
      .gte('dismissed_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .then(({ data }) => {
        if (data) setDismissedIds(new Set(data.map(r => r.quote_id)));
      })
      .catch(() => {
        try {
          const raw = JSON.parse(localStorage.getItem('pl_dismissed_attn') || '[]');
          const week = Date.now() - 7 * 86400000;
          setDismissedIds(new Set(raw.filter(d => d.ts > week).map(d => d.id)));
        } catch { /* no-op */ }
      });
  }, [user]);

  const dismissItem = useCallback(async (item) => {
    const id = item.quote_id;
    if (!id || !user) return;
    const capturedItem = item;
    setDismissedIds(prev => new Set([...prev, id]));
    showUndo(
      'Hidden',
      5000,
      async () => {
        try {
          await supabase.from('dismissed_dashboard_items').upsert(
            { user_id: user.id, quote_id: id, dismissed_at: new Date().toISOString() },
            { onConflict: 'user_id,quote_id' }
          );
        } catch {
          try {
            const raw = JSON.parse(localStorage.getItem('pl_dismissed_attn') || '[]');
            raw.push({ id, ts: Date.now() });
            localStorage.setItem('pl_dismissed_attn', JSON.stringify(raw));
          } catch { /* no-op */ }
        }
      },
      () => {
        setDismissedIds(prev => {
          const next = new Set(prev);
          next.delete(capturedItem.quote_id);
          return next;
        });
      }
    );
  }, [user, showUndo]);

  /* ── Main data fetch ── */
  useEffect(() => {
    if (!user) return;
    identify(user.id, { email: user.email });
    expireStaleDrafts().catch(e => console.warn('[PL]', e));
    fetch('/api/activation-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    }).catch(e => console.warn('[PL]', e));

    Promise.all([fetchDashboardBundle(user.id), getProfile(user.id)])
      .then(([bundleResult, profile]) => {
        if (bundleResult.source === 'rpc' && bundleResult.data) {
          setBundle(bundleResult.data);
          setBundleLoading(false);
        } else {
          setUsingFallback(true);
          Promise.all([
            listQuotes(user.id),
            listBookings(user.id),
            listInvoices(user.id),
            listCustomers(user.id),
          ]).then(([q, b, inv, cust]) => {
            const active = (q || []).filter(qt => !qt.archived_at);
            setQuotes(active);
            setBookings(b || []);
            setInvoiceList(inv || []);
            setAllCustomers(cust || []);
            setSentThisMonth(countSentThisMonth(active));
          }).catch(e => console.warn('[PL]', e)).finally(() => setBundleLoading(false));
        }

        if (!profile) {
          import('../lib/api/profile.js').then(({ saveProfile }) =>
            saveProfile(user, { full_name: user.user_metadata?.full_name || '', trade: 'Other', province: 'AB', country: 'CA' })
              .catch(e => console.warn('[PL]', e))
          );
          setShowOnboarding(true);
          setUserProfile({ trade: 'Other', province: 'AB', country: 'CA' });
        } else {
          setUserProfile(profile);
          if (profile?.digest_enabled) checkAndSendDigest(user.id, profile).catch(e => console.warn('[PL]', e));
          try { localStorage.setItem('pl_is_pro', isPro(profile) ? '1' : '0'); } catch { /* no-op */ }
        }
        setProfileLoaded(true);
      })
      .catch(() => setBundleLoading(false));
  }, [user]);

  /* ── Onboarding trigger ── */
  useEffect(() => {
    if (bundleLoading || !profileLoaded) return;
    const hasQuotes = bundle
      ? Object.entries(bundle.pipeline_counts || {}).some(([k, v]) => !k.startsWith('total') && typeof v === 'number' && v > 0)
      : quotes.length > 0;
    if (!hasQuotes) {
      try { if (!localStorage.getItem('pl_onboarded')) setShowOnboarding(true); } catch { /* no-op */ }
    }
  }, [bundleLoading, profileLoaded, bundle, quotes.length]);

  /* ── Upgrade check ── */
  useEffect(() => {
    if (!userProfile || isPro(userProfile)) return;
    const sm = usingFallback ? sentThisMonth : 0;
    if (sm >= 3 && shouldShowUpgrade('near_limit', sm)) {
      recordUpgradeShown('near_limit');
      setUpgradePrompt({ trigger: 'near_limit', context: { count: sm } });
    }
  }, [userProfile, sentThisMonth, usingFallback]);

  /* ── Value trigger (approvals from other tabs) ── */
  useEffect(() => {
    function onValue(e) {
      const { type, title } = e.detail || {};
      if (type === 'quote_approved') toast('Job won!', 'success');
      if (type === 'quote_viewed')   toast(`${title || 'Your quote'} was just opened`, 'success');
    }
    window.addEventListener('pl:value-trigger', onValue);
    return () => window.removeEventListener('pl:value-trigger', onValue);
  }, [toast]);

  /* ──────────────────────────────────────────────────────────────
     DERIVED DATA
  ────────────────────────────────────────────────────────────── */
  const todayActions = useMemo(() => {
    if (bundle) {
      return (bundle.today_actions || []).filter(a => !dismissedIds.has(a.quote_id));
    }
    const now = Date.now();
    const items = [];

    for (const q of quotes) {
      if (!['sent','viewed','question_asked'].includes(q.status)) continue;
      if (dismissedIds.has(q.id)) continue;
      const ref = q.last_followup_at || q.sent_at || q.created_at;
      const days = ref ? (now - new Date(ref).getTime()) / 86400000 : 0;
      if (days < 2) continue;
      items.push({
        type: 'followup',
        quote_id: q.id,
        title: q.title || 'Untitled quote',
        total: q.total || 0,
        customer_name: q.customer?.name,
        customer_phone: q.customer?.phone,
        customer_email: q.customer?.email,
        last_followup_at: q.last_followup_at,
        sent_at: q.sent_at,
        view_count: q.view_count || 0,
        followup_count: q.followup_count || 0,
        priority: days >= 5 ? 0 : 1,
      });
    }

    for (const inv of invoiceList) {
      if (['paid','cancelled'].includes(inv.status)) continue;
      if (!inv.due_at) continue;
      const daysOver = (now - new Date(inv.due_at).getTime()) / 86400000;
      if (daysOver < 14) continue;
      items.push({
        type: 'invoice_overdue',
        invoice_id: inv.id,
        title: inv.quote?.title || 'Invoice',
        total: inv.total || 0,
        customer_name: inv.customer?.name,
        due_at: inv.due_at,
        days_overdue: Math.floor(daysOver),
        priority: 0,
      });
    }

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const tmrwEnd   = new Date(); tmrwEnd.setDate(tmrwEnd.getDate()+1); tmrwEnd.setHours(23,59,59,999);
    for (const b of bookings) {
      if (['cancelled','completed'].includes(b.status)) continue;
      const sf = new Date(b.scheduled_for);
      if (sf < todayStart || sf > tmrwEnd) continue;
      const q = quotes.find(qq => qq.id === b.quote_id);
      items.push({
        type: 'scheduled_today',
        booking_id: b.id,
        quote_id: b.quote_id,
        title: q?.title || 'Job',
        customer_name: q?.customer?.name,
        scheduled_for: b.scheduled_for,
        total: q?.total || 0,
        priority: 2,
      });
    }

    items.sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));
    return items;
  }, [bundle, quotes, bookings, invoiceList, dismissedIds]);

  const pipelineCounts = useMemo(() => {
    if (bundle) return bundle.pipeline_counts;
    return {
      draft:     quotes.filter(q => q.status === 'draft').length,
      sent:      quotes.filter(q => q.status === 'sent' && !q.view_count).length,
      viewed:    quotes.filter(q => ['viewed','question_asked'].includes(q.status) || (q.status === 'sent' && q.view_count > 0)).length,
      approved:  quotes.filter(q => ['approved','approved_pending_deposit'].includes(q.status)).length,
      scheduled: quotes.filter(q => q.status === 'scheduled').length,
    };
  }, [bundle, quotes]);

  const weekScheduled = useMemo(() => {
    if (bundle) return bundle.week_scheduled || [];
    const now = new Date();
    const wkEnd = new Date(); wkEnd.setDate(wkEnd.getDate()+7);
    return bookings
      .filter(b => b.status !== 'cancelled' && new Date(b.scheduled_for) >= now && new Date(b.scheduled_for) <= wkEnd)
      .map(b => {
        const q = quotes.find(qq => qq.id === b.quote_id);
        return {
          booking_id: b.id,
          quote_id: b.quote_id,
          quote_title: q?.title || 'Job',
          customer_name: q?.customer?.name,
          scheduled_for: b.scheduled_for,
          total: q?.total || 0,
        };
      })
      .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
  }, [bundle, bookings, quotes]);

  const revenueWeek  = bundle ? (bundle.revenue_this_week  || 0) : 0;
  const revenueMonth = bundle ? (bundle.revenue_this_month || 0) : 0;
  const revenueLast  = bundle ? (bundle.revenue_last_period || 0) : 0;
  const headlineMetric = bundle ? bundle.headline_metric : null;
  const insights       = bundle ? (bundle.insights || []) : [];

  const hasAnyData = useMemo(() => {
    try { if (localStorage.getItem('pl_has_sent_quote')) return true; } catch { /* no-op */ }
    if (bundle) {
      const hasPipeline = Object.entries(bundle.pipeline_counts || {}).some(([k,v]) => !k.startsWith('total') && typeof v === 'number' && v > 0);
      const hasRevenue = (bundle.revenue_this_month || 0) > 0 || (bundle.revenue_this_week || 0) > 0;
      return hasPipeline || hasRevenue;
    }
    return quotes.length > 0;
  }, [bundle, quotes]);

  // Check if there's any real revenue to show
  const hasRevenue = revenueMonth > 0 || revenueWeek > 0;

  /* ── Greeting ── */
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const raw = user?.user_metadata?.full_name?.split(' ')[0] || '';
    const name = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : '';
    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return name ? `${g}, ${name}` : g;
  }, [user]);

  const subtitle = useMemo(() => {
    const todayJobs = weekScheduled.filter(j => {
      const d = new Date(j.scheduled_for);
      const s = new Date(); s.setHours(0,0,0,0);
      const e = new Date(); e.setHours(23,59,59,999);
      return d >= s && d <= e;
    }).length;
    if (todayJobs > 0) return `${todayJobs} job${todayJobs > 1 ? 's' : ''} on today's schedule`;
    if (todayActions.length > 0) return `${todayActions.length} item${todayActions.length > 1 ? 's' : ''} need${todayActions.length === 1 ? 's' : ''} attention`;
    return null;
  }, [todayActions, weekScheduled]);

  /* ── Actions ── */
  function handleJobSubmit(e) {
    e.preventDefault();
    trackQuoteFlowStarted({ source: 'dashboard_job_input' });
    navigate('/app/quotes/new', jobInput.trim() ? { state: { prefill: jobInput.trim() } } : undefined);
  }

  function handleActionNudge(item) {
    navigate(`/app/quotes/${item.quote_id}`);
  }

  async function handleCreateInvoice() {
    if (!invoicePromptQuote || !user) return;
    setInvoiceCreating(true);
    try {
      const inv = await createInvoiceFromQuoteWithAdditionalWork(user.id, invoicePromptQuote);
      setInvoicePromptQuote(null);
      toast('Invoice created', 'success');
      navigate(`/app/invoices/${inv.id}`);
    } catch (e) { toast(friendly(e), 'error'); }
    finally { setInvoiceCreating(false); }
  }

  async function handleBookingSaved(booking) {
    setBookings(prev => [...prev, booking]);
    toast('Job scheduled', 'success');
    haptic('success');
    if (scheduleQuote) {
      try { await updateQuoteStatus(scheduleQuote.id, { status: 'scheduled' }); } catch { /* no-op */ }
      setQuotes(prev => prev.map(q => q.id === scheduleQuote.id ? { ...q, status: 'scheduled' } : q));
    }
    setScheduleQuote(null);
  }

  /* ── Auto-focus for empty state ── */
  useEffect(() => {
    if (!bundleLoading && !hasAnyData && jobInputRef.current) {
      const t = setTimeout(() => jobInputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
  }, [bundleLoading, hasAnyData]);

  /* ── Total $ on the line ── */
  const onTheLine = useMemo(
    () => todayActions.reduce((s, a) => s + (Number(a.total) || 0), 0),
    [todayActions]
  );

  /* ──────────────────────────────────────────────────────────────
     RENDER
  ────────────────────────────────────────────────────────────── */
  return (
    <AppShell hideTitle>
      {showOnboarding && <OnboardingWizard onDismiss={() => setShowOnboarding(false)} />}
      {upgradePrompt && (
        <UpgradePrompt trigger={upgradePrompt.trigger} context={upgradePrompt.context}
          onDismiss={() => setUpgradePrompt(null)} />
      )}

      <div className="dv2-root motion-isolate">

        {/* ═══ ROW 1: GREETING + HEADLINE ═══ */}
        <div className="dv2-row1 dv2-enter" style={{ '--i': 0 }}>
          <div className="dv2-greeting-block">
            <h1 className="dv2-greeting font-display">{greeting}</h1>
            {subtitle && <p className="dv2-greeting-sub">{subtitle}</p>}
          </div>
          <div className="dv2-row1-right">
            {!bundleLoading && <HeadlineStat metric={headlineMetric} />}
          </div>
        </div>

        {/* ═══ JOB INPUT — full width, short placeholder ═══ */}
        <form className="dv2-job-form dv2-enter" style={{ '--i': 1 }}
              onSubmit={handleJobSubmit} data-testid="dash-job-form">
          <input ref={jobInputRef} className="dv2-job-input" type="text"
            placeholder="What's the job?"
            value={jobInput} onChange={e => setJobInput(e.target.value)} autoComplete="off" enterKeyHint="go" />
          <button className="dv2-job-go" type="submit">
            {jobInput.trim()
              ? <><span>Build quote</span><ArrowRight size={14} /></>
              : <span>+ New quote</span>}
          </button>
        </form>

        {/* ═══ ONBOARDING EMPTY STATE ═══ */}
        {!bundleLoading && !hasAnyData && (
          <Card padding="loose" className="dv2-empty">
            <div className="dv2-empty-headline">Send your first quote</div>
            <p className="dv2-empty-sub">Describe the job above — Punchlist builds it in under 2 minutes.</p>
            <div className="v2-empty-fine">No credit card needed · 5 free quotes per month</div>
          </Card>
        )}

        {/* ═══ ROW 2: TODAY ACTIONS ═══ */}
        {(bundleLoading || hasAnyData) && (
          <section className="dv2-section dv2-enter" style={{ '--i': 2 }}>
            <div className="dv2-section-head">
              <h2 className="dv2-section-title">
                <Clock size={12} className="dv2-section-icon" />
                Today
              </h2>
              {!bundleLoading && todayActions.length > 0 && onTheLine > 0 && (
                <span className="dv2-section-meta">
                  {currency(onTheLine)} outstanding
                </span>
              )}
            </div>

            {bundleLoading ? (
              <div className="dv2-action-list">
                <CardSkeleton height={64} />
                <CardSkeleton height={64} />
                <CardSkeleton height={64} />
              </div>
            ) : todayActions.length === 0 && headlineMetric?.type === 'followups' ? (
              <div className="dv2-slim-empty">
                <CheckCircle2 size={16} className="dv2-slim-empty-icon" />
                <span className="dv2-slim-empty-text">Nothing urgent right now</span>
              </div>
            ) : todayActions.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="You're all caught up"
                sub="Build your next quote when you're ready."
                cta={{ label: <>New quote <ChevronRight size={12} /></>, to: '/app/quotes/new' }}
                onCtaClick={() => trackQuoteFlowStarted({ source: 'dashboard_caught_up' })}
              />
            ) : (
              <div className="dv2-action-list">
                {todayActions.slice(0, 8).map((item, i) => (
                  <ActionListRow
                    key={item.quote_id || item.invoice_id || item.booking_id || i}
                    item={item}
                    primary={i < 2}
                    onAction={handleActionNudge}
                    onDismiss={dismissItem}
                    className="dv2-enter"
                    style={{ '--i': 3 + i }}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══ ROW 3: PIPELINE BAR ═══ */}
        {!bundleLoading && hasAnyData && (
          <section className="dv2-section dv2-enter" style={{ '--i': 11 }}>
            <div className="dv2-section-head">
              <h2 className="dv2-section-title">
                <TrendingUp size={12} className="dv2-section-icon" />
                Pipeline
              </h2>
              <Link to="/app/quotes" className="dv2-section-link">
                All quotes <ChevronRight size={11} />
              </Link>
            </div>
            <PipelineBar counts={pipelineCounts} loading={false} />
          </section>
        )}

        {/* ═══ ROW 4: SCHEDULE + REVENUE ═══
            Only show the row if at least one card will render.
            Revenue card self-hides when both values are $0.
            If only schedule card shows, it takes full width. */}
        {(bundleLoading || hasAnyData) && (
          <RevealOnView delay={120}>
            <div className={`dv2-row4 ${!hasRevenue ? 'dv2-row4--single' : ''}`}>
              <WeekScheduleCard jobs={weekScheduled} loading={bundleLoading} />
              <RevenueCard week={revenueWeek} month={revenueMonth} lastPeriod={revenueLast} loading={bundleLoading} />
            </div>
          </RevealOnView>
        )}

        {/* ═══ ROW 5: INSIGHTS ═══ */}
        <InsightsRow insights={insights} loading={bundleLoading} />

        {/* ═══ UPSELL — only when user has data and hasn't connected Stripe ═══ */}
        {!bundleLoading && userProfile && !userProfile.stripe_connect_onboarded && hasAnyData && (
          <Link to="/app/payments/setup" className="dv2-upsell">
            <DollarSign size={18} className="dv2-upsell-icon" />
            <div className="dv2-upsell-text">
              <strong>Let customers pay monthly — you still get the full amount</strong>
              <span>10-minute setup. No monthly fee.</span>
            </div>
            <ChevronRight size={15} className="dv2-upsell-arrow" />
          </Link>
        )}

        {/* ═══ USAGE METER — show at 1+ quotes sent ═══ */}
        {!bundleLoading && userProfile && !isPro(userProfile) && sentThisMonth >= 1 && (
          <div className="dv2-usage">
            <div className="dv2-usage-track">
              <div
                className="dv2-usage-fill"
                style={{ '--fill': Math.min(1, sentThisMonth / FREE_QUOTE_LIMIT) }}
              />
            </div>
            <span className="dv2-usage-text">{sentThisMonth} of {FREE_QUOTE_LIMIT} quotes this month</span>
            {sentThisMonth >= 3 && (
              <Link to="/pricing" className="dv2-usage-upgrade">Upgrade</Link>
            )}
          </div>
        )}

      </div>{/* /dv2-root */}

      {/* ═══ INVOICE PROMPT MODAL ═══ */}
      {invoicePromptQuote && (
        <div className="modal-overlay" onClick={() => setInvoicePromptQuote(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}
            style={{ maxWidth: 380 }} role="dialog" aria-modal="true" aria-label="Create invoice">
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800 }}>Job complete!</h2>
              <p style={{ margin: '0 0 20px', fontSize: 'var(--text-base)', color: 'var(--text-2)', lineHeight: 1.5 }}>
                <strong>{invoicePromptQuote.title || 'This job'}</strong> is marked complete.<br />
                Ready to send the invoice?
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                <button className="btn btn-primary full-width" type="button"
                  disabled={invoiceCreating} onClick={handleCreateInvoice}>
                  {invoiceCreating ? 'Creating…' : 'Create invoice now'}
                </button>
                <button className="btn btn-secondary full-width" type="button"
                  onClick={() => setInvoicePromptQuote(null)}>
                  I'll do it later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BookingDrawer
        open={Boolean(scheduleQuote)}
        onClose={() => setScheduleQuote(null)}
        onSave={handleBookingSaved}
        preSelectedQuote={scheduleQuote}
        preSelectedCustomer={scheduleQuote?.customer || null}
        customers={allCustomers}
        quotes={quotes}
        bookings={bookings}
        userId={user?.id}
        showICSExport={false}
        contextLabel={scheduleQuote
          ? `${scheduleQuote.title || 'Untitled'} · ${scheduleQuote.customer?.name || 'Customer'}`
          : null}
      />
    </AppShell>
  );
}
