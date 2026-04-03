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
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-CA', { month: 'short', year: '2-digit' });
}

// ── Sub-components ────────────────────────────────────────

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r)',
      padding: '18px 20px',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || 'var(--text)', letterSpacing: '-.03em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function FunnelChart({ data }) {
  // data = [{label, count, pct}]
  const max = data[0]?.count || 1;
  const colors = ['#e86b30', '#f59e0b', '#3b82f6', '#059669', '#8b5cf6'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((row, i) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 70, minWidth: 50, fontSize: 11, color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }} className="analytics-funnel-label">{row.label}</div>
          <div style={{ flex: 1, background: 'var(--line)', borderRadius: 4, height: 22, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0,
              width: max > 0 ? `${Math.max(2, (row.count / max) * 100)}%` : '2%',
              background: colors[i % colors.length],
              borderRadius: 4,
              transition: 'width .5s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
            }}>
            </div>
          </div>
          <div style={{ width: 36, fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>{row.count}</div>
          {i > 0 && row.pct !== null && (
            <div style={{ width: 36, fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>{row.pct}%</div>
          )}
          {i === 0 && <div style={{ width: 36 }} />}
        </div>
      ))}
    </div>
  );
}

function BarChart({ data, valueKey, labelKey, color, formatVal }) {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const fmt = formatVal || (v => v);
  const [tooltip, setTooltip] = useState(null);
  return (
    <div className="bar-chart-container analytics-bar-chart" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, paddingBottom: 20, position: 'relative' }}>
      {data.map((d, i) => {
        const h = Math.max(2, ((d[valueKey] || 0) / max) * 100);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative', minWidth: 0 }}>
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
            <div style={{
              position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
              fontSize: 9, color: 'var(--subtle)', whiteSpace: 'nowrap', overflow: 'hidden',
              maxWidth: '100%', textAlign: 'center',
            }}>
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
          fontSize: 12,
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
  // data = [{label, rate}]  rate 0-100
  if (data.length < 2) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Not enough data yet.</div>;
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
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }} preserveAspectRatio="none">
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
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--subtle)', marginTop: 2 }}>
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

  useEffect(() => {
    if (!user) return;
    Promise.all([listQuotes(user.id), listInvoices(user.id)])
      .then(([q, inv]) => { setQuotes(q || []); setInvoices(inv || []); })
      .finally(() => setLoading(false));
  }, [user]);

  const analytics = useMemo(() => {
    if (!quotes.length) return null;

    // ── Conversion funnel ──
    const sent = quotes.filter(q => q.status !== 'draft').length;
    const viewed = quotes.filter(q => !['draft', 'sent'].includes(q.status)).length;
    const approved = quotes.filter(q => ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status)).length;
    const completed = quotes.filter(q => ['completed','invoiced','paid'].includes(q.status)).length;
    const paid = invoices.filter(i => i.status === 'paid').length;

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
    const avgQuoteValue = quotes.length > 0
      ? quotes.reduce((s, q) => s + Number(q.total || 0), 0) / quotes.length
      : 0;

    // ── Revenue by month (paid invoices) ──
    const revenueByMonth = {};
    for (const inv of invoices) {
      if (inv.status !== 'paid' || !inv.paid_at) continue;
      const k = monthKey(inv.paid_at);
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
    for (const q of quotes) {
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
    const closedQuotes = quotes.filter(q =>
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
    const totalRevenue = invoices
      .filter(i => i.status === 'paid')
      .reduce((s, i) => s + Number(i.total || 0), 0);

    // ── Pipeline (approved, not yet paid) ──
    const pipeline = quotes
      .filter(q => ['approved','approved_pending_deposit','scheduled','completed','invoiced'].includes(q.status))
      .reduce((s, q) => s + Number(q.total || 0), 0);

    return { funnel, winRate, avgQuoteValue, revenueData, winRateTrend, avgDaysToClose, totalRevenue, pipeline };
  }, [quotes, invoices]);

  return (
    <AppShell title="Analytics">
      {loading ? (
        <PageSkeleton variant="cards" />
      ) : !analytics ? (
        <EmptyState
          icon="📊"
          title="No data yet"
          description="Create and send your first quote to see analytics."
          actionLabel="+ Create a quote"
          actionTo="/app/quotes/new"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 900 }}>

          {/* ── KPI row ── */}
          <div className="analytics-kpi-grid">
            <StatCard label="Revenue collected" value={currency(analytics.totalRevenue)} sub="from paid invoices" color="var(--green)" />
            <StatCard label="Pipeline" value={currency(analytics.pipeline)} sub="approved, not yet paid" color="var(--amber)" />
            <StatCard label="Win rate" value={`${analytics.winRate}%`} sub="approved ÷ sent" />
            <StatCard label="Avg quote value" value={currency(analytics.avgQuoteValue)} sub="all quotes" />
            {analytics.avgDaysToClose !== null && (
              <StatCard label="Avg days to close" value={`${analytics.avgDaysToClose}d`} sub="created → approved" />
            )}
            <StatCard label="Total quotes" value={quotes.length} sub="all time" />
          </div>

          {/* ── Conversion funnel ── */}
          <section className="analytics-section">
            <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, letterSpacing: '-.02em' }}>Conversion Funnel</h3>
            <FunnelChart data={analytics.funnel} />
            <p style={{ margin: '14px 0 0', fontSize: 11, color: 'var(--subtle)' }}>
              Percentages show conversion rate from the previous stage.
            </p>
          </section>

          {/* ── Revenue by month ── */}
          <section className="analytics-section">
            <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, letterSpacing: '-.02em' }}>Revenue by Month</h3>
            {analytics.revenueData.every(d => d.revenue === 0) ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>No paid invoices in the last 12 months.</div>
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
            <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, letterSpacing: '-.02em' }}>Win Rate Trend</h3>
            <WinRateLine data={analytics.winRateTrend} />
            {analytics.winRateTrend.length >= 2 && (
              <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--subtle)' }}>
                Monthly win rate (approved ÷ sent) over the past 12 months.
              </p>
            )}
          </section>

        </div>
      )}
    </AppShell>
  );
}
