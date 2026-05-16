import { supabase, friendly } from './shared.js';
import { calculateTotals } from '../pricing';

const INVOICE_SELECT = [
  'id', 'invoice_number', 'quote_id', 'customer_id', 'user_id',
  'title', 'description', 'status', 'subtotal', 'tax', 'discount',
  'total', 'deposit_credited', 'remaining_balance',
  'province', 'country', 'due_at', 'issued_at', 'paid_at',
  'payment_method', 'notes', 'share_token',
  'reminder_schedule', 'last_reminder_sent_at',
  'updated_at', 'created_at',
  'customer:customers(id,name,email,phone,address)',
  'invoice_items(id,name,quantity,unit_price,notes,category,sort_order,included)',
].join(',');

export async function listInvoices(_userId) {
  const { data, error } = await supabase
    .from('invoices')
    .select('id,invoice_number,quote_id,customer_id,title,status,total,remaining_balance,deposit_credited,due_at,paid_at,updated_at,customer:customers(name,email)')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(friendly(error));
  return data || [];
}

export async function getInvoice(invoiceId) {
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('id', invoiceId)
    .maybeSingle();
  if (error) throw new Error(friendly(error));
  if (!data) throw new Error('Invoice not found. It may have been deleted.');
  return data;
}

export async function updateInvoiceStatus(invoiceId, updates) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function markInvoicePaid(invoiceId, paymentMethod = null) {
  const { data, error } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod || null,
      remaining_balance: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function updateInvoice(invoiceId, { title, description, items, discount, due_at, notes, province, country }) {
  const totals = calculateTotals((items || []).map(i => ({ ...i, included: true })), province || 'ON', country || 'CA');
  const disc = Math.max(0, Number(discount || 0));
  const discSubtotal = Math.max(0, totals.subtotal - disc);
  const discTax = discSubtotal * totals.rate;
  const total = discSubtotal + discTax;

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .update({
      title: title || null,
      description: description || null,
      discount: disc,
      subtotal: totals.subtotal,
      tax: discTax,
      total,
      due_at: due_at || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .select()
    .single();
  if (invErr) throw new Error(friendly(invErr));

  if (items) {
    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
    const rows = (items || []).filter(i => (i.name || '').trim()).map((item, idx) => ({
      invoice_id: invoiceId,
      name: item.name,
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      notes: item.notes || null,
      category: item.category || null,
      sort_order: idx,
      included: true,
    }));
    if (rows.length) {
      const { error: rowsErr } = await supabase.from('invoice_items').insert(rows);
      if (rowsErr) console.warn('[PL] invoice_items update error:', rowsErr.message);
    }
  }

  return inv;
}

export async function listPayments(invoiceId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('paid_at', { ascending: true });
  if (error) throw new Error(friendly(error));
  return data || [];
}

export async function recordPayment(userId, invoiceId, { amount, method, notes }) {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      invoice_id: invoiceId,
      amount: Number(amount),
      method: method || null,
      notes: notes || null,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  // Update remaining_balance on invoice
  const { data: inv } = await supabase.from('invoices').select('total,deposit_credited').eq('id', invoiceId).maybeSingle();
  if (inv) {
    const { data: allPays } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId);
    const totalPaid = (allPays || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const remaining = Math.max(0, Number(inv.total) - Number(inv.deposit_credited || 0) - totalPaid);
    await supabase.from('invoices').update({ remaining_balance: remaining, status: remaining <= 0 ? 'paid' : 'partial', updated_at: new Date().toISOString() }).eq('id', invoiceId);
  }
  return data;
}

export async function deletePayment(paymentId, invoiceId) {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) throw new Error(friendly(error));
  // Recalculate remaining_balance
  const { data: inv } = await supabase.from('invoices').select('total,deposit_credited').eq('id', invoiceId).maybeSingle();
  if (inv) {
    const { data: allPays } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId);
    const totalPaid = (allPays || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const remaining = Math.max(0, Number(inv.total) - Number(inv.deposit_credited || 0) - totalPaid);
    await supabase.from('invoices').update({ remaining_balance: remaining, status: remaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'sent', updated_at: new Date().toISOString() }).eq('id', invoiceId);
  }
}

export function getInvoiceBalance(invoice, payments = []) {
  const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  return Math.max(0, Number(invoice?.total || 0) - Number(invoice?.deposit_credited || 0) - totalPaid);
}

export async function updateInvoiceReminders(invoiceId, schedule) {
  const { error } = await supabase
    .from('invoices')
    .update({ reminder_schedule: schedule, updated_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) throw new Error(friendly(error));
}

export async function checkAndSendReminder(_invoice, _profile) {
  // Reminder logic is server-side — client stub returns null (no-op)
  return null;
}

export async function sendInvoiceEmail({ invoice, profile, payments = [] }) {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  } catch (e) { console.warn('[PL]', e); }
  const r = await fetch('/api/send-invoice-email', {
    method: 'POST',
    headers,
    body: JSON.stringify({ invoiceId: invoice.id }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Unable to send invoice email');
  return d;
}
