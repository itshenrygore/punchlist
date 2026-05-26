import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/app-shell';
import EmptyState from '../components/empty-state';
import { InvoicesListSkeleton } from '../components/skeletons';
import { listInvoices } from '../lib/api';
import { currency as fmtCurrency, formatDate, friendly } from '../lib/format';
import { useToast } from '../components/toast';
import { chipForStatus } from '../lib/workflow';

const STATUS_ORDER = ['overdue', 'sent', 'partial', 'draft', 'paid'];

const STATUS_PILLS = [
  { value: null,        label: 'All' },
  { value: 'overdue',   label: 'Overdue' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'paid',      label: 'Paid' },
  { value: 'draft',     label: 'Draft' },
];

function matchesFilter(inv, filter, now) {
  if (!filter) return true;
  const overdue = inv.due_at && new Date(inv.due_at) < now && inv.status !== 'paid';
  if (filter === 'overdue') return overdue;
  if (filter === 'paid') return inv.status === 'paid';
  if (filter === 'draft') return inv.status === 'draft';
  if (filter === 'outstanding') return inv.status !== 'paid' && inv.status !== 'draft' && !overdue;
  return inv.status === filter;
}

/** CSV export — gives contractors a one-click handoff to QuickBooks /
 *  Xero / spreadsheets. Mapped to the columns most tax software accepts. */
