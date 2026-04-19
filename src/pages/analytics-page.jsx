import FunnelChart from '../components/ui/FunnelChart';
import { Stat } from '../components/ui';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/app-shell';
import PageSkeleton from '../components/page-skeleton';
import EmptyState from '../components/empty-state';
import { listQuotes, listInvoices } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { currency } from '../lib/format';

// ── Helpers ──────────────────────────────────────────────
function startOfMonth(date) {
 return new Date(date.getFullYear(), date.getMonth(), 1);
}
function monthKey(iso) {
 if (!iso) return null;
 const d = new Date(iso);
 return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key) {
 if (!key) return '';
 const [y, m] = key.split('-');
 const d = new Date(Number(y), Number(m) - 1, 1);
 const mon = d.toLocaleDateString('en-CA', { month: 'short' });
 // Only show year on Jan or for the first/last item
 return `${mon}`;
}

// ── Sub-components ────────────────────────────────────────

function BarChart({ data, valueKey, labelKey, color, formatVal }) {
 const max = Math.max(...data.map(bar-chart-container analytics-bar-chart ap-flex-750a = formatVal || (v => v);
 const [tooltip, setTooltip] = useState(null);
 return (
 <div className="bar-chart-container analytics-bar-chart" >
 {data.map((d, i) => {
 const h = Math.max(2, ((d[valueKey] || 0) / max) * 100);
 return (
 <div key={i} className="ap-flex-e835">
 <div
 title={`${d[labelKey]}: ${fmt(d[valueKey] || 0)}`}
 onMouseEnter={(e) => {
 const rect = e.currentTarget.getBoundingClientRect();
 const container = e.currentTarget.closest('.bar-chart-container')?.getBoundingClientRect();
 setTooltip({
 x: rect.left - (container?.left || 0) + rect.width / 2,
 y: rect.top - (container?.top || 0) - 8,
 label: d[labelKey],
 value: fmt(d[valueKey] || 0),
 });
 }}
 onMouseLeave={() => setTooltip(null)}
 style={{
 width: '80%',
 height: `${h}%`,
 background: color || 'var(--primary)',
 borderRadius: '4px 4px 0 0',
 transition: 'height .4s ease',
 cursor: 'default',
 }}
 />
 <div className="ap-ta-center_fs-2xs-efd3">
 {d[labelKey]}
 </div>
 </div>
 );
 })}
 {tooltip && (
 <div style={{
 position: 'absolute',
 left: tooltip.x,
 top: tooltip.y,
 transform: 'translateX(-50%) translateY(-100%)',
 background: 'var(--panel)',
 border: '1px solid var(--line)',
 borderRadius: 6,
 padding: '4px 8px',
 fontSize: 'var(--text-xs)',
 fontWeight: 600,
 color: 'var(--text)',
 whiteSpace: 'nowrap',
 pointerEvents: 'none',
 zIndex: 10,
 }}>
 {tooltip.label}: {tooltip.value}
 </div>
 )}
 </div>
 );
}

function WinRateLine({ data }) {
 // data = [{label, rate}] rate 0-100
 if (data.length < 2) return <div className="ap-fs-sm-a4cf">Not enough data yet.</div>;
 const W = 400, H = 80;
 const pts = data.map((d, i) => {
 const x = (i / (data.length - 1)) * W;
 const y = H - (d.rate / 100) * H;
 return `${x},${y}`;
 });
 const polyline = pts.join(' ');
 // Fill area under line
 const fillPts = `0,${H} ${pts.join(' ')} ${W},${H}`;
 return (
 <div className="ap-s3-ec31">
 <svg viewBox={`0 0 ${W} ${H}`} className="ap-s2-b485" preserveAspectRatio="none">
 <defs>
 <linearGradient id="winGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
 <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
 </linearGradient>
 </defs>
 <polygon points={fillPts} fill="url(#winGrad)" />
 <polyline points={polyline} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" />
 {data.map((d, i) => {
 const x = (i / (data.length - 1)) * W;
 const y = H - (d.rate / 100) * H;
 return <circle key={i} cx={x} cy={y} r="3" fill="#059669" />;
 })}
 </svg>
 <div className="ap-flex_fs-2xs-9a95">
 <span>{data[0]?.label}</span>
 <span>{data[data.length - 1]?.label}</span>
 </div>
 </div>
 );
}

// ── Main component ────────────────────────────────────────
export default function AnalyticsPage() {
 const { user } = useAuth();
 const [quotes, setQuotes] = useState([]);
 const [invoices, setInvoices] = useState([]);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState(false);
 const [dateRange, setDateRange] = useState('all');

 useEffect(() => {
 if (!user) return;
 let cancelled = false;
 Promise.all([listQuotes(user.id), listInvoices(user.id)])
 .then(([q, inv]) => { if (!cancelled) { setQuotes(q || []); setInvoices(inv || []); } })
 .catch(() => { if (!cancelled) setLoadError(true); })
 .finally(() => { if (!cancelled) setLoading(false); });
 return () => { cancelled = true; };
 }, [user]);

 // Filter data by date range
 const { filteredQuotes, filteredInvoices } = useMemo(() => {
 if (dateRange === 'all') return { filteredQuotes: quotes, filteredInvoices: invoices };
 const now = new Date();
 let cutoff;
 if (dateRange === 'month') cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
 else if (dateRange === '90days') cutoff = new Date(now.getTime() - 90 * 86400000);
 else if (dateRange === 'year') cutoff = new Date(now.getFullYear(), 0, 1);
 else return { filteredQuotes: quotes, filteredInvoices: invoices };
 return {
 filteredQuotes: quotes.filter(q => new Date(q.created_at) >= cutoff),
 filteredInvoices: invoices.filter(i => new Date(i.created_at) >= cutoff),
 };
 }, [quotes, invoices, dateRange]);

 const analytics = useMemo(() => {
 if (!filteredQuotes.length) return null;

 // ── Conversion funnel ──
 const sent = filteredQuotes.filter(q => q.status !== 'draft').length;
 const viewed = filteredQuotes.filter(q => !['draft', 'sent'].includes(q.status)).length;
 const approved = filteredQuotes.filter(q => ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status)).length;
 const completed = filteredQuotes.filter(q => ['completed','invoiced','paid'].includes(q.status)).length;
 const paid = filteredInvoices.filter(i => i.status === 'paid').length;

 const funnel = [
 { label: 'Sent', count: sent, pct: null },
 { label: 'Viewed', count: viewed, pct: sent > 0 ? Math.round(viewed / sent * 100) : 0 },
 { label: 'Approved', count: approved, pct: viewed > 0 ? Math.round(approved / viewed * 100) : 0 },
 { label: 'Completed', count: completed, pct: approved > 0 ? Math.round(completed / approved * 100) : 0 },
 { label: 'Paid', count: paid, pct: completed > 0 ? Math.round(paid / completed * 100) : 0 },
 ];

 // ── Win rate (approved / sent) ──
 const winRate = sent > 0 ? Math.round(approved / sent * 100) : 0;

 // ── Average quote value ──
 const avgQuoteValue = filteredQuotes.length > 0
 ? filteredQuotes.reduce((s, q) => s + Number(q.total || 0), 0) / filteredQuotes.length
 : 0;

 // ── Revenue by month (paid invoices) ──
 const revenueByMonth = {};
 for (const inv of filteredInvoices) {
 if (inv.status !== 'paid') continue;
 const paidDate = inv.paid_at || inv.updated_at || inv.created_at;
 if (!paidDate) continue;
 const k = monthKey(paidDate);
 revenueByMonth[k] = (revenueByMonth[k] || 0) + Number(inv.total || 0);
 }
 // Last 12 months
 const now = new Date();
 const revenueData = [];
 for (let i = 11; i >= 0; i--) {
 const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
 const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
 revenueData.push({ label: monthLabel(k), revenue: revenueByMonth[k] || 0, key: k });
 }

 // ── Win rate by month (quotes sent in that month) ──
 const quotesByMonth = {};
 const approvedByMonth = {};
 for (const q of filteredQuotes) {
 if (q.status === 'draft') continue;
 const k = monthKey(q.created_at);
 if (!k) continue;
 quotesByMonth[k] = (quotesByMonth[k] || 0) + 1;
 if (['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status)) {
 approvedByMonth[k] = (approvedByMonth[k] || 0) + 1;
 }
 }
 const winRateTrend = revenueData
 .filter(d => quotesByMonth[d.key])
 .map(d => ({
 label: d.label,
 rate: quotesByMonth[d.key] ? Math.round((approvedByMonth[d.key] || 0) / quotesByMonth[d.key] * 100) : 0,
 }));

 // ── Average time to close (approved_at or signed_at vs created_at) ──
 const closedQuotes = filteredQuotes.filter(q =>
 ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status) &&
 (q.approved_at || q.signed_at) && q.created_at
 );
 let avgDaysToClose = null;
 if (closedQuotes.length > 0) {
 const totalDays = closedQuotes.reduce((s, q) => {
 const close = new Date(q.approved_at || q.signed_at);
 const create = new Date(q.created_at);
 return s + Math.max(0, (close - create) / 86400000);
 }, 0);
 avgDaysToClose = (totalDays / closedQuotes.length).toFixed(1);
 }

 // ── Total revenue collected ──
 const totalRevenue = filteredInvoices
 .filter(i => i.status === 'paid')
 .reduce((s, i) => s + Number(i.total || 0), 0);

 // ── Pipeline (approved, not yet paid) ──
 const pipeline = filteredQuotes
 .filter(q => ['approved','approved_pending_deposit','scheduled','completed','invoiced'].includes(q.status))
 .reduce((s, q) => s + Number(q.total || 0), 0);

 // ── Tracking metrics ──
 const viewedQuotes = filteredQuotes.filter(q => q.view_count > 0 && q.status !== 'draft');
 const avgViewsBeforeApproval = (() => {
 const approvedWithViews = filteredQuotes.filter(q =>
 ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status) && q.view_count > 0
 );
 if (!approvedWithViews.length) return null;
 return (approvedWithViews.reduce((s, q) => s + q.view_count, 0) / approvedWithViews.length).toFixed(1);
 })();
 const viewedWithin1hr = (() => {
 const sentWithView = filteredQuotes.filter(q => q.sent_at && q.last_viewed_at && q.status !== 'draft');
 if (!sentWithView.length) return null;
 const fast = sentWithView.filter(q => {
 const diff = new Date(q.last_viewed_at) - new Date(q.sent_at);
 return diff <= 3600000 && diff >= 0;
 });
 return sentWithView.length > 0 ? Math.round((fast.length / sentWithView.length) * 100) : null;
 })();

 // ── Financing metrics ──
 const quotesWithMonthly = filteredQuotes.filter(q => q.total >= 500 && q.status !== 'draft').length;
 const approvedWithMonthly = filteredQuotes.filter(q =>
 q.total >= 500 && ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status)
 ).length;

 return { funnel, winRate, avgQuoteValue, revenueData, winRateTrend, avgDaysToClose, totalRevenue, pipeline, avgViewsBeforeApproval, viewedWithin1hr, quotesWithMonthly, approvedWithMonthly };
 }, [filteredQuotes, filteredInvoices]);

 return (
 <AppShell title="Analytics">
 {loading ? (
 <PageSkeleton variant="cards" />
 ) : loadError ? (
 <EmptyState
 icon={null}
 title="Could not load analytics"
 description="Check your connection and try refreshing."
 actionLabel="Refresh"
 actionTo="/app/analytics"
 />
 ) : !analytics ? (
 <EmptyState
 icon={null}
 title="No data yet"
 description="Send your first quote to start tracking your close rate, views, and revenue."
 actionLabel="Create a quote →"
 actionTo="/app/quotes/new"
 />
 ql-status-pills ap-s1-a133div className="ap-flex-9e7d">

 {/* ── Date range selector ── */}
 <div className="ql-status-pills" >
 {[
 { value: 'month', label: 'This month' },
 { value: '90days', label: 'Last 90 days' },
 { value: 'year', label: 'This year' },
 { value: 'all', label: 'All time' },
 ].map(opt => (
 <button
 key={opt.value}
 type="button"
 className={`ql-pill${dateRange === opt.value ? ' active' : ''}`}
 onClick={() => setDateRange(opt.value)}
 >
 {opt.label}
 </button>
 ))}
 </div>

 {/* ── KPI row — close rate is the hero ── */}
 <div className="analytics-kpi-grid">
 <Stat label="Close rate" value={`${analytics.winRate}%`} hint={`${analytics.funnel[2].count} approved of ${analytics.funnel[0].count} sent`} tone="success" />
 <Stat label="Revenue collected" value={currency(analytics.totalRevenue)} hint="from paid invoices" tone="success" />
 <Stat label="Pipeline" value={currency(analytics.pipeline)} hint="approved, not yet paid" />
 <Stat label="Avg quote value" value={currency(analytics.avgQuoteValue)} hint="all quotes" />
 {analytics.avgDaysToClose !== null && (
 <Stat label="Avg days to close" value={`${analytics.avgDaysToClose}d`} hint="created → approved" />
 )}
 {analytics.avgViewsBeforeApproval !== null && (
 <Stat label="Avg views before approval" value={`${analytics.avgViewsBeforeApproval}×`} hint="quote tracking" />
 )}
 </div>

 {/* ── Tracking & financing insights ── */}
 {(analytics.viewedWithin1hr !== null || analytics.quotesWithMonthly > 0) && (
 <section className="analytics-section">
 <h3 className="ap-fs-base-7d4c">Insights</h3>
 <div className="ap-grid-72f5">
 {analytics.viewedWithin1hr !== null && (
 <div className="ap-flex_fs-sm-c29a">
 <span className="ap-inline-flex-abcd"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
 <span><strong className="ap-s0-0ee2">{analytics.viewedWithin1hr}%</strong> of quotes opened within 1 hour of sending</span>
 </div>
 )}
 {analytics.quotesWithMonthly > 0 && (
 <div className="ap-flex_fs-sm-c29a">
 <span className="ap-inline-flex-abcd"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
 <span><strong className="ap-s0-0ee2">{analytics.approvedWithMonthly}</strong> of {analytics.quotesWithMonthly} quotes with monthly option were approved</span>
 </div>
 )}
 </div>
 </section>
 )}

 {/* ── Conversion funnel ── */}
 <section className="analytics-section">
 <h3 className="ap-fs-base-b7cd">Conversion Funnel</h3>
 <FunnelChart data={analytics.funnel} />
 <p className="ap-fs-2xs-7cda">
 Percentages show conversion rate from the previous stage.
 </p>
 </section>

 {/* ── Revenue by month ── */}
 <section className="analytics-section">
 <h3 className="ap-fs-base-b7cd">Revenue by Month</h3>
 {analytics.revenueData.every(d => d.revenue === 0) ? (
 <div className="ap-fs-sm-a4cf">No paid invoices in the last 12 months.</div>
 ) : (
 <BarChart
 data={analytics.revenueData}
 valueKey="revenue"
 labelKey="label"
 color="var(--primary)"
 formatVal={v => currency(v)}
 />
 )}
 </section>

 {/* ── Win rate trend ── */}
 <section className="analytics-section">
 <h3 className="ap-fs-base-b7cd">Win Rate Trend</h3>
 <WinRateLine data={analytics.winRateTrend} />
 {analytics.winRateTrend.length >= 2 && (
 <p className="ap-fs-2xs-b2cb">
 Monthly win rate (approved ÷ sent) over the past 12 months.
 </p>
 )}
 </section>

 </div>
 )}
 </AppShell>
 );
}
