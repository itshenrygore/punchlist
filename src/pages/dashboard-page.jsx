import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/app-shell';
import OnboardingWizard from '../components/onboarding-wizard';
import UpgradePrompt, { shouldShowUpgrade, recordUpgradeShown, UpgradeBanner, UsageMeter } from '../components/upgrade-prompt';
import { listBookings, listQuotes, listInvoices, listCustomers, markFollowedUp, updateQuoteStatus, createInvoiceFromQuoteWithAdditionalWork, friendly, calculateReceivables, getProfile, checkAndSendDigest, expireStaleDrafts, checkAndSendReminder } from '../lib/api';
import { isPro, countSentThisMonth, getUsageInfo, FREE_QUOTE_LIMIT } from '../lib/billing';
import { useAuth } from '../hooks/use-auth';
import { currency, relativeTime } from '../lib/format';
import { exportQuotesCSV } from '../lib/format';
import { getFollowUpAdvice } from '../lib/workflow';
import { useToast } from '../components/toast';
import BookingDrawer from '../components/booking-drawer';

function safeLocalStorage(key, fallback) {
  try { return localStorage.getItem(key); } catch { return fallback; }
}

/* ═══════════════════════════════════════════
   STATUS SIGNAL — inline badge with icon
   ═══════════════════════════════════════════ */
function StatusSignal({ type, label }) {
  const config = {
    viewed:    { icon: '👀', cls: 'sig-blue' },
    followup:  { icon: '⚠️', cls: 'sig-amber' },
    approved:  { icon: '✅', cls: 'sig-green' },
    deposit:   { icon: '💰', cls: 'sig-amber' },
    expiring:  { icon: '⏳', cls: 'sig-red' },
    hot:       { icon: '🔥', cls: 'sig-red' },
    cold:      { icon: '❄️', cls: 'sig-blue' },
    draft:     { icon: '📝', cls: 'sig-muted' },
    scheduled: { icon: '📅', cls: 'sig-green' },
    revision:  { icon: '🔄', cls: 'sig-amber' },
    declined:  { icon: '❌', cls: 'sig-red' },
    overdue:   { icon: '🧾', cls: 'sig-red' },
    question:  { icon: '💬', cls: 'sig-amber' },
    complete:  { icon: '🏁', cls: 'sig-green' },
  };
  const c = config[type] || config.draft;
  return <span className={`ds-signal ${c.cls}`}>{c.icon} {label}</span>;
}

/* ═══════════════════════════════════════════
   URGENT STRIP — desktop alert bar
   ═══════════════════════════════════════════ */
