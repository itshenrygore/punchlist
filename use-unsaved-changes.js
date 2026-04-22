import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import AppShell from '../components/app-shell';
import OnboardingWizard from '../components/onboarding-wizard';
import UpgradePrompt, { shouldShowUpgrade, recordUpgradeShown, UpgradeBanner, UsageMeter } from '../components/upgrade-prompt';
import { listBookings, listQuotes, listInvoices, listCustomers, markFollowedUp, updateQuoteStatus, createInvoiceFromQuoteWithAdditionalWork, friendly, calculateReceivables, getProfile, checkAndSendDigest, expireStaleDrafts, checkAndSendReminder } from '../lib/api';
import { isPro, countSentThisMonth, getUsageInfo, FREE_QUOTE_LIMIT } from '../lib/billing';
import { useAuth } from '../hooks/use-auth';
import { currency, relativeTime } from '../lib/format';
import { exportQuotesCSV } from '../lib/format';
import { getFollowUpAdvice, chipForStatus, draftFollowUp } from '../lib/workflow';
import { identify, getVariant, trackQuoteFlowStarted } from '../lib/analytics';
import { useToast } from '../components/toast';
import BookingDrawer from '../components/booking-drawer';
import { smsNotify } from '../lib/sms';
import { estimateMonthly, showFinancing } from '../lib/financing';
import { haptic } from '../hooks/use-mobile-ux';
import { Card, PageHeader, Stat, RevealOnView } from '../components/ui';

function safeLocalStorage(key, fallback) {
  try { return localStorage.getItem(key); } catch { return fallback; }
}

/* ═══════════════════════════════════════════
   STATUS DOT — subtle colored indicator
   ═══════════════════════════════════════════ */
function StatusDot({ type }) {
  const colors = {
    viewed: 'var(--blue, #3B82F6)', followup: 'var(--amber, #F59E0B)', approved: 'var(--green, #22C55E)',
    deposit: 'var(--amber, #F59E0B)', expiring: 'var(--red, #EF4444)', hot: 'var(--red, #EF4444)',
    draft: 'var(--muted)', scheduled: 'var(--green, #22C55E)', revision: 'var(--amber, #F59E0B)',
    declined: 'var(--red, #EF4444)', overdue: 'var(--red, #EF4444)', question: 'var(--blue, #3B82F6)',
    complete: 'var(--green, #22C55E)',
  };
  return <span className="v2-dot" style={{ background: colors[type] || 'var(--muted)' }} />;
}

/* ═══════════════════════════════════════════
   FEED ITEM — unified attention/pipeline card
   ═══════════════════════════════════════════ */
