import { supabase, friendly } from './shared.js';
import { updateProfile } from './profile.js';
import { listQuotes } from './quotes.js';
import { listBookings } from './bookings.js';
import { listInvoices } from './invoices.js';

// ── 7E: Daily digest ──
export async function checkAndSendDigest(userId, profile) {
  if (!profile?.digest_enabled) return false;
  const lastSent = profile.last_digest_sent_at;
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (lastSent) {
    const lastDate = new Date(lastSent).toLocaleDateString('en-CA');
    if (lastDate === todayStr) return false;
  }

  try {
    const quotes = await listQuotes(userId);
    const bookings = await listBookings(userId);
    const invoices = await listInvoices(userId);

    const quotesNeedingAction = quotes
      .filter(q => ['revision_requested', 'viewed'].includes(q.status))
      .slice(0, 5)
      .map(q => ({ id: q.id, title: q.title, status: q.status }));

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const todaysJobs = bookings
      .filter(b => {
        const d = new Date(b.scheduled_for);
        return d >= todayStart && d < todayEnd && b.status !== 'cancelled';
      })
      .map(b => ({
        customerName: b.customer?.name || 'Job',
        time: new Date(b.scheduled_for).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true }),
      }));

    const overdueInvoices = invoices
      .filter(i => {
        if (!['sent', 'viewed', 'partial', 'overdue'].includes(i.status)) return false;
        if (!i.due_at) return false;
        return new Date(i.due_at) < today;
      })
      .slice(0, 5)
      .map(i => ({
        id: i.id,
        invoice_number: i.invoice_number,
        total: i.total,
        daysPastDue: Math.floor((today - new Date(i.due_at)) / 86400000),
      }));

    if (!quotesNeedingAction.length && !todaysJobs.length && !overdueInvoices.length) {
      await updateProfile(userId, { last_digest_sent_at: new Date().toISOString() });
      return false;
    }

    const res = await fetch('/api/send-quote-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'daily_digest',
        contractorEmail: profile.email,
        contractorName: profile.full_name,
        quotesNeedingAction,
        todaysJobs,
        overdueInvoices,
      }),
    });

    if (res.ok) {
      await updateProfile(userId, { last_digest_sent_at: new Date().toISOString() });
      return true;
    }
  } catch (err) {
    console.warn('[digest] Failed:', err?.message);
  }
  return false;
}

// ── 7F: QuickBooks / Xero invoice export ──
export function exportInvoicesQuickBooks(invoices) {
  const rows = [['Date', 'Description', 'Amount', 'Tax', 'Category', 'Customer', 'Invoice #']];
  for (const inv of invoices) {
    const date = inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-CA') : '';
    rows.push([
      date,
      inv.title || inv.description || 'Services',
      inv.subtotal || 0,
      inv.tax || 0,
      'Service Revenue',
      inv.customer?.name || '',
      inv.invoice_number || '',
    ]);
  }
  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'punchlist-invoices-quickbooks.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportInvoicesXero(invoices) {
  const rows = [['ContactName', 'InvoiceNumber', 'InvoiceDate', 'DueDate', 'Total', 'TaxTotal', 'Description', 'Quantity', 'UnitAmount', 'AccountCode']];
  for (const inv of invoices) {
    const invDate = inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-CA') : '';
    const dueDate = inv.due_at ? new Date(inv.due_at).toLocaleDateString('en-CA') : '';
    rows.push([
      inv.customer?.name || '',
      inv.invoice_number || '',
      invDate,
      dueDate,
      inv.total || 0,
      inv.tax || 0,
      inv.title || 'Services',
      1,
      inv.subtotal || 0,
      '200',
    ]);
  }
  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'punchlist-invoices-xero.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 7G: Full data export ──
export async function exportAllData(userId) {
  const [quotes, customers, bookings, invoices] = await Promise.all([
    listQuotes(userId),
    (await import('./customers.js')).listCustomers(userId),
    listBookings(userId),
    listInvoices(userId),
  ]);

  const csvEncode = (rows) => rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');

  const quotesCsv = csvEncode([
    ['Quote #', 'Title', 'Customer', 'Status', 'Subtotal', 'Tax', 'Total', 'Trade', 'Province', 'Created', 'Updated'],
    ...quotes.map(q => [
      q.quote_number ? `Q-${String(q.quote_number).padStart(4, '0')}` : '',
      q.title || '', q.customer?.name || '', q.status || '',
      q.subtotal || 0, q.tax || 0, q.total || 0,
      q.trade || '', q.province || '', q.created_at || '', q.updated_at || '',
    ]),
  ]);

  const contactsCsv = csvEncode([
    ['Name', 'Email', 'Phone', 'Address', 'Notes', 'Tags', 'Created'],
    ...customers.map(c => [
      c.name || '', c.email || '', c.phone || '',
      c.address || '', c.notes || '',
      Array.isArray(c.tags) ? c.tags.join('; ') : '',
      c.created_at || '',
    ]),
  ]);

  const bookingsCsv = csvEncode([
    ['Customer', 'Date', 'Duration (min)', 'Status', 'Notes', 'Created'],
    ...bookings.map(b => [
      b.customer?.name || '', b.scheduled_for || '',
      b.duration_minutes || 120, b.status || '',
      b.notes || '', b.created_at || '',
    ]),
  ]);

  const invoicesCsv = csvEncode([
    ['Invoice #', 'Customer', 'Status', 'Subtotal', 'Tax', 'Total', 'Due Date', 'Paid Date', 'Created'],
    ...invoices.map(i => [
      i.invoice_number || '', i.customer?.name || '', i.status || '',
      i.subtotal || 0, i.tax || 0, i.total || 0,
      i.due_at || '', i.paid_at || '', i.created_at || '',
    ]),
  ]);

  const files = [
    { name: 'punchlist-quotes.csv', data: quotesCsv },
    { name: 'punchlist-contacts.csv', data: contactsCsv },
    { name: 'punchlist-bookings.csv', data: bookingsCsv },
    { name: 'punchlist-invoices.csv', data: invoicesCsv },
  ];

  for (const f of files) {
    const blob = new Blob(['\uFEFF' + f.data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await new Promise(r => setTimeout(r, 300));
  }

  return files.length;
}

// ── 7G: Delete account ──
export async function deleteAccount(userId) {
  await supabase.from('notifications').delete().eq('user_id', userId);
  await supabase.from('bookings').delete().eq('user_id', userId);
  await supabase.from('additional_work_requests').delete().eq('user_id', userId);
  await supabase.from('amendments').delete().eq('user_id', userId);
  await supabase.from('invoices').delete().eq('user_id', userId);
  await supabase.from('quotes').delete().eq('user_id', userId);
  await supabase.from('customers').delete().eq('user_id', userId);
  await supabase.from('ai_usage').delete().eq('user_id', userId);
  await supabase.from('company_catalog_items').delete().eq('user_id', userId);
  await supabase.from('helper_sessions').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);
  await supabase.auth.signOut();
}
