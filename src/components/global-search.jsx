import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listQuotes, listCustomers, listBookings, listInvoices } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { currency } from '../lib/format';
import { chipForStatus, toneForStatus } from '../lib/workflow';
import useScrollLock from '../hooks/use-scroll-lock';

export default function GlobalSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  const [query, setQuery] = useState('');
  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open || !user) return;
    Promise.all([
      listQuotes(user.id),
      listCustomers(user.id),
      listBookings(user.id),
      listInvoices(user.id),
    ]).then(([q, c, b, inv]) => {
      setQuotes(q || []);
      setCustomers(c || []);
      setBookings(b || []);
      setInvoices(inv || []);
    }).catch(() => {});
  }, [open, user]);

  useEffect(() => { setFocusedIdx(-1); }, [query]);

  useEffect(() => {
    function onKey(e) {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(''); setFocusedIdx(-1); }
  }, [open]);

  const q = query.trim().toLowerCase();

  const matchedQuotes = q
    ? quotes.filter(qt =>
        [qt.title, qt.customer?.name, qt.scope_summary, qt.status]
          .some(v => String(v || '').toLowerCase().includes(q))
      ).slice(0, 5)
    : quotes.slice(0, 3);

  const matchedCustomers = q
    ? customers.filter(c =>
        [c.name, c.email, c.phone].some(v => String(v || '').toLowerCase().includes(q))
      ).slice(0, 3)
    : [];

  const matchedBookings = q
    ? bookings.filter(b =>
        [b.customer?.name, b.notes, b.quote?.title, b.status]
          .some(v => String(v || '').toLowerCase().includes(q))
      ).slice(0, 3)
    : bookings.slice(0, 2);

  const matchedInvoices = q
    ? invoices.filter(inv =>
        [inv.invoice_number, inv.customer?.name, inv.title, inv.status]
          .some(v => String(v || '').toLowerCase().includes(q))
      ).slice(0, 3)
    : invoices.slice(0, 2);

  // Build flat list for keyboard navigation
  const allResults = [
    ...matchedQuotes.map(r => ({ path: `/app/quotes/${r.id}` })),
    ...matchedCustomers.map(r => ({ path: `/app/contacts?q=${encodeURIComponent(r.name)}` })),
    ...matchedBookings.map(r => ({ path: `/app/bookings?id=${r.id}` })),
    ...matchedInvoices.map(r => ({ path: `/app/invoices/${r.id}` })),
  ];

  const handleKeyDown = useCallback((e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault();
      if (allResults[focusedIdx]) go(allResults[focusedIdx].path);
    }
  }, [open, focusedIdx, allResults]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (focusedIdx < 0) return;
    const el = listRef.current?.querySelector(`[data-idx="${focusedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  function go(path) {
    setOpen(false);
    setQuery('');
    navigate(path);
  }

  if (!open) {
    return (
      <button className="search-trigger" type="button" onClick={() => setOpen(true)} aria-label="Search">
        <span className="search-trigger-icon">🔍</span>
        <span className="search-trigger-text">Search</span>
        <span className="search-trigger-hint">⌘K</span>
      </button>
    );
  }

  // Running index for keyboard focus assignment
  let ridx = -1;
  function RItem({ path, children }) {
    ridx += 1;
    const myIdx = ridx;
    const focused = focusedIdx === myIdx;
    return (
      <button
        className={`search-result-item${focused ? ' focused' : ''}`}
        type="button"
        data-idx={myIdx}
        onClick={() => go(path)}
        onMouseEnter={() => setFocusedIdx(myIdx)}
      >
        {children}
      </button>
    );
  }

  const hasAnyResults = matchedQuotes.length || matchedCustomers.length || matchedBookings.length || matchedInvoices.length;

  return (
    <div className="search-overlay" onClick={() => setOpen(false)}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-row">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search quotes, contacts, bookings, invoices…"
          />
          <button className="search-esc" type="button" onClick={() => setOpen(false)}>Esc</button>
          <button className="search-close-mobile" type="button" onClick={() => setOpen(false)} aria-label="Close search">✕</button>
        </div>

        <div className="search-results" ref={listRef}>
          {matchedQuotes.length > 0 && (
            <div className="search-section">
              <div className="search-section-label">{!q ? 'Recent quotes' : 'Quotes'}</div>
              {matchedQuotes.map(qt => (
                <RItem key={qt.id} path={`/app/quotes/${qt.id}`}>
                  <div className="search-result-main">
                    <strong>{qt.title || 'Untitled quote'}</strong>
                    <span className="muted small">{qt.customer?.name || 'No customer'}</span>
                  </div>
                  <div className="search-result-meta">
                    <span className="muted small">{currency(qt.total || 0)}</span>
                    <span className={`status-chip ${toneForStatus(qt.status)}`} style={{ fontSize: 11, padding: '2px 7px' }}>{chipForStatus(qt.status)}</span>
                  </div>
                </RItem>
              ))}
            </div>
          )}

          {matchedCustomers.length > 0 && (
            <div className="search-section">
              <div className="search-section-label">Contacts</div>
              {matchedCustomers.map(c => (
                <RItem key={c.id} path={`/app/contacts?q=${encodeURIComponent(c.name)}`}>
                  <div className="search-result-main">
                    <strong>{c.name}</strong>
                    <span className="muted small">{[c.email, c.phone].filter(Boolean).join(' · ')}</span>
                  </div>
                </RItem>
              ))}
            </div>
          )}

          {matchedBookings.length > 0 && (
            <div className="search-section">
              <div className="search-section-label">{!q ? 'Upcoming bookings' : 'Bookings'}</div>
              {matchedBookings.map(b => (
                <RItem key={b.id} path={`/app/bookings?id=${b.id}`}>
                  <div className="search-result-main">
                    <strong>{b.customer?.name || 'Booking'}</strong>
                    <span className="muted small">{b.quote?.title || b.notes || ''}</span>
                  </div>
                  <div className="search-result-meta">
                    <span className="muted small">{b.scheduled_for ? new Date(b.scheduled_for).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : ''}</span>
                    <span className={`status-chip ${b.status === 'confirmed' ? 'approved' : b.status === 'cancelled' ? 'declined' : 'sent'}`} style={{ fontSize: 11, padding: '2px 7px' }}>{b.status}</span>
                  </div>
                </RItem>
              ))}
            </div>
          )}

          {matchedInvoices.length > 0 && (
            <div className="search-section">
              <div className="search-section-label">{!q ? 'Recent invoices' : 'Invoices'}</div>
              {matchedInvoices.map(inv => (
                <RItem key={inv.id} path={`/app/invoices/${inv.id}`}>
                  <div className="search-result-main">
                    <strong>{inv.invoice_number || inv.title || 'Invoice'}</strong>
                    <span className="muted small">{inv.customer?.name || ''}</span>
                  </div>
                  <div className="search-result-meta">
                    <span className="muted small">{currency(inv.total || 0)}</span>
                    <span className={`status-chip ${inv.status === 'paid' ? 'paid' : inv.status === 'overdue' ? 'overdue' : 'sent'}`} style={{ fontSize: 11, padding: '2px 7px' }}>{inv.status}</span>
                  </div>
                </RItem>
              ))}
            </div>
          )}

          {q && !hasAnyResults && (
            <div className="search-empty">No results for "{query}"</div>
          )}

          {!q && !hasAnyResults && (
            <div className="search-hint">Type to search across quotes, contacts, bookings and invoices</div>
          )}

          {allResults.length > 0 && (
            <div style={{ padding: '6px 14px', fontSize: 11, color: 'var(--subtle)', borderTop: '1px solid var(--line)', marginTop: 4 }}>
              ↑↓ navigate · Enter select · Esc close
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
