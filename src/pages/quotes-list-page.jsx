import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/app-shell';
import StatusBadge from '../components/status-badge';
import EmptyState from '../components/empty-state';
import PageSkeleton from '../components/page-skeleton';
import { listQuotes, expireStaleDrafts } from '../lib/api';
import { currency, formatDate, formatQuoteNumber } from '../lib/format';
import { chipForStatus, toneForStatus } from '../lib/workflow';
import { useAuth } from '../hooks/use-auth';

const ALL_STATUSES = [
  'draft', 'sent', 'viewed', 'approved', 'scheduled',
  'completed', 'invoiced', 'paid', 'declined', 'expired',
];

const ACTIVE_STATUSES = ['draft', 'sent', 'viewed', 'approved', 'scheduled'];

const SORT_OPTIONS = [
  { value: 'updated', label: 'Last updated' },
  { value: 'created', label: 'Date created' },
  { value: 'total',   label: 'Total (high → low)' },
  { value: 'number',  label: 'Quote number' },
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
  return (
    <Link
      to={`/app/quotes/${quote.id}`}
      className="ql-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr 160px 110px 90px 110px',
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
      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{num}</span>
      <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {quote.title || 'Untitled quote'}
        {quote.customer?.name && (
          <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6, fontSize: 13 }}>{quote.customer.name}</span>
        )}
      </span>
      <span style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {quote.customer?.name || <span style={{ fontStyle: 'italic' }}>No contact</span>}
      </span>
      <span><StatusBadge status={quote.status} /></span>
      <span style={{ fontWeight: 600, fontSize: 14, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {currency(quote.total || 0)}
      </span>
      <span style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {formatDate(quote.updated_at || quote.created_at)}
      </span>
    </Link>
  );
}

/* ─── Mobile card ─── */
function QuoteCard({ quote }) {
  const num = quote.quote_number ? formatQuoteNumber(quote.quote_number) : null;
  return (
    <Link
      to={`/app/quotes/${quote.id}`}
      style={{
        display: 'block',
        padding: '12px 16px',
        borderRadius: 'var(--r)',
        borderBottom: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {quote.title || 'Untitled quote'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {quote.customer?.name || <span style={{ fontStyle: 'italic' }}>No contact</span>}
            {num && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {num}</span>}
          </span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {currency(quote.total || 0)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <StatusBadge status={quote.status} />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {formatDate(quote.updated_at || quote.created_at)}
        </span>
      </div>
    </Link>
  );
}

/* ─── Desktop table header ─── */
function TableHeader() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '90px 1fr 160px 110px 90px 110px',
      gap: 12,
      padding: '8px 16px',
      borderBottom: '2px solid var(--border)',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--muted)',
    }}>
      <span>Quote #</span>
      <span>Title</span>
      <span>Customer</span>
      <span>Status</span>
      <span style={{ textAlign: 'right' }}>Total</span>
      <span style={{ textAlign: 'right' }}>Updated</span>
    </div>
  );
}

export default function QuotesListPage() {
  const { user } = useAuth();
  const [quotes, setQuotes]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState(null);
  const [hideCompleted, setHideCompleted] = useState(() => {
    try { return localStorage.getItem('pl_hide_completed') === '1'; } catch { return false; }
  });
  const [sortBy, setSortBy]               = useState('updated');
  const [filtersOpen, setFiltersOpen]     = useState(false);

  useEffect(() => {
    if (!user) return;
    expireStaleDrafts().catch(() => {});
    listQuotes(user.id)
      .then(q => setQuotes((q || []).filter(qt => !qt.archived_at)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    let result = quotes;
    if (hideCompleted) result = result.filter(q => ACTIVE_STATUSES.includes(q.status));
    if (statusFilter) result = result.filter(q => q.status === statusFilter);
    if (search.trim()) result = result.filter(q => matchesSearch(q, search.trim()));
    return sortQuotes(result, sortBy);
  }, [quotes, statusFilter, hideCompleted, search, sortBy]);

  function toggleHideCompleted() {
    setHideCompleted(prev => {
      const next = !prev;
      try { localStorage.setItem('pl_hide_completed', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  const isFiltered = !!statusFilter || !!search.trim() || hideCompleted;
  const summary = isFiltered
    ? `Showing ${filtered.length} of ${quotes.length} quote${quotes.length !== 1 ? 's' : ''}`
    : `${quotes.length} quote${quotes.length !== 1 ? 's' : ''}`;

  const actions = (
    <Link className="btn btn-primary" to="/app/quotes/new" style={{ whiteSpace: 'nowrap' }}>
      + New quote
    </Link>
  );

  return (
    <AppShell title="Quotes" actions={actions}>
      {/* ── Filter bar ── */}
      <div style={{ marginBottom: 16 }}>
        {/* Mobile: search + toggle row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="search"
            className="input"
            placeholder="Search quotes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
            aria-label="Search quotes"
          />
          {/* Mobile filter toggle — visible only on small screens */}
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setFiltersOpen(f => !f)}
            aria-expanded={filtersOpen}
            style={{
              whiteSpace: 'nowrap',
              display: 'none', // hidden on desktop; shown via media query below
            }}
            id="ql-filter-toggle"
          >
            Filters {filtersOpen ? '▲' : '▼'}
          </button>

          {/* Desktop: inline selects */}
          <div className="ql-desktop-filters" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="input"
              value={statusFilter || ''}
              onChange={e => setStatusFilter(e.target.value || null)}
              style={{ minWidth: 130 }}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
              <input type="checkbox" checked={hideCompleted} onChange={toggleHideCompleted} style={{ accentColor: 'var(--brand)' }} />
              Hide completed
            </label>
          </div>
        </div>

        {/* Mobile: expanded filters */}
        <div
          className="ql-mobile-filters"
          style={{
            display: 'none', // shown by media query when filtersOpen
            marginTop: 8,
            gap: 8,
            flexDirection: 'column',
          }}
          aria-hidden={!filtersOpen}
        >
          <select
            className="input"
            value={statusFilter || ''}
            onChange={e => setStatusFilter(e.target.value || null)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select
            className="input"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            aria-label="Sort quotes"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', padding: '4px 0' }}>
            <input type="checkbox" checked={hideCompleted} onChange={toggleHideCompleted} style={{ accentColor: 'var(--brand)', width: 18, height: 18 }} />
            Hide completed quotes
          </label>
        </div>
      </div>

      {/* ── Summary line ── */}
      {!loading && quotes.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          {summary}
          {isFiltered && (
            <button
              type="button"
              className="btn-link"
              onClick={() => { setSearch(''); setStatusFilter(null); setHideCompleted(false); try { localStorage.removeItem('pl_hide_completed'); } catch {} }}
              style={{ marginLeft: 10, fontSize: 13, color: 'var(--orange)' }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <PageSkeleton variant="list" />
      ) : quotes.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No quotes yet"
          description="Create your first quote to get started."
          actionLabel="+ New quote"
          actionTo="/app/quotes/new"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No quotes match"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="panel" style={{ overflow: 'hidden', padding: 0 }}>
          {/* Desktop table */}
          <div className="ql-table">
            <TableHeader />
            {filtered.map(q => <QuoteRow key={q.id} quote={q} />)}
          </div>
          {/* Mobile card list */}
          <div className="ql-cards">
            {filtered.map(q => <QuoteCard key={q.id} quote={q} />)}
          </div>
        </div>
      )}

      {/* Responsive styles handled in index.css (980px breakpoint) */}
    </AppShell>
  );
}
