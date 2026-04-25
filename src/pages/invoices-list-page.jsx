import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/app-shell';
import StatusBadge from '../components/status-badge';
import EmptyState from '../components/empty-state';
import PageSkeleton from '../components/page-skeleton';
import { listInvoices } from '../lib/api';
import { currency, formatDate, exportInvoicesCSV } from '../lib/format';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { usePullToRefresh } from '../hooks/use-mobile-ux';
import { useScrollRestore } from '../hooks/use-scroll-restore';

const STATUS_FILTERS = [
  { value: 'all',     label: 'All' },
  { value: 'unpaid',  label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid',    label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

function matchesSearch(inv, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    (inv.invoice_number || '').toLowerCase().includes(s) ||
    (inv.customer?.name || '').toLowerCase().includes(s) ||
    (inv.title || '').toLowerCase().includes(s) ||
    (inv.status || '').toLowerCase().includes(s)
  );
}

function getEffectiveStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  if (inv.status === 'cancelled') return 'cancelled';
  if (inv.due_at && new Date(inv.due_at) < new Date()) return 'overdue';
  return 'unpaid';
}

function InvoiceRow({ inv }) {
  const effective = getEffectiveStatus(inv);
  const statusDisplay = effective === 'overdue' ? 'overdue' : inv.status;
  return (
    <Link
      to={`/app/invoices/${inv.id}`}
      className="ql-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr 160px 110px 110px 100px',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 'var(--r)',
        borderBottom: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-xs)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
        {inv.invoice_number || '—'}
      </span>
      <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {inv.title || 'Invoice'}
        {inv.customer?.name && (
          <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6, fontSize: 'var(--text-sm)' }}>{inv.customer.name}</span>
        )}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {inv.customer?.name || <span style={{ fontStyle: 'italic' }}>No contact</span>}
      </span>
      <span><StatusBadge status={statusDisplay} /></span>
      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', textAlign: 'right' }}>
        {currency(inv.total || 0)}
      </span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textAlign: 'right' }}>
        {inv.due_at ? formatDate(inv.due_at) : '—'}
      </span>
    </Link>
  );
}

function InvoiceCard({ inv }) {
  const effective = getEffectiveStatus(inv);
  const statusDisplay = effective === 'overdue' ? 'overdue' : inv.status;
  const isOverdue = effective === 'overdue';
  return (
    <Link to={`/app/invoices/${inv.id}`} className="inv-card-v2" style={{ textDecoration: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="inv-card-title">{inv.title || 'Invoice'}</div>
          <div className="inv-card-meta">
            {inv.customer?.name || 'No contact'}
            {inv.invoice_number && <span style={{ opacity: 0.6 }}> · {inv.invoice_number}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className={`inv-card-total${isOverdue ? ' overdue' : inv.status === 'paid' ? ' paid' : ''}`}>
            {currency(inv.total || 0)}
          </div>
        </div>
      </div>
      <div className="inv-card-bottom">
        <StatusBadge status={statusDisplay} />
        {inv.due_at && (
          <div style={{ fontSize: 'var(--text-2xs)', color: isOverdue ? 'var(--red)' : 'var(--muted)', fontWeight: isOverdue ? 700 : 400 }}>
            {isOverdue ? 'Overdue · ' : 'Due '}{formatDate(inv.due_at)}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function InvoicesListPage() {
  const { user } = useAuth();
  const { show: toast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // v103 Phase 5: Scroll restoration + pull-to-refresh
  useScrollRestore('/app/invoices');

  function fetchInvoices() {
    if (!user) return;
    setLoading(true);
    listInvoices(user.id)
      .then(setInvoices)
      .catch(() => toast('Could not load invoices', 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) return;
    listInvoices(user.id)
      .then(setInvoices)
      .catch(() => toast('Could not load invoices', 'error'))
      .finally(() => setLoading(false));
  }, [user]);

  usePullToRefresh(fetchInvoices);

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter !== 'all') {
      list = list.filter(inv => getEffectiveStatus(inv) === statusFilter);
    }
    if (search.trim()) {
      list = list.filter(inv => matchesSearch(inv, search));
    }
    return list;
  }, [invoices, statusFilter, search]);

  // Summary totals
  const totals = useMemo(() => {
    const unpaid = invoices.filter(inv => !['paid', 'cancelled'].includes(inv.status));
    const overdue = unpaid.filter(inv => inv.due_at && new Date(inv.due_at) < new Date());
    const paid = invoices.filter(inv => inv.status === 'paid');
    return {
      outstanding: unpaid.reduce((s, i) => s + Number(i.total || 0), 0),
      overdueTotal: overdue.reduce((s, i) => s + Number(i.total || 0), 0),
      overdueCount: overdue.length,
      paidTotal: paid.reduce((s, i) => s + Number(i.total || 0), 0),
    };
  }, [invoices]);

  const headerColumns = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '110px 1fr 160px 110px 110px 100px',
      gap: 12,
      padding: '8px 16px',
      fontSize: 'var(--text-2xs)',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '.06em',
      color: 'var(--muted)',
    }}>
      <span>Invoice #</span>
      <span>Title</span>
      <span>Customer</span>
      <span>Status</span>
      <span style={{ textAlign: 'right' }}>Amount</span>
      <span style={{ textAlign: 'right' }}>Due</span>
    </div>
  );

  return (
    <AppShell
      title="Invoices"
      actions={
        invoices.length > 0 && (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => exportInvoicesCSV(invoices)} style={{ fontSize: 'var(--text-2xs)' }}>
            Export
          </button>
        )
      }
    >
      {loading ? (
        <PageSkeleton variant="list" />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={null}
          title="No invoices yet"
          description="Complete a job and invoice with one tap. Your customer pays online — you get the money in 2 days."
          actionLabel="View completed quotes →"
          actionTo="/app/quotes?filter=completed"
        />
      ) : (
        <>
          {/* Summary strip */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 16px' }}>
              <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 4 }}>Outstanding</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{currency(totals.outstanding)}</div>
            </div>
            {totals.overdueCount > 0 && (
              <div style={{ flex: 1, minWidth: 140, background: 'var(--red-bg, rgba(239,68,68,.06))', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--r)', padding: '12px 16px' }}>
                <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--red)', marginBottom: 4 }}>Overdue ({totals.overdueCount})</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--red)' }}>{currency(totals.overdueTotal)}</div>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 140, background: 'var(--green-bg, rgba(34,197,94,.06))', border: '1px solid rgba(34,197,94,.15)', borderRadius: 'var(--r)', padding: '12px 16px' }}>
              <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--green)', marginBottom: 4 }}>Collected</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--green)' }}>{currency(totals.paidTotal)}</div>
            </div>
          </div>

          {/* Status pills */}
          <div className="ql-status-pills" style={{ marginBottom: 8 }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                className={`ql-pill${statusFilter === f.value ? ' active' : ''}`}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ marginBottom: 16 }}>
            <input
              className="input"
              style={{ width: '100%', maxWidth: 400 }}
              placeholder="Search invoices…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              No invoices match your filter.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="ds-desktop-only" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                {headerColumns}
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {filtered.map(inv => <InvoiceRow key={inv.id} inv={inv} />)}
                </div>
              </div>
              {/* Mobile cards */}
              <div className="ds-mobile-only">
                {filtered.map(inv => <InvoiceCard key={inv.id} inv={inv} />)}
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
