import { supabase, friendly } from './shared.js';
import { calculateTotals } from '../pricing';

// Core columns guaranteed to exist in all database instances
const INVOICE_SELECT_BASE = [
  'id', 'quote_id', 'customer_id', 'user_id',
  'title', 'description', 'status', 'subtotal', 'tax', 'discount',
  'total', 'province', 'country', 'due_at', 'issued_at', 'sent_at', 'paid_at',
  'payment_method', 'notes', 'share_token',
  'updated_at', 'created_at',
  'customer:customers(id,name,email,phone,address)',
  'invoice_items(id,name,quantity,unit_price,notes,category,sort_order,included)',
].join(',');

// Optional columns that may not exist on older database instances
const INVOICE_SELECT_OPTIONAL = [
  'invoice_number', 'deposit_credited', 'remaining_balance',
  'reminder_schedule', 'last_reminder_sent_at',
];

// Columns that might not exist on older database instances.
// We try the full list first, then silently drop whichever column
// Supabase complains about and retry — the user never sees an error.
const LIST_COLS_OPTIONAL = ['remaining_balance', 'deposit_credited', 'invoice_number'];

export async function listInvoices(_userId) {
  const baseSelect = 'id,quote_id,customer_id,title,status,total,due_at,paid_at,updated_at,customer:customers(name,email)';
  const optionalCols = [...LIST_COLS_OPTIONAL];
  let cols = [...optionalCols, baseSelect].join(',');

  for (let attempt = 0; attempt <= optionalCols.length; attempt++) {
    const { data, error } = await supabase
      .from('invoices')
      .select(cols)
      .order('updated_at', { ascending: false })
      .limit(500);

    if (!error) return data || [];

    // Detect which column is missing and retry without it
    const colMatch =
      error.message?.match(/column[s]? ["']?(\w+)["']? (of relation|does not exist)/i) ||
      error.message?.match(/Could not find the '(\w+)' column/i);

    if (colMatch) {
      const badCol = colMatch[1];
      console.warn(`[Punchlist] Invoice column "${badCol}" not in DB yet — retrying without it`);
      cols = cols.split(',').filter(c => c.trim() !== badCol).join(',');
      continue;
    }

    // Not a column error — throw with a clean generic message
    throw new Error('Couldn\'t load invoices. Try refreshing the page.');
  }

  // All optional cols stripped, try bare minimum
  const { data, error } = await supabase
    .from('invoices')
    .select(baseSelect)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) throw new Error('Couldn\'t load invoices. Try refreshing the page.');
  return data || [];
}

export async function getInvoice(invoiceId) {
  let optionalCols = [...INVOICE_SELECT_OPTIONAL];
  let cols = [...optionalCols, INVOICE_SELECT_BASE].join(',');

  for (let attempt = 0; attempt <= optionalCols.length; attempt++) {
    const { data, error } = await supabase
      .from('invoices')
      .select(cols)
      .eq('id', invoiceId)
      .maybeSingle();

    if (!error) {
      if (!data) throw new Error('Invoice not found. It may have been deleted.');
      return data;
    }

    const colMatch =
      error.message?.match(/column[s]? ["']?(\w+)["']? (of relation|does not exist)/i) ||
      error.message?.match(/Could not find the '(\w+)' column/i);

    if (colMatch) {
      const badCol = colMatch[1];
      console.warn(`[Punchlist] Invoice column "${badCol}" not in DB yet — retrying without it`);
      cols = cols.split(',').filter(c => c.trim() !== badCol).join(',');
      continue;
    }

    throw new Error('Couldn\'t load this invoice. Try refreshing the page.');
  }

  const { data, error } = await supabase
    .from('invoices').select(INVOICE_SELECT_BASE).eq('id', invoiceId).maybeSingle();
  if (error) throw new Error('Couldn\'t load this invoice. Try refreshing the page.');
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
  // Idempotent: if the invoice is already paid, leave paid_at alone so
  // we don't clobber the original payment timestamp on a double-click.
  // Only set paid_at when transitioning out of an unpaid state.
  const { data: current } = await supabase
    .from('invoices')
    .select('status, paid_at')
    .eq('id', invoiceId)
    .maybeSingle();
  const wasPaid = current?.status === 'paid' && current?.paid_at;
  const payload = {
    status: 'paid',
    payment_method: paymentMethod || null,
    remaining_balance: 0,
    updated_at: new Date().toISOString(),
  };
  if (!wasPaid) payload.paid_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('invoices')
    .update(payload)
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
      province: province || null,
      country: country || null,
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
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Enter a payment amount greater than zero.');
  }
  const safeAmount = Math.min(n, 1e7);
  const { data, error } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      invoice_id: invoiceId,
      amount: safeAmount,
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
    const nextStatus = remaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'sent';
    // If we're transitioning OUT of 'paid' (e.g. a payment was deleted
    // and there's now a balance), clear paid_at so the dashboard doesn't
    // show the invoice as both unpaid AND with a paid_at timestamp.
    const update = { remaining_balance: remaining, status: nextStatus, updated_at: new Date().toISOString() };
    if (nextStatus !== 'paid') update.paid_at = null;
    await supabase.from('invoices').update(update).eq('id', invoiceId);
  }
}

export async function createStandaloneInvoice(userId, { title, description, items, discount, due_at, notes, province, country, customer_id }) {
  const prov = province || 'ON';
  const ctry = country || 'CA';
  const totals = calculateTotals((items || []).map(i => ({ ...i, included: true })), prov, ctry);
  const disc = Math.max(0, Number(discount || 0));
  const discSubtotal = Math.max(0, totals.subtotal - disc);
  const discTax = discSubtotal * totals.rate;
  const total = discSubtotal + discTax;
  const dueAt = due_at || new Date(Date.now() + 30 * 86400000).toISOString();

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      customer_id: customer_id || null,
      title: title || 'Invoice',
      description: description || '',
      status: 'draft',
      subtotal: totals.subtotal,
      tax: discTax,
      discount: disc,
      total,
      province: prov,
      country: ctry,
      due_at: dueAt,
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw new Error(friendly(error));

  const rows = (items || []).filter(i => (i.name || '').trim()).map((item, idx) => ({
    invoice_id: invoice.id,
    name: item.name,
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unit_price || 0),
    notes: item.notes || null,
    category: item.category || null,
    sort_order: idx,
    included: true,
  }));
  if (rows.length) {
    const { error: ie } = await supabase.from('invoice_items').insert(rows);
    if (ie) console.warn('[PL] invoice_items insert error:', ie.message);
  }
  return invoice;
}

