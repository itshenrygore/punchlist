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

const STATUS_FILTERS = [
 { value: 'all', label: 'All' },
 { value: 'unpaid', label: 'Unpaid' },
 { value: 'overdue', label: 'Overdue' },
 { value: 'paid', label: 'Paid' },
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
 const statusDisplay ql-row ilp-grid-63f1ctive === 'overdue' ? 'overdue' : inv.status;
 return (
 <Link
 to={`/app/invoices/${inv.id}`}
 className="ql-row"
 
 onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
 onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
 >
 <span className="ilp-fs-xs-1202">
 {inv.invoice_number || '—'}
 </span>
 <span className="ilp-fs-base-4c16">
 {inv.title || 'Invoice'}
 {inv.customer?.name && (
 <span className="ilp-fs-sm-52f9">{inv.customer.name}</span>
 )}
 </span>
 <span className="ilp-fs-sm-97ce">
 {inv.customer?.name || <span className="ilp-s11-8ec5">No contact</span>}
 </span>
 <span><StatusBadge status={statusDisplay} /></span>
 <span className="ilp-ta-right_fs-base-306b">
 {currency(inv.total || 0)}
 </span>
 <span className="ilp-ta-right_fs-xs-63fa">
 {inv.due_at ? formatDate(inv.due_at) : '—'}
 </span>
 </Link>
 );
}

function InvoiceCard({ inv }) {
 const effective = getEffectiveStatus(inv);
 const statusDisplay = effective === 'oveinv-card-v2 ilp-s10-bd50erdue' : inv.status;
 const isOverdue = effective === 'overdue';
 return (
 <Link to={`/app/invoices/${inv.id}`} className="inv-card-v2" >
 <div className="ilp-flex-f55b">
 <div className="ilp-s9-d14f">
 <div className="inv-card-title">{inv.title || 'Invoice'}</div>
 <div className="inv-card-meta">
 {inv.customer?.name || 'No contact'}
 {inv.invoice_number && <span className="ilp-s8-07e6"> · {inv.invoice_number}</span>}
 </div>
 </div>
 <div className="ilp-ta-right-445e">
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

 useEffect(() => {
 if (!user) return;
 listInvoices(user.id)
 .then(setInvoices)
 .catch(() => toast('Could not load invoices', 'error'))
 .finally(() => setLoading(false));
 }, [user]);

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
 <div className="ilp-grid_fs-2xs-48f7">
 <span>Invoice #</span>
 <span>Title</span>
 <span>Customer</span>
 <span>Status</span>
 <span className="ilp-ta-right-a1ae">Amount</span>
 <span className="ilp-ta-right-a1ae">Due</span>
 </div>
 );

 return (
 <AppShellbtn btn-ghost btn-sm ilp-fs-2xs-69e0es"
 actions={
 invoices.length > 0 && (
 <button className="btn btn-ghost btn-sm" type="button" onClick={() => exportInvoicesCSV(invoices)} >
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
 <div className="ilp-flex-c2b8">
 <div className="ilp-s7-1c76">
 <div className="ilp-fs-2xs-575c">Outstanding</div>
 <div className="ilp-fs-2xl-a9e8">{currency(totals.outstanding)}</div>
 </div>
 {totals.overdueCount > 0 && (
 <div className="ilp-s6-3a14">
 <div className="ilp-fs-2xs-b49a">Overdue ({totals.overdueCount})</div>
 <div className="ilp-fs-2xl-6740">{currency(totals.overdueTotal)}</div>
 </div>
 )}
 <div className="ilp-s5-72ba">
 <div className="ilp-fs-2xs-4ee1">Collected</div>
 <div className="ilp-fs-2xl-06f6"--green)' }}>{currency(totals.paidTotal)}</div>
 </div>
 </div>

 {/* Status pills */}
 <div className="ql-status-pills" >
 {STATUS_FILTERS.map(f => (
 <button
 key={f.value}
 type="button"
 className={`ql-pill${statusFilter === f.value ? ' active' : ''}`}
 onClick={() => setStatusFilter(f.value)}
 >
 {f.label}
 </button>
input ilp-s2-0d9b ))}
 </div>

 {/* Search */}
 <div className="ilp-s3-eb4a">
 <input
 className="input"
 
 placeholder="Search invoices…"
 value={search}
 onChange={e => setSearch(e.target.value)}
 />
 </div>

 {filtered.length === 0 ? (
 <div className="ilp-ta-center-ddc0"sktop-only ilp-s1-000a No invoices match your filter.
 </div>
 ) : (
 <>
 {/* Desktop table */}
 <div className="ds-desktop-only" >
 {headerColumns}
 <div className="ilp-s0-bb14">
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