function FeedItem({ signal, title, subtitle, value, to, actions, liveText, lastFollowedUp, onDismiss }) {
  return (
    <div className="v2-feed-item" style={{ position: 'relative' }}>
      {onDismiss && <button className="v2-feed-dismiss" type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }} aria-label="Dismiss" title="Dismiss">×</button>}
      <Link className="v2-feed-main" to={to || '#'}>
        <StatusDot type={signal?.type} />
        <div className="v2-feed-body">
          <span className="v2-feed-title">{title}</span>
          <span className="v2-feed-meta">
            {signal?.label && <span className="v2-feed-signal">{signal.label}</span>}
            {subtitle && <>{signal?.label ? ' · ' : ''}{subtitle}</>}
            {liveText && <>{' · '}{liveText}</>}
          </span>
          {lastFollowedUp && <span className="v2-feed-followup-ts">Last followed up {lastFollowedUp}</span>}
        </div>
        {value && <span className="v2-feed-value">{value}</span>}
      </Link>
      {actions && actions.length > 0 && (
        <div className="v2-feed-actions">
          {actions.map((act, i) => (
            <button key={i} className={`v2-feed-action ${act.primary ? 'primary' : ''}`} type="button" onClick={act.onClick} title={act.hint || ''}>{act.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   PIPELINE BAR — compact horizontal visualization
   ═══════════════════════════════════════════ */
function PipelineBar({ drafts, sent, viewed, approved, scheduled }) {
  const total = drafts + sent + viewed + approved + scheduled;
  if (total === 0) return null;
  const segments = [
    { count: drafts, color: 'var(--muted)', label: 'Draft', filter: 'draft' },
    { count: sent, color: 'var(--blue, #3B82F6)', label: 'Sent', filter: 'sent' },
    { count: viewed, color: 'var(--purple, #A78BFA)', label: 'Viewed', filter: 'viewed' },
    { count: approved, color: 'var(--green, #22C55E)', label: 'Approved', filter: 'approved' },
    { count: scheduled, color: 'var(--brand)', label: 'Scheduled', filter: 'scheduled' },
  ].filter(s => s.count > 0);
  return (
    <div className="v2-pipeline">
      <div className="v2-pipeline-bar">
        {segments.map(s => (
          <div key={s.label} className="v2-pipeline-seg" style={{ flex: s.count, background: s.color }} title={`${s.count} ${s.label}`} />
        ))}
      </div>
      <div className="v2-pipeline-legend">
        {segments.map(s => (
          <Link key={s.label} to={`/app/quotes?filter=${s.filter}`} className="v2-pipeline-key" style={{ textDecoration:'none', color:'inherit' }}>
            <span className="v2-dot" style={{ background: s.color }} />
            {s.count} {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCHEDULE STRIP — today's jobs, minimal
   ═══════════════════════════════════════════ */
function ScheduleStrip({ jobs }) {
  if (!jobs.length) return null;
  return (
    <Link to="/app/bookings" className="v2-schedule" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="v2-schedule-header">
        <span className="v2-schedule-label">Today's jobs</span>
        <span className="v2-schedule-count">{jobs.length}</span>
      </div>
      <div className="v2-schedule-items">
        {jobs.slice(0, 3).map(job => {
          const t = new Date(job.scheduled_for);
          const time = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const name = job.customer?.name?.split(' ')[0] || 'Customer';
          const title = job.quote?.title || 'Job';
          return (
            <div key={job.id} className="v2-schedule-job">
              <span className="v2-schedule-time">{time}</span>
              <span className="v2-schedule-info">{title} · {name}</span>
            </div>
          );
        })}
        {jobs.length > 3 && <div className="v2-schedule-job v2-schedule-more">+{jobs.length - 3} more</div>}
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════
   PIPELINE CARD — compact quote row for expanded view
   ═══════════════════════════════════════════ */
function PipelineCard({ quote, signals }) {
  const notViewed = quote.status === 'sent' && !quote.view_count;
  return (
    <Link className="ds-pipe-card" to={`/app/quotes/${quote.id}`}>
      <div className="ds-pipe-top">
        <span className="ds-pipe-title">{quote.title || 'Untitled quote'}</span>
        <span className="ds-pipe-price">{currency(quote.total || 0)}</span>
      </div>
      <div className="ds-pipe-meta">
        <span>{quote.customer?.name || 'No contact'}</span>
        {notViewed && <span className="ds-not-viewed">Not opened</span>}
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════
   PIPELINE STAGE — collapsible (desktop sidebar)
   ═══════════════════════════════════════════ */
function PipelineStage({ label, count, total, color, children, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  if (count === 0) return null;
  return (
    <div className={`ds-stage${open ? ' ds-stage-open' : ''}`}>
      <button type="button" className="ds-stage-head" onClick={() => setOpen(!open)}>
        <div className="ds-stage-left">
          <span className="ds-stage-dot" style={{ background: color }} />
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
  const [profileLoaded, setProfileLoaded] = useState(false);
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
  const [pipelineOpen, setPipelineOpen] = useState(true);
  const [winCard, setWinCard] = useState(null);
  const [hidePaid, setHidePaid] = useState(() => { try { return localStorage.getItem('pl_hide_paid') === '1'; } catch { return false; } });
  const attentionRef = useRef(null);

  /* ── Attention dismiss state ── */
  const [dismissedAttn, setDismissedAttn] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('pl_dismissed_attn') || '[]');
      const weekAgo = Date.now() - 7 * 86400000;
      return raw.filter(d => d.ts > weekAgo);
    } catch { return []; }
  });
  const [showDismissed, setShowDismissed] = useState(false);
  const dismissedIds = useMemo(() => new Set(dismissedAttn.map(d => d.id)), [dismissedAttn]);
  const dismissAttentionItem = (quoteId) => {
    if (!quoteId) return;
    const next = [...dismissedAttn, { id: quoteId, ts: Date.now() }];
    setDismissedAttn(next);
    try { localStorage.setItem('pl_dismissed_attn', JSON.stringify(next)); } catch (e) { console.warn('[PL]', e); }
  };
  const clearDismissed = () => {
    setDismissedAttn([]);
    setShowDismissed(false);
    try { localStorage.removeItem('pl_dismissed_attn'); } catch (e) { console.warn('[PL]', e); }
  };

  /* ── Value trigger listener ── */
  useEffect(() => {
    function handleValueTrigger(e) {
      const { type } = e.detail || {};
      if (!type) return;
      if (type === 'quote_approved') {
        const detail = e.detail || {};
        const winInfo = { title: detail.title || 'A job', total: detail.total ? currency(detail.total) : '', customer: detail.customerName || '' };
        setWinCard(winInfo);
        toast('Job won!', 'success');
        // Auto-dismiss win card after 30s
        setTimeout(() => setWinCard(null), 30000);
        try { if (localStorage.getItem('pl_is_pro') === '1') return; } catch (e) { console.warn("[PL]", e); }
        setTimeout(() => {
          if (shouldShowUpgrade('quote_approved', quotes.length)) {
            recordUpgradeShown('quote_approved');
            setUpgradePrompt({ trigger: 'quote_approved', context: { title: detail.title, total: detail.total ? currency(detail.total) : '' } });
          }
        }, 1500);
      } else if (type === 'quote_viewed') {
        const detail = e.detail || {};
        const viewMsg = detail.title || 'Your quote';
        toast(`${viewMsg} was just opened`, 'success');
        // Delayed nudge — don't interrupt the viewing notification
        setTimeout(() => {
          if (shouldShowUpgrade('quote_viewed', quotes.length)) {
            recordUpgradeShown('quote_viewed');
            setUpgradeBanner({ trigger: 'quote_viewed', context: { title: detail.title } });
          }
        }, 3000);
      }
    }
    window.addEventListener('pl:value-trigger', handleValueTrigger);
    return () => window.removeEventListener('pl:value-trigger', handleValueTrigger);
  }, [toast, navigate, quotes.length]);

  /* ── Data fetch ── */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    identify(user.id, { email: user.email });
    try { localStorage.removeItem('pl_first_run'); } catch (e) { console.warn("[PL]", e); }
    expireStaleDrafts().catch(e => console.warn('[PL]', e));
    fetch('/api/activation-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }) }).catch(e => console.warn('[PL]', e));
    Promise.all([listQuotes(user.id), listBookings(user.id), listInvoices(user.id), listCustomers(user.id)])
      .then(([q, b, inv, customers]) => {
        if (cancelled) return;
        const raw = q || [];
        const active = raw.filter(qt => !qt.archived_at);
        setQuotes(active);
        setAllQuotes(raw);
        setAllCustomers(customers || []);
        setBookings(b || []);
        setInvoiceReceivables(calculateReceivables(inv || []));
        setInvoiceList(inv || []);
        setSentThisMonth(countSentThisMonth(active));
      })
      .catch(e => console.warn('[PL]', e))
      .finally(() => { if (!cancelled) setLoading(false); });
    getProfile(user.id).then(p => {
      if (cancelled) return;
      setProfileLoaded(true);
      if (!p) {
        import('../lib/api/profile.js').then(({ saveProfile }) => {
          saveProfile(user, {
            full_name: user.user_metadata?.full_name || '',
            trade: 'Other', province: 'AB', country: 'CA',
          }).catch(e => console.warn('[PL]', e));
        });
        setShowOnboarding(true);
        setUserProfile({ trade: 'Other', province: 'AB', country: 'CA' });
        return;
      }
      setUserProfile(p);
      if (p?.digest_enabled) checkAndSendDigest(user.id, p).catch(e => console.warn('[PL]', e));
      try { localStorage.setItem('pl_is_pro', isPro(p) ? '1' : '0'); } catch (e) { console.warn("[PL]", e); }
      if (!isPro(p)) { try { if (!localStorage.getItem('pl_welcome_shown')) { localStorage.setItem('pl_welcome_shown', '1'); setShowWelcome(true); } } catch (e) { console.warn("[PL]", e); } }
      const missing = [];
      if (!p?.company_name?.trim()) missing.push('business name');
      if (!p?.logo_url?.trim()) missing.push('logo');
      if (!p?.phone?.trim()) missing.push('phone number');
      if (missing.length > 0) setProfileNudge({ missing });
    }).catch(e => console.warn('[PL]', e));
    return () => { cancelled = true; };
  }, [user]);

  /* ── Onboarding: only trigger after BOTH quotes and profile have loaded ── */
  useEffect(() => {
    if (loading || !profileLoaded) return;
    if (allQuotes.length === 0 && !safeLocalStorage('pl_onboarded', '')) {
      setShowOnboarding(true);
    }
  }, [loading, profileLoaded, allQuotes.length]);

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
      checkAndSendReminder(inv, userProfile).catch(e => console.warn('[PL]', e));
    });
  }, [userProfile, invoiceList]);

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
  const sentQuotes      = useMemo(() => quotes.filter(q => q.status === 'sent' && !q.view_count), [quotes]);
  const viewedQuotes    = useMemo(() => quotes.filter(q => ['viewed','question_asked'].includes(q.status) || (q.status === 'sent' && q.view_count > 0)), [quotes]);
  const approvedQuotes  = useMemo(() => quotes.filter(q => ['approved','approved_pending_deposit'].includes(q.status)), [quotes]);
  const scheduledQuotes = useMemo(() => quotes.filter(q => q.status === 'scheduled'), [quotes]);
  const completedQuotes = useMemo(() => quotes.filter(q => ['completed','invoiced','paid'].includes(q.status)), [quotes]);

  /* Quick continuation */
  const lastDraft       = useMemo(() => [...drafts].sort((a,b) => new Date(b.updated_at)-new Date(a.updated_at))[0] || null, [drafts]);
  const recentSentQuote = useMemo(() => quotes.filter(q => q.status !== 'draft').sort((a,b) => new Date(b.updated_at)-new Date(a.updated_at))[0] || null, [quotes]);

  /* ── Needs Attention — smart composite ── */
  const attentionItems = useMemo(() => {
    const items = [];

    // Helper: get last time contractor followed up on a quote
    // v100 M3: prefer last_followup_at (new event-timestamp column) over
    // conversation timestamps so the feed stays accurate after API sends.
    function getLastFollowedUp(q) {
      if (q.last_followup_at) return relativeTime(q.last_followup_at);
      const conv = Array.isArray(q.conversation) ? q.conversation : [];
      const lastContractorMsg = [...conv].reverse().find(m => m.role === 'contractor');
      return lastContractorMsg?.timestamp ? relativeTime(lastContractorMsg.timestamp) : null;
    }

    /* Viewed but no response */
    for (const q of quotes.filter(q => q.status === 'viewed')) {
      const advice = getFollowUpAdvice(q);
      const sType = advice?.urgency === 'high' ? 'hot' : advice?.urgency === 'medium' ? 'followup' : 'viewed';
      const firstName = q.customer?.name?.split(' ')[0] || '';
      const hasMo = showFinancing(q.total);
      const moHint = hasMo && q.view_count > 1 ? ' — the monthly option may close it' : '';
      const viewLabel = sType === 'hot' ? (firstName ? `${firstName} is waiting — follow up` : 'Customer waiting — follow up')
        : sType === 'followup' ? (firstName ? `${firstName} viewed — text now${moHint}` : `Viewed — follow up now${moHint}`)
        : (firstName ? `${firstName} viewed ${q.view_count||1}×${moHint}` : `Viewed ${q.view_count||1}×${moHint}`);
      items.push({ signal: { type: sType, label: viewLabel },
        title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
        to: `/app/quotes/${q.id}`, liveText: q.last_viewed_at ? relativeTime(q.last_viewed_at) : null,
        priority: sType === 'hot' ? 0 : sType === 'followup' ? 1 : 2, quote: q, actionType: 'followup',
        lastFollowedUp: getLastFollowedUp(q) });
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
      const firstName = q.customer?.name?.split(' ')[0] || 'Customer';
      items.push({ signal: { type: 'revision', label: `${firstName} wants changes — revise to close` },
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
      items.push({ signal: { type: 'expiring', label: dl === 0 ? 'Expires today — follow up or extend' : `Expires in ${dl}d — follow up` },
        title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
        to: `/app/quotes/${q.id}`, priority: 0, quote: q, actionType: 'view' });
    }

    /* Deposits pending */
    for (const q of quotes.filter(q => ['approved','approved_pending_deposit'].includes(q.status) && q.deposit_required && q.deposit_status !== 'paid')) {
      items.push({ signal: { type: 'deposit', label: `Collect ${currency(q.deposit_amount||0)} deposit to lock it in` },
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
        to: oi.length === 1 ? `/app/invoices/${oi[0].id}` : '/app/invoices', priority: 0, actionType: 'view' });
    }

    /* Customer questions — by status OR unanswered conversation entries */
    const questionQuoteIds = new Set();
    for (const q of quotes.filter(q => q.status === 'question_asked')) {
      questionQuoteIds.add(q.id);
      const firstName = q.customer?.name?.split(' ')[0] || 'Customer';
      items.push({ signal: { type: 'question', label: `${firstName} asked a question — reply to close` },
        title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
        to: `/app/quotes/${q.id}`, priority: 0, quote: q, actionType: 'view' });
    }
    for (const q of quotes) {
      if (questionQuoteIds.has(q.id)) continue; // already added above
      const conv = Array.isArray(q.conversation) ? q.conversation : [];
      if (conv.length > 0 && conv[conv.length-1]?.role === 'customer') {
        const firstName = q.customer?.name?.split(' ')[0] || 'Customer';
        items.push({ signal: { type: 'question', label: `${firstName} asked a question — reply to close` },
          title: q.title || 'Untitled quote', subtitle: q.customer?.name, value: currency(q.total||0),
          to: `/app/quotes/${q.id}`, priority: 0, quote: q, actionType: 'view' });
      }
    }

    /* Approved but unscheduled */
    for (const q of approvedQuotes) {
      if (!bookings.some(b => b.quote_id === q.id && b.status !== 'cancelled')) {
        const firstName = q.customer?.name?.split(' ')[0] || 'Customer';
        const mo = showFinancing(q.total) ? estimateMonthly(q.total) : null;
        const moLabel = mo ? ` · ${currency(mo)}/mo option` : '';
        items.push({ signal: { type: 'approved', label: `${firstName} approved${moLabel} — schedule now` },
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
        items.push({ signal: { type: 'complete', label: 'Job done? Mark complete to invoice' },
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
    if (fups.length) items.push({ icon: 'warn', label: `${fups.length} quote${fups.length>1?'s':''} need follow-up`, to: fups[0]?.to || '/app/quotes' });
    const exp = attentionItems.filter(i => i.signal?.type === 'expiring').length;
    if (exp) items.push({ icon: '⏳', label: `${exp} quote${exp>1?'s':''} expiring soon`, to: '/app/quotes' });
    const qs = attentionItems.filter(i => i.signal?.type === 'question');
    if (qs.length) items.push({ icon: 'message', label: `${qs.length} customer question${qs.length>1?'s':''}`, to: qs[0]?.to || '/app/quotes' });
    return items;
  }, [attentionItems]);

  /* Pipeline totals */
  const closedStatuses = useMemo(() => new Set(['approved','approved_pending_deposit','scheduled','completed','invoiced','paid']), []);
  const closedRevenue = useMemo(() => quotes.filter(q => closedStatuses.has(q.status)).reduce((s,q) => s+Number(q.total||0), 0), [quotes, closedStatuses]);
  const pipelineTotals = useMemo(() => ({
    draft: drafts.reduce((s,q) => s+Number(q.total||0), 0),
    sent: sentQuotes.reduce((s,q) => s+Number(q.total||0), 0),
    viewed: viewedQuotes.reduce((s,q) => s+Number(q.total||0), 0),
    approved: approvedQuotes.reduce((s,q) => s+Number(q.total||0), 0),
    scheduled: scheduledQuotes.reduce((s,q) => s+Number(q.total||0), 0),
    closed: completedQuotes.reduce((s,q) => s+Number(q.total||0), 0),
  }), [drafts, sentQuotes, viewedQuotes, approvedQuotes, scheduledQuotes, completedQuotes]);

  /* Insights */
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
    trackQuoteFlowStarted({ source: 'dashboard_job_input' }); // B13
    navigate('/app/quotes/new', val ? { state: { prefill: val } } : undefined);
  }

  async function handleFollowUpEmail(quote) {
    if (!quote.customer?.email) { toast('No email on file for this customer', 'error'); return; }
    markFollowedUp(quote.id).catch(e => toast(friendly(e), 'error'));
    setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, follow_up_at: new Date().toISOString() } : q));
    const url = `${window.location.origin}/public/${quote.share_token}`;
    const cn = userProfile?.company_name || userProfile?.full_name || '';
    const subj = encodeURIComponent(`Following up: ${quote.title || 'your quote'}`);
    const body = encodeURIComponent(draftFollowUp(quote, cn, url));
    window.location.href = `mailto:${quote.customer.email}?subject=${subj}&body=${body}`;
    toast('Follow-up sent ✓', 'success');
  }

  async function handleFollowUpText(quote) {
    if (!quote.customer?.phone) { toast('No phone number on file for this customer', 'error'); return; }
    markFollowedUp(quote.id).catch(e => toast(friendly(e), 'error'));
    setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, follow_up_at: new Date().toISOString() } : q));
    const url = `${window.location.origin}/public/${quote.share_token}`;
    const cn = userProfile?.company_name || userProfile?.full_name || '';
    const msgBody = draftFollowUp(quote, cn, url);
    const result = await smsNotify.customMessage({ to: quote.customer?.phone, body: msgBody });
    if (result?.ok) {
      toast('Follow-up texted', 'success');
    } else {
      const body = encodeURIComponent(msgBody);
      window.open(`sms:${quote.customer?.phone}?body=${body}`, '_self');
      toast('Opening messages…', 'info');
    }
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

  async function handleBookingSaved(booking) {
    setBookings(prev => [...prev, booking].sort((a,b) => new Date(a.scheduled_for)-new Date(b.scheduled_for)));
    toast('Job scheduled', 'success');
    haptic('success');
    // Update quote status server-side, then update local state
    if (scheduleQuote) {
      try {
        await updateQuoteStatus(scheduleQuote.id, { status: 'scheduled' });
      } catch (e) { console.warn("[PL]", e); }
      setQuotes(prev => prev.map(q => q.id === scheduleQuote.id ? { ...q, status: 'scheduled' } : q));
    }
    setScheduleQuote(null);
  }

  function getItemActions(item) {
    const q = item.quote;
    if (item.actionType === 'followup' && q) {
      const a = [];
      if (q.customer?.phone) a.push({ label: 'Text', primary: true, onClick: () => handleFollowUpText(q), hint: `Text ${q.customer?.name?.split(' ')[0] || 'customer'}` });
      else if (q.customer?.email) a.push({ label: 'Email', primary: true, onClick: () => { window.location.href = `mailto:${q.customer.email}?subject=Following up: ${q.title || 'Your quote'}`; } });
      a.push({ label: 'View', onClick: () => navigate(`/app/quotes/${q.id}`) });
      return a;
    }
    if (item.actionType === 'edit' && q) {
      return [
        { label: '✎ Revise', primary: true, onClick: () => navigate(`/app/quotes/${q.id}/edit`) },
        { label: 'See feedback', onClick: () => navigate(`/app/quotes/${q.id}`) },
      ];
    }
    if (item.actionType === 'schedule' && q) {
      return [
        { label: 'Schedule', primary: true, onClick: () => setScheduleQuote(q) },
        { label: '✓ Complete', onClick: () => handleMarkComplete(q) },
      ];
    }
    if (item.actionType === 'complete' && q) {
      return [{ label: '✓ Complete & Invoice', primary: true, onClick: () => handleMarkComplete(q) }];
    }
    if (item.actionType === 'view' && q) {
      const a = [];
      if (q.customer?.phone) a.push({ label: 'Text', primary: true, onClick: () => handleFollowUpText(q) });
      a.push({ label: 'View', primary: !q.customer?.phone, onClick: () => navigate(`/app/quotes/${q.id}`) });
      return a;
    }
    return [{ label: 'View', primary: true, onClick: () => item.to && navigate(item.to) }];
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

  /* ── Auto-focus job input for new users with no quotes ── */
  useEffect(() => {
    if (!loading && quotes.length === 0 && jobInputRef.current) {
      // Small delay to let the DOM settle after onboarding dismiss
      const t = setTimeout(() => jobInputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
  }, [loading, quotes.length]);

  /* ── Auto-scroll to attention items on mobile for returning users ── */
  useEffect(() => {
    if (!loading && quotes.length > 0 && attentionItems.length > 0 && todaysJobs.length === 0 && attentionRef.current) {
      if (window.innerWidth < 768) {
        const t = setTimeout(() => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
        return () => clearTimeout(t);
      }
    }
  }, [loading, quotes.length, attentionItems.length, todaysJobs.length]);

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <AppShell hideTitle>
      {showOnboarding && <OnboardingWizard onDismiss={() => setShowOnboarding(false)} />}
      {upgradePrompt && <UpgradePrompt trigger={upgradePrompt.trigger} context={upgradePrompt.context} onDismiss={() => setUpgradePrompt(null)} />}

      {loading ? (
        <div className="v2-loading">
          {[1,2,3].map(i => (
            <div key={`skel-${i}`} className="skel-card">
              <div className="skel-card-top"><div className="skel-line" style={{ width:'45%', height:14 }} /><div className="skel-line" style={{ width:'20%', height:14 }} /></div>
              <div className="skel-line" style={{ width:'70%', marginTop:8 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="v2-dash">
          {/* ═══ GREETING ═══ */}
          <PageHeader
            className="pl-dash-header"
            title={greeting}
            subtitle={quotes.length > 0 ? (
              <>
                {todaysJobs.length > 0
                  ? `${todaysJobs.length} job${todaysJobs.length>1?'s':''} today`
                  : attentionItems.length > 0 ? `${attentionItems.length} quote${attentionItems.length>1?'s':''} need${attentionItems.length===1?'s':''} action` : 'No jobs today — build your next quote'}
                {pipelineTotals.sent + pipelineTotals.viewed > 0 && ` · ${currency(pipelineTotals.sent + pipelineTotals.viewed)} in play`}
              </>
            ) : null}
            actions={<Link to="/app/quotes/new" className="btn btn-primary" onClick={() => trackQuoteFlowStarted({ source: 'dashboard_header' })}>New quote</Link>}
          />

          {/* ═══ WIN CARD — celebrates a closed job ═══ */}
          {winCard && (
            <div className="v2-win-card">
              <button type="button" className="v2-win-close" onClick={() => setWinCard(null)} aria-label="Dismiss win card"><X size={16} strokeWidth={2} /></button>
              <div className="v2-win-check">✓</div>
              <div className="v2-win-title">Job won{winCard.total ? ` — ${winCard.total}` : ''}</div>
              <div className="v2-win-sub">{winCard.customer ? `${winCard.customer} approved` : 'Customer approved'} {winCard.title}</div>
            </div>
          )}

          {/* ═══ JOB INPUT — the hero action ═══ */}
          <form className="v2-job-input" data-testid="dash-job-form" onSubmit={handleJobInputSubmit}>
            <input ref={jobInputRef} className="v2-job-field" type="text" placeholder="What's the job? e.g. Poly B repipe, panel upgrade…" value={jobInput} onChange={e => setJobInput(e.target.value)} autoComplete="off" />
            <button className="v2-job-go" type="submit">{jobInput.trim() ? 'Build quote →' : '+ New quote'}</button>
          </form>

          {/* ═══ TODAY'S SCHEDULE — only if jobs exist ═══ */}
          <ScheduleStrip jobs={todaysJobs} />

          {/* ═══ EMPTY STATE — first-time user, A/B tested ═══ */}
          {quotes.length === 0 && (() => {
            const demoVariant = getVariant('empty_state_demo');
            return (
            <Card padding="loose" minH="260px" className="v2-empty">
              <div className="v2-empty-headline">Send your first quote</div>
              <p className="v2-empty-sub">Describe the job above — Punchlist builds it in under 4 minutes.</p>
              {/* Demo quote preview — variant 'a' shows the card, 'b' shows text only */}
              {demoVariant === 'a' && (
              <div className="v2-demo-preview">
                <div className="v2-demo-label">What your customer sees</div>
                <div className="v2-demo-card">
                  <div className="v2-demo-card-top">
                    <span className="v2-demo-card-title">Poly B Repipe to PEX</span>
                    <span className="v2-demo-card-badge">Quote</span>
                  </div>
                  <div className="v2-demo-card-items">
                    <div className="v2-demo-item"><span>Labour — repipe 2-bath home</span><span>$3,200</span></div>
                    <div className="v2-demo-item"><span>PEX material + fittings</span><span>$1,450</span></div>
                    <div className="v2-demo-item"><span>Drywall repair & patching</span><span>$1,100</span></div>
                  </div>
                  <div className="v2-demo-card-total">
                    <div className="v2-demo-total-row"><span>Total</span><span>$6,000</span></div>
                    <div className="v2-demo-monthly">or $500/mo for 12 months</div>
                  </div>
                  <div className="v2-demo-cta">Approve & Sign</div>
                </div>
              </div>
              )}
              <div className="v2-empty-fine">No credit card needed · 5 free quotes per month</div>
            </Card>
            );
          })()}

          {/* ═══ MAIN CONTENT — has quotes ═══ */}
          {quotes.length > 0 && (
            <div className="v2-main">
              {/* ── Upgrade nudge (single, non-intrusive) ── */}
              {userProfile && !isPro(userProfile) && sentThisMonth >= 1 && (
                <div className="v2-usage-bar">
                  <div className="v2-usage-track">
                    <div className="v2-usage-fill" style={{ width: `${Math.min(100, (sentThisMonth / FREE_QUOTE_LIMIT) * 100)}%` }} />
                  </div>
                  <span className="v2-usage-text">{sentThisMonth} of {FREE_QUOTE_LIMIT} quotes this month</span>
                  {sentThisMonth >= 3 && <Link to="/pricing" className="v2-usage-link">Upgrade</Link>}
                </div>
              )}

              {/* ── Payments nudge — HIGH PRIORITY: directly serves closing ── */}
              {userProfile && !userProfile.stripe_connect_onboarded && (
                <Link to="/app/payments/setup" style={{
                  display:'flex', gap:12, alignItems:'center',
                  padding:'14px 16px', background:'var(--brand-bg)',
                  border:'1px solid var(--brand-line)', borderRadius:'var(--r,14px)',
                  textDecoration:'none', transition:'border-color .15s',
                }}>
                  <span style={{ flexShrink:0, display:"inline-flex", color:"var(--brand)" }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight:700, color:'var(--text)' }}>Let customers pay monthly — you still get the full amount</div>
                    <div style={{ fontSize: 'var(--text-xs)', color:'var(--muted)', marginTop:2 }}>10-minute setup. No monthly fee.</div>
                  </div>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight:700, color:'var(--brand)', flexShrink:0 }}>Set up →</span>
                </Link>
              )}

              {/* ── Close these — attention feed, highest priority ── */}
              {attentionItems.length > 0 && (() => {
                const visibleItems = showDismissed ? attentionItems : attentionItems.filter(i => !dismissedIds.has(i.quote?.id));
                const hiddenCount = attentionItems.length - attentionItems.filter(i => !dismissedIds.has(i.quote?.id)).length;
                if (visibleItems.length === 0 && hiddenCount === 0) return null;
                return (
                <div className="v2-feed" ref={attentionRef}>
                  <div className="v2-feed-head">
                    <span className="v2-feed-heading">Close these</span>
                    <span className="v2-feed-count">{visibleItems.length} · {currency(visibleItems.reduce((s, i) => s + Number((i.quote?.total) || 0), 0))} outstanding</span>
                  </div>
                  {visibleItems.map((item, i) => (
                    <FeedItem key={item.quote?.id || i} signal={item.signal} title={item.title} subtitle={item.subtitle} value={item.value} to={item.to} liveText={item.liveText} actions={getItemActions(item)} lastFollowedUp={item.lastFollowedUp} onDismiss={item.quote?.id ? () => dismissAttentionItem(item.quote.id) : undefined} />
                  ))}
                  {hiddenCount > 0 && !showDismissed && (
                    <button className="v2-feed-hidden-link" type="button" onClick={() => setShowDismissed(true)}>
                      {hiddenCount} hidden — show all
                    </button>
                  )}
                  {showDismissed && hiddenCount > 0 && (
                    <button className="v2-feed-hidden-link" type="button" onClick={clearDismissed}>
                      Clear dismissed
                    </button>
                  )}
                </div>
                );
              })()}

              {/* ── Stat cards — revenue, close rate, pipeline, open ── */}
              {(() => {
                const totalSentEver = quotes.filter(q => q.status !== 'draft').length;
                const totalApproved = quotes.filter(q => ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status)).length;
                const closeRate = totalSentEver > 0 ? Math.round((totalApproved / totalSentEver) * 100) : 0;
                const pipeline = pipelineTotals.sent + pipelineTotals.viewed + pipelineTotals.approved;
                const openCount = sentQuotes.length + viewedQuotes.length;
                const notOpened = sentQuotes.filter(q => !q.view_count).length;
                return (
                <RevealOnView>
                  <div className="pl-stat-grid">
                    <Card as={Link} to="/app/quotes" interactive padding="default" className="pl-stat-cell">
                      <Stat label="Closed revenue" value={currency(closedRevenue)} tone="success" />
                    </Card>
                    <Card as={Link} to="/app/analytics" interactive padding="default" className="pl-stat-cell">
                      <Stat label="Close rate" value={totalSentEver > 0 ? closeRate : 0} suffix={totalSentEver > 0 ? '%' : ''} />
                    </Card>
                    <Card as={Link} to="/app/quotes?filter=sent" interactive padding="default" className="pl-stat-cell">
                      <Stat label="In pipeline" value={currency(pipeline)} tone="brand" />
                    </Card>
                    <Card as={Link} to="/app/quotes?filter=sent" interactive padding="default" className="pl-stat-cell">
                      <Stat label="Open quotes" value={openCount} hint={notOpened > 0 ? `${notOpened} not yet opened` : undefined} />
                    </Card>
                  </div>
                </RevealOnView>
                );
              })()}

              {/* ── Pipeline bar ── */}
              <PipelineBar drafts={drafts.length} sent={sentQuotes.length} viewed={viewedQuotes.length} approved={approvedQuotes.length} scheduled={scheduledQuotes.length} />

              {/* ── Resume draft shortcut (only when relevant) ── */}
              {lastDraft && (
                <Link to={`/app/quotes/${lastDraft.id}/edit`}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--panel)', border:'1px solid var(--line)', borderRadius:'var(--r,14px)', textDecoration:'none', color:'inherit', fontSize: 'var(--text-sm)', fontWeight:600, transition:'border-color .15s' }}>
                  <span style={{ color:'var(--brand)' }}>✎</span>
                  <span>Resume: {lastDraft.title || 'Untitled draft'}</span>
                  <span style={{ marginLeft:'auto', color:'var(--muted)', fontSize: 'var(--text-2xs)' }}>{currency(lastDraft.total || 0)}</span>
                </Link>
              )}

              {/* ── Recent quotes — always visible ── */}
              {(() => {
                const recent = [...quotes]
                  .filter(q => q.status !== 'draft')
                  .filter(q => !hidePaid || q.status !== 'paid')
                  .sort((a,b) => new Date(b.updated_at||b.created_at) - new Date(a.updated_at||a.created_at))
                  .slice(0, 5);
                if (!recent.length && !hidePaid) return null;
                return (
                  <div className="v2-feed">
                    <div className="v2-feed-head">
                      <span className="v2-feed-heading">Recent quotes</span>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <button
                          type="button"
                          onClick={() => { const next = !hidePaid; setHidePaid(next); try { localStorage.setItem('pl_hide_paid', next ? '1' : '0'); } catch (e) { console.warn("[PL]", e); } }}
                          style={{ fontSize: 'var(--text-2xs)', fontWeight:600, color: hidePaid ? 'var(--brand)' : 'var(--muted)', background:'none', border:'none', cursor:'pointer', padding:'4px 0', whiteSpace:'nowrap' }}
                        >
                          {hidePaid ? '● Hide paid' : '○ Hide paid'}
                        </button>
                        <Link to="/app/quotes" style={{ fontSize: 'var(--text-sm)', fontWeight:700, color:'var(--brand)', textDecoration:'none', padding:'4px 0' }}>All quotes →</Link>
                      </div>
                    </div>
                    {recent.length === 0 && hidePaid && (
                      <div style={{ padding:'16px 0', textAlign:'center', fontSize: 'var(--text-xs)', color:'var(--muted)' }}>All recent quotes are paid</div>
                    )}
                    {recent.map(q => {
                      const signals = getSignalsForQuote(q);
                      const topSignal = signals[0] || { type: q.status, label: chipForStatus(q.status) };
                      const isInvoiced = q.status === 'invoiced' || q.status === 'completed';
                      return (
                        <FeedItem
                          key={q.id}
                          signal={topSignal}
                          title={q.title || 'Untitled quote'}
                          subtitle={q.customer?.name}
                          value={currency(q.total || 0)}
                          to={`/app/quotes/${q.id}`}
                          liveText={relativeTime(q.updated_at || q.created_at)}
                          actions={isInvoiced ? [{ label: '✓ Mark paid', primary: true, onClick: async (e) => {
                            e?.preventDefault?.(); e?.stopPropagation?.();
                            try {
                              await updateQuoteStatus(q.id, { status: 'paid' });
                              setQuotes(prev => prev.map(p => p.id === q.id ? { ...p, status: 'paid' } : p));
                              toast('Marked as paid', 'success');
                            } catch { toast('Error', 'error'); }
                          }}] : undefined}
                        />
                      );
                    })}
                  </div>
                );
              })()}

              {/* ── Caught up indicator (only when no attention items) ── */}
              {attentionItems.length === 0 && (
                <div className="v2-caught-up">
                  <span className="v2-caught-up-text">✓ Nothing pending</span>
                  {drafts.length > 0 ? (
                    <Link to="/app/quotes?filter=draft" className="v2-caught-up-link">
                      Finish {drafts.length} draft{drafts.length>1?'s':''} →
                    </Link>
                  ) : sentQuotes.length > 0 && sentQuotes.some(q => !q.view_count) ? (
                    <Link to={`/app/quotes/${sentQuotes.find(q => !q.view_count)?.id}`} className="v2-caught-up-link">
                      {sentQuotes.filter(q => !q.view_count).length} sent, not yet opened →
                    </Link>
                  ) : (
                    <Link to="/app/quotes/new" className="v2-caught-up-link" onClick={() => trackQuoteFlowStarted({ source: 'dashboard_caught_up' })}>Build your next quote →</Link>
                  )}
                </div>
              )}

              {/* ── Upcoming schedule — tomorrow preview ── */}
              {tomorrowJobs.length > 0 && (
                <Link to="/app/bookings" style={{
                  display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                  background:'var(--panel)', border:'1px solid var(--line)', borderRadius:'var(--r,14px)',
                  textDecoration:'none', color:'inherit', transition:'border-color .15s',
                }}>
                  <span style={{ fontSize: 'var(--text-2xs)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--muted)', flexShrink:0 }}>Tomorrow</span>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, minWidth:0 }}>
                    {tomorrowJobs.slice(0,3).map(job => {
                      const t = new Date(job.scheduled_for);
                      return (
                        <span key={job.id} style={{ fontSize: 'var(--text-xs)', fontWeight:500, color:'var(--text-2)', whiteSpace:'nowrap' }}>
                          {t.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}
                          {' · '}
                          {job.customer?.name?.split(' ')[0] || job.quote?.title || 'Job'}
                        </span>
                      );
                    })}
                  </div>
                </Link>
              )}

              {/* ── Profile completion nudge ── */}
              {profileNudge && (
                <Link to="/app/settings" style={{
                  display:'flex', gap:10, alignItems:'center',
                  padding:'12px 14px', background:'var(--panel)',
                  border:'1px solid var(--line)', borderRadius:'var(--r,14px)',
                  textDecoration:'none', color:'inherit', transition:'border-color .15s',
                }}>
                  <span style={{ flexShrink:0, display:"inline-flex", color:"var(--muted)" }}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
                  <div style={{ fontSize: 'var(--text-xs)', color:'var(--muted)', lineHeight:1.45 }}>
                    <span style={{ fontWeight:700, color:'var(--text-2)' }}>Complete your profile</span>
                    {' — add your ' + profileNudge.missing.join(', ')}
                  </div>
                </Link>
              )}

              {/* ── Pipeline detail — collapsed by default, toggle to expand ── */}
              {totalPipeline > 0 && (
                <div className="v2-pipeline-detail">
                  <button type="button" className="pl-toggle-row" onClick={() => setPipelineOpen(!pipelineOpen)} style={{ background:'none', border:'none', width:'100%', fontFamily:'inherit' }}>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight:700, color:'var(--text)' }}>Quotes in Motion · {totalPipeline}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Link to="/app/quotes" className="v2-pipeline-detail-link" onClick={e => e.stopPropagation()} style={{ fontSize: 'var(--text-sm)' }}>All quotes →</Link>
                      <span className={`pl-chevron ${pipelineOpen ? 'pl-chevron--open' : ''}`} />
                    </div>
                  </button>
                  {pipelineOpen && <>
                  <PipelineStage label="Draft" count={drafts.length} total={pipelineTotals.draft} color="var(--muted)" defaultOpen={false}>{drafts.map(q => <PipelineCard key={q.id} quote={q} />)}</PipelineStage>
                  <PipelineStage label="Sent" count={sentQuotes.length} total={pipelineTotals.sent} color="var(--blue, #3B82F6)">{sentQuotes.map(q => <PipelineCard key={q.id} quote={q} />)}</PipelineStage>
                  <PipelineStage label="Viewed" count={viewedQuotes.length} total={pipelineTotals.viewed} color="#A78BFA">{viewedQuotes.map(q => <PipelineCard key={q.id} quote={q} />)}</PipelineStage>
                  <PipelineStage label="Approved" count={approvedQuotes.length} total={pipelineTotals.approved} color="var(--green, #22C55E)">{approvedQuotes.map(q => <PipelineCard key={q.id} quote={q} />)}</PipelineStage>
                  <PipelineStage label="Scheduled" count={scheduledQuotes.length} total={pipelineTotals.scheduled} color="var(--brand)" defaultOpen={false}>{scheduledQuotes.map(q => <PipelineCard key={q.id} quote={q} />)}</PipelineStage>
                  </>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Invoice prompt modal */}
      {invoicePromptQuote && (
        <div className="modal-overlay" onClick={() => setInvoicePromptQuote(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth:380 }} role="dialog" aria-modal="true" aria-label="Create invoice">
            <div style={{ textAlign:'center', padding:'8px 0 16px' }}>
              <h2 style={{ margin:'0 0 6px', fontSize:'1.15rem', fontWeight:800 }}>Job complete!</h2>
              <p style={{ margin:'0 0 20px', fontSize: 'var(--text-base)', color:'var(--text-2)', lineHeight:1.5 }}>
                <strong>{invoicePromptQuote.title || 'This job'}</strong> is marked complete.<br />Ready to send the invoice?
              </p>
              <div style={{ display:'grid', gap:8 }}>
                <button className="btn btn-primary full-width" type="button" disabled={invoiceCreating} onClick={handleCreateInvoiceNow}>{invoiceCreating ? 'Creating…' : 'Create invoice now'}</button>
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
