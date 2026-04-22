import { supabase, friendly } from './shared.js';
import { calculateTotals } from '../pricing';

export async function listInvoices(_userId) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customer:customers(name,email,phone), invoice_items(id)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendly(error));
  return (data || []).map(inv => ({ ...inv, item_count: inv.invoice_items?.length || 0 }));
}

export async function getInvoice(invoiceId) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customer:customers(*), invoice_items(*)')
    .eq('id', invoiceId)
    .maybeSingle();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function createInvoiceFromQuote(userId, quote) {
  const invNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  const items = (quote.line_items || []).filter(i => i.included !== false && (i.name || '').trim());

  // Get contractor's default due days (OOB: 7)
  let dueDays = 7;
  try {
    const { data: profile } = await supabase.from('profiles').select('invoice_due_days').eq('id', userId).maybeSingle();
    if (profile?.invoice_due_days) dueDays = Number(profile.invoice_due_days);
  } catch (e) { console.warn("[PL]", e); }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      quote_id: quote.id,
      customer_id: quote.customer_id || null,
      invoice_number: invNumber,
      title: quote.title || 'Invoice',
      description: quote.scope_summary || '',
      subtotal: Number(quote.subtotal || 0),
      tax: Number(quote.tax || 0),
      total: Number(quote.total || 0),
      province: quote.province || 'ON',
      country: quote.country || 'CA',
      status: 'draft',
      issued_at: new Date().toISOString(),
      due_at: new Date(Date.now() + dueDays * 86400000).toISOString(),
      deposit_credited: quote.deposit_status === 'paid' ? Number(quote.deposit_amount || 0) : 0,
    })
    .select()
    .single();
  if (error) throw new Error(friendly(error));

  if (items.length) {
    const invItems = items.map((item, i) => ({
      invoice_id: invoice.id,
      sort_order: i,
      name: item.name,
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      notes: item.notes || null,
      category: item.category || null,
      included: true,
    }));
    const { error: ie } = await supabase.from('invoice_items').insert(invItems);
    if (ie) throw new Error(friendly(ie));
  }

  await supabase.from('quotes').update({ status: 'invoiced' }).eq('id', quote.id);
  return invoice;
}

export async function updateInvoiceStatus(invoiceId, updates) {
  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', invoiceId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function markInvoicePaid(invoiceId, paymentMethod = null) {
  const updates = { status: 'paid', paid_at: new Date().toISOString() };
  if (paymentMethod) updates.payment_method = paymentMethod;
  const inv = await updateInvoiceStatus(invoiceId, updates);
  if (inv.quote_id) {
    await supabase.from('quotes').update({ status: 'paid' }).eq('id', inv.quote_id);
  }
  sendPaymentReceiptEmail(inv).catch(e => console.warn('[PL]', e));
  return inv;
}

export async function updateInvoice(invoiceId, draft) {
  const province = draft.province || 'ON';
  const country = draft.country || 'CA';
  const items = (draft.items || []).filter(i => (i.name || '').trim());
  const totals = calculateTotals(
    items.map(i => ({ ...i, included: true })),
    province, country
  );
  const discount = Math.max(0, Number(draft.discount || 0));
  const discountedSubtotal = Math.max(0, totals.subtotal - discount);
  const discountedTax = discountedSubtotal * totals.rate;
  const discountedTotal = discountedSubtotal + discountedTax;

  const payload = {
    title: draft.title || 'Invoice',
    description: draft.description || '',
    subtotal: totals.subtotal,
    tax: discountedTax,
    total: discountedTotal,
    discount,
    province,
    country,
    due_at: draft.due_at || null,
    notes: draft.notes || null,
    updated_at: new Date().toISOString(),
  };

  const { data: invoice, error } = await supabase
    .from('invoices')
    .update(payload)
    .eq('id', invoiceId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));

  // ── SAFE INVOICE ITEMS UPDATE (insert-first for data safety) ──
  // Insert new items while old items remain as safety net.
  // Only delete old items after new ones are confirmed saved.
  if (items.length) {
    const { data: oldItems } = await supabase.from('invoice_items').select('id').eq('invoice_id', invoiceId);
    const oldIds = (oldItems || []).map(i => i.id);

    const invItems = items.map((item, i) => ({
      invoice_id: invoiceId,
      sort_order: i,
      name: item.name,
      quantity: Number(item.quantity || 1),
      unit_price: Math.max(0, Number(item.unit_price || 0)),
      notes: item.notes || null,
      category: item.category || null,
      included: true,
    }));
    const { error: ie } = await supabase.from('invoice_items').insert(invItems);
    if (ie) {
      // Insert failed — old items still intact, no data loss
      throw new Error('Invoice saved but items failed to update. Your previous items are still intact — try again.');
    }

    // Insert succeeded — safe to remove old items
    if (oldIds.length) {
      const { error: delErr } = await supabase.from('invoice_items').delete().in('id', oldIds);
      if (delErr) {
        // Non-fatal: duplicates may exist but no data lost. Next save cleans up.
        console.error('[Punchlist] invoice_items delete failed after insert:', delErr.message);
      }
    }
  } else {
    // No new items — user intentionally cleared all items
    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
  }

  return invoice;
}

