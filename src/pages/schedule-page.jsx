import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { Card, PageHeader } from '../components/ui';
import { listQuotes, updateQuoteStatus } from '../lib/api';
import { currency as fmtCurrency, formatDate } from '../lib/format';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { openMaps } from '../lib/utils';
import { smsNotify } from '../lib/sms';

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

// Hour-level helpers — schedule_window is a timestamp; UI surfaces it
// as "Today 9:00 AM" inside the day card.
function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes();
    if (h === 12 && m === 0) return 'noon';
    if (h === 0 && m === 0) return '';
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
  } catch { return ''; }
}

// .ics file generation (RFC 5545) — generates one VCALENDAR with all
// scheduled jobs in the current week. Lets the contractor pull jobs
// into Apple Calendar / Google Calendar / Outlook without integration.
function buildIcs(jobs, contractorName) {
  const dt = (iso) => {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  };
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Punchlist//${esc(contractorName || 'Schedule')}//EN`,
    'CALSCALE:GREGORIAN',
  ];
  for (const q of jobs) {
    if (!q.schedule_window) continue;
    const start = new Date(q.schedule_window);
    // Default 2-hour duration if we don't have an explicit end.
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:punchlist-${q.id}@punchlist.ca`,
      `DTSTAMP:${dt(new Date().toISOString())}`,
      `DTSTART:${dt(start.toISOString())}`,
      `DTEND:${dt(end.toISOString())}`,
      `SUMMARY:${esc(q.title || 'Job')}${q.customer?.name ? ` — ${esc(q.customer.name)}` : ''}`,
      ...(q.customer?.address ? [`LOCATION:${esc(q.customer.address)}`] : []),
      `DESCRIPTION:${esc(`Customer: ${q.customer?.name || 'TBD'}\\nTotal: ${fmtCurrency(q.total || 0, q.country)}\\nQuote: https://punchlist.ca/app/quotes/${q.id}`)}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export default function SchedulePage() {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const currency = (n, c) => fmtCurrency(n, c ?? quotes[0]?.country);
  const [weekOffset, setWeekOffset] = useState(0);

  function loadSchedule() {
    if (!user) return;
    setLoading(true);
    listQuotes(user.id)
      .then(q => {
        setQuotes(q.filter(qt => SCHEDULED_STATUSES.includes(qt.status) && !qt.archived_at));
        setLoadError(false);
      })
      .catch(e => { console.warn('[PL]', e); setLoadError(true); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { loadSchedule(); /* eslint-disable-next-line */ }, [user]);

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
    // Sort jobs within each day by start time so the day reads top-down
    // like a calendar (8am job first, 2pm job second).
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.schedule_window) - new Date(b.schedule_window));
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
      const timeLabel = formatTime(date.toISOString());
      toast(`Scheduled ${formatDayLabel(date)}${timeLabel ? ` at ${timeLabel}` : ''}`, 'success');
    } catch { toast('Could not schedule', 'error'); }
  }

  /** Send a day-before reminder SMS to the customer. */
  async function sendReminder(q) {
    if (!q.customer?.phone) { toast('Customer has no phone on file', 'error'); return; }
    const when = q.schedule_window ? new Date(q.schedule_window) : null;
    const dayLabel = when ? formatDayLabel(when) : '';
    const timeLabel = when ? formatTime(when.toISOString()) : '';
    const dateStr = [dayLabel, timeLabel].filter(Boolean).join(' at ');
    const contractorName = quotes[0]?.contractor_name || 'Your contractor';
    const body = `Hi ${q.customer?.name?.split(' ')[0] || ''} — just a heads up, ${contractorName} is scheduled for "${(q.title || 'your job').slice(0, 50)}"${dateStr ? ` ${dateStr}` : ''}. Reply if anything changes.`;
    try {
      const r = await smsNotify.customMessage({ to: q.customer.phone, body });
      if (r?.ok) toast(`Reminder sent to ${q.customer.name || 'customer'}`, 'success');
      else toast('Could not send reminder', 'error');
    } catch { toast('Could not send reminder', 'error'); }
  }

  /** Download a .ics file of the visible week so the contractor can
   *  pull jobs into Apple/Google/Outlook calendar. */
  function downloadIcs() {
    const weekJobs = days.flatMap(d => scheduled[d.toISOString().slice(0, 10)] || []);
    if (weekJobs.length === 0) { toast('Nothing scheduled this week to export', 'info'); return; }
    const ics = buildIcs(weekJobs, user?.user_metadata?.full_name || 'Schedule');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `punchlist-schedule-${start.toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Calendar file downloaded — import into Google/Apple/Outlook', 'success');
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
        <button type="button" className="btn btn-secondary btn-sm sch-export-btn" onClick={downloadIcs} title="Export this week as a calendar file">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Export</span>
        </button>
      </div>

      {loading ? (
        <div className="pl-skel-list">{[...Array(4)].map((_, i) => <div key={i} className="pl-skel-row" />)}</div>
      ) : loadError ? (
        <div className="sch-load-error" role="alert" style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg, 14px)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px' }}>Couldn’t load your schedule</h2>
          <p className="muted" style={{ fontSize: 14, margin: '0 0 16px' }}>Something went wrong reaching the server. Check your connection and try again.</p>
          <button type="button" className="btn btn-primary" onClick={loadSchedule}>Retry</button>
        </div>
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
                  {jobs.map(q => {
                    const time = formatTime(q.schedule_window);
                    return (
                      <Link key={`${q.id}-${key}`} to={`/app/quotes/${q.id}`} className={`sch-job${q._isMultiDay ? ' sch-job--multi' : ''}${q._isFirst ? ' sch-job--first' : ''}${q._isLast ? ' sch-job--last' : ''}`}>
                        {time && <span className="sch-job-time">{time}</span>}
                        <div className="sch-job-info">
                          <span className="sch-job-title">{q.title || 'Untitled'}{q._isMultiDay && !q._isFirst ? ' (cont.)' : ''}</span>
                          <span className="sch-job-meta">
                            {q.customer?.name || 'No customer'} · {currency(q.total || 0)}
                          </span>
                        </div>
                        <div className="sch-job-actions">
                          {q.customer?.phone && (
                            <button type="button" className="sch-nav-btn" title="Send reminder text" onClick={e => { e.preventDefault(); e.stopPropagation(); sendReminder(q); }} aria-label="Send reminder">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            </button>
                          )}
                          {q.customer?.address && (
                            <button type="button" className="sch-nav-btn" title="Get directions" onClick={e => { e.preventDefault(); e.stopPropagation(); openMaps(q.customer.address); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            </button>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                  {jobs.length === 0 && (
                    // Empty day: an action-oriented prompt ("Add a job")
                    // beats a passive label ("Open") — every empty
                    // state should be a doorway.
                    <Link
                      to="/app/quotes/new"
                      className="sch-empty-day sch-empty-day--clickable"
                    >
                      <span className="sch-empty-day-icon" aria-hidden="true">+</span>
                      <span>Add a job</span>
                    </Link>
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
                    <input type="datetime-local" className="sch-date-input" title="Pick start date &amp; time" onChange={e => {
                      if (e.target.value) assignDate(q.id, new Date(e.target.value));
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
