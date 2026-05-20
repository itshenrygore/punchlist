const _fmtCAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const _fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function currency(n, country) {
  const num = Number(n || 0);
  if (country === 'US') return _fmtUSD.format(num);
  return _fmtCAD.format(num);
}

// Default locale picks up the user's browser preference (en-US for
// US devices, en-CA for Canada). Both render the same month-abbrev
// format ("May 20") for date contexts where we don't need numerics,
// so callers don't usually need to pass country — but it's available
// for cases where we want strict US-style or CA-style output.
function _localeFor(country) {
  if (country === 'US') return 'en-US';
  if (country === 'CA') return 'en-CA';
  return undefined; // browser default
}

export function formatDate(iso, country) {
  if (!iso) return 'Not set';
  try {
    return new Date(iso).toLocaleDateString(_localeFor(country), { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso, country) {
  if (!iso) return 'Not set';
  try {
    return new Date(iso).toLocaleString(_localeFor(country), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return iso;
  }
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(iso);
}

/** Shared CSV download helper — converts rows array to CSV and triggers download */
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function exportQuotesCSV(quotes) {
  const rows = [['Quote #','Title','Customer','Status','Subtotal','Tax','Discount','Total','Trade','Province','Created','Updated']];
  for (const q of quotes) {
    rows.push([
      q.quote_number ? formatQuoteNumber(q.quote_number) : '',
      q.title || '', q.customer?.name || '', q.status || '',
      q.subtotal || 0, q.tax || 0, q.discount || 0, q.total || 0,
      q.trade || '', q.province || '', q.created_at || '', q.updated_at || '',
    ]);
  }
  downloadCSV(rows, 'punchlist-quotes.csv');
}

export function exportInvoicesCSV(invoices) {
  const rows = [['Invoice #','Customer','Status','Subtotal','Tax','Total','Due Date','Paid Date','Payment Method','Created']];
  for (const inv of invoices) {
    rows.push([
      inv.invoice_number || '', inv.customer?.name || '', inv.status || '',
      inv.subtotal || 0, inv.tax || 0, inv.total || 0,
      inv.due_at || '', inv.paid_at || '', inv.paid_method || '', inv.created_at || '',
    ]);
  }
  downloadCSV(rows, 'punchlist-invoices.csv');
}

// ── Phase 6 (Schedule): Compact time label for calendar blocks ──
export function formatTimeShort(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    let h = d.getHours(), m = d.getMinutes();
    const ap = h >= 12 ? 'p' : 'a';
    h = h % 12 || 12;
    return m === 0 ? `${h}${ap}` : `${h}:${String(m).padStart(2,'0')}${ap}`;
  } catch { return ''; }
}

// ── Phase 6: Quote number formatting ──
export function formatQuoteNumber(n) {
  if (!n) return '';
  return `Q-${String(n).padStart(4, '0')}`;
}

export function friendly(e) {
  if (!e) return "Something broke on our end.";
  if (typeof e === "string") return e;
  return e.message || e.error || "Something broke on our end.";
}
