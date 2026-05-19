// ═══════════════════════════════════════════
// PUNCHLIST — API Module Index
// Re-exports everything for backwards compatibility.
// All existing `import { ... } from '../lib/api'` paths continue working.
// ═══════════════════════════════════════════
export * from './shared.js';
export * from './profile.js';
export * from './quotes.js';
export * from './customers.js';
export * from './notifications.js';
export * from './checkout.js';
export * from './templates.js';
export * from './invoices.js';
export * from './job-templates.js';

// ── Removed-feature stubs (booking/amendment system cut in 2.0) ──
export async function listBookings() { return []; }
export async function listAdditionalWork() { return []; }
export async function listAmendments() { return []; }
export async function createAdditionalWork() { return null; }
export async function createAmendment() { return null; }
export async function exportInvoicesQuickBooks(invoices) {
  if (!invoices?.length) return null;
  const headers = ['InvoiceNo,Date,DueDate,Customer,Description,Amount,Tax,Total,Status'];
  const rows = invoices.map(i => [
    i.invoice_number || '', i.issued_at?.slice(0, 10) || '', i.due_at?.slice(0, 10) || '',
    `"${(i.customer?.name || '').replace(/"/g, '""')}"`,
    `"${(i.title || '').replace(/"/g, '""')}"`,
    i.subtotal || 0, i.tax || 0, i.total || 0, i.status || '',
  ].join(','));
  const csv = [...headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `punchlist-invoices-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  return { count: invoices.length };
}

export async function exportInvoicesXero(invoices) {
  return exportInvoicesQuickBooks(invoices);
}

export async function exportAllData(userId) {
  const { supabase } = await import('./shared.js');
  const [{ data: quotes }, { data: customers }, { data: invoices }, { data: profile }] = await Promise.all([
    supabase.from('quotes').select('*,line_items(*),customers(name,email,phone)').eq('user_id', userId),
    supabase.from('customers').select('*').eq('user_id', userId),
    supabase.from('invoices').select('*,invoice_items(*),customer:customers(name,email,phone)').eq('user_id', userId),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ]);
  const payload = { exportDate: new Date().toISOString(), profile: profile || {}, quotes: quotes || [], customers: customers || [], invoices: invoices || [] };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `punchlist-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  URL.revokeObjectURL(url);
  return payload;
}

export async function deleteAccount(userId) {
  const { supabase } = await import('./shared.js');
  await supabase.from('notifications').delete().eq('user_id', userId);
  await supabase.from('job_templates').delete().eq('user_id', userId);
  await supabase.from('message_templates').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) console.warn('[PL] auth delete:', error.message);
  return { deleted: true };
}

// ── createInvoiceFromQuoteWithAdditionalWork: legacy name, routes to real impl ──
export { createInvoiceFromQuote as createInvoiceFromQuoteWithAdditionalWork } from './quotes.js';