export async function createInvoiceCheckout({ invoiceId, shareToken, amount, customerEmail, title, country }) {
  const r = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoiceId, shareToken, amount, customerEmail, title, country, paymentType: 'invoice_payment' }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Invoice checkout failed');
  window.location.href = d.url;
}

export async function updateInvoiceReminders(invoiceId, reminderSchedule) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ reminder_schedule: reminderSchedule })
    .eq('id', invoiceId)
    .select()
    .single();
  if (error) throw new Error(friendly(error));
  return data;
}

export async function checkAndSendReminder(invoice, profile) {
  if (!invoice || !invoice.due_at || invoice.status === 'paid' || invoice.status === 'cancelled') return null;
  const schedule = invoice.reminder_schedule || [];
  if (!schedule.length) return null;

  const now = new Date();
  const dueDate = new Date(invoice.due_at);
  if (now <= dueDate) return null;

  const daysPastDue = Math.floor((now - dueDate) / 86400000);
  const lastSent = invoice.last_reminder_sent_at ? new Date(invoice.last_reminder_sent_at) : null;

  const sortedSchedule = [...schedule].sort((a, b) => a - b);
  let shouldSendForDay = null;
  for (const day of sortedSchedule) {
    if (daysPastDue >= day) shouldSendForDay = day;
  }
  if (!shouldSendForDay) return null;

  if (lastSent && (now - lastSent) < 6 * 86400000) return null;

  const customerEmail = invoice.customer?.email;
  if (!customerEmail) return null;

  try {
    const r = await fetch('/api/send-quote-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'payment_reminder',
        invoiceId: invoice.id,
        customerEmail,
        customerName: invoice.customer?.name || '',
        contractorName: profile?.company_name || profile?.full_name || '',
        contractorPhone: profile?.phone || '',
        contractorEmail: profile?.email || '',
        invoiceNumber: invoice.invoice_number || '',
        invoiceTitle: invoice.title || '',
        invoiceTotal: invoice.total || 0,
        invoiceBalance: getInvoiceBalance(invoice),
        dueAt: invoice.due_at,
        daysPastDue,
        shareToken: invoice.share_token,
        country: invoice.country || profile?.country || 'CA',
      }),
    });
    if (r.ok) {
      await supabase
        .from('invoices')
        .update({ last_reminder_sent_at: now.toISOString() })
        .eq('id', invoice.id);
      // 9B: SMS — payment reminder to customer
      if (invoice.customer?.phone) {
        fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'payment_reminder',
            to: invoice.customer.phone,
            data: {
              contractorName: profile?.company_name || profile?.full_name || 'Your contractor',
              invoiceNumber: invoice.invoice_number || '',
              balance: getInvoiceBalance(invoice),
              daysPastDue,
              shareToken: invoice.share_token,
              country: invoice.country || profile?.country || 'CA',
            },
          }),
        }).catch(e => console.warn('[PL]', e));
      }
      return shouldSendForDay;
    }
  } catch (e) { console.warn("[PL]", e); }
  return null;
}

