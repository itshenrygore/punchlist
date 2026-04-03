import { useEffect, useState } from 'react';
import AppShell from '../components/app-shell';
import PageSkeleton from '../components/page-skeleton';
import { UsageMeter } from '../components/upgrade-prompt';
import { getProfile, listQuotes, createCheckout, openBillingPortal } from '../lib/api';
import { isPro, countSentThisMonth, getUsageInfo, FREE_QUOTE_LIMIT, PRICING } from '../lib/billing';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';

export default function BillingPage() {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ quotes: 0, sent: 0, won: 0 });
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getProfile(user.id), listQuotes(user.id)]).then(([p, q]) => {
      setProfile(p);
      const quotes = q || [];
      setStats({
        quotes: quotes.length,
        sent: quotes.filter(x => x.status !== 'draft').length,
        won: quotes.filter(x => ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(x.status)).length,
      });
      setSentThisMonth(countSentThisMonth(quotes));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const pro = isPro(profile);
  const plan = profile?.subscription_plan || 'free';
  const usage = getUsageInfo(profile, sentThisMonth);

  async function handleCheckout(priceKey) {
    setCheckingOut(true);
    try { await createCheckout(priceKey); }
    catch (e) { toast(e?.message || 'Checkout failed', 'error'); setCheckingOut(false); }
  }

  if (loading) return <AppShell title="Billing"><PageSkeleton variant="form" /></AppShell>;

  return (
    <AppShell title="Billing">
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 16 }}>

        {/* Current plan */}
        <div className="panel" style={{ textAlign: 'center', padding: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Your plan</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--text)', textTransform: 'capitalize' }}>
            {pro ? 'Pro' : 'Free'}
          </div>
          {pro && (
            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, marginTop: 6 }}>
              ✓ Unlimited quotes · full workflow
            </div>
          )}
        </div>

        {/* Usage meter (free users) */}
        {!pro && (
          <div className="panel" style={{ padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Monthly usage</div>
            <UsageMeter sent={sentThisMonth} limit={FREE_QUOTE_LIMIT} />
          </div>
        )}

        {/* Upgrade CTA (free users) */}
        {!pro && (
          <div className="panel" style={{ background: 'linear-gradient(160deg, var(--brand-bg), var(--panel))', border: '1px solid var(--brand-line)' }}>
            <div className="eyebrow">Upgrade to Pro</div>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8, marginBottom: 16 }}>
              Unlimited quotes, activity tracking, deposits, scheduling, invoicing, and analytics.
            </p>
            <div className="billing-pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="panel" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em' }}>${PRICING.monthly}</div>
                <div className="muted" style={{ fontSize: 12 }}>per month</div>
                <button className="btn btn-secondary full-width" style={{ marginTop: 12 }} type="button" disabled={checkingOut} onClick={() => handleCheckout('monthly')}>
                  {checkingOut ? 'Loading…' : 'Monthly'}
                </button>
              </div>
              <div className="panel" style={{ textAlign: 'center', padding: 16, border: '2px solid var(--green)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: 'white', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap' }}>SAVE ${PRICING.annualSavings}</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em' }}>${PRICING.annual}</div>
                <div className="muted" style={{ fontSize: 12 }}>per year · ${PRICING.annualMonthly}/mo</div>
                <button className="btn btn-primary full-width" style={{ marginTop: 12 }} type="button" disabled={checkingOut} onClick={() => handleCheckout('yearly')}>
                  {checkingOut ? 'Loading…' : 'Annual'}
                </button>
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10 }}>Cancel anytime · upgrade or downgrade freely</div>
          </div>
        )}

        {/* Manage subscription (paid users) */}
        {pro && (
          <div className="panel">
            <div className="eyebrow">Manage subscription</div>
            <p className="muted" style={{ fontSize: 13, marginTop: 8, marginBottom: 12 }}>
              Change plan, update payment method, or cancel.
            </p>
            {profile?.stripe_customer_id ? (
              <button
                className="btn btn-secondary full-width"
                type="button"
                disabled={portalLoading}
                onClick={async () => {
                  setPortalLoading(true);
                  try { await openBillingPortal(profile.stripe_customer_id); }
                  catch (e) { toast(e?.message || 'Could not open portal', 'error'); setPortalLoading(false); }
                }}
              >
                {portalLoading ? 'Loading…' : 'Manage subscription →'}
              </button>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                Contact <a href="mailto:hello@punchlist.ca" style={{ color: 'var(--brand-dark)' }}>hello@punchlist.ca</a> to manage your subscription.
              </p>
            )}
          </div>
        )}

        {/* Usage stats */}
        <div className="panel" style={{ background: 'var(--panel-2)' }}>
          <div className="eyebrow">Usage</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{stats.quotes}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Quotes</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{stats.sent}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Sent</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{stats.won}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Won</div>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="panel" style={{ background: 'var(--panel-2)' }}>
          <div className="eyebrow">Account</div>
          <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-2)' }}>{user?.email || ''}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
            Questions? <a href="mailto:hello@punchlist.ca" style={{ color: 'var(--brand-dark)' }}>hello@punchlist.ca</a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
