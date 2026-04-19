import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import AppShell from '../components/app-shell';
import PageSkeleton from '../components/page-skeleton';
import EmptyState from '../components/empty-state';
import {
 createCustomer, listBookings, listCustomers, listQuotes, updateCustomer,
 uploadCustomersCsvDedup, listInvoices, friendly,
 updateCustomerTags, mergeCustomers, exportCustomersCSV,
} from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { currency, formatDateTime, formatDate } from '../lib/format';
import { toneForStatus, chipForStatus } from '../lib/workflow';

const emptyForm = { name: '', email: '', phone: '', address: '', notes: '' };

// ── Tag colours (cycle through 6) ──
const TAG_COLORS = ['var(--brand)','var(--blue, #2563eb)','var(--green)','var(--purple, #7c3aed)','var(--red)','var(--blue, #0891b2)'];
function tagColor(tag) {
 let h = 0;
 for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff;
 return TAG_COLORS[h % TAG_COLORS.length];
}

// ── Activity timeline for a contact ──
function ActivityTimeline({ quotes, bookings, invoices }) {
 const events = useMemo(() => {
 const all = [];
 for (const q of quotes) all.push({ date: q.created_at, icon: '📄', label: q.title || 'Untitled quote', sub: chipForStatus(q.status), path: `/app/quotes/${q.id}`, tone: toneForStatus(q.status) });
 for (const b of bookings) all.push({ date: b.scheduled_for, icon: '📅', label: b.quote?.title || 'Booking', sub: b.status, path: null, tone: 'sent' });
 for (const i of invoices) all.push({ date: i.created_at, icon: '💰', label: i.invoice_number || 'Invoice', sub: i.status, path: `/app/invoices/${i.id}`, tone: i.status === 'paid' ? 'paid' : 'sent' });
 return all.filter(e => e.date).sort((a, b) => new Date(b.date) - new Date(a.date));
 }, [quotes, bookings, invoices]);

 if (!events.length) return <div className="qb-empty">No activity yet for this contact.</div>;

 return (
 <div className="cp-flex-2652">
 {events.map((ev, i) => (
 <div key={ev.date + ev.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < events.length - 1 ? '1px solid var(--line)' : 'none' }}>
 <div className="cp-fs-xl-7898">{ev.icon}</div>
 <div className="cp-s10-d14f">
 {ev.path
 ? <Link to={ev.path} className="cp-fs-sm-5320">{ev.label}</Link>
 : <span className="cp-fs-sm-dbe4">{ev.label}</span>}
 <div className="cp-flex-ddc8">
 <span className={`status-chip ${ev.tone}`} className="cp-fs-2xs-08bd">{ev.sub}</span>
 <span className="cp-fs-2xs-cf07">{formatDate(ev.date)}</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 );
}

export default function ContactsPage() {
 const { user } = useAuth();
 const { show: showToast } = useToast();
 const [searchParams] = useSearchParams();
 const [customers, setCustomers] = useState([]);
 const [quotes, setQuotes] = useState([]);
 const [bookings, setBookings] = useState([]);
 const [invoices, setInvoices] = useState([]);
 const [selectedId, setSelectedId] = useState('');
 const [isCreating, setIsCreating] = useState(false);
 const [form, setForm] = useState(emptyForm);
 const [search, setSearch] = useState(searchParams.get('q') || '');
 const [sortBy, setSortBy] = useState('alpha');
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [showArchived, setShowArchived] = useState(false);
 const [tab, setTab] = useState('details');
 const [tagFilter, setTagFilter] = useState('');

 // Tags UI state
 const [tagInput, setTagInput] = useState('');

 // Merge state
 const [showMergeModal, setShowMergeModal] = useState(false);
 const [mergeTargetId, setMergeTargetId] = useState('');
 const [merging, setMerging] = useState(false);

 useEffect(() => {
 if (!user) return;
 let cancelled = false;
 Promise.all([listCustomers(user.id), listQuotes(user.id), listBookings(user.id), listInvoices(user.id)])
 .then(([c, q, b, inv]) => {
 if (cancelled) return;
 setCustomers(c || []);
 setQuotes(q || []);
 setBookings(b || []);
 setInvoices(inv || []);
 const qParam = searchParams.get('q');
 if (qParam) {
 const match = (c || []).find(cx => cx.name.toLowerCase().includes(qParam.toLowerCase()));
 if (match) setSelectedId(match.id);
 }
 })
 .finally(() => { if (!cancelled) setLoading(false); });
 return () => { cancelled = true; };
 }, [user]);

 // Collect all unique tags across all customers
 const allTags = useMemo(() => {
 const set = new Set();
 for (const c of customers) {
 const tags = Array.isArray(c.tags) ? c.tags : [];
 for (const t of tags) if (t) set.add(t);
 }
 return [...set].sort();
 }, [customers]);

 const filteredCustomers = useMemo(() => {
 const term = search.trim().toLowerCase();
 let base = customers.filter(c => showArchived || !c.archived_at);
 if (term) base = base.filter(c => [c.name, c.email, c.phone, c.notes].some(v => String(v || '').toLowerCase().includes(term)));
 if (tagFilter) base = base.filter(c => Array.isArray(c.tags) && c.tags.includes(tagFilter));
 if (sortBy === 'recent') base = [...base].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
 else base = [...base].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
 return base;
 }, [customers, search, showArchived, sortBy, tagFilter]);

 const selected = customers.find(c => c.id === selectedId) || null;
 const customerQuotes = quotes.filter(q => q.customer_id === selectedId);
 const customerBookings = bookings.filter(b => b.customer_id === selectedId);
 const customerInvoices = invoices.filter(i => i.customer_id === selectedId);

 const approvedValue = customerQuotes
 .filter(q => ['approved','approved_pending_deposit','scheduled','completed','invoiced','paid'].includes(q.status))
 .reduce((sum, q) => sum + Number(q.total || 0), 0);
 const paidValue = customerInvoices
 .filter(i => i.status === 'paid')
 .reduce((sum, i) => sum + Number(i.total || 0), 0);

 function selectCustomer(c) {
 setSelectedId(c.id);
 setIsCreating(false);
 setForm({ name: c.name || '', email: c.email || '', phone: c.phone || '', address: c.address || '', notes: c.notes || '' });
 setTagInput('');
 setTab('details');
 }

 function startNewContact() {
 setSelectedId('');
 setIsCreating(true);
 setForm(emptyForm);
 setTagInput('');
 setTab('details');
 }

 async function saveCustomer(e) {
 e.preventDefault();
 if (!form.name.trim()) return showToast('Name can\u2019t be blank', 'error');
 if (!form.phone.trim()) return showToast('Add a phone number — that\u2019s how quotes get sent.', 'error');
 setSaving(true);
 try {
 if (selectedId) {
 const updated = await updateCustomer(selectedId, { ...form, archived_at: selected?.archived_at || null });
 if (updated) {
 setCustomers(prev => prev.map(c => c.id === selectedId ? { ...c, ...updated } : c).sort((a,b) => a.name.localeCompare(b.name)));
 showToast('Contact updated', 'success');
 }
 } else {
 const dupe = customers.find(c => c.name?.trim().toLowerCase() === form.name.trim().toLowerCase());
 if (dupe) { setSaving(false); return showToast('A contact with that name already exists', 'error'); }
 const created = await createCustomer(user.id, form);
 if (created) {
 const next = [...customers, { ...created, tags: [] }].sort((a,b) => a.name.localeCompare(b.name));
 setCustomers(next);
 selectCustomer({ ...created, tags: [] });
 showToast('Contact created', 'success');
 } else {
 showToast('Contact may not have saved — check your connection', 'error');
 }
 }
 } catch (error) {
 showToast(error?.message || 'Failed to save contact', 'error');
 } finally {
 setSaving(false);
 }
 }

 async function archiveSelected() {
 if (!selected) return;
 try {
 const updated = await updateCustomer(selected.id, { ...form, archived_at: selected.archived_at ? null : new Date().toISOString() });
 setCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
 showToast(updated.archived_at ? 'Archived' : 'Restored', 'success');
 } catch (error) { showToast(friendly(error), 'error'); }
 }

 // ── Tags ──
 async function addTag(tag) {
 const t = tag.trim();
 if (!t || !selected) return;
 const existing = Array.isArray(selected.tags) ? selected.tags : [];
 if (existing.includes(t)) return;
 const newTags = [...existing, t];
 try {
 const updated = await updateCustomerTags(selected.id, newTags);
 setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, tags: updated.tags || newTags } : c));
 setTagInput('');
 } catch (err) { showToast(friendly(err), 'error'); }
 }

 async function removeTag(tag) {
 if (!selected) return;
 const existing = Array.isArray(selected.tags) ? selected.tags : [];
 const newTags = existing.filter(t => t !== tag);
 try {
 const updated = await updateCustomerTags(selected.id, newTags);
 setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, tags: updated.tags || newTags } : c));
 } catch (err) { showToast(friendly(err), 'error'); }
 }

 // ── Merge ──
 async function handleMerge() {
 if (!mergeTargetId || !selected) return;
 setMerging(true);
 try {
 await mergeCustomers(selected.id, mergeTargetId);
 const next = await listCustomers(user.id);
 setCustomers(next);
 setShowMergeModal(false);
 setMergeTargetId('');
 showToast('Contacts merged', 'success');
 } catch (err) { showToast(friendly(err), 'error'); }
 finally { setMerging(false); }
 }

 // ── CSV import (dedup-aware) ──
 async function importCsv(e) {
 const file = e.target.files?.[0];
 if (!file) return;
 try {
 const result = await uploadCustomersCsvDedup(user.id, file);
 const next = await listCustomers(user.id);
 setCustomers(next);
 showToast(`${result.inserted} imported, ${result.skipped} duplicates skipped`, 'success');
 } catch (error) { showToast(friendly(error), 'error'); }
 e.target.value = '';
 }

 return (
 <AppShell title="Contacts">
 {loading ? (
 <div className="cp-s11-9bed">
 <PageSkeleton variant="list" />
 </div>
 ) : (
 <div className={`ct-layout${selectedId || isCreating ? ' ct-detail-active' : ''}`}>
 {/* ── Left: contact list ── */}
 <section className="ct-list-panel">
 <div className="ct-list-header">
 <h3 className="ct-list-title">Contacts</h3>
 <button className="btn btn-primary btn-sm" type="button" onClick={startNewContact}>+ New</button>
 </div>
 <input className="qb-inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…" />

 {/* Tag filter chips */}
 {allTags.length > 0 && (
 <div className="cp-flex-c32e">
 <button
 type="button"
 className="ct-tag-chip"
 onClick={() => setTagFilter('')}
 style={{ fontSize: 'var(--text-2xs)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--line)', background: tagFilter === '' ? 'var(--primary)' : 'var(--surface)', color: tagFilter === '' ? '#fff' : 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
 >All</button>
 {allTags.map(tag => (
 <button
 key={tag}
 type="button"
 className="ct-tag-chip"
 onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
 style={{ fontSize: 'var(--text-2xs)', padding: '2px 8px', borderRadius: 99, border: `1px solid ${tagColor(tag)}`, background: tagFilter === tag ? tagColor(tag) : 'transparent', color: tagFilter === tag ? '#fff' : tagColor(tag), cursor: 'pointer', fontWeight: 600 }}
 >{tag}</button>
 ))}
 </div>
 )}

 <div className="ct-list-meta">
 <span className="qb-muted">{filteredCustomers.length} contacts</span>
 <div className="cp-flex-58b0">
 <button className="ct-toggle-btn" type="button" onClick={() => setSortBy(s => s === 'alpha' ? 'recent' : 'alpha')}>{sortBy === 'alpha' ? 'A→Z' : 'Recent'}</button>
 <label className="ct-csv-btn">Import CSV<input hidden type="file" accept=".csv" onChange={importCsv} /></label>
 <button className="ct-toggle-btn" type="button" onClick={() => exportCustomersCSV(filteredCustomers)}>Export CSV</button>
 <button className="ct-toggle-btn" type="button" onClick={() => setShowArchived(p => !p)}>{showArchived ? 'Hide archived' : 'Show archived'}</button>
 </div>
 </div>
 <div className="ct-list">
 {filteredCustomers.length ? filteredCustomers.map(c => {
 const qc = quotes.filter(q => q.customer_id === c.id).length;
 const ctags = Array.isArray(c.tags) ? c.tags : [];
 return (
 <button type="button" key={c.id} className={`ct-item ${selectedId === c.id ? 'active' : ''} ${c.archived_at ? 'archived' : ''}`} onClick={() => selectCustomer(c)}>
 <div className="ct-avatar">
 {(c.name || '?').slice(0, 2).toUpperCase()}
 </div>
 <div className="cp-s10-d14f">
 <div className="ct-item-name">{c.name}</div>
 <div className="ct-item-sub">{[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'}</div>
 {ctags.length > 0 && (
 <div className="cp-flex-d452">
 {ctags.slice(0, 3).map(t => (
 <span key={t} style={{ fontSize: 'var(--text-2xs)', padding: '1px 5px', borderRadius: 99, background: tagColor(t) + '22', color: tagColor(t), fontWeight: 700, border: `1px solid ${tagColor(t)}44` }}>{t}</span>
 ))}
 {ctags.length > 3 && <span className="cp-fs-2xs-cf07">+{ctags.length - 3}</span>}
 </div>
 )}
 </div>
 {qc > 0 && <span className="ct-item-badge">{qc}</span>}
 </button>
 );
 }) : (
 <div>
 <EmptyState
 icon="📇"
 title="No contacts yet"
 description="Your customers show up here as you send quotes. You can also add them manually."
 actionLabel="+ Add contact"
 onAction={() => { setIsCreating(true); setForm(emptyForm)btn btn-secondary btn-sm cp-s9-911c>
 <div className="cp-flex-aebc">
 <label className="btn btn-secondary btn-sm">
 Import CSV
 <input hidden type="file" accept=".csv" onChange={importCsv} />
 </label>
 </div>
 </div>
 )}
 </div>
 </section>

 {/* ── Right: detail panel ── */}
 <section className="ct-detail">
 {selected && (
 <button className="ct-close-btn" type="button" onClick={() => setSelectedId('')}>← Back to list</button>
 )}

 {selected && (
 <div className="ct-tabs">
 <button type="button" className={`ct-tab ${tab === 'details' ? 'active' : ''}`} onClick={() => setTab('details')}>Details</button>
 <button type="button" className={`ct-tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>Activity ({customerQuotes.length + customerBookings.length + customerInvoices.length})</button>
 </div>
 )}

 {/* Details tab / new contact form */}
 {(selected || isCreating) && (tab === 'details' || !selected) && (
 <div className="qb-card">
 <div className="qb-card-header">
 <h3 className="qb-card-title">{selected ? selected.name : 'New contact'}</h3>
 {selected && (
 <div className="cp-flex-353f">
 <Link className="btn btn-primary btn-sm" to={`/app/quotes/new?customer=${selected.id}`}>New quote</Link>
 <Link className="btn btn-secondary btn-sm" to={`/app/bookings?customer=${selected.id}`}>Schedule</Link>
 </div>
 )}
 </div>
 <form onSubmit={saveCustomer} className="ct-form">
 <input className="qb-inp" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" required />
 <div className="qb-r2">
 <input className="qb-inp" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone *" type="tel" required />
 <input className="qb-inp" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email (optional)" type="email" />
 </div>
 <input className="qb-inp" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Address (optional)" />
 <textarea className="qb-ta" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes — access codes, site details" rows={3} />
 <div className="ct-form-actions">
 <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : (selected ? 'Save' : 'Create')}</button>
 {selected?.phone && <a clbtn btn-secondary btn-sm cp-s8-bd50ry btn-sm" href={`tel:${selected.phone}`}>Call</a>}
 {selected?.phone && <a className="btn btn-secondary btn-sm" href={`sbtn btn-ghost btn-sm cp-s7-7f0e`} >Text</a>}
 {selected && <button className="btn btn-ghost btn-sm" type="button" onClick={archiveSelected} >{selected.archived_at ? 'Restore' : 'Archive'}</button>}
 {selected && customers.filbtn btn-ghost btn-sm cp-s7-7f0elected.id && !c.archived_at).length > 0 && (
 <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowMergeModal(true)} >Merge…</button>
 )}
 </div>
 </form>

 {/* Tags section */qb-label cp-s5-78e5 {selected && (
 <div className="cp-s6-fe6f">
 <label className="qb-label">Tags</label>
 <div className="cp-flex-5924">
 {(Array.isArray(selected.tags) ? selected.tags : []).map(tag => (
 <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', padding: '3px 8px', borderRadius: 99, background: tagColor(tag) + '22', color: tagColor(tag), border: `1px solid ${tagColor(tag)}55`, fontWeight: 700 }}>
 {tag}
 <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => removeTag(tag)} className="jd-photo-dismiss"><X size={10} /></button>
 </span>
 ))}
 {(Array.isArray(selected.tags) ? selected.tags : []).length === 0 && (
 <span className="cp-fs-xs-6e5f">No tags yet</span>
 )}
 </div>qb-inp cp-fs-xs-73cb <div className="cp-flex-353f">
 <input
 className="qb-inp"
 
 value={tagInput}
 onChange={e => setTagInput(e.target.value)}
 placeholder="Add tag (e.g. commercial, repeat)"
 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
 list="tag-suggestions"
 />
 <datalist id="tag-suggestions">
 {allTags.map(t => <option key={t} value={t} />)}
 </datalist>
 <button className="btn btn-secondary btn-sm" type="button" onClick={() => addTag(tagInput)}>Add</button>
 </div>
 </div>
 )}

 {/* Inline metrics */}
 {selected && (
 <div className="ct-metrics">
 <div className="ct-metric"><span className="ct-metric-val">{customerQuotes.length}</span><span className="ct-metric-label">Quotes</span></div>
 <div className="ct-metric"><span className="ct-metric-val">{currency(approvedValue)}</span><span className="ct-metric-label">Won value</span></div>
 <div className="ct-metric"><span className="ct-metric-val">{customerInvoices.length}</span><span className="ct-metric-label">Invoices</span></div>
 <div className="ct-metric"><span className="ct-metric-val">{currency(paidValue)}</span><span className="ct-metric-label">Paid</span></div>
 </div>
 )}
 </div>
 )}

 qb-label cp-s4-f682Activity tab — chronological timeline */}
 {tab === 'activity' && selected && (
 <div className="qb-card">
 <label className="qb-label">Activity timeline</label>
 <ActivityTimeline quotes={customerQuotes} bookings={customerBookings} invoices={customerInvoices} />
 </div>
 )}

 {/* Quotes tab */}
 {tab === 'history' && selected && (
 <div className="qb-card">
 <label className="qb-label">Quote history</label>
 <div className="ct-history">
 {customerQuotes.length ? customerQuotes.map(q => (
 <Link key={q.id} to={`/app/quotes/${q.id}`} className="ct-history-item">
 <div>
 <strong>{q.title || 'Untitled'}</strong>
 <span className={`status-chip ${toneForStatus(q.status)}`} className="cp-fs-2xs-1e1c">{chipForStatus(q.status)}</span>
 </div>
 <span>{currency(q.total || 0)}</span>
 </Link>
 )) : <div className="qb-empty">No quotes yet for this contact.</div>}
 </div>
 </div>
 )}

 {/* Invoices tab */}
 {tab === 'invoices' && selected && (
 <div className="qb-card">
 <label className="qb-label">Invoices</label>
 <div className="ct-history">
 {customerInvoices.length ? customerInvoices.map(inv => (
 <Link key={inv.id} to={`/app/invoices/${inv.id}`} className="ct-history-item">
 <div>
 <strong>{inv.invoice_number || inv.title || 'Invoice'}</strong>
 <span className={`ct-inv-status ${inv.status}`} className="cp-s3-8ccc">{inv.status === 'paid' ? '✓ Paid' : inv.status === 'sent' ? 'Sent' : inv.status === 'overdue' ? '⚠ Overdue' : 'Draft'}</span>
 </div>
 qb-muted cp-fs-2xs-69e0 <div className="cp-ta-right-a1ae">
 <div>{currency(inv.total || 0)}</div>
 {inv.issued_at && <div className="qb-muted">{formatDate(inv.issued_at)}</div>}
 </div>
 </Link>
 )) : <div className="qb-empty">No invoices yet for this contact.</div>}
 </div>
 </div>
 )}

 {/* Schedule tab */}
 {tab === 'schedule' && selected && (
 <div className="qb-card">
 <label className="qb-label">Bookings</label>
 <div className="ct-history">
 {customerBookings.length ? customerBookings.map(b => (
 <div key={b.id}qb-muted cp-s3-8cccme="ct-history-item">
 <div>
 <strong>{formatDateTime(b.scheduled_for)}</strong>
 <span className="qb-muted">{b.notes || 'Scheduled visit'}</span>
 </div>
 <span className="qb-muted">{b.status}</span>
 </div>
 )) : <div className="qb-empty">No bookings for this contact yet.</div>}
 </div>
 </div>
 )}

 {/* Empty state */}
 {!selected && !isCreating && (
 <div className="cp-ta-center-7690">
 <div className="cp-flex-4efc"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
 btn btn-primary btn-sm cp-s2-9313base-a3b5">Select a contact to view details</p>
 <button className="btn btn-primary btn-sm" type="button" onClick={startNewContact} >+ New contact</button>
 </div>
 )}
 </section>
 </div>
 )}

 {/* ── Merge modal ── */}
 {showmodal-content cp-s1-bb70 selected && (
 <div className="modal-overlay" onClick={() => setShowMergeModal(false)}>
 <div className="modal-content" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Merge contact">
 <h3 className="cp-fs-lg-5574">Merge contact</h3>
 <p className="cp-fs-sm-5847">
 Keep <strong>{selected.name}</strong>, merge from:
 </p>
 <label className="qb-label">Select duplicate to remove</label>
 <select
 className="qb-inp"
 value={mergeTargetId}
 onChange={e => setMergeTargetId(e.target.value)}
 >
 <option value="">Choose contact…</option>
 {(() => {
 const others = customers.filter(c => c.id !== selected.id && !c.archived_at);
 const selName = (selected.name || '').toLowerCase();
 const similar = others.filter(c => {
 const n = (c.name || '').toLowerCase();
 return n && selName && (n.includes(selName) || selName.includes(n) || n.split(' ').some(w => w.length > 2 && selName.includes(w)));
 });
 const rest = others.filter(c => !similar.includes(c));
 const sorted = [...similar, ...rest];
 return sorted.map((c, i) => (
 <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ''}{i < similar.length && similar.length > 0 ? ' ★' : ''}</option>
 ));
 })()}
 </select>
 <div className="cp-flex-e2c8">
 <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setShowMergeModal(false); setMergeTargetId(''); }}>Cancel</button>
 <button
 classNbtn btn-primary btn-sm cp-s0-c70ftn-sm"
 type="button"
 disabled={!mergeTargetId || merging}
 onClick={handleMerge}
 
 >
 {merging ? 'Merging…' : 'Merge & delete duplicate'}
 </button>
 </div>
 </div>
 </div>
 )}
 </AppShell>
 );
}