async function sendPaymentReceiptEmail(invoice) {
  if (!invoice?.customer_id) return;
  const { data: customer } = await supabase.from('customers').select('name,email,phone').eq('id', invoice.customer_id).maybeSingle();
  if (!customer?.email) return;
  const { data: profile } = await supabase.from('profiles').select('full_name,company_name,phone,email,country').eq('id', invoice.user_id).maybeSingle();

  await fetch('/api/send-quote-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'payment_receipt',
      customerEmail: customer.email,
      customerName: customer.name || '',
      contractorName: profile?.company_name || profile?.full_name || '',
      contractorPhone: profile?.phone || '',
      contractorEmail: profile?.email || '',
      invoiceNumber: invoice.invoice_number || '',
      invoiceTitle: invoice.title || '',
      amount: invoice.total || 0,
      paymentMethod: invoice.payment_method || '',
      paidAt: invoice.paid_at || new Date().toISOString(),
      country: profile?.country || invoice.country || 'CA',
    }),
  }).catch(e => console.warn('[PL]', e));

  // 9B: SMS — payment receipt to customer (reuse customer.phone from above)
  if (customer.phone) {
    fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'payment_receipt',
        to: customer.phone,
        data: {
          contractorName: profile?.company_name || profile?.full_name || 'Your contractor',
          amount: invoice.total || 0,
          country: profile?.country || invoice.country || 'CA',
        },
      }),
    }).catch(e => console.warn('[PL]', e));
  }
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
  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      user_id: userId,
      amount: Number(amount || 0),
      method: method || null,
      notes: notes || null,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(friendly(error));

  await recalcInvoicePaymentStatus(invoiceId);
  return payment;
}

export async function deletePayment(paymentId, invoiceId) {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) throw new Error(friendly(error));
  await recalcInvoicePaymentStatus(invoiceId);
}

async function recalcInvoicePaymentStatus(invoiceId) {
  const { data: inv } = await supabase.from('invoices').select('total,status,quote_id,customer_id,user_id,invoice_number,title,payment_method,paid_at,country').eq('id', invoiceId).maybeSingle();
  if (!inv) return;
  const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId);
  const totalPaid = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const invoiceTotal = Number(inv.total || 0);

  let newStatus = inv.status;
  if (totalPaid >= invoiceTotal && invoiceTotal > 0) {
    newStatus = 'paid';
  } else if (totalPaid > 0) {
    newStatus = 'partial';
  } else if (inv.status === 'paid' || inv.status === 'partial') {
    newStatus = 'sent';
  }

  const updates = { status: newStatus };
  if (newStatus === 'paid' && !inv.paid_at) {
    updates.paid_at = new Date().toISOString();
  }

  await supabase.from('invoices').update(updates).eq('id', invoiceId);

  if (newStatus === 'paid' && inv.quote_id) {
    await supabase.from('quotes').update({ status: 'paid' }).eq('id', inv.quote_id);
    sendPaymentReceiptEmail({ ...inv, id: invoiceId, ...updates }).catch(e => console.warn('[PL]', e));
  }
}

export function getInvoiceBalance(invoice, payments) {
  const total = Number(invoice?.total || 0);
  const depositCredited = Number(invoice?.deposit_credited || 0);
  const paidSum = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  return Math.max(0, total - depositCredited - paidSum);
}

export function calculateReceivables(invoices) {
  const now = new Date();
  let totalOutstanding = 0;
  let overdueCount = 0;
  let overdueTotal = 0;
  let unpaidCount = 0;

  for (const inv of (invoices || [])) {
    if (['paid', 'cancelled'].includes(inv.status)) continue;
    const balance = Number(inv.total || 0) - Number(inv.deposit_credited || 0);
    if (balance <= 0) continue;

    totalOutstanding += balance;
    unpaidCount++;

    if (inv.due_at && new Date(inv.due_at) < now) {
      overdueCount++;
      overdueTotal += balance;
    }
  }

  return { totalOutstanding, overdueCount, overdueTotal, unpaidCount };
}

/**
 * Send branded HTML invoice email via Resend API.
 * Calls /api/send-quote-email with action:'send_invoice'.
 */
export async function sendInvoiceEmail({ invoice, profile, payments: pList }) {
  const customerEmail = invoice.customer?.email;
  if (!customerEmail) throw new Error('No email on file for this customer');
  const balance = getInvoiceBalance(invoice, pList || []);
  const r = await fetch('/api/send-quote-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send_invoice',
      customerEmail,
      customerName: invoice.customer?.name || '',
      contractorName: profile?.company_name || profile?.full_name || '',
      contractorPhone: profile?.phone || '',
      contractorEmail: profile?.email || '',
      invoiceNumber: invoice.invoice_number || '',
      invoiceTitle: invoice.title || '',
      invoiceTotal: invoice.total || 0,
      invoiceBalance: balance,
      dueAt: invoice.due_at || null,
      shareToken: invoice.share_token,
      country: invoice.country || profile?.country || 'CA',
      depositCredited: Number(invoice.deposit_credited || 0),
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed to send invoice email');
  return d;
}
