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
 }).catch(e => console.warn('[PL]', e)).finally(() => setLoading(false));
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

panel bp-ta-center-3729urn (
 <AppShell title="Billing">
 <div className="bp-grid-c7e2">

 {/* Current plan */}
 <div className="panel">
 <div className="eyebrow">Your plan</div>
 <div className="bp-fs-4xl-9bf6">
 {pro ? 'Pro' : 'Free'}
 </div>
 {pro && (
 <div className="bp-fs-sm-9952">
 panel bp-s5-64b2 ✓ Unlimited quotes · full workflow
 </div>eyebrow bp-s4-f682 )}
 </div>

 {/* Usage meter (free users) */}
 {!pro && (
 <div className="panel">
 <div className="eyebrow">Monthly usage</div>
 panel bp-s3-8c89ageMeter sent={sentThisMonth} limit={FREE_QUOTE_LIMIT} />
 </div>
 )}

 {/* Upgrade CTA (free users) */}
 {!pro && (
 <div className="panel">
 <div className="eyebrow">Upgrade to Pro</div>
 <p className="muted">
 Send unlimited quotes.billing-pricing-grid bp-grid-1d54open them. Let them pay monthly. Collect deposits, schedule jobs, and invoice — all in panel bp-ta-center-2138lace.
 </p>
 <div className="billing-pricing-grid">
 <div className="panel">
 <div className="bp-fs-3xl-f4b8">${btn btn-secondary full-width bp-s2-9313 <div className="muted">per month</div>
 <button className="btn btn-secondary full-width" type="button" disabled={checkingOut}panel bp-ta-center-c25cick={() => handleCheckout('monthly')}>
 {checkingOut ? 'Loading…' : 'Monthly'}
 </button>
 </div>
 <div className="panel">
 <div className="bp-fs-2xs-5e75">SAVE ${PRICING.anmuted bp-fs-xs-f59cavings}</div>
 <div className="bp-fs-3xl-f4b8">${PRICING.annual}</div>
 btn btn-primary full-width bp-s2-9313="muted" >per year · ${PRICING.annualMonthly}/mo</div>
 <button className="btn btn-primary full-width" type="button" disabled={checkingOut} onClick={() =>muted bp-ta-center_fs-xs-56c2leCheckout('yearly')}>
 {checkingOut ? 'Loading…' : 'Annual'}
 </button>
 </div>
 </div>
 <div className="muted">Cancel anytime · upgrade or downgrade freely</div>
 </div>
 )}

 {/muted bp-fs-sm-d7d5age subscription (paid users) */}
 {pro && (
 <div className="panel">
 <div className="eyebrow">Manage subscription</div>
 <p className="muted">
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
 catch (e) { toast(e?.message || 'Could not open portal', 'error'); setPortalLoading(false)muted bp-fs-sm-4202 }}
 >
 {portalLoading ? 'Loading…' : 'Manage subscription →'}
 </button>
 ) : (
 <p className="muted">
 Contact <a href="mailto:hello@punchlist.ca" className="bp-s0-feea">hello@punchlist.ca</a> to manage your subscription.
 </p>
 )}
 </div>
 )}

 {/* Usage stats */}
 <div className="panel">
 <div className="eyebrow">Usage</div>
 <div className="bp-grid-42cf">
 <div className="bp-ta-center-99ae">
 <div className="bp-fs-2xl-301d">{stats.quotes}</div>
 <div className="bp-fs-2xs-5628">Quotes</div>
 </div>
 <div className="bp-ta-center-99ae">
 <div className="bp-fs-2xl-301d">{stats.sent}</div>
 <div className="bp-fs-2xs-5628">Sent</div>
 </div>
 <div className="bp-ta-center-99ae">
 <div className="bp-fs-2xl-301d">{stats.won}</div>
 panel bp-s1-4c92className="bp-fs-2xs-5628">Won</div>
 </div>
 </div>
 </div>

 {/* Account */}
 <div className="panel">
 <div className="eyebrow">Account</div>
 <div className="bp-fs-base-44a5">{user?.email || ''}</div>
 <div className="bp-fs-xs-2c9d">
 Questions? <a href="mailto:hello@punchlist.ca" className="bp-s0-feea">hello@punchlist.ca</a>
 </div>
 </div>
 </div>
 </AppShell>
 );
}
