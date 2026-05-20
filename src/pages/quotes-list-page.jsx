import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import AppShell from '../components/app-shell';
import EmptyState from '../components/empty-state';
import SwipeableRow from '../components/swipeable-row';
import { listQuotes, expireStaleDrafts, updateQuote, updateQuoteStatus, deleteQuote, getQuote, duplicateQuote, sendQuoteEmail } from '../lib/api';
import { currency, formatDate, formatQuoteNumber } from '../lib/format';
import { chipForStatus } from '../lib/workflow';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { usePullToRefresh, haptic } from '../hooks/use-mobile-ux';
// Monthly payment estimates are hidden on contractor screens — they
// belong on the customer-facing public quote view only.
import { Card, PageHeader, RevealOnView } from '../components/ui';
import { useScrollFade } from '../hooks/use-scroll-fade';
import { useScrollRestore } from '../hooks/use-scroll-restore';
import { cacheQuotes, getCachedQuotes } from '../lib/offline-cache';

const ALL_STATUSES = [
  'draft', 'sent', 'viewed', 'revision_requested', 'approved', 'approved_pending_deposit',
  'deposit_paid', 'converted_to_invoice', 'paid', 'declined', 'expired',
];

const ACTIVE_STATUSES = ['draft', 'sent', 'viewed', 'revision_requested', 'approved', 'approved_pending_deposit', 'deposit_paid'];

const SORT_OPTIONS = [
  { value: 'updated', label: 'Last updated' },
  { value: 'created', label: 'Date created' },
  { value: 'total',   label: 'Total (high → low)' },
  { value: 'number',  label: 'Quote number' },
];

// Simplified status pills — fewer options, all fit on screen.
// shortLabel is rendered on phones where "Needs follow-up" would push
// the rightmost pill off-screen.
const STATUS_PILLS = [
  { value: null,             label: 'All' },
  { value: 'needs_followup', label: 'Needs follow-up', shortLabel: 'Follow-up' },
  { value: 'draft',          label: 'Draft' },
  { value: 'sent',           label: 'Sent' },
  { value: 'viewed',         label: 'Viewed' },
  { value: 'approved',       label: 'Approved' },
  { value: 'done',           label: 'Done' },
  { value: 'declined',       label: 'Declined' },
];

