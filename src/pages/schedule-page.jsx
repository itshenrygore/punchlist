import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { Card, PageHeader } from '../components/ui';
import { listQuotes, updateQuoteStatus } from '../lib/api';
import { currency, formatDate } from '../lib/format';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { openMaps } from '../lib/utils';

const SCHEDULED_STATUSES = ['approved', 'approved_pending_deposit', 'deposit_paid'];

function weekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDayLabel(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function SchedulePage() {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    listQuotes(user.id)
      .then(q => {
        if (cancelled) return;
        setQuotes(q.filter(qt => SCHEDULED_STATUSES.includes(qt.status) && !qt.archived_at));
      })
      .catch(() => { /* keep prior list */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const start = weekStart(addDays(new Date(), weekOffset * 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const scheduled = useMemo(() => {
    const map = {};
    for (const d of days) map[d.toISOString().slice(0, 10)] = [];
    for (const q of quotes) {
      // schedule_start / schedule_end were never declared in the
      // schema — the previous code silently failed on every save. The
      // canonical column is `schedule_window`. Multi-day jobs use a
      // single point-in-time for now until/unless real range columns
      // are added.
      const sw = q.schedule_window;
      if (!sw) continue;
      const startDate = new Date(sw).toISOString().slice(0, 10);
      const key = startDate;
      if (map[key]) map[key].push({ ...q, _isFirst: true, _isLast: true, _isMultiDay: false });
    }
    return map;
  }, [quotes, weekOffset]);

  const unscheduled = useMemo(
    () => quotes.filter(q => !q.schedule_window),
    [quotes]
  );

  async function assignDate(quoteId, date /* endDate parameter ignored: see comment in `scheduled` */) {
    try {
      const updates = { schedule_window: date.toISOString() };
      await updateQuoteStatus(quoteId, updates);
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, ...updates } : q));
      toast(`Scheduled ${formatDayLabel(date)}`, 'success');
    } catch { toast('Could not schedule', 'error'); }
  }

  const weekLabel = (() => {
    if (weekOffset === 0) return 'This week';
    if (weekOffset === 1) return 'Next week';
    if (weekOffset === -1) return 'Last week';
    return `${start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} week`;
  })();

  return (
    <AppShell>
      <PageHeader kicker="Schedule" title={weekLabel} />

      <div className="sch-nav">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(p => p - 1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {weekOffset !== 0 && (
          <button type="button" className="btn-link" onClick={() => setWeekOffset(0)}>Today</button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(p => p + 1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {loading ? (
        <div className="pl-skel-list">{[...Array(4)].map((_, i) => <div key={i} className="pl-skel-row" />)}</div>
      ) : (
        <>
          <div className="sch-week">
            {days.map(day => {
              const key = day.toISOString().slice(0, 10);
              const isToday = new Date().toISOString().slice(0, 10) === key;
              const jobs = scheduled[key] || [];
              return (
                <div key={key} className={`sch-day${isToday ? ' sch-day--today' : ''}${jobs.length === 0 ? ' sch-day--empty' : ''}`}>
                  <div className="sch-day-header">
                    <span className="sch-day-label">{formatDayLabel(day)}</span>
                    <span className="sch-day-count">{jobs.length > 0 ? `${jobs.length} job${jobs.length > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  {jobs.map(q => (
                    <Link key={`${q.id}-${key}`} to={`/app/quotes/${q.id}`} className={`sch-job${q._isMultiDay ? ' sch-job--multi' : ''}${q._isFirst ? ' sch-job--first' : ''}${q._isLast ? ' sch-job--last' : ''}`}>
                      <div className="sch-job-info">
                        <span className="sch-job-title">{q.title || 'Untitled'}{q._isMultiDay && !q._isFirst ? ' (cont.)' : ''}</span>
                        <span className="sch-job-meta">
                          {q.customer?.name || 'No customer'} · {currency(q.total || 0)}
                        </span>
                      </div>
                      {q.customer?.address && (
                        <button type="button" className="sch-nav-btn" title="Get directions" onClick={e => { e.preventDefault(); e.stopPropagation(); openMaps(q.customer.address); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </button>
                      )}
                    </Link>
                  ))}
                  {jobs.length === 0 && (
                    // Dashed empty slot reads as "available" instead
                    // of "lifeless" — visual rhythm matches a calendar
                    // drop zone rather than a flat null cell.
                    <div className="sch-empty-day">
                      <span className="sch-empty-day-icon" aria-hidden="true">+</span>
                      <span>Open</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {unscheduled.length > 0 && (
            <section className="sch-unscheduled">
              <h3 className="sch-unsched-title">Approved — not yet scheduled ({unscheduled.length})</h3>
              {unscheduled.map(q => (
                <div key={q.id} className="sch-unsched-row">
                  <Link to={`/app/quotes/${q.id}`} className="sch-unsched-info">
                    <span className="sch-job-title">{q.title || 'Untitled'}</span>
                    <span className="sch-job-meta">{q.customer?.name || ''} · {currency(q.total || 0)}</span>
                  </Link>
                  <div className="sch-quick-sched">
                    {[0, 1, 2, 7].map(offset => {
                      const d = addDays(new Date(), offset);
                      const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : offset === 2 ? formatDayLabel(d) : 'Next week';
                      return (
                        <button key={offset} type="button" className="btn btn-secondary btn-xs" onClick={() => assignDate(q.id, d)}>
                          {label}
                        </button>
                      );
                    })}
                    <input type="date" className="sch-date-input" title="Pick start date" onChange={e => {
                      if (e.target.value) assignDate(q.id, new Date(e.target.value + 'T12:00:00'));
                    }} />
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
