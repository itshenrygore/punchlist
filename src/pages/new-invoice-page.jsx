import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { Card, PageHeader } from '../components/ui';
import { createStandaloneInvoice, listCustomers, listQuotes } from '../lib/api';
import { currency } from '../lib/format';
import { calculateTotals } from '../lib/pricing';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';

const EMPTY_ITEM = { name: '', quantity: 1, unit_price: 0, notes: '' };

const APPROVED_STATUSES = ['approved', 'approved_pending_deposit', 'deposit_paid'];

export default function NewInvoicePage() {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const fromQuote = location.state?.fromQuote || null;

  const [title, setTitle] = useState(fromQuote?.title || '');
  const [description, setDescription] = useState(fromQuote?.scope_summary || '');
  const [customerId, setCustomerId] = useState(fromQuote?.customer_id || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [approvedQuotes, setApprovedQuotes] = useState([]);
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [items, setItems] = useState(() => {
    if (fromQuote?.line_items?.length) {
      return fromQuote.line_items
        .filter(i => i.included !== false)
        .map(i => ({ name: i.name || '', quantity: i.quantity || 1, unit_price: i.unit_price || 0, notes: i.notes || '' }));
    }
    return [{ ...EMPTY_ITEM }];
  });
  const [discount, setDiscount] = useState(fromQuote?.discount || 0);
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date(Date.now() + 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkedQuoteId, setLinkedQuoteId] = useState(fromQuote?.id || null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      listCustomers(user.id),
      listQuotes(user.id),
    ]).then(([c, q]) => {
      setCustomers(c || []);
      setApprovedQuotes((q || []).filter(qt => APPROVED_STATUSES.includes(qt.status) && !qt.archived_at));
    }).catch(() => {});
  }, [user]);

  function prefillFromQuote(q) {
    setTitle(q.title || '');
    setDescription(q.scope_summary || '');
    setCustomerId(q.customer_id || '');
    setLinkedQuoteId(q.id);
    setDiscount(q.discount || 0);
    if (q.line_items?.length) {
      setItems(q.line_items.filter(i => i.included !== false).map(i => ({
        name: i.name || '', quantity: i.quantity || 1, unit_price: i.unit_price || 0, notes: i.notes || '',
      })));
    }
    setShowQuotePicker(false);
    toast('Pre-filled from quote', 'success');
  }

  const filteredCustomers = customerSearch.length >= 2
    ? customers.filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 8)
    : [];

  const selectedCustomer = customers.find(c => c.id === customerId);

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function addItem() {
    setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx) {
    setItems(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  }

  const totals = calculateTotals(items.map(i => ({ ...i, included: true })), 'ON', 'CA');
  const disc = Math.max(0, Number(discount || 0));
  const subtotal = totals.subtotal;
  const taxed = Math.max(0, subtotal - disc) * totals.rate;
  const total = Math.max(0, subtotal - disc) + taxed;

  async function handleSave() {
    if (!user) return;
    const validItems = items.filter(i => (i.name || '').trim());
    if (!validItems.length) { toast('Add at least one line item', 'error'); return; }
    setSaving(true);
    try {
      const invoice = await createStandaloneInvoice(user.id, {
        title: title || 'Invoice',
        description,
        items: validItems,
        discount,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        notes,
        customer_id: customerId || null,
        quote_id: linkedQuoteId || null,
      });
      toast('Invoice created', 'success');
      navigate(`/app/invoices/${invoice.id}`);
    } catch (e) {
      toast(e.message || 'Failed to create invoice', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader kicker="Invoices" title="New invoice" />

      {/* ── Create from approved quote ── */}
      {approvedQuotes.length > 0 && !linkedQuoteId && (
        <div className="inv-from-quote">
          <button type="button" className="btn btn-secondary inv-from-quote-btn" onClick={() => setShowQuotePicker(p => !p)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Create from approved quote
          </button>
          {showQuotePicker && (
            <div className="inv-quote-picker">
              {approvedQuotes.map(q => (
                <button key={q.id} type="button" className="inv-quote-option" onClick={() => prefillFromQuote(q)}>
                  <span className="inv-quote-option-title">{q.title || 'Untitled'}</span>
                  <span className="inv-quote-option-meta">
                    {q.customer?.name || ''}
                    {q.total > 0 ? ` · ${currency(q.total)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {linkedQuoteId && (
        <div className="inv-linked-banner">
          Linked to quote: <strong>{title || 'Untitled'}</strong>
          <button type="button" className="btn-link" onClick={() => setLinkedQuoteId(null)}>Unlink</button>
        </div>
      )}

      <Card padding="normal" className="inv-new-form">
        {/* Customer */}
        <div className="inv-field">
          <label className="inv-label">Customer</label>
          {selectedCustomer ? (
            <div className="inv-cust-selected">
              <span>{selectedCustomer.name}</span>
              <button type="button" className="btn-link" onClick={() => { setCustomerId(''); setCustomerSearch(''); }}>Change</button>
            </div>
          ) : (
            <div className="inv-cust-search">
              <input
                className="input"
                placeholder="Search customers…"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
              {filteredCustomers.length > 0 && (
                <div className="inv-cust-results">
                  {filteredCustomers.map(c => (
                    <button key={c.id} type="button" className="inv-cust-option" onClick={() => { setCustomerId(c.id); setCustomerSearch(''); }}>
                      {c.name}{c.email ? ` · ${c.email}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title & description */}
        <div className="inv-field">
          <label className="inv-label">Title</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Invoice title" />
        </div>
        <div className="inv-field">
          <label className="inv-label">Description</label>
          <textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
        </div>

        {/* Line items */}
        <div className="inv-field">
          <label className="inv-label">Line items</label>
          <div className="inv-items">
            {items.map((item, idx) => (
              <div key={idx} className="inv-item-row">
                <input className="input inv-item-name" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Item name" />
                <input className="input inv-item-qty" type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value) || 1)} />
                <input className="input inv-item-price" type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value) || 0)} placeholder="Price" />
                <span className="inv-item-total">{currency(item.quantity * item.unit_price)}</span>
                {items.length > 1 && (
                  <button type="button" className="btn-link inv-item-remove" onClick={() => removeItem(idx)} aria-label="Remove item">×</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="btn-link" onClick={addItem}>+ Add line item</button>
        </div>

        {/* Discount, due date, notes */}
        <div className="inv-row-2col">
          <div className="inv-field">
            <label className="inv-label">Discount ($)</label>
            <input className="input" type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} />
          </div>
          <div className="inv-field">
            <label className="inv-label">Due date</label>
            <input className="input" type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </div>
        </div>
        <div className="inv-field">
          <label className="inv-label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes" />
        </div>

        {/* Totals */}
        <div className="inv-totals">
          <div className="inv-totals-row"><span>Subtotal</span><span>{currency(subtotal)}</span></div>
          {disc > 0 && <div className="inv-totals-row"><span>Discount</span><span>-{currency(disc)}</span></div>}
          <div className="inv-totals-row"><span>Tax</span><span>{currency(taxed)}</span></div>
          <div className="inv-totals-row inv-totals-total"><span>Total</span><span>{currency(total)}</span></div>
        </div>

        <div className="inv-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/app/invoices')}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Creating…' : 'Create invoice'}
          </button>
        </div>
      </Card>
    </AppShell>
  );
}
