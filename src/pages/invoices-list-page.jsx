import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/app-shell';
import { InvoicesListSkeleton } from '../components/skeletons';
import { listInvoices } from '../lib/api';
import { currency, formatDate, friendly } from '../lib/format';
import { useToast } from '../components/toast';
import { chipForStatus } from '../lib/workflow';

const STATUS_ORDER = ['overdue', 'sent', 'partial', 'draft', 'paid'];

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
  const [loading, setLoading] = useState(true);
  const { show: toast } = useToast();

  useEffect(() => {
    listInvoices()
      .then(data => setInvoices(sortInvoices(data || [])))
      .catch(e => toast(friendly(e), 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <InvoicesListSkeleton />;

  const unpaid = invoices.filter(i => i.status !== 'paid');
  const paid = invoices.filter(i => i.status === 'paid');

  return (
    <AppShell title="Invoices">
      {invoices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧾</div>
          <h2 className="empty-state-title">No invoices yet</h2>
          <p className="empty-state-body">
            Create a standalone invoice or convert an approved quote.
          </p>
          <div className="es-actions">
            <Link className="btn btn-primary" to="/app/invoices/new">New invoice</Link>
            <Link className="btn btn-secondary" to="/app/quotes">View quotes</Link>
          </div>
        </div>
      ) : (
        <div className="quotes-list-wrap" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Link className="btn btn-primary btn-sm" to="/app/invoices/new">New invoice</Link>
          </div>
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
        </div>
      )}
    </AppShell>
  );
}

function InvoiceRow({ invoice }) {
  const now = new Date();
  const isOverdue = invoice.due_at && new Date(invoice.due_at) < now && invoice.status !== 'paid';
  const displayStatus = isOverdue ? 'overdue' : invoice.status;
  const balance = Number(invoice.remaining_balance ?? invoice.total ?? 0);

  const chipLabel = displayStatus === 'overdue'
    ? 'Overdue'
    : chipForStatus(displayStatus) || displayStatus;

  return (
    <Link className="ql-row-premium" to={`/app/invoices/${invoice.id}`} data-status={displayStatus}>
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
