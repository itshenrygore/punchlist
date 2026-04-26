import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import AppShell from '../components/app-shell';
import { InvoiceDetailSkeleton } from '../components/skeletons';
import StatusBadge from '../components/status-badge';
import ConfirmModal from '../components/confirm-modal';
import { getInvoice, getProfile, friendly, markInvoicePaid, updateInvoiceStatus, updateInvoice, listPayments, recordPayment, deletePayment, getInvoiceBalance, updateInvoiceReminders, checkAndSendReminder, sendInvoiceEmail } from '../lib/api';
import { currency, formatDate } from '../lib/format';
import { calculateTotals } from '../lib/pricing';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { smsNotify } from '../lib/sms';

const CA_PAYMENT_METHODS = ['E-Transfer', 'Cash', 'Cheque', 'Credit Card', 'Square', 'PayPal', 'Other'];
const US_PAYMENT_METHODS = ['Cash', 'Check', 'Venmo', 'Zelle', 'ACH Transfer', 'Square', 'PayPal', 'Credit Card', 'Other'];
const REMINDER_OPTIONS = [
  { value: 7, label: '7 days overdue' },
  { value: 14, label: '14 days overdue' },
  { value: 30, label: '30 days overdue' },
];

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const { user } = useAuth();
  const { show: toast } = useToast();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payMethod, setPayMethod] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);
  const [country, setCountry] = useState('CA');
  const [profile, setProfile] = useState(null);

  // 5A: Edit mode
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editDueAt, setEditDueAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // 5E: Partial payments
  const [payments, setPayments] = useState([]);
  const [showPartialForm, setShowPartialForm] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialMethod, setPartialMethod] = useState('');
  const [partialNotes, setPartialNotes] = useState('');
  const [partialSaving, setPartialSaving] = useState(false);

  // 5C: Reminders
  const [reminderSchedule, setReminderSchedule] = useState([]);

  // Phase 4: ConfirmModal state for delete payment
  const [deletePaymentId, setDeletePaymentId] = useState(null);

  useEffect(() => {
    if (!invoiceId) return;
    Promise.all([
      getInvoice(invoiceId),
      listPayments(invoiceId),
    ])
      .then(([data, pays]) => {
        setInvoice(data);
        setPayments(pays || []);
        setReminderSchedule(data?.reminder_schedule || []);
      })
      .catch(e => toast(friendly(e), 'error'))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then(p => {
      if (p?.country) setCountry(p.country);
      setProfile(p);
    }).catch(e => console.warn('[PL]', e));
  }, [user]);

  // 5C: Check for due reminders on load
  useEffect(() => {
    if (!invoice || !profile) return;
    checkAndSendReminder({ ...invoice, customer: invoice.customer }, profile)
      .then(day => { if (day) toast(`Reminder sent (${day}-day overdue)`, 'success'); })
      .catch(e => console.warn('[PL]', e));
  }, [invoice?.id, profile?.id]);

  async function handleMarkPaid() {
    setPaying(true);
    try {
      const updated = await markInvoicePaid(invoice.id, payMethod || null);
      setInvoice(p => ({ ...p, ...updated, status: 'paid', paid_at: updated.paid_at }));
      setShowPayForm(false);
      toast('Invoice marked as paid', 'success');
    } catch (e) { toast(friendly(e), 'error'); }
    finally { setPaying(false); }
  }

  async function handleSend() {
    // Mark as sent in DB
    try {
      const updated = await updateInvoiceStatus(invoice.id, { status: 'sent' });
      setInvoice(p => ({ ...p, ...updated }));
    } catch (e) { toast(friendly(e), 'error'); return; }
  }

  async function handleSendEmail() {
    await handleSend();
    const customerEmail = invoice.customer?.email;
    if (!customerEmail) { toast('No email on file for this customer', 'error'); return; }
    const firstName = invoice.customer?.name?.split(' ')[0] || '';
    const compName = profile?.company_name || profile?.full_name || '';
    const phone = profile?.phone || '';
    const balance = getInvoiceBalance(invoice, payments);

    // ── Primary: send branded HTML invoice email via Resend ──
    let resendSent = false;
    try {
      await sendInvoiceEmail({ invoice, profile, payments });
      resendSent = true;
      toast('Invoice emailed to ' + (firstName || customerEmail), 'success');
      // 9B: SMS — notify customer that invoice is ready
      if (invoice.customer?.phone && invoice.share_token) {
        smsNotify.invoiceReady({
          to: invoice.customer.phone,
          contractorName: compName || 'Your contractor',
          invoiceTitle: (invoice.title || invoice.invoice_number || 'your invoice').slice(0, 40),
          total: getInvoiceBalance(invoice, payments),
          shareToken: invoice.share_token,
          country: invoice.country || profile?.country,
        });
      }
    } catch (emailErr) {
      console.warn('[Punchlist] Resend invoice email failed, falling back to mailto:', emailErr.message);
    }

    // Fallback: open native email client
    if (!resendSent) {
      const url = `${window.location.origin}/public/invoice/${invoice.share_token}`;
      const dueStr = invoice.due_at ? new Date(invoice.due_at).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
      const subject = encodeURIComponent(`Invoice: ${invoice.title || invoice.invoice_number || 'Your invoice'} — ${compName}`);
      const body = encodeURIComponent(
        `Hi${firstName ? ' ' + firstName : ''},\n\n` +
        `Here's your invoice for ${invoice.title || 'services rendered'}.\n\n` +
        `Amount due: ${currency(balance)}\n` +
        (dueStr ? `Due date: ${dueStr}\n` : '') +
        `\nView and pay here:\n${url}\n\n` +
        `${compName}${phone ? '\n' + phone : ''}`
      );
      window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`;
      toast('Opening email…', 'info');
    }
  }

  async function handleSendText() {
    await handleSend();
    const phone = invoice.customer?.phone;
    if (!phone) { toast('No phone on file for this customer', 'error'); return; }
    const firstName = invoice.customer?.name?.split(' ')[0] || '';
    const compName = profile?.company_name || profile?.full_name || '';
    const balance = getInvoiceBalance(invoice, payments);
    const url = `${window.location.origin}/public/invoice/${invoice.share_token}`;
    const msgBody = `Hi${firstName ? ' ' + firstName : ''}, your invoice from ${compName} for ${currency(balance)} is ready: ${url}`;
    // Auto-send via Twilio
    const result = await smsNotify.customMessage({ to: phone, body: msgBody });
    if (result?.ok) {
      toast(`Invoice texted to ${firstName || phone}`, 'success');
    } else {
      const smsBody = encodeURIComponent(msgBody);
      window.open(`sms:${phone}?body=${smsBody}`, '_self');
      toast('Opening messages…', 'info');
    }
  }

  async function handleSendCopy() {
    await handleSend();
    const url = `${window.location.origin}/public/invoice/${invoice.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Invoice link copied', 'success');
    } catch {
      toast('Invoice link: ' + url, 'info');
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/public/invoice/${invoice.share_token}`;
    try { await navigator.clipboard.writeText(url); toast('Link copied', 'success'); }
    catch { toast('Could not copy — share this link: ' + url, 'info'); }
  }

  // ── 5A: Edit mode ──
  function startEditing() {
    const items = (invoice.invoice_items || []).filter(i => i.included !== false);
    setEditItems(items.map(i => ({ ...i })));
    setEditDiscount(Number(invoice.discount || 0));
    setEditDueAt(invoice.due_at ? invoice.due_at.slice(0, 10) : '');
    setEditNotes(invoice.notes || '');
    setEditTitle(invoice.title || '');
    setEditDescription(invoice.description || '');
    setEditing(true);
  }

  function addEditItem() {
    setEditItems(prev => [...prev, { id: `new-${Date.now()}`, name: '', quantity: 1, unit_price: 0, notes: '', category: null }]);
  }

  function removeEditItem(idx) {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateEditItem(idx, field, value) {
    setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function saveEdits() {
    setSaving(true);
    try {
      await updateInvoice(invoice.id, {
        title: editTitle,
        description: editDescription,
        items: editItems,
        discount: editDiscount,
        due_at: editDueAt ? new Date(editDueAt + 'T12:00:00').toISOString() : invoice.due_at,
        notes: editNotes,
        province: invoice.province || 'ON',
        country: invoice.country || 'CA',
      });
      const fresh = await getInvoice(invoice.id);
      setInvoice(fresh);
      setEditing(false);
      toast('Invoice updated', 'success');
    } catch (e) { toast(friendly(e), 'error'); }
    finally { setSaving(false); }
  }

  const editTotals = editing ? (() => {
    const t = calculateTotals(editItems.map(i => ({ ...i, included: true })), invoice.province || 'ON', invoice.country || 'CA');
    const disc = Math.max(0, Number(editDiscount || 0));
    const ds = Math.max(0, t.subtotal - disc);
    const dt = ds * t.rate;
    return { subtotal: t.subtotal, tax: dt, total: ds + dt, discount: disc };
  })() : null;

  // ── 5E: Partial payment ──
  async function handleRecordPartial() {
    const amt = Number(partialAmount);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    setPartialSaving(true);
    try {
      const payment = await recordPayment(user.id, invoice.id, {
        amount: amt,
        method: partialMethod || null,
        notes: partialNotes || null,
      });
      setPayments(prev => [...prev, payment]);
      const fresh = await getInvoice(invoice.id);
      setInvoice(fresh);
      setShowPartialForm(false);
      setPartialAmount('');
      setPartialMethod('');
      setPartialNotes('');
      toast('Payment recorded', 'success');
    } catch (e) { toast(friendly(e), 'error'); }
    finally { setPartialSaving(false); }
  }

  async function handleDeletePayment(paymentId) {
    setDeletePaymentId(paymentId);
  }

  async function confirmDeletePayment() {
    const paymentId = deletePaymentId;
    setDeletePaymentId(null);
    try {
      await deletePayment(paymentId, invoice.id);
      setPayments(prev => prev.filter(p => p.id !== paymentId));
      const fresh = await getInvoice(invoice.id);
      setInvoice(fresh);
      toast('Payment deleted', 'success');
    } catch (e) { toast(friendly(e), 'error'); }
  }

  // ── 5C: Reminder toggle ──
  async function toggleReminder(day) {
    const next = reminderSchedule.includes(day)
      ? reminderSchedule.filter(d => d !== day)
      : [...reminderSchedule, day].sort((a, b) => a - b);
    setReminderSchedule(next);
    try {
      await updateInvoiceReminders(invoice.id, next);
      toast(next.includes(day) ? `Reminder at ${day} days enabled` : `Reminder at ${day} days disabled`, 'success');
    } catch (e) { toast(friendly(e), 'error'); }
  }

  if (loading) return <InvoiceDetailSkeleton />;
  if (!invoice) return <AppShell title="Invoice"><div className="empty-state">Invoice not found.</div></AppShell>;

  const items = (invoice.invoice_items || []).filter(i => i.included !== false);
  const isPaid = invoice.status === 'paid';
  const isOverdue = invoice.due_at && new Date(invoice.due_at) < new Date() && !isPaid && invoice.status !== 'cancelled';
  const hasAdditionalWork = items.some(i => i.category === 'Additional Work');
  const groupedItems = items.reduce((acc, item) => {
    const key = item.category === 'Additional Work' ? 'Additional Work' : 'Original Work';
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});
  const customerUrl = `${window.location.origin}/public/invoice/${invoice.share_token}`;
  const balance = getInvoiceBalance(invoice, payments);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const isPartial = invoice.status === 'partial' || (totalPaid > 0 && !isPaid);
  const depositCredited = Number(invoice.deposit_credited || 0);

  return (
    <AppShell title={`Invoice ${invoice.invoice_number || ''}`} actions={
      invoice.quote_id ? <Link className="btn btn-secondary btn-sm" to={`/app/quotes/${invoice.quote_id}`}>View quote</Link> : null
    }>
      <div className="inv-layout">
        {/* ── Invoice document ── */}
        <div className="inv-doc">
          {editing ? (
            <div>
              <div className="id-edit-header">
                <h2 className="id-edit-title">Edit Invoice</h2>
                <div className="id-edit-actions">
                  <button className="btn btn-primary btn-sm" type="button" disabled={saving} onClick={saveEdits}>{saving ? 'Saving…' : 'Save changes'}</button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
              <div className="id-edit-fields">
                <div><span className="field-label">Title</span><input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
                <div><span className="field-label">Description</span><textarea className="input textarea-sm" value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} /></div>
                <div className="id-edit-row-2col">
                  <div><span className="field-label">Due date</span><input className="input" type="date" value={editDueAt} onChange={e => setEditDueAt(e.target.value)} /></div>
                  <div><span className="field-label">Discount ($)</span><input className="input" type="number" min="0" step="1" value={editDiscount} onChange={e => setEditDiscount(Number(e.target.value))} /></div>
                </div>
              </div>
              <div className="id-edit-items">
                <div className="inv-edit-header id-edit-grid-header">
                  <span>Item</span><span className="id-edit-input-right">Qty</span><span className="id-edit-input-right">Price</span><span/>
                </div>
                {editItems.map((item, idx) => (
                  <div key={item.id || idx} className="inv-edit-row id-edit-item-row">
                    <input className="input input--dense id-edit-input-min" value={item.name} onChange={e => updateEditItem(idx, 'name', e.target.value)} placeholder="Item name" />
                    <input className="input input--dense id-edit-input-right" type="number" min="0" step="0.25" value={item.quantity} onChange={e => updateEditItem(idx, 'quantity', e.target.value)} />
                    <input className="input input--dense id-edit-input-right" type="number" min="0" step="1" value={item.unit_price} onChange={e => updateEditItem(idx, 'unit_price', e.target.value)} />
                    <button className="btn btn-secondary btn--xs" type="button" onClick={() => removeEditItem(idx)} className="id-edit-remove" aria-label="Remove item"><X size={12} /></button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" type="button" onClick={addEditItem} className="id-edit-add-btn">+ Add item</button>
              </div>
              {editTotals && (
                <div className="inv-totals id-edit-totals">
                  <div className="inv-total-row"><span>Subtotal</span><span>{currency(editTotals.subtotal)}</span></div>
                  {editTotals.discount > 0 && <div className="inv-total-row"><span>Discount</span><span className="id-color-red">−{currency(editTotals.discount)}</span></div>}
                  <div className="inv-total-row"><span>Tax ({invoice.province})</span><span>{currency(editTotals.tax)}</span></div>
                  <div className="inv-total-row inv-grand"><span>Total</span><span>{currency(editTotals.total)}</span></div>
                </div>
              )}
              <div className="id-edit-notes"><span className="field-label">Notes</span><textarea className="input textarea-sm" value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} /></div>
            </div>
          ) : (
            <>
              <div className="inv-doc-header">
                <div>
                  <div className="inv-doc-number">{invoice.invoice_number}</div>
                  <div className="inv-doc-title">{invoice.title || 'Invoice'}</div>
                </div>
                <StatusBadge status={isOverdue && !isPaid ? 'overdue' : invoice.status} />
              </div>
              <div className="inv-meta-grid">
                <div className="inv-meta-block">
                  <div className="inv-meta-label">BILL TO</div>
                  {invoice.customer ? (
                    <div>
                      <div className="inv-meta-name">{invoice.customer.name}</div>
                      {invoice.customer.email && <div className="inv-meta-sub">{invoice.customer.email}</div>}
                      {invoice.customer.phone && <div className="inv-meta-sub">{invoice.customer.phone}</div>}
                      {invoice.customer.address && <div className="inv-meta-sub">{invoice.customer.address}</div>}
                    </div>
                  ) : <div className="inv-meta-sub">No customer linked</div>}
                </div>
                <div className="inv-meta-block">
                  <div className="inv-meta-label">DETAILS</div>
                  <div className="inv-meta-row"><span>Issued</span><span>{formatDate(invoice.issued_at)}</span></div>
                  <div className="inv-meta-row"><span>Due</span><span className={isOverdue && !isPaid ? 'inv-overdue' : ''}>{formatDate(invoice.due_at)}</span></div>
                  {isPaid && <div className="inv-meta-row"><span>Paid</span><span className="inv-paid-date">{formatDate(invoice.paid_at)}</span></div>}
                  {invoice.payment_method && <div className="inv-meta-row"><span>Method</span><span>{invoice.payment_method}</span></div>}
                </div>
              </div>
              {invoice.description && <div className="inv-description">{invoice.description}</div>}
              <div className="inv-items">
                <div className="inv-items-header">
                  <span className="inv-col-name">Item</span>
                  <span className="inv-col-qty">Qty</span>
                  <span className="inv-col-price">Price</span>
                  <span className="inv-col-total">Total</span>
                </div>
                {hasAdditionalWork ? (
                  Object.entries(groupedItems).map(([group, groupItems]) => (
                    <div key={group}>
                      <div className={`id-group-header ${group === 'Additional Work' ? 'id-group-header--additional' : 'id-group-header--original'}`}>
                        {group === 'Additional Work' ? '+ Approved additional work' : group}
                      </div>
                      {groupItems.map((item, i) => (
                        <div key={item.id || i} className="inv-item-row">
                          <div className="inv-col-name">
                            <div className="inv-item-name">{item.name}</div>
                            {item.notes && <div className="inv-item-note">{item.notes}</div>}
                          </div>
                          <span className="inv-col-qty">{item.quantity}</span>
                          <span className="inv-col-price">{currency(item.unit_price)}</span>
                          <span className="inv-col-total">{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}</span>
                        </div>
                      ))}
                    </div>
                  ))
                ) : items.length > 0 ? (
                  items.map((item, i) => (
                    <div key={item.id || i} className="inv-item-row">
                      <div className="inv-col-name">
                        <div className="inv-item-name">{item.name}</div>
                        {item.notes && <div className="inv-item-note">{item.notes}</div>}
                      </div>
                      <span className="inv-col-qty">{item.quantity}</span>
                      <span className="inv-col-price">{currency(item.unit_price)}</span>
                      <span className="inv-col-total">{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}</span>
                    </div>
                  ))
                ) : (
                  <div className="id-items-empty">Line items included in total above.</div>
                )}
              </div>
              <div className="inv-totals">
                <div className="inv-total-row"><span>Subtotal</span><span>{currency(invoice.subtotal)}</span></div>
                {Number(invoice.discount || 0) > 0 && <div className="inv-total-row"><span>Discount</span><span className="id-color-red">−{currency(invoice.discount)}</span></div>}
                <div className="inv-total-row"><span>Tax ({invoice.province})</span><span>{currency(invoice.tax)}</span></div>
                {depositCredited > 0 && <div className="inv-total-row"><span>Deposit credited</span><span className="id-color-green">−{currency(depositCredited)}</span></div>}
                <div className="inv-total-row inv-grand"><span>Total</span><span>{currency(invoice.total)}</span></div>
                {totalPaid > 0 && !isPaid && (
                  <>
                    <div className="inv-total-row id-color-green"><span>Paid</span><span>−{currency(totalPaid)}</span></div>
                    <div className="inv-total-row inv-grand id-color-brand"><span>Balance</span><span>{currency(balance)}</span></div>
                  </>
                )}
              </div>
              {isPaid && <div className="inv-paid-stamp">PAID</div>}
              {invoice.notes && <div className="inv-notes"><strong>Notes:</strong> {invoice.notes}</div>}
              {payments.length > 0 && (
                <div className="id-pay-history">
                  <div className="id-pay-history-label">Payment History</div>
                  {payments.map(p => (
                    <div key={p.id} className="id-pay-row">
                      <div>
                        <span className="id-pay-amount">{currency(p.amount)}</span>
                        {p.method && <span className="id-pay-method">via {p.method}</span>}
                        <span className="id-pay-date">{formatDate(p.paid_at)}</span>
                        {p.notes && <div className="id-pay-notes">{p.notes}</div>}
                      </div>
                      {!isPaid && (
                        <button className="btn btn-secondary btn-sm inv-payment-delete" type="button" onClick={() => handleDeletePayment(p.id)} className="id-pay-delete" aria-label="Delete payment">×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Sidebar actions ── */}
        <aside className="inv-sidebar">
          <div className="qb-card">
            <span className="qb-label">Status</span>
            <div className="id-status-wrap">
              <StatusBadge status={isOverdue && !isPaid ? 'overdue' : invoice.status} />
            </div>
            {isPaid && (
              <div className="inv-paid-confirm">
                ✓ Paid {invoice.paid_at ? formatDate(invoice.paid_at) : ''}
                {invoice.payment_method ? ` via ${invoice.payment_method}` : ''}
              </div>
            )}
            {isPartial && !isPaid && (
              <div className="id-partial-info">
                {currency(totalPaid)} of {currency(invoice.total)} paid · {currency(balance)} remaining
              </div>
            )}
          </div>

          <div className="qb-card">
            <span className="qb-label">Actions</span>
            <div className="qd-send-grid">
              {!isPaid && !editing && (
                <>
                  <div className="id-send-row">
                    {invoice.customer?.phone && (
                      <button className="btn btn-primary" type="button" className="id-mobile-btn" onClick={handleSendText}>
                        {['sent','viewed','partial','overdue'].includes(invoice.status) ? 'Resend text' : 'Text invoice'}
                      </button>
                    )}
                    <button className="btn btn-secondary" type="button" style={{ flex: invoice.customer?.phone ? 0 : 1, padding: '10px 14px' }} onClick={handleSendCopy} aria-label="Copy link" title="Copy link">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      {!invoice.customer?.phone && <span className="id-send-link-label">Copy link</span>}
                    </button>
                  </div>
                  {invoice.status !== 'draft' && (
                    <div className="id-sent-date">
                      Sent {formatDate(invoice.issued_at || invoice.updated_at)}
                    </div>
                  )}
                  <button className="btn btn-secondary full-width" type="button" onClick={() => {
                    window.location.href = `/api/export-pdf?invoice_token=${invoice.share_token}`;
                  }}>Download PDF</button>
                  <a href={customerUrl} target="_blank" rel="noreferrer" className="qd-share-link id-preview-link">Preview customer view ↗</a>
                  <button className="btn btn-secondary full-width" type="button" onClick={startEditing} className="id-edit-btn">
                    Edit invoice
                  </button>
                  {!showPartialForm && !showPayForm ? (
                    <div className="id-pay-grid">
                      <button className="btn btn-secondary full-width" type="button" onClick={() => setShowPartialForm(true)} className="id-record-btn">
                        Record payment
                      </button>
                      <button className="btn btn-secondary full-width" type="button" onClick={() => setShowPayForm(true)} className="id-mark-paid-btn">
                        Mark fully paid
                      </button>
                    </div>
                  ) : showPayForm ? (
                    <div className="inv-pay-form">
                      <select className="qb-inp" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                        <option value="">Payment method (optional)</option>
                        {(country === 'US' ? US_PAYMENT_METHODS : CA_PAYMENT_METHODS).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <div className="id-pay-grid-2">
                        <button className="btn btn-primary btn-sm" type="button" disabled={paying} onClick={handleMarkPaid}>
                          {paying ? 'Saving…' : 'Confirm paid'}
                        </button>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowPayForm(false)}>Cancel</button>
                      </div>
                    </div>
                  ) : showPartialForm ? (
                    <div className="inv-pay-form">
                      <div className="id-partial-header">Record Payment</div>
                      <input className="qb-inp" type="number" min="0" step="1" placeholder={`Amount (balance: ${currency(balance)})`} value={partialAmount} onChange={e => setPartialAmount(e.target.value)} autoFocus />
                      <select className="qb-inp" value={partialMethod} onChange={e => setPartialMethod(e.target.value)}>
                        <option value="">Payment method (optional)</option>
                        {(country === 'US' ? US_PAYMENT_METHODS : CA_PAYMENT_METHODS).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input className="qb-inp" placeholder="Notes (optional)" value={partialNotes} onChange={e => setPartialNotes(e.target.value)} />
                      <div className="id-pay-grid-2">
                        <button className="btn btn-primary btn-sm" type="button" disabled={partialSaving} onClick={handleRecordPartial}>
                          {partialSaving ? 'Saving…' : 'Record'}
                        </button>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowPartialForm(false)}>Cancel</button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
              {isPaid && <div className="inv-paid-confirm id-paid-confirm">✓ This invoice has been paid</div>}
            </div>
          </div>

          {profile?.payment_instructions && (
            <div className="qb-card">
              <div className="id-pay-instructions">
                <strong className="id-pay-instructions-label">Payment instructions (visible to customer)</strong>
                {profile.payment_instructions}
              </div>
            </div>
          )}

          {!isPaid && (
            <div className="qb-card">
              <span className="qb-label">Auto-reminders</span>
              <p className="id-reminder-desc">
                Send automatic text reminders when overdue
              </p>
              {REMINDER_OPTIONS.map(opt => (
                <label key={opt.value} className="id-reminder-label">
                  <input
                    type="checkbox"
                    checked={reminderSchedule.includes(opt.value)}
                    onChange={() => toggleReminder(opt.value)}
                    style={{ accentColor: 'var(--brand)' }}
                  />
                  {opt.label}
                </label>
              ))}
              {invoice.last_reminder_sent_at && (
                <div className="id-last-reminder">
                  Last reminder: {formatDate(invoice.last_reminder_sent_at)}
                </div>
              )}
            </div>
          )}

          {invoice.quote_id && (
            <div className="qb-card">
              <span className="qb-label">Related quote</span>
              <Link className="btn btn-secondary full-width" to={`/app/quotes/${invoice.quote_id}`} className="id-related-link">
                View original quote
              </Link>
            </div>
          )}

          {hasAdditionalWork && (
            <div className="qb-card id-aw-card">
              <span className="qb-label id-aw-label">Includes additional work</span>
              <p className="id-aw-desc">
                This invoice includes additional work that was approved after the original quote.
              </p>
            </div>
          )}
        </aside>
      </div>
      {invoice && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
        <div className="qd-mobile-send-bar">
          <button className="btn btn-primary" type="button" className="id-mobile-btn" onClick={() => setShowPayForm(true)}>
            Mark as paid
          </button>
        </div>
      )}
      <ConfirmModal
        open={!!deletePaymentId}
        onConfirm={confirmDeletePayment}
        onCancel={() => setDeletePaymentId(null)}
        title="Delete Payment"
        message="This will remove the payment record. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />
    </AppShell>
  );
}