function UrgentStrip({ items }) {
  if (!items.length) return null;
  return (
    <div className="ds-urgent">
      {items.map((item, i) => (
        <Link key={i} className="ds-urgent-item" to={item.to || '#'}>
          <span className="ds-urgent-icon">{item.icon}</span>
          <span className="ds-urgent-text">{item.label}</span>
          <span className="ds-urgent-arrow">→</span>
        </Link>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ATTENTION CARD
   ═══════════════════════════════════════════ */
function AttentionCard({ signal, title, subtitle, value, to, actions, liveText }) {
  return (
    <div className="ds-attn-card">
      <Link className="ds-attn-main" to={to || '#'}>
        <div className="ds-attn-left">
          {signal && <StatusSignal type={signal.type} label={signal.label} />}
          <span className="ds-attn-title">{title}</span>
          {subtitle && <span className="ds-attn-sub">{subtitle}</span>}
          {liveText && <span className="ds-attn-live">{liveText}</span>}
        </div>
        {value && <span className="ds-attn-value">{value}</span>}
      </Link>
      {actions && actions.length > 0 && (
        <div className="ds-attn-actions">
          {actions.map((act, i) => (
            <button key={i} className={`btn ${act.primary ? 'btn-primary' : 'btn-secondary'} btn-sm`} type="button" onClick={act.onClick}>{act.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   PIPELINE CARD
   ═══════════════════════════════════════════ */
function PipelineCard({ quote, signals }) {
  const viewInfo = quote.view_count > 0
    ? `Viewed ${quote.view_count}×${quote.last_viewed_at ? ' · ' + relativeTime(quote.last_viewed_at) : ''}`
    : null;
  return (
    <Link className="ds-pipe-card" to={`/app/quotes/${quote.id}`}>
      <div className="ds-pipe-top">
        <span className="ds-pipe-title">{quote.title || 'Untitled quote'}</span>
        <span className="ds-pipe-price">{currency(quote.total || 0)}</span>
      </div>
      <div className="ds-pipe-meta">
        <span>{quote.customer?.name || 'No contact'}</span>
        {viewInfo && <span className="ds-pipe-views">{viewInfo}</span>}
      </div>
      {signals && signals.length > 0 && (
        <div className="ds-pipe-signals">
          {signals.map((s, i) => <StatusSignal key={i} type={s.type} label={s.label} />)}
        </div>
      )}
    </Link>
  );
}

/* ═══════════════════════════════════════════
   PIPELINE STAGE — collapsible
   ═══════════════════════════════════════════ */
function PipelineStage({ label, count, total, color, icon, children, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  if (count === 0) return null;
  return (
    <div className={`ds-stage${open ? ' ds-stage-open' : ''}`}>
      <button type="button" className="ds-stage-head" onClick={() => setOpen(!open)}>
        <div className="ds-stage-left">
          <span className="ds-stage-dot" style={{ background: color }} />
          <span className="ds-stage-icon">{icon}</span>
          <span className="ds-stage-label">{label}</span>
          <span className="ds-stage-count">{count}</span>
        </div>
        <div className="ds-stage-right">
          {total > 0 && <span className="ds-stage-total">{currency(total)}</span>}
          <span className="ds-stage-chevron">{open ? '▾' : '▸'}</span>
        </div>
      </button>
      {open && <div className="ds-stage-body">{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCHEDULE PREVIEW
   ═══════════════════════════════════════════ */
function SchedulePreview({ todaysJobs, tomorrowJobs }) {
  if (!todaysJobs.length && !tomorrowJobs.length) return null;
  return (
    <div className="ds-section ds-schedule">
      <div className="ds-section-head">
        <span className="ds-section-title"><span className="ds-section-icon">🔨</span> Upcoming</span>
        <Link className="ds-section-link" to="/app/bookings">Calendar →</Link>
      </div>
      <div className="ds-schedule-body">
        {todaysJobs.length > 0 && (
          <div className="ds-schedule-group">
            <span className="ds-schedule-day">Today</span>
            {todaysJobs.map(job => (
              <div key={job.id} className="ds-schedule-item">
                <span className="ds-schedule-time">{new Date(job.scheduled_for).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                <div className="ds-schedule-info">
                  <span className="ds-schedule-name">{job.customer?.name || job.quote?.title || 'Job'}</span>
                  {job.notes && <span className="ds-schedule-notes">{job.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {tomorrowJobs.length > 0 && (
          <div className="ds-schedule-group">
            <span className="ds-schedule-day">Tomorrow</span>
            {tomorrowJobs.map(job => (
              <div key={job.id} className="ds-schedule-item">
                <span className="ds-schedule-time">{new Date(job.scheduled_for).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                <div className="ds-schedule-info">
                  <span className="ds-schedule-name">{job.customer?.name || job.quote?.title || 'Job'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   QUICK ACTIONS
   ═══════════════════════════════════════════ */
function QuickActionsBar({ lastDraft, recentQuote }) {
  return (
    <div className="ds-section ds-quick">
      <div className="ds-qa-row">
        <Link className="ds-qa-btn ds-qa-primary" to="/app/quotes/new">
          <span className="ds-qa-icon">📝</span><span className="ds-qa-label">New Quote</span>
        </Link>
        {lastDraft && (
          <Link className="ds-qa-btn" to={`/app/quotes/${lastDraft.id}/edit`}>
            <span className="ds-qa-icon">✏️</span><span className="ds-qa-label">Resume Draft</span>
          </Link>
        )}
        {recentQuote && !lastDraft && (
          <Link className="ds-qa-btn" to={`/app/quotes/${recentQuote.id}`}>
            <span className="ds-qa-icon">📋</span><span className="ds-qa-label">Last Quote</span>
          </Link>
        )}
        <Link className="ds-qa-btn" to="/app/bookings">
          <span className="ds-qa-icon">📅</span><span className="ds-qa-label">Calendar</span>
        </Link>
        <Link className="ds-qa-btn" to="/app/contacts">
          <span className="ds-qa-icon">👤</span><span className="ds-qa-label">Contacts</span>
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   INSIGHTS STRIP
   ═══════════════════════════════════════════ */
function InsightsStrip({ conversionRate, avgQuoteValue, totalPipeline, recentWins }) {
  return (
    <div className="ds-section ds-insights">
      <div className="ds-section-head"><span className="ds-section-title">Business Pulse</span></div>
      <div className="ds-insights-grid">
        <div className="ds-insight"><span className="ds-insight-val">{conversionRate}%</span><span className="ds-insight-label">Win rate</span></div>
        <div className="ds-insight"><span className="ds-insight-val">{currency(avgQuoteValue)}</span><span className="ds-insight-label">Avg quote</span></div>
        <div className="ds-insight"><span className="ds-insight-val">{currency(totalPipeline)}</span><span className="ds-insight-label">Pipeline</span></div>
        <div className="ds-insight"><span className="ds-insight-val">{recentWins}</span><span className="ds-insight-label">Wins/mo</span></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════ */
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show: toast } = useToast();
  const jobInputRef = useRef(null);
  const [quotes, setQuotes] = useState([]);
  const [allQuotes, setAllQuotes] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [scheduleQuote, setScheduleQuote] = useState(null);
  const [invoicePromptQuote, setInvoicePromptQuote] = useState(null);
  const [invoiceReceivables, setInvoiceReceivables] = useState(null);
  const [invoiceList, setInvoiceList] = useState([]);
  const [invoiceCreating, setInvoiceCreating] = useState(false);
  const [profileNudge, setProfileNudge] = useState(null);
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const [upgradeBanner, setUpgradeBanner] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [jobInput, setJobInput] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  /* ── Value trigger listener ── */
  useEffect(() => {
    function handleValueTrigger(e) {
      const { type } = e.detail || {};
      if (!type) return;
      try { if (localStorage.getItem('pl_is_pro') === '1') return; } catch {}
      if (type === 'quote_approved') {
        toast('You just won a job 🎉', 'success', { label: 'Upgrade for unlimited', onClick: () => navigate('/pricing') });
      } else if (type === 'quote_viewed') {
        const detail = e.detail || {};
        const viewMsg = detail.title || 'Your quote was just viewed';
        toast(`${viewMsg} 👀`, 'success');
      }
    }
    window.addEventListener('pl:value-trigger', handleValueTrigger);
    return () => window.removeEventListener('pl:value-trigger', handleValueTrigger);
  }, [toast, navigate]);

  /* ── Data fetch ── */
  useEffect(() => {
    if (!user) return;
    try { localStorage.removeItem('pl_first_run'); } catch {}
    expireStaleDrafts().catch(() => {});
    Promise.all([listQuotes(user.id), listBookings(user.id), listInvoices(user.id), listCustomers(user.id)])
      .then(([q, b, inv, customers]) => {
        const raw = q || [];
        const active = raw.filter(qt => !qt.archived_at);
        setQuotes(active);
        setAllQuotes(raw);
        setAllCustomers(customers || []);
        setBookings(b || []);
        setInvoiceReceivables(calculateReceivables(inv || []));
        setInvoiceList(inv || []);
        if (active.length === 0 && !safeLocalStorage('pl_onboarded', '')) setShowOnboarding(true);
        setSentThisMonth(countSentThisMonth(active));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    getProfile(user.id).then(p => {
      if (!p) {
        // Orphaned signup — user exists in auth but no profile row.
        // Create a minimal profile so the app doesn't break, and show onboarding.
        import('../lib/api/profile.js').then(({ saveProfile }) => {
          saveProfile(user, {
            full_name: user.user_metadata?.full_name || '',
            trade: 'Other', province: 'AB', country: 'CA',
          }).catch(() => {});
        });
        setShowOnboarding(true);
        setUserProfile({ trade: 'Other', province: 'AB', country: 'CA' });
        return;
      }
      setUserProfile(p);
      if (p?.digest_enabled) checkAndSendDigest(user.id, p).catch(() => {});
      try { localStorage.setItem('pl_is_pro', isPro(p) ? '1' : '0'); } catch {}
      if (!isPro(p)) { try { if (!localStorage.getItem('pl_welcome_shown')) { localStorage.setItem('pl_welcome_shown', '1'); setShowWelcome(true); } } catch {} }
      const missing = [];
      if (!p?.company_name?.trim()) missing.push('business name');
      if (!p?.logo_url?.trim()) missing.push('logo');
      if (!p?.phone?.trim()) missing.push('phone number');
      if (missing.length > 0) setProfileNudge({ missing });
    }).catch(() => {});
  }, [user]);

  /* ── Upgrade checks ── */
  // ── Batch overdue invoice reminder check ──
  // Runs on dashboard load so reminders fire even if contractor doesn't open each invoice.
  // Checks up to 5 overdue invoices per load to avoid rate limits.
  useEffect(() => {
    if (!userProfile || !invoiceList.length) return;
    const now = new Date();
    const overdue = invoiceList.filter(inv =>
      !['paid','cancelled'].includes(inv.status) &&
      inv.due_at && new Date(inv.due_at) < now &&
      inv.customer?.email
    ).slice(0, 5);
    if (!overdue.length) return;
    // Fire-and-forget: check each overdue invoice for pending reminders
    overdue.forEach(inv => {
      checkAndSendReminder(inv, userProfile).catch(() => {});
    });
  }, [userProfile?.id, invoiceList.length]);

  useEffect(() => {
    if (!userProfile || !quotes.length) return;
    if (isPro(userProfile)) return;
    const usage = getUsageInfo(userProfile, sentThisMonth);
    if (usage.atLimit && shouldShowUpgrade('quote_limit', quotes.length)) {
      recordUpgradeShown('quote_limit');
      setUpgradePrompt({ trigger: 'quote_limit', context: { count: sentThisMonth } });
    } else if (usage.nearLimit && shouldShowUpgrade('near_limit', quotes.length)) {
      setUpgradeBanner({ trigger: 'near_limit', context: { count: sentThisMonth } });
    }
  }, [userProfile, sentThisMonth, quotes.length]);

  /* ═══ Derived data ═══ */
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayEnd   = useMemo(() => { const d = new Date(); d.setHours(23,59,59,999); return d; }, []);
  const tmrwStart  = useMemo(() => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d; }, []);
  const tmrwEnd    = useMemo(() => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(23,59,59,999); return d; }, []);
  const weekEnd    = useMemo(() => { const d = new Date(); d.setDate(d.getDate()+(7-d.getDay())); d.setHours(23,59,59,999); return d; }, []);
  const nowTs      = useMemo(() => Date.now(), []);

  const todaysJobs = useMemo(() =>
    bookings.filter(b => b.status !== 'cancelled' && new Date(b.scheduled_for) >= todayStart && new Date(b.scheduled_for) <= todayEnd)
      .sort((a,b) => new Date(a.scheduled_for) - new Date(b.scheduled_for)), [bookings, todayStart, todayEnd]);

  const tomorrowJobs = useMemo(() =>
    bookings.filter(b => b.status !== 'cancelled' && new Date(b.scheduled_for) >= tmrwStart && new Date(b.scheduled_for) <= tmrwEnd)
      .sort((a,b) => new Date(a.scheduled_for) - new Date(b.scheduled_for)), [bookings, tmrwStart, tmrwEnd]);

  const weekJobs = useMemo(() =>
    bookings.filter(b => b.status !== 'cancelled' && new Date(b.scheduled_for) >= todayStart && new Date(b.scheduled_for) <= weekEnd),
    [bookings, todayStart, weekEnd]);

  const weekRevenue = useMemo(() =>
    weekJobs.reduce((sum,b) => { const q = quotes.find(q2 => q2.id === b.quote_id); return sum + Number(q?.total||0); }, 0),
    [weekJobs, quotes]);

  /* Pipeline stages */
  const drafts          = useMemo(() => quotes.filter(q => q.status === 'draft'), [quotes]);
  const sentQuotes      = useMemo(() => quotes.filter(q => q.status === 'sent'), [quotes]);
  const viewedQuotes    = useMemo(() => quotes.filter(q => q.status === 'viewed'), [quotes]);
  const approvedQuotes  = useMemo(() => quotes.filter(q => ['approved','approved_pending_deposit'].includes(q.status)), [quotes]);
  const scheduledQuotes = useMemo(() => quotes.filter(q => q.status === 'scheduled'), [quotes]);

  /* Quick continuation */
  const lastDraft       = useMemo(() => [...drafts].sort((a,b) => new Date(b.updated_at)-new Date(a.updated_at))[0] || null, [drafts]);
  const recentSentQuote = useMemo(() => quotes.filter(q => q.status !== 'draft').sort((a,b) => new Date(b.updated_at)-new Date(a.updated_at))[0] || null, [quotes]);

  /* ── Needs Attention — smart composite ── */
  const attentionItems = useMemo(() => {
    const items = [];

    /* Viewed but no response */
    for (const q of quotes.filter(q => q.status === 'viewed')) {
      const advice = getFollowUpAdvice(q);
      const sType = advice?.urgency === 'high' ? 'hot' : advice?.urgency === 'medium' ? 'followup' : 'viewed';
      items.push({ signal: { type: sType, label: advice?.headline || `Viewed ${q.view_count||1}×` },
        title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
        to: `/app/quotes/${q.id}`, liveText: q.last_viewed_at ? `Last viewed ${relativeTime(q.last_viewed_at)}` : null,
        priority: sType === 'hot' ? 0 : sType === 'followup' ? 1 : 2, quote: q, actionType: 'followup' });
    }

    /* Sent but never opened — only if advice says to act */
    for (const q of quotes.filter(q => q.status === 'sent')) {
      const advice = getFollowUpAdvice(q);
      if (advice && advice.urgency !== 'low') {
        items.push({ signal: { type: advice.urgency === 'high' ? 'hot' : 'followup', label: advice.headline },
          title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
          to: `/app/quotes/${q.id}`, liveText: null,
          priority: advice.urgency === 'high' ? 0 : 1, quote: q, actionType: 'followup' });
      }
    }

    /* Revision requests */
    for (const q of quotes.filter(q => q.status === 'revision_requested')) {
      items.push({ signal: { type: 'revision', label: 'Changes requested' },
        title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
        to: `/app/quotes/${q.id}/edit`, priority: 0, quote: q, actionType: 'edit' });
    }

    /* Expiring soon */
    for (const q of quotes.filter(q => {
      if (!q.expires_at) return false;
      if (['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status)) return false;
      return Math.ceil((new Date(q.expires_at)-nowTs)/86400000) >= 0 && Math.ceil((new Date(q.expires_at)-nowTs)/86400000) <= 3;
    })) {
      const dl = Math.ceil((new Date(q.expires_at)-nowTs)/86400000);
      items.push({ signal: { type: 'expiring', label: dl === 0 ? 'Expires today' : `Expires in ${dl}d` },
        title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
        to: `/app/quotes/${q.id}`, priority: 0, quote: q, actionType: 'view' });
    }

    /* Deposits pending */
    for (const q of quotes.filter(q => ['approved','approved_pending_deposit'].includes(q.status) && q.deposit_required && q.deposit_status !== 'paid')) {
      items.push({ signal: { type: 'deposit', label: `${currency(q.deposit_amount||0)} deposit pending` },
        title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
        to: `/app/quotes/${q.id}`, priority: 1, quote: q, actionType: 'view' });
    }

    /* Overdue invoices */
    if (invoiceReceivables?.overdueCount > 0) {
      const now = new Date();
      const oi = invoiceList.filter(i => !['paid','cancelled'].includes(i.status) && i.due_at && new Date(i.due_at) < now);
      items.push({ signal: { type: 'overdue', label: `${invoiceReceivables.overdueCount} overdue` },
        title: `${invoiceReceivables.overdueCount} overdue invoice${invoiceReceivables.overdueCount>1?'s':''}`,
        subtitle: currency(invoiceReceivables.overdueTotal),
        to: oi.length === 1 ? `/app/invoices/${oi[0].id}` : '/app/quotes', priority: 0, actionType: 'view' });
    }

    /* Customer questions */
    for (const q of quotes) {
      const conv = Array.isArray(q.conversation) ? q.conversation : [];
      if (conv.length > 0 && conv[conv.length-1]?.role === 'customer') {
        items.push({ signal: { type: 'question', label: 'Customer question' },
          title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
          to: `/app/quotes/${q.id}`, priority: 0, quote: q, actionType: 'view' });
      }
    }

    /* Approved but unscheduled */
    for (const q of approvedQuotes) {
      if (!bookings.some(b => b.quote_id === q.id && b.status !== 'cancelled')) {
        items.push({ signal: { type: 'approved', label: 'Ready to schedule' },
          title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
          to: `/app/quotes/${q.id}`, priority: 2, quote: q, actionType: 'schedule' });
      }
    }

    /* Scheduled jobs whose booking time has passed — prompt to mark complete */
    for (const q of scheduledQuotes) {
      const pastBooking = bookings.find(b =>
        b.quote_id === q.id && b.status === 'scheduled' &&
        new Date(b.scheduled_for).getTime() < nowTs
      );
      if (pastBooking) {
        items.push({ signal: { type: 'complete', label: 'Job done?' },
          title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
          to: `/app/quotes/${q.id}`, priority: 3, quote: q, actionType: 'complete' });
      }
    }

    items.sort((a,b) => a.priority - b.priority);
    return items.slice(0, 8);
  }, [quotes, approvedQuotes, scheduledQuotes, bookings, invoiceReceivables, invoiceList, nowTs]);

  /* Urgent strip */
  const urgentItems = useMemo(() => {
    const items = [];
    const fups = attentionItems.filter(i => ['hot','followup'].includes(i.signal?.type));
    if (fups.length) items.push({ icon: '⚠️', label: `${fups.length} quote${fups.length>1?'s':''} need follow-up`, to: fups[0]?.to || '/app/quotes' });
    const exp = attentionItems.filter(i => i.signal?.type === 'expiring').length;
    if (exp) items.push({ icon: '⏳', label: `${exp} quote${exp>1?'s':''} expiring soon`, to: '/app/quotes' });
    const qs = attentionItems.filter(i => i.signal?.type === 'question');
    if (qs.length) items.push({ icon: '💬', label: `${qs.length} customer question${qs.length>1?'s':''}`, to: qs[0]?.to || '/app/quotes' });
    return items;
  }, [attentionItems]);

  /* Pipeline totals */
  const pipelineTotals = useMemo(() => ({
    draft: drafts.reduce((s,q) => s+Number(q.total||0), 0),
    sent: sentQuotes.reduce((s,q) => s+Number(q.total||0), 0),
    viewed: viewedQuotes.reduce((s,q) => s+Number(q.total||0), 0),
    approved: approvedQuotes.reduce((s,q) => s+Number(q.total||0), 0),
    scheduled: scheduledQuotes.reduce((s,q) => s+Number(q.total||0), 0),
  }), [drafts, sentQuotes, viewedQuotes, approvedQuotes, scheduledQuotes]);

  /* Insights */
  const insights = useMemo(() => {
    const ms = new Date(); ms.setDate(1); ms.setHours(0,0,0,0);
    const allActive = quotes.filter(q => q.status !== 'draft');
    const won = quotes.filter(q => ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status));
    const wonMonth = won.filter(q => new Date(q.updated_at) >= ms);
    return {
      conversionRate: allActive.length > 0 ? Math.round((won.length/allActive.length)*100) : 0,
      avgQuoteValue: allActive.length > 0 ? Math.round(allActive.reduce((s,q)=>s+Number(q.total||0),0)/allActive.length) : 0,
      totalPipeline: [...sentQuotes,...viewedQuotes,...approvedQuotes].reduce((s,q)=>s+Number(q.total||0),0),
      recentWins: wonMonth.length,
    };
  }, [quotes, sentQuotes, viewedQuotes, approvedQuotes]);

  function getSignalsForQuote(q) {
    const signals = [];
    const advice = getFollowUpAdvice(q);
    if (advice?.urgency === 'high') signals.push({ type: 'hot', label: advice.headline });
    else if (advice?.urgency === 'medium') signals.push({ type: 'followup', label: advice.headline });
    if (q.view_count > 0 && ['sent','viewed'].includes(q.status)) signals.push({ type: 'viewed', label: `Viewed ${q.view_count}×` });
    if (q.deposit_required && q.deposit_status !== 'paid' && ['approved','approved_pending_deposit'].includes(q.status)) signals.push({ type: 'deposit', label: 'Deposit pending' });
    const dl = q.expires_at ? Math.ceil((new Date(q.expires_at)-nowTs)/86400000) : null;
    if (dl !== null && dl <= 3 && dl >= 0) signals.push({ type: 'expiring', label: dl === 0 ? 'Expires today' : `${dl}d left` });
    return signals;
  }

  /* ── Actions ── */
  function handleJobInputSubmit(e) {
    e.preventDefault();
    const val = jobInput.trim();
    navigate('/app/quotes/new', val ? { state: { prefill: val } } : undefined);
  }

  async function handleFollowUpEmail(quote) {
    if (!quote.customer?.email) { toast('No email on file for this customer', 'error'); return; }
    markFollowedUp(quote.id).catch(e => toast(friendly(e), 'error'));
    /* Optimistic: update local state so card signal refreshes */
    setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, follow_up_at: new Date().toISOString() } : q));
    const fn = quote.customer?.name?.split(' ')[0] || '';
    const url = `${window.location.origin}/public/${quote.share_token}`;
    const cn = userProfile?.company_name || userProfile?.full_name || '';
    const subj = encodeURIComponent(`Following up: ${quote.title || 'your quote'}`);
    const body = encodeURIComponent(`Hi${fn?' '+fn:''},\n\nJust checking in on the quote I sent over.\n\nYou can review it here:\n${url}\n\nThanks,\n${cn}`);
    window.location.href = `mailto:${quote.customer.email}?subject=${subj}&body=${body}`;
    toast('Follow-up sent ✓', 'success');
  }

  async function handleFollowUpText(quote) {
    if (!quote.customer?.phone) { toast('No phone number on file for this customer', 'error'); return; }
    markFollowedUp(quote.id).catch(e => toast(friendly(e), 'error'));
    /* Optimistic: update local state so card signal refreshes */
    setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, follow_up_at: new Date().toISOString() } : q));
    const fn = quote.customer?.name?.split(' ')[0] || '';
    const url = `${window.location.origin}/public/${quote.share_token}`;
    const cn = userProfile?.company_name || userProfile?.full_name || '';
    const body = encodeURIComponent(`Hi${fn?' '+fn:''}, following up on the quote for ${quote.title || 'the work we discussed'}: ${url}\n\n— ${cn}`);
    window.open(`sms:${quote.customer.phone}?body=${body}`, '_self');
    toast('Follow-up sent ✓', 'success');
  }

  async function handleMarkComplete(quote) {
    try {
      await updateQuoteStatus(quote.id, { status: 'completed' });
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'completed' } : q));
      toast('Job marked complete', 'success');
      setInvoicePromptQuote({ ...quote, status: 'completed' });
    } catch (e) { toast(friendly(e), 'error'); }
  }

  async function handleCreateInvoiceNow() {
    if (!invoicePromptQuote || !user) return;
    setInvoiceCreating(true);
    try {
      const inv = await createInvoiceFromQuoteWithAdditionalWork(user.id, invoicePromptQuote);
      setQuotes(prev => prev.map(q => q.id === invoicePromptQuote.id ? { ...q, status: 'invoiced' } : q));
      setInvoicePromptQuote(null);
      toast('Invoice created', 'success');
      navigate(`/app/invoices/${inv.id}`);
    } catch (e) { toast(friendly(e), 'error'); }
    finally { setInvoiceCreating(false); }
  }

  function handleBookingSaved(booking) {
    if (scheduleQuote) setQuotes(prev => prev.map(q => q.id === scheduleQuote.id ? { ...q, status: 'scheduled' } : q));
    setBookings(prev => [...prev, booking].sort((a,b) => new Date(a.scheduled_for)-new Date(b.scheduled_for)));
    toast('Job scheduled', 'success');
    setScheduleQuote(null);
  }

  function getItemActions(item) {
    if (item.actionType === 'followup' && item.quote) {
      const q = item.quote, a = [];
      if (q.customer?.email) a.push({ label: '✉ Email', primary: true, onClick: () => handleFollowUpEmail(q) });
      if (q.customer?.phone) a.push({ label: '💬 Text', primary: !q.customer?.email, onClick: () => handleFollowUpText(q) });
      return a;
    }
    if (item.actionType === 'schedule' && item.quote) {
      return [
        { label: 'Schedule', primary: true, onClick: () => setScheduleQuote(item.quote) },
        { label: 'Complete', primary: false, onClick: () => handleMarkComplete(item.quote) },
      ];
    }
    if (item.actionType === 'complete' && item.quote) {
      return [{ label: '🏁 Mark Complete', primary: true, onClick: () => handleMarkComplete(item.quote) }];
    }
    return [];
  }

  const greeting = (() => {
    const h = new Date().getHours();
    const raw = user?.user_metadata?.full_name?.split(' ')[0] || '';
    const name = raw ? raw.charAt(0).toUpperCase()+raw.slice(1).toLowerCase() : '';
    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return name ? `${g}, ${name}` : g;
  })();

  /* Next upcoming job — for header subline */
  const nextJob = useMemo(() =>
    bookings.find(b => b.status !== 'cancelled' && b.status !== 'completed' && new Date(b.scheduled_for).getTime() >= nowTs),
    [bookings, nowTs]
  );

  const totalPipeline = drafts.length + sentQuotes.length + viewedQuotes.length + approvedQuotes.length + scheduledQuotes.length;

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <AppShell title="Dashboard">
      {showOnboarding && <OnboardingWizard onDismiss={() => setShowOnboarding(false)} />}
      {upgradePrompt && <UpgradePrompt trigger={upgradePrompt.trigger} context={upgradePrompt.context} onDismiss={() => setUpgradePrompt(null)} />}

      {loading ? (
        <div style={{ display:'grid', gap:10, padding:'12px 0' }}>
          {[1,2,3].map(i => (
            <div key={i} className="skel-card">
              <div className="skel-card-top"><div className="skel-line" style={{ width:'45%', height:14 }} /><div className="skel-line" style={{ width:'20%', height:14 }} /></div>
              <div className="skel-line" style={{ width:'70%', marginTop:8 }} />
              <div className="skel-line" style={{ width:'40%', marginTop:6 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ═══ HEADER ═══ */}
          <div className="ds-header">
            <div>
              <h2 className="ds-greeting">{greeting}</h2>
              {quotes.length > 0 && (
                <p className="ds-subline">
                  {todaysJobs.length > 0
                    ? `${todaysJobs.length} job${todaysJobs.length>1?'s':''} today`
                    : 'No jobs today'}
                  {nextJob && todaysJobs.length > 0 && (() => {
                    const t = new Date(nextJob.scheduled_for);
                    const now = new Date();
                    if (t > now) return ` · next at ${t.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}`;
                    return '';
                  })()}
                  {attentionItems.length > 0 && <span className="ds-subline-alert"> · {attentionItems.length} need{attentionItems.length===1?'s':''} attention</span>}
                </p>
              )}
            </div>
            {quotes.length > 0 && <button className="btn btn-ghost btn-sm" type="button" onClick={() => exportQuotesCSV(quotes)} style={{ fontSize:11 }}>Export</button>}
          </div>

          {/* ═══ JOB INPUT ═══ */}
          <form className="dash-job-input" data-testid="dash-job-form" onSubmit={handleJobInputSubmit}>
            <input ref={jobInputRef} className="dash-job-field" type="text" placeholder="Describe the job… e.g. replace hot water tank" value={jobInput} onChange={e => setJobInput(e.target.value)} autoComplete="off" />
            <button className="btn btn-primary dash-job-go" type="submit">{jobInput.trim() ? 'Build quote →' : '+ New quote'}</button>
          </form>

          {/* ═══ TODAY SUMMARY — visible primarily on mobile, shows schedule at a glance ═══ */}
          {todaysJobs.length > 0 && (
            <div className="dash-today">
              <div className="dash-today-label">Today's schedule</div>
              <div className="dash-today-items">
                {todaysJobs.slice(0, 4).map(job => {
                  const t = new Date(job.scheduled_for);
                  const time = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                  const name = job.customer?.name || 'Direct booking';
                  const title = job.quote?.title || '';
                  return (
                    <Link key={job.id} to="/app/bookings" className="dash-today-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <span className="dash-today-time">{time}</span>
                      <span className="dash-today-name">{name}{title ? ` — ${title}` : ''}</span>
                    </Link>
                  );
                })}
                {todaysJobs.length > 4 && (
                  <Link to="/app/bookings" className="dash-today-item" style={{ textDecoration: 'none', color: 'var(--brand)', fontWeight: 700, fontSize: 12 }}>
                    + {todaysJobs.length - 4} more →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ═══ BANNERS ═══ */}
          {showWelcome && (
            <div className="dash-nudge" style={{ background:'var(--surface,var(--panel))', border:'1px solid var(--border,var(--line))' }}>
              <div className="dash-nudge-text"><strong>Free plan:</strong> 5 quotes/month. Upgrade anytime.</div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <Link className="btn btn-primary btn-sm" to="/pricing" style={{ fontSize:11 }}>See plans</Link>
                <button className="btn btn-secondary btn-sm" type="button" style={{ fontSize:11 }} onClick={() => setShowWelcome(false)}>Got it</button>
              </div>
            </div>
          )}
          {profileNudge && !showWelcome && quotes.length > 0 && quotes.length <= 5 && !safeLocalStorage('pl_nudge_dismissed','') && (
            <div className="dash-nudge">
              <div className="dash-nudge-text"><strong>Make quotes shine</strong> — add your {profileNudge.missing.slice(0,2).join(' and ')} in Settings.</div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <Link className="btn btn-primary btn-sm" to="/app/settings" style={{ fontSize:11 }}>Settings</Link>
                <button className="btn btn-secondary btn-sm" type="button" style={{ fontSize:11 }} onClick={() => { try { localStorage.setItem('pl_nudge_dismissed','1'); } catch {} setProfileNudge(null); }}>Dismiss</button>
              </div>
            </div>
          )}
          {upgradeBanner && !upgradePrompt && <UpgradeBanner trigger={upgradeBanner.trigger} context={upgradeBanner.context} onDismiss={() => setUpgradeBanner(null)} />}
          {userProfile && !isPro(userProfile) && quotes.length > 0 && <UsageMeter sent={sentThisMonth} limit={FREE_QUOTE_LIMIT} />}

          {/* Value reinforcement */}
          {userProfile && !isPro(userProfile) && sentThisMonth >= 2 && (() => {
            const ms = new Date(); ms.setDate(1); ms.setHours(0,0,0,0);
            const tot = quotes.filter(q => q.status !== 'draft' && q.sent_at && new Date(q.sent_at) >= ms).reduce((s,q) => s+(q.total||0), 0);
            if (tot < 200) return null;
            return (
              <div className="dash-nudge" style={{ background:'rgba(19,138,91,.04)', border:'1px solid rgba(19,138,91,.12)' }}>
                <div className="dash-nudge-text" style={{ color:'var(--text)' }}>
                  <strong>{currency(tot)} quoted this month.</strong>{' '}
                  <span style={{ color:'var(--muted)' }}>Upgrade to keep growing.</span>
                </div>
                <Link className="btn btn-primary btn-sm" to="/pricing" style={{ fontSize:11 }}>Upgrade</Link>
              </div>
            );
          })()}

          {/* ═══ EMPTY STATE ═══ */}
          {quotes.length === 0 && (
            <div className="dash-empty-state">
              <div style={{ fontSize:'2.5rem', marginBottom:8 }}>⚡</div>
              <h3 style={{ margin:'0 0 6px', fontSize:20, fontWeight:800, letterSpacing:'-.03em' }}>You're 2 minutes from your first quote</h3>
              <p style={{ color:'var(--muted)', fontSize:13, lineHeight:1.6, margin:'0 0 6px', maxWidth:360 }}>Describe a job. Punchlist builds the scope, pricing, and a clean quote your customer can approve from their phone.</p>
              <div style={{ display:'grid', gap:8, margin:'10px 0 20px', textAlign:'left', maxWidth:340, width:'100%' }}>
                {[['1','Describe the job','voice, text, or photo'],['2','Review the scope','edit line items and pricing'],['3','Send the quote','customer approves on their phone']].map(([n,t,s]) => (
                  <div key={n} style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:13 }}>
                    <span style={{ width:24, height:24, borderRadius:7, background:'var(--brand-bg)', color:'var(--brand)', display:'grid', placeItems:'center', fontSize:11, fontWeight:800, flexShrink:0, border:'1px solid var(--brand-glow)' }}>{n}</span>
                    <span style={{ color:'var(--text-2)', lineHeight:1.5 }}><strong style={{ color:'var(--text)' }}>{t}</strong> — {s}</span>
                  </div>
                ))}
              </div>
              <Link className="btn btn-primary full-width" to="/app/quotes/new" style={{ maxWidth:340, fontSize:15, padding:'14px 24px' }}>+ Create your first quote</Link>
              <div style={{ fontSize:11, color:'var(--subtle)', marginTop:8, fontWeight:500 }}>No credit card needed · 5 free quotes per month</div>
            </div>
          )}

          {/* ═══ MAIN LAYOUT ═══ */}
          {quotes.length > 0 && (
            <div className="ds-layout">
              <div className="ds-primary">

                {/* Desktop urgent strip */}
                <div className="ds-desktop-only"><UrgentStrip items={urgentItems} /></div>

                {/* MOBILE: Today's schedule first — contractor's #1 question */}
                <div className="ds-mobile-only">
                  <SchedulePreview todaysJobs={todaysJobs} tomorrowJobs={tomorrowJobs} />
                </div>

                {/* SECTION 1: Needs Attention */}
                {attentionItems.length > 0 ? (
                  <div className="ds-section ds-attention">
                    <div className="ds-section-head">
                      <span className="ds-section-title">
                        <span className="ds-section-dot" style={{ background:'var(--amber)' }} />
                        Needs Attention
                        <span className="ds-section-count">{attentionItems.length}</span>
                      </span>
                    </div>
                    <div className="ds-section-body">
                      {attentionItems.map((item, i) => (
                        <AttentionCard key={i} signal={item.signal} title={item.title} subtitle={item.subtitle} value={item.value} to={item.to} liveText={item.liveText} actions={getItemActions(item)} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="ds-section ds-all-clear">
                    <div style={{ textAlign:'center', padding:'20px 16px' }}>
                      <div style={{ fontSize:'1.6rem', marginBottom:4 }}>👍</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>You're all caught up</div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>No items need attention right now.</div>
                    </div>
                  </div>
                )}

                {/* MOBILE: Quick actions after attention, before pipeline */}
                <div className="ds-mobile-only">
                  <QuickActionsBar lastDraft={lastDraft} recentQuote={recentSentQuote} />
                </div>

                {/* SECTION 2: Pipeline */}
                {totalPipeline > 0 && (
                  <div className="ds-section ds-pipeline-section">
                    <div className="ds-section-head">
                      <span className="ds-section-title">
                        <span className="ds-section-dot" style={{ background:'var(--brand)' }} />
                        Quotes in Motion
                        <span className="ds-section-count">{totalPipeline}</span>
                      </span>
                      <Link className="ds-section-link" to="/app/quotes">All quotes →</Link>
                    </div>
                    <div className="ds-pipeline-stages">
                      <PipelineStage label="Draft" count={drafts.length} total={pipelineTotals.draft} color="var(--muted)" icon="📝" defaultOpen={false}>{drafts.map(q => <PipelineCard key={q.id} quote={q} signals={[]} />)}</PipelineStage>
                      <PipelineStage label="Sent" count={sentQuotes.length} total={pipelineTotals.sent} color="var(--blue)" icon="📤">{sentQuotes.map(q => <PipelineCard key={q.id} quote={q} signals={getSignalsForQuote(q)} />)}</PipelineStage>
                      <PipelineStage label="Viewed" count={viewedQuotes.length} total={pipelineTotals.viewed} color="#A78BFA" icon="👀">{viewedQuotes.map(q => <PipelineCard key={q.id} quote={q} signals={getSignalsForQuote(q)} />)}</PipelineStage>
                      <PipelineStage label="Approved" count={approvedQuotes.length} total={pipelineTotals.approved} color="var(--green)" icon="✅">{approvedQuotes.map(q => <PipelineCard key={q.id} quote={q} signals={getSignalsForQuote(q)} />)}</PipelineStage>
                      <PipelineStage label="Scheduled" count={scheduledQuotes.length} total={pipelineTotals.scheduled} color="var(--brand)" icon="📅" defaultOpen={false}>{scheduledQuotes.map(q => <PipelineCard key={q.id} quote={q} signals={[]} />)}</PipelineStage>
                    </div>
                  </div>
                )}
              </div>

              {/* SIDEBAR (desktop) */}
              <div className="ds-sidebar">
                <QuickActionsBar lastDraft={lastDraft} recentQuote={recentSentQuote} />
                <SchedulePreview todaysJobs={todaysJobs} tomorrowJobs={tomorrowJobs} />

                <div className="ds-section ds-revenue">
                  <div className="ds-section-head"><span className="ds-section-title">Revenue</span></div>
                  <div className="ds-revenue-rows">
                    <div className="ds-rev-row"><span className="ds-rev-label">Pending</span><span className="ds-rev-val">{currency(pipelineTotals.sent + pipelineTotals.viewed)}</span></div>
                    <div className="ds-rev-row"><span className="ds-rev-label">Approved</span><span className="ds-rev-val ds-rev-good">{currency(pipelineTotals.approved)}</span></div>
                    <div className="ds-rev-row"><span className="ds-rev-label">This week</span><span className="ds-rev-val">{currency(weekRevenue)}</span></div>
                    {invoiceReceivables && invoiceReceivables.unpaidCount > 0 && (
                      <>
                        <div className="ds-rev-divider" />
                        <div className="ds-rev-row"><span className="ds-rev-label">Outstanding</span><span className="ds-rev-val">{currency(invoiceReceivables.totalOutstanding)}</span></div>
                        {invoiceReceivables.overdueCount > 0 && (
                          <div className="ds-rev-row"><span className="ds-rev-label ds-rev-warn">Overdue ({invoiceReceivables.overdueCount})</span><span className="ds-rev-val ds-rev-warn">{currency(invoiceReceivables.overdueTotal)}</span></div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {quotes.length >= 3 && <InsightsStrip {...insights} />}
              </div>
            </div>
          )}
        </>
      )}

      {/* Invoice prompt modal */}
      {invoicePromptQuote && (
        <div className="modal-overlay" onClick={() => setInvoicePromptQuote(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth:380 }} role="dialog" aria-modal="true" aria-label="Create invoice">
            <div style={{ textAlign:'center', padding:'8px 0 16px' }}>
              <div style={{ fontSize:'2rem', marginBottom:10 }}>🎉</div>
              <h2 style={{ margin:'0 0 6px', fontSize:'1.15rem', fontWeight:800 }}>Job complete!</h2>
              <p style={{ margin:'0 0 20px', fontSize:14, color:'var(--text-2)', lineHeight:1.5 }}>
                <strong>{invoicePromptQuote.title || 'This job'}</strong> is marked complete.<br />Ready to send the invoice?
              </p>
              <div style={{ display:'grid', gap:8 }}>
                <button className="btn btn-primary full-width" type="button" disabled={invoiceCreating} onClick={handleCreateInvoiceNow}>{invoiceCreating ? 'Creating…' : '📄 Create invoice now'}</button>
                <button className="btn btn-secondary full-width" type="button" onClick={() => setInvoicePromptQuote(null)}>I'll do it later</button>
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
        quotes={allQuotes}
        bookings={bookings}
        userId={user?.id}
        showICSExport={false}
        contextLabel={scheduleQuote ? `${scheduleQuote.title || 'Untitled'} · ${scheduleQuote.customer?.name || 'Customer'}` : null}
      />
    </AppShell>
  );
}
