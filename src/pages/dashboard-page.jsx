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
import { Card } from '../components/ui';
import { useToast } from '../components/toast';
import { useAuth } from '../hooks/use-auth';
import { haptic, usePullToRefresh } from '../hooks/use-mobile-ux';
import { listQuotes, getProfile, expireStaleDrafts, friendly } from '../lib/api';
import { listCustomers } from '../lib/api/customers';
import { isPro, countSentThisMonth, FREE_QUOTE_LIMIT } from '../lib/billing';
import { currency } from '../lib/format';
import { normalizeStatus, chipForStatus } from '../lib/workflow';
import { estimateMonthly, showFinancing } from '../lib/financing';
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

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show: toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [jobInput, setJobInput] = useState('');
  const [installLeaving, setInstallLeaving] = useState(false);
  const jobInputRef = useRef(null);
  const { canInstall, install: installPwa, dismiss: dismissPwa } = usePwaInstall();

  // ── Data fetch ──
  useEffect(() => {
    if (!user) return;
    identify(user.id, { email: user.email });
    expireStaleDrafts().catch(() => {});
    supabase.auth.getSession().then(({ data: { session } }) => {
      const hdrs = { 'Content-Type': 'application/json' };
      if (session?.access_token) hdrs['Authorization'] = `Bearer ${session.access_token}`;
      // Fire-and-forget but swallow rejections so an outage doesn't
      // emit unhandled-rejection warnings on every dashboard load.
      fetch('/api/activation-email', {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ user_id: user.id }),
      }).catch(() => {});
    }).catch(() => {});

    Promise.all([listQuotes(user.id), getProfile(user.id), listCustomers(user.id)])
      .then(([q, profile, customers]) => {
        const active = (q || []).filter(qt => !qt.archived_at);
        setQuotes(active);
        setSentThisMonth(countSentThisMonth(active));
        if (profile) setUserProfile(profile);
        setCustomerCount((customers || []).length);

        // Show onboarding if first visit
        try {
          if (!localStorage.getItem('pl_onboarded') && active.length === 0) {
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
    Promise.all([listQuotes(user.id), getProfile(user.id), listCustomers(user.id)])
      .then(([q, profile, customers]) => {
        const active = (q || []).filter(qt => !qt.archived_at);
        setQuotes(active);
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

  const recentQuotes = useMemo(() => {
    return [...quotes]
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
      .slice(0, 6);
  }, [quotes]);

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

  const actionItems = useMemo(() => {
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
    return items.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)).slice(0, 5);
  }, [quotes]);

  const hasAnyData = quotes.length > 0;

  function handleJobSubmit(e) {
    e.preventDefault();
    trackQuoteFlowStarted({ source: 'home_job_input' });
    haptic('medium');
    navigate('/app/quotes/new', jobInput.trim() ? { state: { prefill: jobInput.trim() } } : undefined);
  }

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
          {/* Pipeline value — revenue anchoring chip */}
          {!loading && pipelineValue > 0 && (
            <Link
              to="/app/quotes"
              className={`dv2-headline-metric ${awaitingApproval > 0 ? 'dv2-headline-metric--warning' : 'dv2-headline-metric--info'}`}
            >
              <span>{currency(pipelineValue)}</span>
              <span className="dv2-metric-sub">{awaitingApproval > 0 ? `${awaitingApproval} awaiting approval` : 'in pipeline'}</span>
            </Link>
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
            autoComplete="off"
            enterKeyHint="go"
          />
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
                return (
                  <Link
                    key={q.id}
                    to={`/app/quotes/${q.id}`}
                    className="dv2-arow dv2-arow--hot dv2-enter"
                    style={{ '--i': i + 3, textDecoration: 'none' }}
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
                  </Link>
                );
              })}
            </div>
          </section>
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
                const monthly = showFinancing(total) ? estimateMonthly(total) : null;
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
                        {monthly && <> · <strong className="dv2-monthly-price">{currency(monthly)}/mo</strong></>}
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
