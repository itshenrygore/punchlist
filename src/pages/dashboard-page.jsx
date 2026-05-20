/* ═══════════════════════════════════════════════════════════════
   Punchlist 2.0 — Home Screen
   
   Not a dashboard. A launch pad.
   Shows: greeting, New Quote CTA, recent quotes with monthly
   payment, one stat (close rate), and that's it.
   
   826 lines → ~200 lines.
   
   Removed: PipelineBar, WeekScheduleCard, RevenueCard, InsightsRow,
   BookingDrawer, invoice creation modal, dismissed items system,
   digest checking, A/B test variants, classic view toggle.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, DollarSign } from 'lucide-react';
import AppShell from '../components/app-shell';
import OnboardingWizard from '../components/onboarding-wizard';
import TodaySection from '../components/dashboard/today-section';
import '../styles/today-section.css';
import { Card } from '../components/ui';
import { useToast } from '../components/toast';
import { useAuth } from '../hooks/use-auth';
import { haptic, usePullToRefresh } from '../hooks/use-mobile-ux';
import { listQuotes, getProfile, expireStaleDrafts, friendly, listInvoices, updateQuoteStatus } from '../lib/api';
import { listCustomers } from '../lib/api/customers';
import { isPro, countSentThisMonth, FREE_QUOTE_LIMIT } from '../lib/billing';
import { currency } from '../lib/format';
import { normalizeStatus, chipForStatus } from '../lib/workflow';
// Monthly payment estimates removed from contractor screens — that
// number is only meaningful on the customer-facing public quote.
import { identify, trackQuoteFlowStarted } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { usePwaInstall } from '../hooks/use-pwa-install';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLOR = {
  sent: 'dv2-arow-avatar--blue', viewed: 'dv2-arow-avatar--blue',
  approved: 'dv2-arow-avatar--green', deposit_paid: 'dv2-arow-avatar--green',
  converted_to_invoice: 'dv2-arow-avatar--green', paid: 'dv2-arow-avatar--green',
  revision_requested: 'dv2-arow-avatar--amber', approved_pending_deposit: 'dv2-arow-avatar--amber',
  declined: 'dv2-arow-avatar--red', expired: 'dv2-arow-avatar--red',
};

// Per-row Needs-attention quick action. Each Needs-attention `_reason`
// has exactly one obvious next step — surface that as a trailing
// button so the contractor doesn't have to drill into the quote
// detail just to send a follow-up text or extend the expiry.
function quickActionFor(reason) {
  if (!reason) return null;
  if (reason === 'Expires today!' || reason.startsWith('Expires in ')) {
    return { kind: 'renew', label: 'Renew', sub: '+14d' };
  }
  if (reason === 'Deposit pending') {
    return { kind: 'copy', label: 'Copy link' };
  }
  if (reason === 'Viewed — follow up' || reason.includes('going cold')) {
    return { kind: 'nudge', label: 'Send follow-up' };
  }
  if (reason === 'Changes requested') {
    return { kind: 'open', label: 'Open editor' };
  }
  return null;
}

function ActionRow({ quote: q, status, customer, quickAction, onQuickAction, busy, style }) {
  const navigate = useNavigate();
  function rowClick() { navigate(`/app/quotes/${q.id}`); }
  function rowKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rowClick(); }
  }
  return (
    <div
      className="dv2-arow dv2-arow--hot dv2-enter"
      style={{ ...style, textDecoration: 'none', cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      onClick={rowClick}
      onKeyDown={rowKey}
      aria-label={`${q.title || 'Quote'} — ${q._reason || ''}`}
    >
      {customer
        ? <span className={`dv2-arow-avatar ${AVATAR_COLOR[status] || ''} dv2-arow-avatar--live`}>{initials(customer)}</span>
        : <span className="dv2-arow-dot dv2-arow-dot--amber dv2-arow-dot--live" />
      }
      <div className="dv2-arow-labels">
        <span className="dv2-arow-primary">{q.title || 'Untitled quote'}</span>
        <span className="dv2-arow-secondary">{q._reason}</span>
      </div>
      {(q.total || q.subtotal) > 0 && <span className="dv2-arow-num">{currency(q.total || q.subtotal)}</span>}
      <span className={`chip chip-${status}`}>{chipForStatus(status)}</span>
      {quickAction && (
        <button
          type="button"
          className="dv2-arow-quick"
          onClick={(e) => { e.stopPropagation(); onQuickAction(); }}
          disabled={busy}
          aria-label={`${quickAction.label} — ${q.title || 'Quote'}`}
        >
          {busy ? '…' : quickAction.label}{quickAction.sub && <span className="dv2-arow-quick-sub"> {quickAction.sub}</span>}
        </button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show: toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [jobInput, setJobInput] = useState('');
  const [installLeaving, setInstallLeaving] = useState(false);
  const [quickActionBusy, setQuickActionBusy] = useState(null);
  const jobInputRef = useRef(null);
  const { canInstall, install: installPwa, dismiss: dismissPwa } = usePwaInstall();

  async function handleQuickAction(quote, action) {
    if (!action) return;
    setQuickActionBusy(quote.id);
    try {
      if (action.kind === 'copy') {
        if (!quote.share_token) {
          toast('Save this quote first to get a share link.', 'error');
        } else {
          const url = `${window.location.origin}/q/${quote.share_token}`;
          try { await navigator.clipboard.writeText(url); toast('Link copied — paste into your messages app.', 'success'); }
          catch { toast(url, 'info'); }
        }
      } else if (action.kind === 'renew') {
        const next = new Date();
        next.setDate(next.getDate() + 14);
        await updateQuoteStatus(quote.id, { expires_at: next.toISOString() });
        setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, expires_at: next.toISOString() } : q));
        toast('Expiry extended by 14 days.', 'success');
      } else if (action.kind === 'nudge' || action.kind === 'open') {
        // The quote detail page already has a polished follow-up
        // composer (`FollowupModal`) and a robust edit flow. Route
        // there so the contractor finishes the action with full
        // context (last view time, draft template variants).
        const target = action.kind === 'open'
          ? `/app/quotes/${quote.id}/edit`
          : `/app/quotes/${quote.id}?action=nudge`;
        navigate(target);
      }
    } catch (e) {
      toast(friendly(e), 'error');
    } finally {
      setQuickActionBusy(null);
    }
  }

  // ── Data fetch ──
  useEffect(() => {
    if (!user) return;
    identify(user.id, { email: user.email });
    expireStaleDrafts().catch(() => {});
    // Server-side throttles to one email per 24h, but each dashboard
    // mount was still hitting the IP-level 5/min limit and surfacing
    // a 429 in the console. Gate per-user, per-browser-session so we
    // POST at most once per tab.
    const activationKey = `pl_activation_email_${user.id}`;
    let alreadyPinged = false;
    try { alreadyPinged = !!sessionStorage.getItem(activationKey); } catch { /* private mode */ }
    if (!alreadyPinged) {
      try { sessionStorage.setItem(activationKey, '1'); } catch { /* private mode */ }
      supabase.auth.getSession().then(({ data: { session } }) => {
        const hdrs = { 'Content-Type': 'application/json' };
        if (session?.access_token) hdrs['Authorization'] = `Bearer ${session.access_token}`;
        fetch('/api/activation-email', {
          method: 'POST',
          headers: hdrs,
          body: JSON.stringify({ user_id: user.id }),
        }).catch(() => {});
      }).catch(() => {});
    }

    Promise.all([listQuotes(user.id), getProfile(user.id), listCustomers(user.id), listInvoices(user.id).catch(() => [])])
      .then(([q, profile, customers, invoices]) => {
        const active = (q || []).filter(qt => !qt.archived_at);
        setQuotes(active);
        setInvoices(invoices || []);
        setSentThisMonth(countSentThisMonth(active));
        if (profile) setUserProfile(profile);
        setCustomerCount((customers || []).length);

        // Show onboarding if first visit OR if the user landed here
        // via the email-confirmation path that skipped signup step 2.
        // Signal: profile.trade is missing/Other AND no quotes yet —
        // we'd otherwise sabotage their first AI scope with wrong
        // trade/region defaults.
        try {
          const tradeMissing = !profile?.trade || profile.trade === 'Other';
          const firstVisit = !localStorage.getItem('pl_onboarded');
          if ((firstVisit && active.length === 0) || (tradeMissing && active.length === 0)) {
            setShowOnboarding(true);
          }
        } catch { /* no-op */ }
      })
      .catch(e => console.warn('[PL]', e))
      .finally(() => setLoading(false));
  }, [user]);

  // Pull-to-refresh
  usePullToRefresh(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([listQuotes(user.id), getProfile(user.id), listCustomers(user.id), listInvoices(user.id).catch(() => [])])
      .then(([q, profile, customers, invoices]) => {
        const active = (q || []).filter(qt => !qt.archived_at);
        setQuotes(active);
        setInvoices(invoices || []);
        setSentThisMonth(countSentThisMonth(active));
        if (profile) setUserProfile(profile);
        setCustomerCount((customers || []).length);
      })
      .finally(() => setLoading(false));
  });

  // ── Derived ──
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const raw = user?.user_metadata?.full_name?.split(' ')[0] || '';
    const name = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : '';
    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return name ? `${g}, ${name}` : g;
  }, [user]);

  const closeRate = useMemo(() => {
    const SENT_STATUSES = ['sent','viewed','revision_requested','approved','approved_pending_deposit','deposit_paid','converted_to_invoice','declined','expired','paid'];
    const WON_STATUSES  = ['approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid'];
    const sent = quotes.filter(q => SENT_STATUSES.includes(q.status));
    const won  = quotes.filter(q => WON_STATUSES.includes(q.status));
    if (sent.length < 2) return null;
    return Math.round((won.length / sent.length) * 100);
  }, [quotes]);

  // Revenue anchoring — show pipeline value so contractors feel momentum
  const pipelineValue = useMemo(() => {
    const ACTIVE = ['sent','viewed','revision_requested','approved','approved_pending_deposit'];
    return quotes
      .filter(q => ACTIVE.includes(normalizeStatus(q.status)))
      .reduce((sum, q) => sum + (q.total || q.subtotal || 0), 0);
  }, [quotes]);

  const awaitingApproval = useMemo(() => {
    return quotes.filter(q => ['sent','viewed'].includes(normalizeStatus(q.status))).length;
  }, [quotes]);

  // Money owed = sum of unpaid invoice remaining balances. Plus an
  // overdue count so the chip can warn when the contractor has bills
  // sitting past due dates. Closed-funnel contractors (no active
  // quotes) still see meaningful state if they have receivables.
  const moneyOwed = useMemo(() => {
    return invoices
      .filter(i => !['paid', 'cancelled'].includes(i.status))
      .reduce((s, i) => s + Math.max(0, Number(i.remaining_balance ?? i.total ?? 0)), 0);
  }, [invoices]);
  const overdueCount = useMemo(() => {
    const now = Date.now();
    return invoices.filter(i =>
      !['paid', 'cancelled', 'draft'].includes(i.status) &&
      i.due_at &&
      new Date(i.due_at).getTime() < now
    ).length;
  }, [invoices]);

  // Month-to-date revenue — the dopamine number. Pipeline and Owed
  // are friction metrics (what's pending, what's unpaid). Earned is
  // the number the contractor actually wants to see on a Friday at
  // 5pm. Computed from paid invoices in the current calendar month
  // using paid_at; falls back to invoice.total when remaining_balance
  // isn't populated.
  const [earnedThisMonth, setEarnedThisMonth] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const monthStart = new Date();
        monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const { data } = await supabase
          .from('payments')
          .select('amount')
          .eq('user_id', user.id)
          .gte('paid_at', monthStart.toISOString());
        const sum = (data || []).reduce((s, p) => s + Number(p.amount || 0), 0);
        setEarnedThisMonth(sum);
      } catch { /* silent — chip just hides */ }
    })();
  }, [user?.id, invoices.length]);

  // Raw, unbounded urgency-sorted set. We keep the full list available
  // so the "+N more" overflow indicator below can show a real count
  // instead of the post-slice 5 (which always reads "5"). Don't
  // remove the slice — the dashboard's job is to prioritize, not
  // dump the queue.
  const actionItemsRaw = useMemo(() => {
    const items = [];
    for (const q of quotes) {
      const s = normalizeStatus(q.status);
      if (s === 'viewed') items.push({ ...q, _reason: 'Viewed — follow up' });
      else if (s === 'revision_requested') items.push({ ...q, _reason: 'Changes requested' });
      else if (s === 'approved_pending_deposit') items.push({ ...q, _reason: 'Deposit pending' });
      else if (s === 'approved' && q.deposit_required && q.deposit_status !== 'paid') items.push({ ...q, _reason: 'Deposit pending' });
      // Cold-quote nudge: sent ≥ 4 days ago, never viewed, not yet
      // expiring. Surfaces the "they ghosted me" cohort which is the
      // single biggest pain a weekly contractor has on Monday morning.
      else if (s === 'sent' && (q.view_count || 0) === 0 && q.sent_at) {
        const daysSent = Math.floor((Date.now() - new Date(q.sent_at)) / 86400000);
        if (daysSent >= 4 && !items.find(i => i.id === q.id)) {
          items.push({ ...q, _reason: `Sent ${daysSent}d ago — going cold` });
        }
      }
      if (['sent','viewed'].includes(s) && q.expires_at) {
        const daysLeft = Math.ceil((new Date(q.expires_at) - Date.now()) / 86400000);
        if (daysLeft >= 0 && daysLeft <= 3 && !items.find(i => i.id === q.id)) {
          items.push({ ...q, _reason: daysLeft === 0 ? 'Expires today!' : `Expires in ${daysLeft}d` });
        }
      }
    }
    // Sort by URGENCY, not recency. The audit flagged that a Monday
    // morning glance returned a near-random subset of 5 — now the
    // top of the list is always "act on this first."
    const urgencyRank = (item) => {
      const r = item._reason || '';
      if (r === 'Expires today!')             return 0;
      if (r.startsWith('Expires in '))        return 1;
      if (r === 'Deposit pending')            return 2;
      if (r === 'Viewed — follow up')         return 3;
      if (r === 'Changes requested')          return 4;
      if (r.includes('going cold'))           return 5;
      return 6;
    };
    return items.sort((a, b) => {
      const ar = urgencyRank(a);
      const br = urgencyRank(b);
      if (ar !== br) return ar - br;
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });
  }, [quotes]);

  const actionItems = actionItemsRaw.slice(0, 5);
  const actionOverflow = Math.max(0, actionItemsRaw.length - 5);

  // Recent Quotes — top 6 by updated_at, but EXCLUDE anything already
  // surfaced in "Needs attention" so the dashboard doesn't render
  // the same quote in two stacked sections on mobile (eats the
  // most-scarce vertical space).
  const recentQuotes = useMemo(() => {
    const actionIds = new Set(actionItemsRaw.map(q => q.id));
    return [...quotes]
      .filter(q => !actionIds.has(q.id))
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
      .slice(0, 6);
  }, [quotes, actionItemsRaw]);

  const hasAnyData = quotes.length > 0;

  // ── Welcome-back recap (audit #23) ──
  // When a contractor returns after >24h away, summarize what changed
  // while they were gone: quote views, deposits paid, invoices paid,
  // quotes expired. Keeps them oriented instead of forcing them to
  // hunt through pages to figure out "what happened since Friday?"
  const [welcomeBack, setWelcomeBack] = useState(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  useEffect(() => {
    if (loading || !hasAnyData) return;
    let lastSeen;
    try {
      lastSeen = localStorage.getItem('pl_last_seen');
    } catch { return; }
    const now = Date.now();
    if (lastSeen) {
      const since = Date.parse(lastSeen);
      const hoursAway = (now - since) / 3600000;
      // Only show for genuine returning visits (24h+) — anything less
      // is normal active use where the contractor already saw the
      // events live.
      if (hoursAway >= 24 && hoursAway < 30 * 24) {
        const sinceMs = since;
        const sinceDays = Math.round(hoursAway / 24);
        const newViews = quotes.filter(q => q.last_viewed_at && Date.parse(q.last_viewed_at) > sinceMs).length;
        const newDeposits = quotes.filter(q => q.deposit_status === 'paid' && q.updated_at && Date.parse(q.updated_at) > sinceMs).length;
        const newPaid = invoices.filter(i => i.status === 'paid' && i.paid_at && Date.parse(i.paid_at) > sinceMs).length;
        const newExpired = quotes.filter(q => q.status === 'expired' && q.updated_at && Date.parse(q.updated_at) > sinceMs).length;
        const total = newViews + newDeposits + newPaid + newExpired;
        if (total > 0) {
          setWelcomeBack({ days: sinceDays, newViews, newDeposits, newPaid, newExpired });
        }
      }
    }
    try { localStorage.setItem('pl_last_seen', new Date(now).toISOString()); } catch { /* private */ }
  }, [loading, hasAnyData, quotes, invoices]);

  // Today's scheduled work — quotes whose schedule_window falls on
  // today's date. Surfaces address, phone, and a one-tap "On my way"
  // SMS so the dashboard becomes the contractor's morning launchpad
  // instead of just a quote-management screen.
  const todayJobs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return quotes.filter((q) => {
      if (!q.schedule_window) return false;
      const w = new Date(q.schedule_window);
      return w >= today && w < tomorrow && !q.archived_at;
    });
  }, [quotes]);

  function handleJobSubmit(e) {
    e.preventDefault();
    trackQuoteFlowStarted({ source: 'home_job_input' });
    haptic('medium');
    const title = jobInput.trim();
    // Remember the typed job title in localStorage so the next quote
    // gets autocomplete from the dashboard's <datalist>. A power user
    // running the same panel-upgrade scope monthly shouldn't be
    // retyping it. Cap at 12 entries, dedupe case-insensitively,
    // MRU-ordered.
    if (title) {
      try {
        const KEY = 'pl_recent_job_titles';
        const raw = localStorage.getItem(KEY);
        const prev = raw ? JSON.parse(raw) : [];
        const lower = title.toLowerCase();
        const next = [title, ...prev.filter(t => t.toLowerCase() !== lower)].slice(0, 12);
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch { /* private mode */ }
    }
    navigate('/app/quotes/new', title ? { state: { prefill: title } } : undefined);
  }

  // MRU job titles, sourced from localStorage. Doesn't trigger a re-
  // render on its own — refreshed alongside the dashboard's data
  // load so a quote just submitted appears in the autocomplete the
  // next time the contractor lands here.
  const recentJobTitles = useMemo(() => {
    try {
      const raw = localStorage.getItem('pl_recent_job_titles');
      const fromStorage = raw ? JSON.parse(raw) : [];
      // Seed from the contractor's actual quote titles too — a brand
      // new visit to the dashboard has nothing in localStorage but
      // the quote list itself reveals what they tend to type.
      const fromQuotes = [...new Set(quotes.map(q => q.title).filter(Boolean))].slice(0, 8);
      const merged = [];
      const seen = new Set();
      for (const t of [...fromStorage, ...fromQuotes]) {
        const k = t.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(t);
        if (merged.length >= 12) break;
      }
      return merged;
    } catch { return []; }
  }, [quotes]);

  /* ── Render ── */
  return (
    <AppShell hideTitle>
      {showOnboarding && <OnboardingWizard onDismiss={() => setShowOnboarding(false)} />}

      <div className="dv2-root motion-isolate">

        {/* ═══ GREETING + STAT ═══ */}
        <div className="dv2-row1 dv2-enter" style={{ '--i': 0 }}>
          <div className="dv2-greeting-block">
            <h1 className="dv2-greeting font-display">{greeting}</h1>
            {!loading && hasAnyData && (sentThisMonth > 0 || closeRate !== null) && (
              <p className="dv2-greeting-sub">
                {sentThisMonth > 0 && `${sentThisMonth} quote${sentThisMonth !== 1 ? 's' : ''} sent this month`}
                {sentThisMonth > 0 && closeRate !== null && ' · '}
                {closeRate !== null && `${closeRate}% close rate`}
              </p>
            )}
          </div>
          {/* Money chips — pipeline + owed. The contractor's two
              honest numbers: what's potentially closing, and what's
              actually owed. Previously the dashboard only showed
              pipeline, so a contractor with a closed funnel + $40K
              of overdue invoices saw $0. */}
          {!loading && (pipelineValue > 0 || moneyOwed > 0 || earnedThisMonth > 0) && (
            <div className="dv2-money-chips">
              {earnedThisMonth > 0 && (
                <Link
                  to="/app/invoices"
                  className="dv2-headline-metric dv2-headline-metric--success"
                  aria-label={`Earned this month: ${currency(earnedThisMonth)}`}
                >
                  <span>{currency(earnedThisMonth)}</span>
                  <span className="dv2-metric-sub">earned this month</span>
                </Link>
              )}
              {pipelineValue > 0 && (
                <Link
                  to="/app/quotes"
                  className={`dv2-headline-metric ${awaitingApproval > 0 ? 'dv2-headline-metric--warning' : 'dv2-headline-metric--info'}`}
                >
                  <span>{currency(pipelineValue)}</span>
                  <span className="dv2-metric-sub">
                    {awaitingApproval > 0
                      ? `${awaitingApproval} in open quote${awaitingApproval !== 1 ? 's' : ''}`
                      : 'in open quotes'}
                  </span>
                </Link>
              )}
              {moneyOwed > 0 && (
                <Link
                  to="/app/invoices"
                  className={`dv2-headline-metric ${overdueCount > 0 ? 'dv2-headline-metric--danger' : 'dv2-headline-metric--info'}`}
                >
                  <span>{currency(moneyOwed)}</span>
                  <span className="dv2-metric-sub">
                    {overdueCount > 0
                      ? `${overdueCount} overdue`
                      : 'awaiting payment'}
                  </span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ═══ NEW QUOTE — the most important action ═══ */}
        <form className="dv2-job-form dv2-enter" style={{ '--i': 1 }}
              onSubmit={handleJobSubmit} data-testid="dash-job-form">
          <input
            ref={jobInputRef}
            className="dv2-job-input"
            type="text"
            placeholder="What's the job?"
            value={jobInput}
            onChange={e => setJobInput(e.target.value)}
            list="pl-recent-jobs"
            autoComplete="off"
            enterKeyHint="go"
          />
          {recentJobTitles.length > 0 && (
            <datalist id="pl-recent-jobs">
              {recentJobTitles.map(t => <option key={t} value={t} />)}
            </datalist>
          )}
          <button className="dv2-job-go" type="submit">
            {jobInput.trim()
              ? <><span>Build quote</span><ArrowRight size={14} /></>
              : <span>+ New quote</span>}
          </button>
        </form>
        {/* Always-on caption under the form so even returning users see
            that typing here summons the AI scope builder. Previously
            this magic was hidden behind the empty-state branch and
            invisible to anyone with ≥ 1 quote. */}
        {!loading && !jobInput.trim() && (
          <div className="dv2-job-hint" aria-hidden="true">
            <span>Punchlist builds the full scope automatically.</span>
            <span className="dv2-job-hint-eg">e.g. <em>Furnace + AC replacement</em></span>
          </div>
        )}

        {/* ═══ PWA INSTALL PROMPT ═══ */}
        {canInstall && sentThisMonth > 0 && (
          <div
            className={`dv2-install-banner dv2-enter${installLeaving ? ' is-leaving' : ''}`}
            style={{ '--i': 2 }}
            onAnimationEnd={(e) => {
              // Trigger the actual dismiss + state update once the
              // leaving animation finishes so the banner collapses
              // gracefully instead of disappearing mid-frame.
              if (installLeaving && e.animationName === 'dv2-banner-out') dismissPwa();
            }}
          >
            <div className="dv2-install-body">
              <strong>Add Punchlist to your home screen</strong>
              <span className="dv2-install-sub">Open quotes faster — one tap from your phone</span>
            </div>
            <div className="dv2-install-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={installPwa}>Install</button>
              <button type="button" className="btn-link dv2-install-dismiss" onClick={() => setInstallLeaving(true)}>Not now</button>
            </div>
          </div>
        )}

        {/* ═══ EMPTY STATE ═══ */}
        {!loading && !hasAnyData && (
          <div className="dv2-empty-state dv2-enter" style={{ '--i': 2 }}>
            <div className="dv2-empty-icon">📋</div>
            <div className="dv2-empty-headline">Your first quote takes 3 minutes</div>
            <p className="dv2-empty-sub">
              Type the job above — Punchlist builds a full line-item quote with trade-accurate pricing.
              Your customer sees a monthly payment option and approves from their phone.
            </p>
            <div className="dv2-empty-examples">
              <div className="dv2-empty-ex-label">Try one of these</div>
              <div className="dv2-empty-chips">
                {[
                  'Replace water heater — main floor',
                  'Panel upgrade to 200A',
                  'Main floor bathroom reno',
                  'Furnace replacement + AC',
                  'Roof replacement — bungalow',
                ].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="dv2-empty-chip"
                    onClick={() => {
                      setJobInput(ex);
                      jobInputRef.current?.focus();
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ WELCOME BACK ═══ — re-orientation banner when contractor
            returns after 24h+ away. Summarizes the events they missed
            so they don't have to hunt across pages to find out what
            happened over the weekend. Dismissable; auto-clears on
            next visit when the recap window resets. */}
        {!loading && welcomeBack && !welcomeDismissed && (
          <div className="dv2-welcome-back dv2-enter" style={{ '--i': 1 }}>
            <div className="dv2-welcome-back-body">
              <div className="dv2-welcome-back-title">
                Welcome back · {welcomeBack.days} day{welcomeBack.days !== 1 ? 's' : ''} away
              </div>
              <div className="dv2-welcome-back-sub">
                {[
                  welcomeBack.newPaid > 0 && `${welcomeBack.newPaid} invoice${welcomeBack.newPaid !== 1 ? 's' : ''} paid`,
                  welcomeBack.newDeposits > 0 && `${welcomeBack.newDeposits} deposit${welcomeBack.newDeposits !== 1 ? 's' : ''}`,
                  welcomeBack.newViews > 0 && `${welcomeBack.newViews} quote view${welcomeBack.newViews !== 1 ? 's' : ''}`,
                  welcomeBack.newExpired > 0 && `${welcomeBack.newExpired} expired`,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button
              type="button"
              className="dv2-welcome-back-close"
              onClick={() => setWelcomeDismissed(true)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ═══ TODAY ═══ — the contractor's morning launchpad. Renders
            only when there are scheduled jobs today; otherwise hides
            entirely (no persistent empty card eating space). */}
        {!loading && todayJobs.length > 0 && (
          <TodaySection
            jobs={todayJobs}
            contractorName={userProfile?.company_name || userProfile?.full_name || ''}
            country={userProfile?.country || 'CA'}
          />
        )}

        {/* ═══ ACTION REQUIRED ═══ */}
        {!loading && actionItems.length > 0 && (
          <section className="dv2-section dv2-enter" style={{ '--i': 2 }}>
            <div className="dv2-section-head">
              <h2 className="dv2-section-title">Needs attention</h2>
              <span className="dv2-section-count">{actionItems.length}</span>
            </div>
            <div className="dv2-action-list">
              {actionItems.map((q, i) => {
                const status = normalizeStatus(q.status);
                const customer = q.customer?.name;
                const quickAction = quickActionFor(q._reason || '');
                return (
                  <ActionRow
                    key={q.id}
                    quote={q}
                    status={status}
                    customer={customer}
                    quickAction={quickAction}
                    onQuickAction={() => handleQuickAction(q, quickAction)}
                    busy={quickActionBusy === q.id}
                    style={{ '--i': i + 3 }}
                  />
                );
              })}
              {actionOverflow > 0 && (
                <Link
                  to="/app/quotes"
                  className="dv2-arow dv2-arow--more dv2-enter"
                  style={{ '--i': actionItems.length + 3, textDecoration: 'none' }}
                >
                  <span className="dv2-arow-more-icon" aria-hidden="true">+</span>
                  <div className="dv2-arow-labels">
                    <span className="dv2-arow-primary">{actionOverflow} more {actionOverflow === 1 ? 'quote needs' : 'quotes need'} attention</span>
                    <span className="dv2-arow-secondary">View all quotes →</span>
                  </div>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* ═══ ALL CLEAR ═══ — a contractor with quotes/invoices but
            zero pending actions today gets a small win moment instead
            of a blank space. Linear-inbox-zero energy. */}
        {!loading && hasAnyData && actionItems.length === 0 && todayJobs.length === 0 && (
          <div className="dv2-all-clear dv2-enter" style={{ '--i': 2 }}>
            <div className="dv2-all-clear-icon" aria-hidden="true">✓</div>
            <div className="dv2-all-clear-body">
              <div className="dv2-all-clear-title">You're all caught up</div>
              <div className="dv2-all-clear-sub">
                No quotes need follow-up today. Nice.
                {sentThisMonth > 0 && ` · ${sentThisMonth} sent this month`}
              </div>
            </div>
          </div>
        )}

        {/* ═══ RECENT QUOTES ═══ */}
        {!loading && hasAnyData && (
          <section className="dv2-section dv2-enter" style={{ '--i': actionItems.length > 0 ? 3 : 2 }}>
            <div className="dv2-section-head">
              <h2 className="dv2-section-title">Recent quotes</h2>
              <Link to="/app/quotes" className="dv2-section-link">
                All quotes <ChevronRight size={11} />
              </Link>
            </div>

            <div className="dv2-action-list">
              {recentQuotes.map((q, i) => {
                const status = normalizeStatus(q.status);
                const total = q.total || q.subtotal || 0;
                const dotClass = {
                  draft: 'dv2-arow-dot--muted',
                  sent: 'dv2-arow-dot--blue',
                  viewed: 'dv2-arow-dot--blue',
                  revision_requested: 'dv2-arow-dot--amber',
                  approved: 'dv2-arow-dot--green',
                  approved_pending_deposit: 'dv2-arow-dot--amber',
                  deposit_paid: 'dv2-arow-dot--green',
                  converted_to_invoice: 'dv2-arow-dot--green',
                  paid: 'dv2-arow-dot--green',
                  declined: 'dv2-arow-dot--red',
                  expired: 'dv2-arow-dot--red',
                }[status] || 'dv2-arow-dot--muted';
                const isHot    = status === 'viewed';
                const isMuted  = status === 'declined' || status === 'expired';
                const customer = q.customer?.name;
                let rowCls = 'dv2-arow dv2-enter';
                if (isHot)   rowCls += ' dv2-arow--hot';
                if (isMuted) rowCls += ' dv2-arow--muted';

                return (
                  <Link
                    key={q.id}
                    to={status === 'draft' ? `/app/quotes/${q.id}/edit` : `/app/quotes/${q.id}`}
                    className={rowCls}
                    style={{ '--i': i + 3, textDecoration: 'none' }}
                  >
                    {customer
                      ? <span className={`dv2-arow-avatar ${AVATAR_COLOR[status] || ''}${isHot ? ' dv2-arow-avatar--live' : ''}`}>
                          {initials(customer)}
                        </span>
                      : <span className={`dv2-arow-dot ${dotClass}${isHot ? ' dv2-arow-dot--live' : ''}`} />
                    }
                    <div className="dv2-arow-labels">
                      <span className="dv2-arow-primary">
                        {q.title || q.description?.slice(0, 48) || 'Untitled quote'}
                      </span>
                      <span className="dv2-arow-secondary">
                        {customer || 'No customer'}
                      </span>
                    </div>
                    {total > 0 && <span className="dv2-arow-num">{currency(total)}</span>}
                    <span className={`chip chip-${status}`}>
                      {chipForStatus(status)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══ QUICK NAV ═══ */}
        {!loading && hasAnyData && (
          <div className="dv2-quicknav dv2-enter" style={{ '--i': 3 }}>
            <Link to="/app/customers" className="dv2-qnav-tile">
              <span className="dv2-qnav-icon">👥</span>
              <div className="dv2-qnav-content">
                <span className="dv2-qnav-label">Customers</span>
                {customerCount > 0 && <span className="dv2-qnav-count">{customerCount}</span>}
              </div>
              <ChevronRight size={13} className="dv2-qnav-arrow" />
            </Link>
            <Link to="/app/templates" className="dv2-qnav-tile">
              <span className="dv2-qnav-icon">💬</span>
              <div className="dv2-qnav-content">
                <span className="dv2-qnav-label">Follow-up messages</span>
                <span className="dv2-qnav-count">Customize templates</span>
              </div>
              <ChevronRight size={13} className="dv2-qnav-arrow" />
            </Link>
            {userProfile && isPro(userProfile) && (
              <Link to="/app/invoices" className="dv2-qnav-tile">
                <span className="dv2-qnav-icon">🧾</span>
                <div className="dv2-qnav-content">
                  <span className="dv2-qnav-label">Invoices</span>
                </div>
                <ChevronRight size={13} className="dv2-qnav-arrow" />
              </Link>
            )}
          </div>
        )}

        {/* ═══ STRIPE CONNECT UPSELL ═══ */}
        {!loading && userProfile && !userProfile.stripe_connect_onboarded && hasAnyData && (
          <Link to="/app/payments/setup" className="dv2-upsell">
            <DollarSign size={18} className="dv2-upsell-icon" />
            <div className="dv2-upsell-text">
              <strong>Let customers pay monthly — you still get the full amount</strong>
              <span>~20-min setup. No monthly fee. You get paid upfront.</span>
            </div>
            <ChevronRight size={15} className="dv2-upsell-arrow" />
          </Link>
        )}

        {/* ═══ USAGE METER ═══ */}
        {!loading && userProfile && !isPro(userProfile) && sentThisMonth >= 1 && (
          <div className="dv2-usage">
            <div className="dv2-usage-track">
              <div
                className="dv2-usage-fill"
                style={{ '--fill': Math.min(1, sentThisMonth / FREE_QUOTE_LIMIT) }}
              />
            </div>
            <span className="dv2-usage-text">
              {sentThisMonth} of {FREE_QUOTE_LIMIT} quotes this month
            </span>
            {sentThisMonth >= 3 && (
              <Link to="/app/billing" className="dv2-usage-upgrade">Upgrade →</Link>
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
}
