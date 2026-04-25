import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppShell from '../components/app-shell';
import StatusBadge from '../components/status-badge';
import EmptyState from '../components/empty-state';
import PageSkeleton from '../components/page-skeleton';
import SwipeableRow from '../components/swipeable-row';
import { listQuotes, expireStaleDrafts, updateQuote, deleteQuote } from '../lib/api';
import { currency, formatDate, formatQuoteNumber } from '../lib/format';
import { chipForStatus, toneForStatus } from '../lib/workflow';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { usePullToRefresh, haptic } from '../hooks/use-mobile-ux';
import { estimateMonthly, showFinancing } from '../lib/financing';
import { Card, PageHeader, RevealOnView } from '../components/ui';

const ALL_STATUSES = [
  'draft', 'sent', 'viewed', 'approved', 'approved_pending_deposit',
  'question_asked', 'revision_requested', 'scheduled',
  'completed', 'invoiced', 'paid', 'declined', 'expired',
];

const ACTIVE_STATUSES = ['draft', 'sent', 'viewed', 'approved', 'approved_pending_deposit', 'question_asked', 'revision_requested', 'scheduled'];

const SORT_OPTIONS = [
  { value: 'updated', label: 'Last updated' },
  { value: 'created', label: 'Date created' },
  { value: 'total',   label: 'Total (high → low)' },
  { value: 'number',  label: 'Quote number' },
];

// Status pill labels (shorter for mobile)
const STATUS_PILLS = [
  { value: null,                     label: 'All' },
  { value: 'needs_followup',         label: 'Needs follow-up' },
  { value: 'draft',                  label: 'Draft' },
  { value: 'sent',                   label: 'Sent' },
  { value: 'viewed',                 label: 'Viewed' },
  { value: 'approved',              label: 'Approved' },
  { value: 'revision_requested',    label: 'Revision requested' },
  { value: 'scheduled',             label: 'Scheduled' },
  { value: 'completed',             label: 'Completed' },
  { value: 'invoiced',              label: 'Invoiced' },
  { value: 'paid',                   label: 'Paid' },
  { value: 'declined',              label: 'Declined' },
  { value: 'expired',               label: 'Expired' },
];

function sortQuotes(quotes, sortBy) {
  return [...quotes].sort((a, b) => {
    if (sortBy === 'total')   return (b.total || 0) - (a.total || 0);
    if (sortBy === 'number')  return (b.quote_number || 0) - (a.quote_number || 0);
    if (sortBy === 'created') return new Date(b.created_at) - new Date(a.created_at);
    // default: updated
    return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
  });
}

function matchesSearch(quote, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (quote.title || '').toLowerCase().includes(q) ||
    (quote.customer?.name || '').toLowerCase().includes(q) ||
    (quote.status || '').toLowerCase().includes(q) ||
    (chipForStatus(quote.status) || '').toLowerCase().includes(q) ||
    (quote.quote_number ? formatQuoteNumber(quote.quote_number).toLowerCase().includes(q) : false)
  );
}

/* ─── Desktop row ─── */
function QuoteRow({ quote }) {
  const num = quote.quote_number ? formatQuoteNumber(quote.quote_number) : '—';
  const viewBadge = quote.view_count > 0 && ['sent','viewed','question_asked'].includes(quote.status);
  return (
    <Link
      to={`/app/quotes/${quote.id}`}
      className="ql-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '80px 1fr 150px 120px 110px',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 'var(--r)',
        borderBottom: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-sm)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{num}</span>
      <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {quote.title || 'Untitled quote'}
        {quote.customer?.name && (
          <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 8, fontSize: 'var(--text-sm)' }}>· {quote.customer?.name}</span>
        )}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <StatusBadge status={quote.status} />
        {viewBadge && <span className="ql-view-badge">{quote.view_count}×</span>}
      </span>
      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {currency(quote.total || 0)}
      </span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {formatDate(quote.updated_at || quote.created_at)}
      </span>
    </Link>
  );
}