function exportInvoicesCSV(invoices) {
  const rows = [[
    'Invoice Number', 'Title', 'Customer', 'Status',
    'Issued Date', 'Due Date', 'Subtotal', 'Tax', 'Total',
    'Amount Paid', 'Balance Due', 'Paid Date',
  ]];
  const esc = (s) => {
    const str = String(s ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  for (const i of invoices) {
    const paid = Number(i.deposit_credited || 0); // partial-payment sum tracked via payments table; using deposit_credited as best-available here
    rows.push([
      i.invoice_number || '',
      i.title || '',
      i.customer?.name || '',
      i.status || '',
      i.issued_at ? new Date(i.issued_at).toISOString().slice(0, 10) : '',
      i.due_at ? new Date(i.due_at).toISOString().slice(0, 10) : '',
      i.subtotal || 0,
      i.tax || 0,
      i.total || 0,
      paid,
      i.remaining_balance ?? i.total ?? 0,
      i.paid_at ? new Date(i.paid_at).toISOString().slice(0, 10) : '',
    ].map(esc).join(','));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `punchlist-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function sortInvoices(invoices) {
  return [...invoices].sort((a, b) => {
    const now = new Date();
    const aOverdue = a.due_at && new Date(a.due_at) < now && a.status !== 'paid';
    const bOverdue = b.due_at && new Date(b.due_at) < now && b.status !== 'paid';
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });
}

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState([]);
  const currency = (n, c) => fmtCurrency(n, c ?? invoices[0]?.country);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null);
  const { show: toast } = useToast();

  useEffect(() => {
    listInvoices()
      .then(data => setInvoices(sortInvoices(data || [])))
      .catch(e => toast(friendly(e), 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Pre-compute counts per filter so the chips can show "Overdue 3"
  // without a separate scan per render.
  const counts = useMemo(() => {
    const now = new Date();
    return STATUS_PILLS.reduce((acc, p) => {
      acc[p.value || 'all'] = invoices.filter(i => matchesFilter(i, p.value, now)).length;
      return acc;
    }, {});
  }, [invoices]);

  const filtered = useMemo(() => {
    const now = new Date();
    return invoices.filter(i => matchesFilter(i, filter, now));
  }, [invoices, filter]);

  // Headline outstanding total — anchors the page so contractors know
  // what they're owed before drilling in.
  const outstanding = useMemo(() => {
    return invoices
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((s, i) => s + Math.max(0, Number(i.remaining_balance ?? i.total ?? 0)), 0);
  }, [invoices]);

  if (loading) return <InvoicesListSkeleton />;

  const unpaid = filtered.filter(i => i.status !== 'paid');
  const paid = filtered.filter(i => i.status === 'paid');

  return (
    <AppShell title="Invoices">
      {invoices.length === 0 ? (
        // Use the shared EmptyState (rise + icon pop animation lives
        // there). The secondary action ("View quotes") sits in
        // .es-actions next to the primary so contractors get a way
        // out when they don't have an invoice yet but do have quotes.
        <EmptyState
          icon={<span aria-hidden="true">🧾</span>}
          title="No invoices yet"
          description="Create a standalone invoice or convert an approved quote."
        >
          <div className="es-actions">
            <Link className="btn btn-primary" to="/app/invoices/new">New invoice</Link>
            <Link className="btn btn-secondary" to="/app/quotes">View quotes</Link>
          </div>
        </EmptyState>
      ) : (
        <div className="quotes-list-wrap" style={{ position: 'relative' }}>
          {/* Outstanding summary + actions */}
          <div className="inv-list-header">
            <div className="inv-list-outstanding">
              <span className="inv-list-outstanding-label">Outstanding</span>
              <span className="inv-list-outstanding-amount">{currency(outstanding)}</span>
            </div>
            <div className="inv-list-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportInvoicesCSV(invoices)} disabled={invoices.length === 0} title="Export all invoices to a CSV file you can upload to QuickBooks, Xero, or your accountant">
                Export CSV
              </button>
              <Link className="btn btn-primary btn-sm" to="/app/invoices/new">New invoice</Link>
            </div>
          </div>

          {/* Status filter chips */}
          <div className="pl-tabstrip" role="tablist" aria-label="Filter invoices by status">
            {STATUS_PILLS.map(p => {
              const active = filter === p.value;
              const count = counts[p.value || 'all'] || 0;
              return (
                <button
                  key={p.value ?? 'all'}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`pl-tab${active ? ' is-active' : ''}`}
                  onClick={() => setFilter(p.value)}
                >
                  {p.label}{count > 0 ? ` · ${count}` : ''}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="inv-list-empty-filter">
              No invoices match this filter.{' '}
              <button type="button" className="btn-link" onClick={() => setFilter(null)}>Show all</button>
            </div>
          ) : (
            <>
              {unpaid.length > 0 && (
                <div className="ql-group">
                  <div className="ql-group-label">Outstanding</div>
                  {unpaid.map(inv => <InvoiceRow key={inv.id} invoice={inv} />)}
                </div>
              )}
              {paid.length > 0 && (
                <div className="ql-group">
                  <div className="ql-group-label">Paid</div>
                  {paid.map(inv => <InvoiceRow key={inv.id} invoice={inv} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

function InvoiceRow({ invoice }) {
  const currency = (n) => fmtCurrency(n, invoice?.country);
  const now = new Date();
  const isOverdue = invoice.due_at && new Date(invoice.due_at) < now && invoice.status !== 'paid';
  const displayStatus = isOverdue ? 'overdue' : invoice.status;
  const balance = Number(invoice.remaining_balance ?? invoice.total ?? 0);

  const chipLabel = displayStatus === 'overdue'
    ? 'Overdue'
    : chipForStatus(displayStatus) || displayStatus;

  return (
    <Link
      className="ql-row-premium"
      to={`/app/invoices/${invoice.id}`}
      // Hand the list row's invoice forward so the detail page paints
      // the header instantly instead of flashing a skeleton through
      // the second fetch — the row already has everything we need
      // for first paint (title, customer, status, total).
      state={{ preview: invoice }}
      data-status={displayStatus}
    >
      <div className="ql-row-info">
        <span className="ql-row-title">
          {invoice.title || invoice.invoice_number || 'Invoice'}
          {invoice.customer?.name && (
            <span className="ql-row-customer">· {invoice.customer.name}</span>
          )}
        </span>
        {invoice.due_at && invoice.status !== 'paid' && (
          <span className={`ql-row-meta${isOverdue ? ' ql-row-meta--overdue' : ''}`}>
            Due {formatDate(invoice.due_at)}
          </span>
        )}
      </div>
      <span className={`chip chip-${displayStatus}`}>{chipLabel}</span>
      <div className="ql-row-right">
        <span className="ql-row-amount">
          {invoice.status === 'paid'
            ? currency(invoice.total)
            : balance > 0 ? currency(balance) : currency(invoice.total)}
        </span>
      </div>
    </Link>
  );
}
