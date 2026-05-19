import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listQuotes, listCustomers } from '../lib/api';
import { listInvoices } from '../lib/api/invoices';
import { currency, formatQuoteNumber } from '../lib/format';
import { chipForStatus } from '../lib/workflow';
import { useAuth } from '../hooks/use-auth';

const ICONS = {
  quote: '📄', customer: '👤', invoice: '🧾', action: '⚡',
};

const QUICK_ACTIONS = [
  { id: 'new-quote', label: 'New quote', icon: ICONS.action, path: '/app/quotes/new' },
  { id: 'new-invoice', label: 'New invoice', icon: ICONS.action, path: '/app/invoices/new' },
  { id: 'schedule', label: 'View schedule', icon: ICONS.action, path: '/app/schedule' },
  { id: 'analytics', label: 'Analytics', icon: ICONS.action, path: '/app/analytics' },
  { id: 'settings', label: 'Settings', icon: ICONS.action, path: '/app/settings' },
  { id: 'templates', label: 'Templates', icon: ICONS.action, path: '/app/templates' },
];

export default function CommandPalette({ open, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  // Track which user's data is currently in state. If the user changes
  // (logout + login in the same tab), we'd otherwise show user A's
  // quotes/customers to user B because `loaded` would still be true.
  const [loadedForUserId, setLoadedForUserId] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    if (loadedForUserId !== user.id) {
      // Clear stale results from the previous user.
      setQuotes([]); setCustomers([]); setInvoices([]);
    }
    if (!open || loadedForUserId === user.id) return;
    const myUserId = user.id;
    Promise.all([
      listQuotes(myUserId).catch(() => []),
      listCustomers(myUserId).catch(() => []),
      listInvoices(myUserId).catch(() => []),
    ]).then(([q, c, i]) => {
      // Discard the response if the user switched while we were fetching.
      if (user.id !== myUserId) return;
      setQuotes(q || []);
      setCustomers(c || []);
      setInvoices(i || []);
      setLoadedForUserId(myUserId);
    });
  }, [open, user, loadedForUserId]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return QUICK_ACTIONS.map(a => ({ ...a, type: 'action' }));

    const items = [];
    for (const qt of quotes) {
      const text = `${qt.title || ''} ${qt.customer?.name || ''} ${qt.quote_number || ''}`.toLowerCase();
      if (text.includes(q)) {
        items.push({
          id: `q-${qt.id}`, type: 'quote', icon: ICONS.quote,
          label: qt.title || 'Untitled quote',
          detail: `${qt.customer?.name || ''} · ${chipForStatus(qt.status)} · ${currency(qt.total || 0)}`,
          path: `/app/quotes/${qt.id}`,
        });
      }
    }
    for (const c of customers) {
      const text = `${c.name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase();
      if (text.includes(q)) {
        items.push({
          id: `c-${c.id}`, type: 'customer', icon: ICONS.customer,
          label: c.name || 'Unnamed',
          detail: [c.phone, c.email].filter(Boolean).join(' · '),
          path: `/app/customers`,
        });
      }
    }
    for (const inv of invoices) {
      const text = `${inv.title || ''} ${inv.customer?.name || ''} ${inv.invoice_number || ''}`.toLowerCase();
      if (text.includes(q)) {
        items.push({
          id: `i-${inv.id}`, type: 'invoice', icon: ICONS.invoice,
          label: inv.title || 'Invoice',
          detail: `${inv.customer?.name || ''} · ${currency(inv.total || 0)}`,
          path: `/app/invoices/${inv.id}`,
        });
      }
    }
    for (const a of QUICK_ACTIONS) {
      if (a.label.toLowerCase().includes(q)) items.push({ ...a, type: 'action' });
    }
    return items.slice(0, 12);
  }, [query, quotes, customers, invoices]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  const go = useCallback((item) => {
    if (!item) return;
    onClose();
    if (item.quoteId && item.action === 'nudge') {
      sessionStorage.setItem('pl_cmdk_intent', JSON.stringify({ kind: 'nudge', quoteId: item.quoteId, at: Date.now() }));
    }
    navigate(item.path);
  }, [navigate, onClose]);

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[selectedIdx]); }
    else if (e.key === 'Escape') { onClose(); }
  }

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk-dialog" onClick={e => e.stopPropagation()}>
        <div className="cmdk-input-wrap">
          <svg className="cmdk-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search quotes, customers, invoices…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cmdk-kbd">esc</kbd>
        </div>
        <div className="cmdk-results">
          {results.length === 0 && <div className="cmdk-empty">No results</div>}
          {results.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`cmdk-item${idx === selectedIdx ? ' cmdk-item--active' : ''}`}
              onClick={() => go(item)}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <span className="cmdk-item-icon">{item.icon}</span>
              <div className="cmdk-item-body">
                <span className="cmdk-item-label">{item.label}</span>
                {item.detail && <span className="cmdk-item-detail">{item.detail}</span>}
              </div>
              <span className="cmdk-item-type">{item.type}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