/* ─── Mobile card ─── */
function QuoteCard({ quote }) {
  const num = quote.quote_number ? formatQuoteNumber(quote.quote_number) : null;
  const viewBadge = quote.view_count > 0 && ['sent','viewed','question_asked'].includes(quote.status);
  return (
    <Link to={`/app/quotes/${quote.id}`} className="ql-card-v2" style={{ textDecoration: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ql-card-title">{quote.title || 'Untitled quote'}</div>
          <div className="ql-card-meta">
            <span>{quote.customer?.name || <span style={{ fontStyle: 'italic' }}>No contact</span>}</span>
            {num && <span style={{ opacity: 0.6 }}>· {num}</span>}
          </div>
        </div>
        <div className="ql-card-total">{currency(quote.total || 0)}</div>
      </div>
      <div className="ql-card-bottom">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusBadge status={quote.status} />
          {viewBadge && <span className="ql-view-badge">{quote.view_count}×</span>}
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>{formatDate(quote.updated_at || quote.created_at)}</span>
      </div>
    </Link>
  );
}

/* ─── Desktop table header ─── */
function TableHeader() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '80px 1fr 150px 120px 110px',
      gap: 12,
      padding: '8px 16px',
      borderBottom: '2px solid var(--border)',
      fontSize: 'var(--text-2xs)',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--muted)',
    }}>
      <span>Quote #</span>
      <span>Title</span>
      <span>Status</span>
      <span style={{ textAlign: 'right' }}>Total</span>
      <span style={{ textAlign: 'right' }}>Updated</span>
    </div>
  );
}

