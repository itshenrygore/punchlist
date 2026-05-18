/* ═══════════════════════════════════════════════════════════════
   Punchlist — Customers Page
   CRM-lite: contact list, quote history, lifetime value, actions.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { usePullToRefresh } from '../hooks/use-mobile-ux';
import { listCustomers, createCustomer, updateCustomer, listQuotes, exportCustomersCSV, uploadCustomersCsvDedup } from '../lib/api';
import { currency, formatDate } from '../lib/format';
import { normalizeStatus } from '../lib/workflow';

const WON_STATUSES = ['approved','approved_pending_deposit','deposit_paid','converted_to_invoice','paid'];
const ACTIVE_STATUSES = ['sent','viewed','revision_requested','approved','approved_pending_deposit'];

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function avatarColor(name) {
  const colors = ['#E76A3C','#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#06B6D4','#84CC16'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

function CustomerRow({ customer, quotes, onClick }) {
  const cQuotes = quotes.filter(q => q.customer_id === customer.id);
  const wonQuotes = cQuotes.filter(q => WON_STATUSES.includes(normalizeStatus(q.status)));
  const activeQuotes = cQuotes.filter(q => ACTIVE_STATUSES.includes(normalizeStatus(q.status)));
  const totalWon = wonQuotes.reduce((s, q) => s + (q.total || q.subtotal || 0), 0);
  const lastQuote = [...cQuotes].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];
  const color = avatarColor(customer.name);

  return (
    <button type="button" className="cust-row" onClick={() => onClick(customer)}>
      <div className="cust-avatar" style={{ background: color }}>{initials(customer.name)}</div>
      <div className="cust-info">
        <div className="cust-name">{customer.name}</div>
        <div className="cust-contact">
          {customer.phone && <span>{customer.phone}</span>}
          {customer.phone && customer.email && <span className="cust-sep"> · </span>}
          {customer.email && <span>{customer.email}</span>}
          {!customer.phone && !customer.email && <span className="cust-muted">No contact info</span>}
        </div>
      </div>
      <div className="cust-stats">
        {totalWon > 0 ? (
          <div className="cust-stat-won">
            <span className="cust-stat-value">{currency(totalWon)}</span>
            <span className="cust-stat-label"> won</span>
          </div>
        ) : cQuotes.length > 0 ? (
          <span className="cust-stat-label">{cQuotes.length} quote{cQuotes.length !== 1 ? 's' : ''}</span>
        ) : null}
        {activeQuotes.length > 0 && (
          <span className="cust-open-badge">{activeQuotes.length} open</span>
        )}
      </div>
      <div className="cust-last pl-hide-mobile">
        {lastQuote
          ? <span className="cust-date">{formatDate(lastQuote.updated_at || lastQuote.created_at)}</span>
          : <span className="cust-muted">—</span>}
      </div>
    </button>
  );
}

function CustomerDrawer({ customer, quotes, onClose, onEdit, onNewQuote }) {
  const cQuotes = quotes.filter(q => q.customer_id === customer.id);
  const wonQuotes = cQuotes.filter(q => WON_STATUSES.includes(normalizeStatus(q.status)));
  const sent = cQuotes.filter(q => q.status !== 'draft');
  const totalWon = wonQuotes.reduce((s, q) => s + (q.total || q.subtotal || 0), 0);
  const closeRate = sent.length >= 2 ? Math.round((wonQuotes.length / sent.length) * 100) : null;
  const sorted = [...cQuotes].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  const color = avatarColor(customer.name);

  return (
    <div className="cust-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cust-drawer">
        <div className="cust-drawer-hd">
          <div className="cust-drawer-av" style={{ background: color }}>{initials(customer.name)}</div>
          <div className="cust-drawer-id">
            <h2 className="cust-drawer-name">{customer.name}</h2>
            {customer.phone && <a href={`tel:${customer.phone}`} className="cust-link">{customer.phone}</a>}
            {customer.email && <a href={`mailto:${customer.email}`} className="cust-link">{customer.email}</a>}
            {customer.address && <span className="cust-muted cust-addr">{customer.address}</span>}
          </div>
          <button type="button" className="cust-close-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {cQuotes.length > 0 && (
          <div className="cust-drawer-stats">
            <div className="cust-dstat"><div className="cust-dstat-v">{cQuotes.length}</div><div className="cust-dstat-l">Quotes</div></div>
            {totalWon > 0 && <div className="cust-dstat"><div className="cust-dstat-v">{currency(totalWon)}</div><div className="cust-dstat-l">Won</div></div>}
            {closeRate !== null && <div className="cust-dstat"><div className="cust-dstat-v">{closeRate}%</div><div className="cust-dstat-l">Close rate</div></div>}
          </div>
        )}

        <div className="cust-drawer-actions">
          <button type="button" className="btn btn-primary" onClick={onNewQuote}>+ New quote</button>
          {customer.phone && <a href={`sms:${customer.phone}`} className="btn btn-secondary">Text</a>}
          {customer.email && <a href={`mailto:${customer.email}`} className="btn btn-secondary">Email</a>}
          <button type="button" className="btn btn-ghost" onClick={onEdit}>Edit</button>
        </div>

        {customer.notes && (
          <div className="cust-drawer-notes">
            <div className="cust-section-lbl">Notes</div>
            <p className="cust-notes-text">{customer.notes}</p>
          </div>
        )}

        <div className="cust-drawer-quotes">
          <div className="cust-section-lbl">{sorted.length > 0 ? `${sorted.length} quote${sorted.length !== 1 ? 's' : ''}` : 'No quotes yet'}</div>
          {sorted.map(q => {
            const st = normalizeStatus(q.status);
            return (
              <Link key={q.id} to={`/app/quotes/${q.id}`} className="cust-q-row" onClick={onClose}>
                <div className="cust-q-info">
                  <span className="cust-q-title">{q.title || 'Untitled quote'}</span>
                  <span className="cust-q-date">{formatDate(q.updated_at || q.created_at)}</span>
                </div>
                <div className="cust-q-right">
                  {(q.total || q.subtotal) > 0 && <span className="cust-q-amt">{currency(q.total || q.subtotal)}</span>}
                  <span className={`chip chip-${st}`}>{st.replace(/_/g, ' ')}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CustomerModal({ customer, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    notes: customer?.notes || '',
  });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div className="cust-overlay cust-overlay--modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cust-modal">
        <div className="cust-modal-hd">
          <h3 className="cust-modal-title">{customer ? 'Edit customer' : 'Add customer'}</h3>
          <button type="button" className="cust-close-btn" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
          <div className="cust-modal-body">
            <label className="label">Name <span className="req">*</span></label>
            <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
            <label className="label">Phone</label>
            <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 555-5555" />
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Job site or home address" />
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes…" />
          </div>
          <div className="cust-modal-ft">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : customer ? 'Save changes' : 'Add customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([listCustomers(user.id), listQuotes(user.id)])
      .then(([c, q]) => {
        setCustomers((c || []).filter(x => !x.archived_at));
        setQuotes((q || []).filter(x => !x.archived_at));
      })
      .catch(e => console.warn('[PL]', e))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);
  usePullToRefresh(load);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aQ = quotes.filter(q => q.customer_id === a.id);
      const bQ = quotes.filter(q => q.customer_id === b.id);
      const aLast = aQ.length ? Math.max(...aQ.map(q => new Date(q.updated_at || q.created_at))) : new Date(a.created_at);
      const bLast = bQ.length ? Math.max(...bQ.map(q => new Date(q.updated_at || q.created_at))) : new Date(b.created_at);
      return bLast - aLast;
    });
  }, [filtered, quotes]);

  const stats = useMemo(() => {
    const wonRevenue = quotes
      .filter(q => WON_STATUSES.includes(normalizeStatus(q.status)))
      .reduce((s, q) => s + (q.total || q.subtotal || 0), 0);
    return { total: customers.length, wonRevenue };
  }, [customers, quotes]);

  async function handleSave(form) {
    setSaving(true);
    try {
      if (editingCustomer) {
        const updated = await updateCustomer(editingCustomer.id, form);
        setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
        if (selectedCustomer?.id === updated.id) setSelectedCustomer(updated);
        toast('Customer updated', 'success');
      } else {
        const created = await createCustomer(user.id, form);
        setCustomers(prev => [created, ...prev]);
        toast('Customer added', 'success');
      }
      setShowModal(false);
      setEditingCustomer(null);
    } catch (e) {
      toast(e?.message || 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(c) {
    setEditingCustomer(c);
    setSelectedCustomer(null);
    setShowModal(true);
  }

  function openNewQuote(c) {
    setSelectedCustomer(null);
    navigate('/app/quotes/new', { state: { customer: c } });
  }

  async function handleImportCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const { inserted, skipped } = await uploadCustomersCsvDedup(user.id, file);
      const skipMsg = skipped > 0 ? ` (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)` : '';
      toast(`${inserted} customer${inserted !== 1 ? 's' : ''} imported${skipMsg}`, 'success');
      load();
    } catch (err) {
      toast(err?.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <AppShell>
      <div className="cust-root">
        <div className="cust-page-hd">
          <div>
            <h1 className="cust-page-title font-display">Customers</h1>
            {!loading && (
              <p className="cust-page-sub">
                {stats.total} customer{stats.total !== 1 ? 's' : ''}
                {stats.wonRevenue > 0 && ` · ${currency(stats.wonRevenue)} revenue tracked`}
              </p>
            )}
          </div>
          <div className="cust-page-hd-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => exportCustomersCSV(customers)}
              disabled={customers.length === 0}
            >
              Export
            </button>
            <label className="btn btn-ghost cust-import-label" title="Import customers from CSV (name, phone, email, address columns)">
              {importing ? 'Importing…' : 'Import CSV'}
              <input hidden type="file" accept=".csv,text/csv" onChange={handleImportCSV} disabled={importing} />
            </label>
            <button type="button" className="btn btn-primary" onClick={() => { setEditingCustomer(null); setShowModal(true); }}>
              + Add
            </button>
          </div>
        </div>

        <div className="cust-search-row">
          <div className="cust-search-wrap">
            <svg className="cust-search-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" className="input cust-search" placeholder="Search by name, phone, or email…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="cust-skel-list">{[...Array(6)].map((_, i) => <div key={i} className="cust-skel-row" />)}</div>
        ) : customers.length === 0 ? (
          <div className="cust-empty">
            <div className="cust-empty-ic">👥</div>
            <h2 className="cust-empty-title font-display">No customers yet</h2>
            <p className="cust-empty-body">Customers are added automatically when you create a quote, or add them manually.</p>
            <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>Add your first customer</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cust-empty">
            <div className="cust-empty-ic">🔍</div>
            <h2 className="cust-empty-title font-display">No results</h2>
            <p className="cust-empty-body">No customers match "{search}".</p>
            <button type="button" className="btn btn-secondary" onClick={() => setSearch('')}>Clear</button>
          </div>
        ) : (
          <div className="panel cust-list">
            <div className="cust-list-hd">
              <span>Customer</span>
              <span className="cust-list-hd-val">Value</span>
              <span className="cust-list-hd-last pl-hide-mobile">Last activity</span>
            </div>
            {sorted.map(c => (
              <CustomerRow key={c.id} customer={c} quotes={quotes} onClick={setSelectedCustomer} />
            ))}
          </div>
        )}
      </div>

      {selectedCustomer && (
        <CustomerDrawer
          customer={selectedCustomer}
          quotes={quotes}
          onClose={() => setSelectedCustomer(null)}
          onEdit={() => openEdit(selectedCustomer)}
          onNewQuote={() => openNewQuote(selectedCustomer)}
        />
      )}

      {showModal && (
        <CustomerModal
          customer={editingCustomer}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingCustomer(null); }}
          saving={saving}
        />
      )}
    </AppShell>
  );
}