export async function setRecurringInterval(invoiceId, interval) {
  const { error } = await supabase
    .from('invoices')
    .update({ recurring_interval: interval || null, updated_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) console.warn('[PL] recurring update:', error.message);
}

export async function createNextRecurring(invoice) {
  if (!invoice?.recurring_interval || !invoice.user_id) return null;
  const intervals = { weekly: 7, biweekly: 14, monthly: 30 };
  const days = intervals[invoice.recurring_interval] || 30;
  const dueAt = new Date(Date.now() + days * 86400000).toISOString();
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      user_id: invoice.user_id,
      customer_id: invoice.customer_id,
      title: invoice.title,
      description: invoice.description,
      status: 'draft',
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      discount: invoice.discount || 0,
      total: invoice.total,
      province: invoice.province,
      country: invoice.country,
      due_at: dueAt,
      notes: invoice.notes,
      recurring_interval: invoice.recurring_interval,
    })
    .select()
    .single();
  if (error) { console.warn('[PL] recurring create:', error.message); return null; }
  if (data && invoice.invoice_items?.length) {
    const items = invoice.invoice_items.map((it, idx) => ({
      invoice_id: data.id,
      name: it.name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      notes: it.notes,
      category: it.category,
      sort_order: idx,
      included: true,
    }));
    await supabase.from('invoice_items').insert(items);
  }
  return data;
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

export async function checkAndSendReminder(invoice, profile) {
  if (!invoice || !profile) return null;
  const status = invoice.status || '';
  if (status === 'paid' || status === 'draft') return null;
  if (!invoice.due_at) return null;
  const schedule = invoice.reminder_schedule || [];
  if (!schedule.length) return null;

  const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_at).getTime()) / 86400000);
  if (daysOverdue < 1) return null;

  const lastSent = invoice.last_reminder_sent_at ? new Date(invoice.last_reminder_sent_at).getTime() : 0;
  const daysSinceLastReminder = lastSent ? Math.floor((Date.now() - lastSent) / 86400000) : Infinity;
  if (daysSinceLastReminder < 3) return null;

  const dueTrigger = schedule.filter(d => daysOverdue >= d).sort((a, b) => b - a)[0];
  if (!dueTrigger) return null;

  try {
    await sendInvoiceEmail({ invoice, profile, isReminder: true });
    await supabase.from('invoices').update({
      last_reminder_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', invoice.id);
    return dueTrigger;
  } catch (e) {
    console.warn('[PL] reminder send failed:', e.message);
    return null;
  }
}

export async function sendInvoiceEmail({ invoice, profile, payments = [], isReminder = false }) {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  } catch (e) { console.warn('[PL]', e); }
  const r = await fetch('/api/send-invoice-email', {
    method: 'POST',
    headers,
    body: JSON.stringify({ invoiceId: invoice.id, isReminder }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Unable to send invoice email');
  return d;
}

export function calculateLateFee(invoice, { lateFeePercent = 0, lateFeeDays = 0 } = {}) {
  if (!lateFeePercent || !lateFeeDays || !invoice?.due_at) return 0;
  if (invoice.status === 'paid' || invoice.status === 'draft') return 0;
  const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_at).getTime()) / 86400000);
  if (daysOverdue < lateFeeDays) return 0;
  return Math.round(Number(invoice.total || 0) * (lateFeePercent / 100) * 100) / 100;
}
