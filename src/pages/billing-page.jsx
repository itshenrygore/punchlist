import { useEffect, useState } from 'react';
import AppShell from '../components/app-shell';
import { BillingSkeleton } from '../components/skeletons';
import { UsageMeter } from '../components/upgrade-prompt';
import { getProfile, listQuotes, createCheckout, openBillingPortal } from '../lib/api';
import { isPro, countSentThisMonth, FREE_QUOTE_LIMIT, PRICING } from '../lib/billing';
import { currency } from '../lib/format';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';

export default function BillingPage() {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ quotes: 0, sent: 0, won: 0, wonRevenue: 0 });
  const [sentThisMonth, setSentThisMonth] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getProfile(user.id), listQuotes(user.id)]).then(([p, q]) => {
      setProfile(p);
      const quotes = q || [];
      const wonStatuses = ['approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid'];
      const wonQuotes = quotes.filter(x => wonStatuses.includes(x.status));
      const wonRevenue = wonQuotes.reduce((sum, q) => sum + (q.total || q.subtotal || 0), 0);
      setStats({
        quotes: quotes.length,
        sent: quotes.filter(x => x.status !== 'draft').length,
        won: wonQuotes.length,
        wonRevenue,
      });
      setSentThisMonth(countSentThisMonth(quotes));
    }).catch(e => console.warn('[PL]', e)).finally(() => setLoading(false));
  }, [user]);

  const pro = isPro(profile);

  async function handleCheckout(priceKey) {
    setCheckingOut(true);
    try { await createCheckout(priceKey); }
    catch (e) { toast(e?.message || 'Checkout failed', 'error'); }
    finally {
      // Reset even on the success path: in practice Stripe redirects
      // and this never matters, but if the helper returns without
      // navigating we don't want the button stuck on "Loading…".
      setCheckingOut(false);
    }
  }

  if (loading) return <AppShell title="Billing"><BillingSkeleton /></AppShell>;

  return (
    <AppShell title="Billing">
      <div className="bp-root">

        {/* Current plan */}
        <div className="bp-plan-card">
          <div className="bp-plan-eyebrow">Your plan</div>
          <div className="bp-plan-name">{pro ? 'Pro' : 'Free'}</div>
          {pro ? (
            <div className="bp-pro-features">
              {[
                '✓ Unlimited quotes',
                '✓ Seen receipts (know when customers open)',
                '✓ Collect deposits online',
                '✓ Convert quotes → invoices',
                '✓ Customize message templates',
                '✓ Full customer & analytics history',
              ].map(f => (
                <div key={f} className="bp-pro-feature-row">{f}</div>
              ))}
            </div>
          ) : (
            <div className="bp-plan-free-note">
              {FREE_QUOTE_LIMIT} quotes/month · Upgrade for unlimited
            </div>
          )}
        </div>

        {/* Usage meter (free users) */}
        {!pro && (
          <div className="bp-usage-card">
            <div className="bp-plan-eyebrow">Monthly usage</div>
            <UsageMeter sent={sentThisMonth} limit={FREE_QUOTE_LIMIT} />
          </div>
        )}

        {/* Upgrade CTA (free users) */}
        {!pro && (
          <div className="bp-upgrade-card">
            <div className="bp-plan-eyebrow">Upgrade to Pro</div>
            <p className="bp-upgrade-desc">
              Send unlimited quotes. See when customers open them. Let them pay monthly. Collect deposits, schedule jobs, and invoice — all in one place.
            </p>
            <div className="bp-pricing-grid">
              <div className="bp-price-panel">
                <div className="bp-price-amount">${PRICING.monthly}</div>
                <div className="bp-price-period">per month</div>
                <button className="btn btn-secondary full-width" style={{ marginTop: 14 }} type="button" disabled={checkingOut} onClick={() => handleCheckout('monthly')}>
                  {checkingOut ? 'Loading…' : 'Start monthly'}
                </button>
              </div>
              <div className="bp-price-panel bp-price-panel--featured">
                <div className="bp-price-badge">Best value — save ${PRICING.annualSavings}</div>
                <div className="bp-price-amount">${PRICING.annualMonthly}<span style={{ fontSize: '0.55em', fontWeight: 600, color: 'var(--text-2)', letterSpacing: 0 }}>/mo</span></div>
                <div className="bp-price-period">billed ${PRICING.annual}/year</div>
                <button className="btn btn-primary full-width" style={{ marginTop: 14 }} type="button" disabled={checkingOut} onClick={() => handleCheckout('yearly')}>
                  {checkingOut ? 'Loading…' : 'Start annual plan'}
                </button>
              </div>
            </div>
            <div className="bp-upgrade-note">Cancel anytime · upgrade or downgrade freely</div>
          </div>
        )}

        {/* Manage subscription (paid users) */}
        {pro && (
          <div className="bp-manage-card">
            <div className="bp-plan-eyebrow">Manage subscription</div>
            <p className="bp-manage-desc">
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
                  catch (e) { toast(e?.message || 'Could not open portal', 'error'); }
                  finally { setPortalLoading(false); }
                }}
              >
                {portalLoading ? 'Loading…' : 'Manage subscription →'}
              </button>
            ) : (
              <p className="bp-manage-desc">
                Contact <a href="mailto:hello@punchlist.ca" className="bp-account-link">hello@punchlist.ca</a> to manage your subscription.
              </p>
            )}
          </div>
        )}

        {/* ROI card — only shows when there's meaningful data */}
        {stats.won > 0 && stats.wonRevenue > 0 && (
          <div className="bp-roi-card">
            <div className="bp-roi-headline">
              {stats.won} job{stats.won !== 1 ? 's' : ''} closed through Punchlist
            </div>
            <div className="bp-roi-amount">{currency(stats.wonRevenue)}</div>
            <div className="bp-roi-sub">in won revenue tracked</div>
            {!pro && (
              <div className="bp-roi-math">
                Pro costs $29/month. At {currency(stats.wonRevenue)} won, you're seeing{' '}
                <strong>{Math.round(stats.wonRevenue / (PRICING.monthly * 12))}× return</strong>{' '}
                on what a full year of Pro would cost.
              </div>
            )}
          </div>
        )}

        {/* Usage stats */}
        <div className="bp-stats-card">
          <div className="bp-plan-eyebrow">Usage</div>
          <div className="bp-stats-grid">
            <div className="bp-stat">
              <div className="bp-stat-value">{stats.quotes}</div>
              <div className="bp-stat-label">Quotes created</div>
            </div>
            <div className="bp-stat">
              <div className="bp-stat-value">{stats.sent}</div>
              <div className="bp-stat-label">Sent to customers</div>
            </div>
            <div className="bp-stat">
              <div className="bp-stat-value">{stats.won}</div>
              <div className="bp-stat-label">Jobs won</div>
            </div>
          </div>
          {stats.won > 0 && stats.sent > 0 && (
            <div className="bp-close-rate">
              Close rate: <strong>{Math.round((stats.won / stats.sent) * 100)}%</strong>
              {stats.won / stats.sent >= 0.5 && <span className="bp-close-rate-badge">Strong ↑</span>}
            </div>
          )}
        </div>

        {/* Account */}
        <div className="bp-account-card">
          <div className="bp-plan-eyebrow">Account</div>
          <div className="bp-account-email">{user?.email || ''}</div>
          <div className="bp-account-note">
            Questions? <a href="mailto:hello@punchlist.ca" className="bp-account-link">hello@punchlist.ca</a>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
