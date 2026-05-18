/* ═══════════════════════════════════════════════════════════════
   Punchlist — Analytics Page
   Close rate, pipeline value, revenue tracked, monthly trends.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { useAuth } from '../hooks/use-auth';
import { usePullToRefresh } from '../hooks/use-mobile-ux';
import { listQuotes } from '../lib/api';
import { currency } from '../lib/format';
import { normalizeStatus } from '../lib/workflow';

const WON = ['approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid'];
const SENT = ['sent','viewed','revision_requested','approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid','declined','expired'];
const PIPELINE = ['sent','viewed','revision_requested','approved','approved_pending_deposit'];

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`an-stat${accent ? ' an-stat--accent' : ''}`}>
      <div className="an-stat-val">{value}</div>
      <div className="an-stat-lbl">{label}</div>
      {sub && <div className="an-stat-sub">{sub}</div>}
    </div>
  );
}

/* Simple bar chart — no library needed */
function MonthBar({ label, value, maxValue, won, sent }) {
  const fill = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  const wonFill = value > 0 ? Math.round((won / value) * 100) : 0;
  return (
    <div className="an-bar-row">
      <div className="an-bar-label">{label}</div>
      <div className="an-bar-track">
        <div className="an-bar-fill" style={{ width: `${fill}%` }}>
          {wonFill > 0 && <div className="an-bar-won" style={{ width: `${wonFill}%` }} />}
        </div>
      </div>
      <div className="an-bar-val">{sent > 0 ? currency(value) : '—'}</div>
    </div>
  );
}

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthKey(key) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-CA', { month: 'short', year: '2-digit' });
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState([]);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    listQuotes(user.id)
      .then(q => setQuotes((q || []).filter(x => !x.archived_at)))
      .catch(e => console.warn('[PL]', e))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);
  usePullToRefresh(load);

  const stats = useMemo(() => {
    const sentQ = quotes.filter(q => SENT.includes(normalizeStatus(q.status)));
    const wonQ = quotes.filter(q => WON.includes(normalizeStatus(q.status)));
    const pipelineQ = quotes.filter(q => PIPELINE.includes(normalizeStatus(q.status)));

    const closeRate = sentQ.length >= 2 ? Math.round((wonQ.length / sentQ.length) * 100) : null;
    const wonRevenue = wonQ.reduce((s, q) => s + (q.total || q.subtotal || 0), 0);
    const pipelineValue = pipelineQ.reduce((s, q) => s + (q.total || q.subtotal || 0), 0);
    const avgJobValue = wonQ.length > 0 ? Math.round(wonRevenue / wonQ.length) : 0;

    // Awaiting action: viewed/revision_requested or sent with views
    const awaitingAction = quotes.filter(q =>
      ['viewed','revision_requested'].includes(q.status) ||
      (q.status === 'sent' && (q.view_count || 0) > 0)
    );

    // Avg days from created_at to approval (for won quotes)
    const closeTimes = wonQ
      .filter(q => q.created_at && q.updated_at)
      .map(q => Math.max(0, (new Date(q.updated_at) - new Date(q.created_at)) / 86_400_000));
    const avgDaysToClose = closeTimes.length > 0
      ? Math.round(closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length)
      : null;

    // 30-day window stats for trend
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const recentSent = sentQ.filter(q => new Date(q.created_at) >= thirtyDaysAgo);
    const recentWon  = wonQ.filter(q => new Date(q.updated_at) >= thirtyDaysAgo);
    const recentCloseRate = recentSent.length >= 3
      ? Math.round((recentWon.length / recentSent.length) * 100)
      : null;

    return {
      closeRate, wonRevenue, pipelineValue, avgJobValue, avgDaysToClose,
      wonCount: wonQ.length, sentCount: sentQ.length,
      totalQuotes: quotes.length, awaitingAction: awaitingAction.length,
      pipelineCount: pipelineQ.length,
      recentCloseRate,
    };
  }, [quotes]);

  // Monthly breakdown: last 6 months
  const monthly = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    return months.map(key => {
      const mQuotes = quotes.filter(q => getMonthKey(q.created_at) === key);
      const mSent = mQuotes.filter(q => SENT.includes(normalizeStatus(q.status)));
      const mWon = mQuotes.filter(q => WON.includes(normalizeStatus(q.status)));
      const totalValue = mSent.reduce((s, q) => s + (q.total || q.subtotal || 0), 0);
      const wonValue = mWon.reduce((s, q) => s + (q.total || q.subtotal || 0), 0);
      return { key, label: formatMonthKey(key), sent: mSent.length, won: mWon.length, totalValue, wonValue };
    });
  }, [quotes]);

  const maxMonthValue = useMemo(() => Math.max(...monthly.map(m => m.totalValue), 1), [monthly]);

  // Top quote types (by frequency), with per-type win rate
  const topJobs = useMemo(() => {
    const map = {};
    for (const q of quotes) {
      if (!q.title) continue;
      const key = q.title.split(' ').slice(0, 3).join(' ');
      if (!map[key]) map[key] = { title: key, count: 0, wonCount: 0, sentCount: 0, totalValue: 0 };
      map[key].count++;
      const st = normalizeStatus(q.status);
      if (SENT.includes(st)) map[key].sentCount++;
      if (WON.includes(st)) {
        map[key].wonCount++;
        map[key].totalValue += (q.total || q.subtotal || 0);
      }
    }
    return Object.values(map)
      .map(j => ({
        ...j,
        winRate: j.sentCount >= 2 ? Math.round((j.wonCount / j.sentCount) * 100) : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [quotes]);

  const hasData = quotes.length > 0;

  return (
    <AppShell>
      <div className="an-root">
        <div className="an-page-hd">
          <h1 className="an-page-title font-display">Analytics</h1>
          {!loading && hasData && (
            <p className="an-page-sub">{stats.totalQuotes} quote{stats.totalQuotes !== 1 ? 's' : ''} total</p>
          )}
        </div>

        {loading ? (
          <div className="an-skel-grid">{[...Array(4)].map((_, i) => <div key={i} className="an-skel-card" />)}</div>
        ) : !hasData ? (
          <div className="an-empty">
            <div className="an-empty-ic">📊</div>
            <h2 className="an-empty-title font-display">No data yet</h2>
            <p className="an-empty-body">Send your first quote to start tracking close rate, pipeline value, and revenue.</p>
            <Link to="/app/quotes/new" className="btn btn-primary">Create a quote →</Link>
          </div>
        ) : (
          <>
            {/* ── Key metrics ── */}
            <div className="an-stats-grid">
              {stats.wonRevenue > 0 && (
                <StatCard
                  label="Revenue tracked"
                  value={currency(stats.wonRevenue)}
                  sub={`${stats.wonCount} job${stats.wonCount !== 1 ? 's' : ''} closed`}
                  accent
                />
              )}
              {stats.closeRate !== null && (
                <StatCard
                  label="Close rate"
                  value={`${stats.closeRate}%`}
                  sub={stats.recentCloseRate !== null
                    ? `${stats.recentCloseRate}% last 30 days`
                    : `${stats.wonCount} of ${stats.sentCount} sent`}
                />
              )}
              {stats.pipelineValue > 0 && (
                <StatCard
                  label="Open pipeline"
                  value={currency(stats.pipelineValue)}
                  sub={`${stats.pipelineCount} quote${stats.pipelineCount !== 1 ? 's' : ''} active`}
                />
              )}
              {stats.avgJobValue > 0 && (
                <StatCard
                  label="Avg job value"
                  value={currency(stats.avgJobValue)}
                  sub="on closed jobs"
                />
              )}
              {stats.avgDaysToClose !== null && (
                <StatCard
                  label="Avg days to close"
                  value={stats.avgDaysToClose === 0 ? 'Same day' : `${stats.avgDaysToClose}d`}
                  sub="from quote to approval"
                />
              )}
              {stats.awaitingAction > 0 && (
                <StatCard
                  label="Needs follow-up"
                  value={stats.awaitingAction}
                  sub="viewed or in revision"
                />
              )}
            </div>

            {/* ── Monthly trend ── */}
            {monthly.some(m => m.sent > 0) && (
              <div className="an-card">
                <div className="an-card-hd">
                  <h2 className="an-card-title">Monthly quote value</h2>
                  <div className="an-chart-legend">
                    <span className="an-legend-dot an-legend-dot--sent" />Sent
                    <span className="an-legend-dot an-legend-dot--won" />Won
                  </div>
                </div>
                <div className="an-chart">
                  {monthly.map(m => (
                    <MonthBar
                      key={m.key}
                      label={m.label}
                      value={m.totalValue}
                      won={m.wonValue}
                      sent={m.sent}
                      maxValue={maxMonthValue}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Top job types ── */}
            {topJobs.length > 0 && (
              <div className="an-card">
                <div className="an-card-hd">
                  <h2 className="an-card-title">Top job types</h2>
                </div>
                <div className="an-job-list">
                  {topJobs.map((j, i) => (
                    <div key={j.title} className="an-job-row">
                      <span className="an-job-rank">{i + 1}</span>
                      <span className="an-job-title">{j.title}…</span>
                      <span className="an-job-count">{j.count} quote{j.count !== 1 ? 's' : ''}</span>
                      {j.winRate !== null && (
                        <span className={`an-job-winrate${j.winRate >= 60 ? ' an-job-winrate--good' : j.winRate < 30 ? ' an-job-winrate--low' : ''}`}>
                          {j.winRate}% win
                        </span>
                      )}
                      {j.totalValue > 0 && (
                        <span className="an-job-val">{currency(j.totalValue)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Awaiting action ── */}
            {stats.awaitingAction > 0 && (
              <div className="an-action-card">
                <div className="an-action-lbl">
                  {stats.awaitingAction} quote{stats.awaitingAction !== 1 ? 's' : ''} need a follow-up
                </div>
                <Link to="/app/quotes?filter=needs_followup" className="btn btn-secondary an-action-btn">
                  Review →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
