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
import { isPro, countSentThisMonth, FREE_QUOTE_LIMIT } from '../lib/billing';
import { currency } from '../lib/format';
import { normalizeStatus, chipForStatus, colorForStatus } from '../lib/workflow';
import { estimateMonthly, showFinancing } from '../lib/financing';
import { identify, trackQuoteFlowStarted } from '../lib/analytics';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show: toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [jobInput, setJobInput] = useState('');
  const jobInputRef = useRef(null);

  // ── Data fetch ──
  useEffect(() => {
    if (!user) return;
    identify(user.id, { email: user.email });
    expireStaleDrafts().catch(() => {});

    Promise.all([listQuotes(user.id), getProfile(user.id)])
      .then(([q, profile]) => {
        const active = (q || []).filter(qt => !qt.archived_at);
        setQuotes(active);
        setSentThisMonth(countSentThisMonth(active));
        if (profile) setUserProfile(profile);

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
    Promise.all([listQuotes(user.id), getProfile(user.id)])
      .then(([q, profile]) => {
        const active = (q || []).filter(qt => !qt.archived_at);
        setQuotes(active);
        setSentThisMonth(countSentThisMonth(active));
        if (profile) setUserProfile(profile);
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
    const sent = quotes.filter(q => ['sent', 'approved', 'paid'].includes(normalizeStatus(q.status)));
    const won = quotes.filter(q => ['approved', 'paid'].includes(normalizeStatus(q.status)));
    if (sent.length < 2) return null;
    return Math.round((won.length / sent.length) * 100);
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
            {!loading && hasAnyData && (
              <p className="dv2-greeting-sub">
                {sentThisMonth} quote{sentThisMonth !== 1 ? 's' : ''} this month
                {closeRate !== null && ` · ${closeRate}% close rate`}
              </p>
            )}
          </div>
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

        {/* ═══ EMPTY STATE ═══ */}
        {!loading && !hasAnyData && (
          <Card padding="loose" className="dv2-empty">
            <div className="dv2-empty-headline">Send your first quote</div>
            <p className="dv2-empty-sub">
              Describe the job above — your customer will see a professional quote
              with monthly payment options they can approve from their phone.
            </p>
          </Card>
        )}

        {/* ═══ RECENT QUOTES ═══ */}
        {!loading && hasAnyData && (
          <section className="dv2-section dv2-enter" style={{ '--i': 2 }}>
            <div className="dv2-section-head">
              <h2 className="dv2-section-title">Recent quotes</h2>
              <Link to="/app/quotes" className="dv2-section-link">
                All quotes <ChevronRight size={11} />
              </Link>
            </div>

            <div className="dv2-action-list">
              {recentQuotes.map(q => {
                const status = normalizeStatus(q.status);
                const total = q.total || q.subtotal || 0;
                const monthly = showFinancing(total) ? estimateMonthly(total) : null;
                return (
                  <Link
                    key={q.id}
                    to={status === 'draft' ? `/app/quotes/${q.id}/edit` : `/app/quotes/${q.id}`}
                    className="dv2-quote-row"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--panel)', border: '1px solid var(--line)', textDecoration: 'none', color: 'inherit', marginBottom: 6 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.title || q.description?.slice(0, 40) || 'Untitled'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                        {q.customer?.name || 'No customer'}
                        {total > 0 && <> · {currency(total)}</>}
                        {monthly && <> · <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{currency(monthly)}/mo</span></>}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                      color: colorForStatus(status),
                      background: colorForStatus(status) + '12',
                      textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    }}>
                      {chipForStatus(status)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══ STRIPE CONNECT UPSELL ═══ */}
        {!loading && userProfile && !userProfile.stripe_connect_onboarded && hasAnyData && (
          <Link to="/app/payments/setup" className="dv2-upsell">
            <DollarSign size={18} className="dv2-upsell-icon" />
            <div className="dv2-upsell-text">
              <strong>Let customers pay monthly — you still get the full amount</strong>
              <span>10-minute setup. No monthly fee.</span>
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
              <Link to="/pricing" className="dv2-usage-upgrade">Upgrade</Link>
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
}