function sortQuotes(quotes, sortBy) {
  return [...quotes].sort((a, b) => {
    if (sortBy === 'total')   return (b.total || 0) - (a.total || 0);
    if (sortBy === 'number')  return (b.quote_number || 0) - (a.quote_number || 0);
    if (sortBy === 'created') return new Date(b.created_at) - new Date(a.created_at);
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

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function expiryLabel(expiresAt, status) {
  if (!expiresAt || !['sent','viewed','revision_requested'].includes(status)) return null;
  const diff = Math.ceil((new Date(expiresAt) - Date.now()) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return { text: 'Expires today', cls: 'ql-expiry--urgent' };
  if (diff <= 3) return { text: `${diff}d left`, cls: 'ql-expiry--warn' };
  if (diff <= 7) return { text: `${diff}d left`, cls: 'ql-expiry--soon' };
  return null;
}

const AVATAR_COLOR = {
  sent: 'dv2-arow-avatar--blue', viewed: 'dv2-arow-avatar--blue',
  approved: 'dv2-arow-avatar--green', deposit_paid: 'dv2-arow-avatar--green',
  converted_to_invoice: 'dv2-arow-avatar--green', paid: 'dv2-arow-avatar--green',
  revision_requested: 'dv2-arow-avatar--amber', approved_pending_deposit: 'dv2-arow-avatar--amber',
  declined: 'dv2-arow-avatar--red', expired: 'dv2-arow-avatar--red',
};

/* ─── Desktop row — premium card style ─── */
function QuoteRow({ quote, onDuplicate, isSelected, onToggleSelect }) {
  const num = quote.quote_number ? formatQuoteNumber(quote.quote_number) : '—';
  const status = quote.status;
  const viewBadge = quote.view_count > 0 && ['sent','viewed','revision_requested'].includes(status);
  const total = quote.total || 0;
  const expiry = expiryLabel(quote.expires_at, status);

  const customerName = quote.customer?.name;
  return (
    <Link to={`/app/quotes/${quote.id}`} className={`ql-row-premium${isSelected ? ' ql-row--selected' : ''}`} data-status={status}>
      {onToggleSelect && (
        <input type="checkbox" className="ql-bulk-cb" checked={isSelected} onChange={e => onToggleSelect(e, quote.id)} aria-label={`Select ${quote.title || 'quote'}`} />
      )}
      {customerName && (
        <span className={`dv2-arow-avatar ${AVATAR_COLOR[status] || ''}${status === 'viewed' ? ' dv2-arow-avatar--live' : ''}`}>
          {initials(customerName)}
        </span>
      )}
      <div className="ql-row-info">
        <span className="ql-row-title">
          {quote.title || 'Untitled quote'}
          {customerName && (
            <span className="ql-row-customer"> · {customerName}</span>
          )}
        </span>
        <span className="ql-row-meta">
          {num}
          <span className="ql-row-date">{formatDate(quote.updated_at || quote.created_at)}</span>
        </span>
      </div>
      <span className={`chip chip-${status}`}>
        {chipForStatus(status)}
      </span>
      {viewBadge && (
        <span className="ql-view-chip" aria-label={`${quote.view_count} views`} title={`${quote.view_count} views`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>{quote.view_count}</span>
        </span>
      )}
      {expiry && <span className={`ql-expiry ${expiry.cls}`}>{expiry.text}</span>}
      <div className="ql-row-right">
        <span className="ql-row-amount">{total > 0 ? currency(total) : '—'}</span>
        {onDuplicate && (
          <button type="button" className="ql-dup-btn" title="Duplicate quote" onClick={e => onDuplicate(e, quote.id)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        )}
      </div>
    </Link>
  );
}

/* ─── Mobile card — premium card style ─── */
function QuoteCard({ quote, onDuplicate }) {
  const num = quote.quote_number ? formatQuoteNumber(quote.quote_number) : null;
  const status = quote.status;
  const viewBadge = quote.view_count > 0 && ['sent','viewed','revision_requested'].includes(status);
  const hasCustomer = quote.customer?.name;
  const total = quote.total || 0;
  const expiry = expiryLabel(quote.expires_at, status);

  return (
    <Link to={`/app/quotes/${quote.id}`} className="ql-row-premium" data-status={status}>
      {hasCustomer && (
        <span className={`dv2-arow-avatar ${AVATAR_COLOR[status] || ''}${status === 'viewed' ? ' dv2-arow-avatar--live' : ''}`}>
          {initials(quote.customer.name)}
        </span>
      )}
      <div className="ql-row-info">
        <span className="ql-row-title">{quote.title || 'Untitled quote'}</span>
        <span className="ql-row-meta">
          {hasCustomer ? quote.customer.name : <span className="ql-row-draft-label">Draft</span>}
          {num && <span className="ql-row-num-dim"> · {num}</span>}
          {expiry && <span className={`ql-expiry ${expiry.cls}`}> · {expiry.text}</span>}
        </span>
      </div>
      <div className="ql-row-right">
        <span className="ql-row-amount">{total > 0 ? currency(total) : '—'}</span>
        <div className="ql-row-chips">
          <span className={`chip chip-${status}`}>{chipForStatus(status)}</span>
          {viewBadge && <span className="ql-view-badge">{quote.view_count}×</span>}
          {onDuplicate && (
            <button type="button" className="ql-dup-btn" title="Duplicate" onClick={e => onDuplicate(e, quote.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Desktop table header ─── */
function TableHeader({ selectAll, allSelected, hasSelection }) {
  return (
    <div className="ql-table-header">
      {selectAll && (
        <input type="checkbox" className="ql-bulk-cb" checked={allSelected} onChange={selectAll} aria-label="Select all" />
      )}
      <span>Quote</span>
      <span>Status</span>
      <span className="ql-table-header-right">Total</span>
    </div>
  );
}

export default function QuotesListPage() {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabstripRef = useScrollFade();
  useScrollRestore('/app/quotes');
  const [quotes, setQuotes]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter]   = useState(() => {
    const valid = ['draft','sent','viewed','revision_requested','approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid','declined','expired','needs_followup','done'];
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchQuotes = useCallback(() => {
    if (!user) return;
    setLoading(true);
    expireStaleDrafts().catch(e => console.warn('[PL]', e));
    listQuotes(user.id)
      .then(q => {
        const active = (q || []).filter(qt => !qt.archived_at);
        setQuotes(active);
        cacheQuotes(active).catch(() => {});
      })
      .catch(e => {
        console.warn('[PL]', e);
        getCachedQuotes(user.id).then(cached => {
          if (cached.length > 0) {
            setQuotes(prev => prev.length === 0 ? cached.filter(qt => !qt.archived_at) : prev);
          }
        }).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  useEffect(() => {
    try {
      if (statusFilter) sessionStorage.setItem('pl_quotes_filter', statusFilter);
      else sessionStorage.removeItem('pl_quotes_filter');
    } catch (e) { /* sessionStorage blocked */ }
  }, [statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 180);
    return () => clearTimeout(t);
  }, [search]);

  usePullToRefresh(fetchQuotes);

  async function handleArchive(quoteId) {
    try {
      await updateQuoteStatus(quoteId, { archived_at: new Date().toISOString() });
      setQuotes(prev => prev.filter(q => q.id !== quoteId));
      haptic('success');
      toast('Quote archived', 'success');
    } catch { toast('Could not archive', 'error'); }
  }

  async function handleDeleteDraft(quoteId) {
    try {
      await deleteQuote(quoteId);
      setQuotes(prev => prev.filter(q => q.id !== quoteId));
      haptic('success');
      toast('Draft deleted', 'success');
    } catch { toast('Could not delete', 'error'); }
  }

  async function handleDuplicate(e, quoteId) {
    e.preventDefault();
    e.stopPropagation();
    try {
      toast('Duplicating…', 'info');
      const full = await getQuote(quoteId);
      const copy = await duplicateQuote(user.id, full);
      haptic('success');
      navigate(`/app/quotes/${copy.id}`);
    } catch { toast('Could not duplicate', 'error'); }
  }

  function toggleSelect(e, quoteId) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(quoteId)) next.delete(quoteId); else next.add(quoteId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(q => q.id)));
  }

  async function handleBulkArchive() {
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => updateQuoteStatus(id, { archived_at: new Date().toISOString() })));
      setQuotes(prev => prev.filter(q => !selected.has(q.id)));
      setSelected(new Set());
      haptic('success');
      toast(`${ids.length} quote${ids.length > 1 ? 's' : ''} archived`, 'success');
    } catch { toast('Could not archive some quotes', 'error'); }
  }

  async function handleBulkDelete() {
    const drafts = [...selected].filter(id => quotes.find(q => q.id === id)?.status === 'draft');
    if (drafts.length === 0) { toast('Only drafts can be deleted', 'error'); return; }
    try {
      await Promise.all(drafts.map(id => deleteQuote(id)));
      setQuotes(prev => prev.filter(q => !selected.has(q.id)));
      setSelected(new Set());
      haptic('success');
      toast(`${drafts.length} draft${drafts.length > 1 ? 's' : ''} deleted`, 'success');
    } catch { toast('Could not delete some drafts', 'error'); }
  }

  async function handleBulkSend() {
    if (bulkBusy) return; // Guard against double-click → duplicate emails.
    const sendable = [...selected]
      .map(id => quotes.find(q => q.id === id))
      .filter(q => q && ['draft', 'viewed', 'revision_requested'].includes(q.status) && q.customer?.email && q.share_token);
    if (sendable.length === 0) { toast('No sendable quotes selected (need customer email and share link)', 'error'); return; }
    setBulkBusy(true);
    toast(`Sending ${sendable.length} quote${sendable.length > 1 ? 's' : ''}…`, 'info');
    let sent = 0;
    try {
      for (const q of sendable) {
        try {
          await sendQuoteEmail(q.id, q.customer.email);
          if (q.status === 'draft') {
            await updateQuoteStatus(q.id, { status: 'sent', sent_at: new Date().toISOString() });
          }
          sent++;
        } catch (e) { console.warn('[PL] bulk send failed for', q.id, e); }
      }
      if (sent > 0) {
        setQuotes(prev => prev.map(q => sendable.some(s => s.id === q.id) ? { ...q, status: q.status === 'draft' ? 'sent' : q.status, sent_at: new Date().toISOString() } : q));
        haptic('success');
      }
      setSelected(new Set());
      toast(`${sent} of ${sendable.length} quote${sendable.length > 1 ? 's' : ''} sent`, sent > 0 ? 'success' : 'error');
    } finally {
      setBulkBusy(false);
    }
  }

  const filtered = useMemo(() => {
    let result = quotes;
    if (hideCompleted) result = result.filter(q => ACTIVE_STATUSES.includes(q.status));
    if (statusFilter === 'needs_followup') {
      const threeDaysAgo = Date.now() - 3 * 86400000;
      result = result.filter(q =>
        ['viewed', 'revision_requested'].includes(q.status) ||
        (q.status === 'sent' && q.view_count > 0) ||
        (q.status === 'sent' && !q.view_count && q.sent_at && new Date(q.sent_at).getTime() < threeDaysAgo)
      );
    } else if (statusFilter === 'approved') {
      result = result.filter(q => ['approved','approved_pending_deposit'].includes(q.status));
    } else if (statusFilter === 'done') {
      result = result.filter(q => ['deposit_paid','converted_to_invoice','paid'].includes(q.status));
    } else if (statusFilter) {
      result = result.filter(q => q.status === statusFilter);
    }
    if (debouncedSearch.trim()) result = result.filter(q => matchesSearch(q, debouncedSearch.trim()));
    return sortQuotes(result, sortBy);
  }, [quotes, statusFilter, hideCompleted, debouncedSearch, sortBy]);

  // Build a summary that doesn't punish — no "0%" anywhere
  const summary = useMemo(() => {
    const total = quotes.length;
    if (total === 0) return null;

    const sent = quotes.filter(q => q.status !== 'draft').length;
    const approved = quotes.filter(q => ['approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid'].includes(q.status)).length;
    const rate = sent > 0 ? Math.round((approved / sent) * 100) : 0;

    // Only show close rate if it's meaningful (>0% and at least 2 sent)
    if (rate > 0 && sent >= 2) {
      return `${total} quote${total !== 1 ? 's' : ''} · ${rate}% close rate`;
    }
    return `${total} quote${total !== 1 ? 's' : ''}`;
  }, [quotes]);

  const isFiltered = !!statusFilter || !!search.trim() || hideCompleted;
  const filteredSummary = isFiltered
    ? `${filtered.length} of ${quotes.length} quote${quotes.length !== 1 ? 's' : ''}`
    : null;

  function toggleHideCompleted() {
    setHideCompleted(prev => {
      const next = !prev;
      try { localStorage.setItem('pl_hide_completed', next ? '1' : '0'); } catch (e) { console.warn("[PL]", e); }
      return next;
    });
  }

  return (
    <AppShell hideTitle>
      <PageHeader
        title="Quotes"
        subtitle={summary}
        actions={<Link to="/app/quotes/new" className="btn btn-primary pl-hide-mobile">New quote</Link>}
      />

      {/* ── Status tabs ── */}
      <div className="pl-tabstrip" ref={tabstripRef} role="tablist" aria-label="Filter quotes by status">
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
              {p.shortLabel
                ? <>
                    <span className="pl-tab-label-full">{p.label}</span>
                    <span className="pl-tab-label-short">{p.shortLabel}</span>
                  </>
                : p.label}
            </button>
          );
        })}
      </div>

      {/* ── Search + desktop controls ── */}
      <div className="pl-search-safe">
        <button type="button" className="ql-filter-toggle" onClick={() => setMobileFiltersOpen(p => !p)} aria-label="Sort & filter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
        </button>
        <input
          type="search"
          placeholder="Search quotes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ql-search-input input"
          aria-label="Search quotes"
        />
        <div className="ql-desktop-filters">
          <select className="input ql-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort quotes">
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <label className="ql-filter-label">
            <input type="checkbox" checked={hideCompleted} onChange={toggleHideCompleted} />
            Hide completed
          </label>
        </div>
      </div>

      {/* ── Mobile filter controls ── */}
      <div className={`ql-mobile-filters${mobileFiltersOpen ? ' --open' : ''}`}>
        <select className="input ql-sort-select-mobile" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort quotes">
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="ql-filter-label">
          <input type="checkbox" checked={hideCompleted} onChange={toggleHideCompleted} />
          Hide completed
        </label>
      </div>

      {/* ── Filtered results summary ── */}
      {!loading && quotes.length > 0 && isFiltered && (
        <div className="ql-filter-summary">
          {filteredSummary}
          <button
            type="button"
            className="btn-link ql-clear-filters"
            onClick={() => { setSearch(''); setStatusFilter(null); setHideCompleted(false); try { localStorage.removeItem('pl_hide_completed'); } catch (e) { console.warn("[PL]", e); } }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Content — stable min-height prevents layout jump when filtering ── */}
      <div className="pl-ql-container">
        {loading ? (
          <div className="pl-skel-list">
            {[...Array(5)].map((_, i) => <div key={i} className="pl-skel-row" />)}
          </div>
        ) : quotes.length === 0 ? (
          <Card padding="loose" minH="260px" className="pl-empty-card">
            <div className="pl-empty-glyph" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <h2 className="pl-empty-title font-display">No quotes yet</h2>
            <p className="pl-empty-body">Describe a job and Punchlist builds the quote in under 2 minutes.</p>
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
              <button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setStatusFilter(null); setHideCompleted(false); }}>
                Clear filters
              </button>
            </div>
          </Card>
        ) : (
          <div className="panel ql-panel-themed" style={{ padding: 0 }}>
            {/* Desktop table */}
            <div className="ql-table">
              <TableHeader selectAll={toggleSelectAll} allSelected={selected.size > 0 && selected.size === filtered.length} />
              {filtered.map(q => <QuoteRow key={q.id} quote={q} onDuplicate={handleDuplicate} isSelected={selected.has(q.id)} onToggleSelect={toggleSelect} />)}
            </div>
            {/* Mobile card list */}
            <div className="ql-cards pl-ql-list">
              {filtered.map(q => {
                // Swipe-to-archive should only appear for quotes in a
                // terminal or pre-send state. A contractor pulling on a
                // quote the customer just viewed expects to follow up,
                // not to file it away — and accidental archive of an
                // in-flight quote is hard to recover from.
                const TERMINAL = ['declined', 'expired', 'paid', 'converted_to_invoice'];
                const swipeable = q.status === 'draft' || TERMINAL.includes(q.status);
                return (
                  <div key={q.id} className="pl-ql-row-wrap">
                    <SwipeableRow
                      onSwipe={() => q.status === 'draft' ? handleDeleteDraft(q.id) : handleArchive(q.id)}
                      label={q.status === 'draft' ? 'Delete' : 'Archive'}
                      color={q.status === 'draft' ? 'var(--red, #ef4444)' : undefined}
                      disabled={!swipeable}
                    >
                      <QuoteCard quote={q} onDuplicate={handleDuplicate} />
                    </SwipeableRow>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="ql-bulk-bar">
          <span className="ql-bulk-count">{selected.size} selected</span>
          <button type="button" className="btn btn-primary btn-sm" disabled={bulkBusy} onClick={handleBulkSend}>{bulkBusy ? 'Sending…' : 'Send'}</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={bulkBusy} onClick={handleBulkArchive}>Archive</button>
          <button type="button" className="btn btn-danger btn-sm" disabled={bulkBusy} onClick={handleBulkDelete}>Delete drafts</button>
          <button type="button" className="btn-link ql-bulk-cancel" onClick={() => setSelected(new Set())}>Cancel</button>
        </div>
      )}
    </AppShell>
  );
}