export default function QuotesListPage() {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const [searchParams] = useSearchParams();
  const [quotes, setQuotes]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter]   = useState(() => {
    const valid = ['draft','sent','viewed','approved','approved_pending_deposit','question_asked','revision_requested','scheduled','completed','invoiced','paid','declined','expired','needs_followup'];
    const f = searchParams.get('filter');
    if (f && valid.includes(f)) return f;
    try {
      const stored = sessionStorage.getItem('pl_quotes_filter');
      if (stored && valid.includes(stored)) return stored;
    } catch (e) { /* sessionStorage blocked */ }
    return null;
  });
  const [hideCompleted, setHideCompleted] = useState(() => {
    try { return localStorage.getItem('pl_hide_completed') === '1'; } catch { return false; }
  });
  const [sortBy, setSortBy]               = useState('updated');

  const fetchQuotes = useCallback(() => {
    if (!user) return;
    setLoading(true);
    expireStaleDrafts().catch(e => console.warn('[PL]', e));
    listQuotes(user.id)
      .then(q => setQuotes((q || []).filter(qt => !qt.archived_at)))
      .catch(e => console.warn('[PL]', e))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  // Persist statusFilter to sessionStorage (Phase 3)
  useEffect(() => {
    try {
      if (statusFilter) sessionStorage.setItem('pl_quotes_filter', statusFilter);
      else sessionStorage.removeItem('pl_quotes_filter');
    } catch (e) { /* sessionStorage blocked */ }
  }, [statusFilter]);

  // Debounce search input — 180ms (Phase 3)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 180);
    return () => clearTimeout(t);
  }, [search]);

  // Pull to refresh
  usePullToRefresh(fetchQuotes);

  // Swipe to archive
  async function handleArchive(quoteId) {
    try {
      await updateQuote(quoteId, { archived_at: new Date().toISOString() });
      setQuotes(prev => prev.filter(q => q.id !== quoteId));
      haptic('success');
      toast('Quote archived', 'success');
    } catch { toast('Could not archive', 'error'); }
  }

  // Delete draft
  async function handleDeleteDraft(quoteId) {
    try {
      await deleteQuote(quoteId);
      setQuotes(prev => prev.filter(q => q.id !== quoteId));
      haptic('success');
      toast('Draft deleted', 'success');
    } catch { toast('Could not delete', 'error'); }
  }

  const filtered = useMemo(() => {
    let result = quotes;
    if (hideCompleted) result = result.filter(q => ACTIVE_STATUSES.includes(q.status));
    if (statusFilter === 'needs_followup') {
      result = result.filter(q => ['viewed','question_asked','revision_requested'].includes(q.status) || (q.status === 'sent' && q.view_count > 0));
    } else if (statusFilter === 'approved') {
      result = result.filter(q => ['approved','approved_pending_deposit'].includes(q.status));
    } else if (statusFilter) {
      result = result.filter(q => q.status === statusFilter);
    }
    if (debouncedSearch.trim()) result = result.filter(q => matchesSearch(q, debouncedSearch.trim()));
    return sortQuotes(result, sortBy);
  }, [quotes, statusFilter, hideCompleted, debouncedSearch, sortBy]);

  // Close rate summary
  const closeRateSummary = useMemo(() => {
    const sent = quotes.filter(q => q.status !== 'draft').length;
    const approved = quotes.filter(q => ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status)).length;
    const rate = sent > 0 ? Math.round((approved / sent) * 100) : 0;
    return { sent, approved, rate };
  }, [quotes]);

  function toggleHideCompleted() {
    setHideCompleted(prev => {
      const next = !prev;
      try { localStorage.setItem('pl_hide_completed', next ? '1' : '0'); } catch (e) { console.warn("[PL]", e); }
      return next;
    });
  }

  const isFiltered = !!statusFilter || !!search.trim() || hideCompleted;
  const summary = isFiltered
    ? `Showing ${filtered.length} of ${quotes.length} quote${quotes.length !== 1 ? 's' : ''}`
    : `${quotes.length} quote${quotes.length !== 1 ? 's' : ''}${closeRateSummary.sent > 0 ? ` · ${closeRateSummary.approved} of ${closeRateSummary.sent} approved (${closeRateSummary.rate}%)` : ''}`;

  return (
    <AppShell hideTitle>
      <PageHeader
        kicker="Workspace"
        title="Quotes"
        subtitle={summary}
        actions={<Link to="/app/quotes/new" className="btn btn-primary pl-hide-mobile">New quote</Link>}
      />

      {/* ── Status tabs (all screen sizes, scrollable on mobile) ── */}
      <div className="pl-tabstrip" role="tablist" aria-label="Filter quotes by status">
        {STATUS_PILLS.map(p => {
          const active = statusFilter === p.value;
          return (
            <button
              key={p.value ?? 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              className={`pl-tab${active ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(p.value)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ── Search + desktop controls ── */}
      <div className="pl-search-safe">
        <input
          type="search"
          className="input"
          placeholder="Search quotes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
          aria-label="Search quotes"
        />
        <div className="ql-desktop-filters" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="input"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ minWidth: 150 }}
            aria-label="Sort quotes"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
            <input type="checkbox" checked={hideCompleted} onChange={toggleHideCompleted} style={{ accentColor: 'var(--brand)' }} />
            Hide completed
          </label>
        </div>
      </div>

      {/* ── Mobile filter controls (hidden on desktop where ql-desktop-filters shows) ── */}
      <div className="ql-mobile-filters">
        <select
          className="input"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-xs)', height: 36 }}
          aria-label="Sort quotes"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
          <input type="checkbox" checked={hideCompleted} onChange={toggleHideCompleted} style={{ accentColor: 'var(--brand)', width: 16, height: 16 }} />
          Hide completed
        </label>
      </div>

      {/* ── Summary line (only when filters are active — unfiltered summary lives in PageHeader) ── */}
      {!loading && quotes.length > 0 && isFiltered && (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginBottom: 12 }}>
          {summary}
          <button
            type="button"
            className="btn-link"
            onClick={() => { setSearch(''); setStatusFilter(null); setHideCompleted(false); try { localStorage.removeItem('pl_hide_completed'); } catch (e) { console.warn("[PL]", e); } }}
            style={{ marginLeft: 10, fontSize: 'var(--text-sm)', color: 'var(--orange)' }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="pl-skel-list">
          <div key="sk-a" className="pl-skel-row" />
          <div key="sk-b" className="pl-skel-row" />
          <div key="sk-c" className="pl-skel-row" />
          <div key="sk-d" className="pl-skel-row" />
          <div key="sk-e" className="pl-skel-row" />
        </div>
      ) : quotes.length === 0 ? (
        <Card padding="loose" minH="260px" className="pl-empty-card">
          <div className="pl-empty-glyph" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
          <h2 className="pl-empty-title font-display">No quotes yet</h2>
          <p className="pl-empty-body">Describe a job and Punchlist builds the quote. Your first one takes under 4 minutes.</p>
          <div className="pl-empty-actions">
            <Link to="/app/quotes/new" className="btn btn-primary">Create your first quote →</Link>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card padding="loose" minH="220px" className="pl-empty-card">
          <div className="pl-empty-glyph">🔍</div>
          <h2 className="pl-empty-title font-display">No quotes match</h2>
          <p className="pl-empty-body">Try adjusting your search or filters.</p>
          <div className="pl-empty-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setSearch(''); setStatusFilter(null); setHideCompleted(false); try { localStorage.removeItem('pl_hide_completed'); } catch (e) { console.warn("[PL]", e); } }}
            >
              Clear filters
            </button>
          </div>
        </Card>
      ) : (
        <div className="panel" style={{ overflow: 'hidden', padding: 0 }}>
          {/* Desktop table */}
          <div className="ql-table">
            <TableHeader />
            {filtered.map(q => <QuoteRow key={q.id} quote={q} />)}
          </div>
          {/* Mobile card list */}
          <div className="ql-cards">
            {filtered.map(q => (
              <div key={q.id} className="pl-ql-row-wrap">
                <SwipeableRow onSwipe={() => q.status === 'draft' ? handleDeleteDraft(q.id) : handleArchive(q.id)} label={q.status === 'draft' ? 'Delete' : 'Archive'} color={q.status === 'draft' ? 'var(--red, #ef4444)' : undefined}>
                  <QuoteCard quote={q} />
                </SwipeableRow>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Responsive styles handled in index.css (980px breakpoint) */}
    </AppShell>
  );
}
