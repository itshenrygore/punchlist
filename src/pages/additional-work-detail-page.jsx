import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Phone, Mail } from 'lucide-react';
import AppShell from '../components/app-shell';
import { AdditionalWorkDetailSkeleton } from '../components/skeletons';
import StatusBadge from '../components/status-badge';
import { getAdditionalWork, friendly, updateAdditionalWork, deleteAdditionalWork, sendAdditionalWork, getProfile } from '../lib/api';
import { currency, formatDate } from '../lib/format';
import { useAuth } from '../hooks/use-auth';
import { useToast } from '../components/toast';
import { safeWriteClipboard } from '../lib/utils';
import { smsNotify } from '../lib/sms';

export default function AdditionalWorkDetailPage() {
 const { requestId } = useParams();
 const { user } = useAuth();
 const navigate = useNavigate();
 const { show: toast } = useToast();
 const [awr, setAwr] = useState(null);
 const [loading, setLoading] = useState(true);
 const [confirmDelete, setConfirmDelete] = useState(false);
 const [profile, setProfile] = useState(null);

 useEffect(() => {
 if (!requestId) return;
 getAdditionalWork(requestId)
 .then(data => setAwr(data))
 .catch(e => toast(friendly(e), 'error'))
 .finally(() => setLoading(false));
 }, [requestId]);

 useEffect(() => {
 if (user) getProfile(user.id).then(setProfile).catch(e => console.warn('[PL]', e));
 }, [user]);

 const shareUrl = awr ? `${window.location.origin}/public/aw/${awr.share_token}` : '';
 const isDraft = awr?.status === 'draft';
 const isApproved = awr?.status === 'approved';
 const isDeclined = awr?.status === 'declined';
 const isNeedsReview = awr?.status === 'needs_review';
 const isSent = ['sent', 'viewed'].includes(awr?.status);

 async function handleSend() {
 try {
 const updated = await sendAdditionalWork(awr.id);
 setAwr(p => ({ ...p, ...updated, status: 'sent' }));

 const customerEmail = awr.customer?.email;
 if (customerEmail) {
 try {
 const r = await fetch('/api/send-quote-email', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 action: 'send_additional_work',
 customerEmail,
 customerName: awr.customer?.name || '',
 contractorName: profile?.company_name || profile?.full_name || '',
 contractorPhone: profile?.phone || '',
 title: awr.title || '',
 total: awr.total || 0,
 shareToken: awr.share_token,
 country: awr.quote?.province || profile?.country || 'CA',
 }),
 });
 if (r.ok) {
 toast('AWR emailed to ' + (awr.customer?.name || customerEmail), 'success');
 // SMS — notify customer about additional work request
 if (awr.customer?.phone && awr.share_token) {
 smsNotify.additionalWork({
 to: awr.customer.phone,
 contractorName: profile?.company_name || profile?.full_name || 'Your contractor',
 title: (awr.title || 'additional work').slice(0, 40),
 total: awr.total,
 shareToken: awr.share_token,
 country: awr.quote?.province || profile?.country || 'CA',
 });
 }
 return;
 }
 } catch (e) { console.warn("[PL]", e); }
 }

 // Fallback: mailto
 const to = customerEmail || '';
 if (!to) { toast('No email on file for this customer', 'error'); return; }
 const firstName = awr.customer?.name?.split(' ')[0] || '';
 const subject = encodeURIComponent(`Additional Work: ${awr.title}`);
 const body = encodeURIComponent(
 `Hi${firstName ? ' ' + firstName : ''},\n\nWhile working on your job, we identified some additional work that needs your approval:\n\n${shareUrl}\n\nPlease review and let me know if you have any questions.`
 );
 window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
 toast('Opening email…', 'info');
 } catch (e) { toast(friendly(e), 'error'); }
 }

 async function handleSendText() {
 try {
 if (awr.status === 'draft') {
 const updated = await sendAdditionalWork(awr.id);
 setAwr(p => ({ ...p, ...updated, status: 'sent' }));
 }
 const phone = awr.customer?.phone || '';
 if (!phone) { toast('No phone number on file for this customer', 'error'); return; }
 const firstName = awr.customer?.name?.split(' ')[0] || '';
 const msgBody = `Hi${firstName ? ' ' + firstName : ''}, we found some additional work on your job that needs your approval: ${shareUrl}`;
 const result = await smsNotify.customMessage({ to: phone, body: msgBody });
 if (result?.ok) {
 toast(`Texted to ${firstName || phone}`, 'success');
 } else {
 const body = encodeURIComponent(msgBody);
 window.open(`sms:${phone}?body=${body}`, '_self');
 toast('Opening messages…', 'info');
 }
 } catch (e) { toast(friendly(e), 'error'); }
 }

 async function handleCopyLink() {
 try {
 if (awr.status === 'draft') {
 const updated = await sendAdditionalWork(awr.id);
 setAwr(p => ({ ...p, ...updated, status: 'sent' }));
 }
 await safeWriteClipboard(shareUrl);
 toast('Link copied', 'success');
 } catch { toast('Copy failed', 'error'); }
 }

 async function handleDelete() {
 try { await deleteAdditionalWork(awr.id); toast('Deleted', 'success'); navigate(`/app/quotes/${awr.quote_id}`); }
 catch (e) { toast(friendly(e), 'error'); }
 }

 if (loading) return <AdditionalWorkDetailSkeleton />;
 if (!awr) return <AppShell title="Additional Work"><div className="empty-state">Request not found.</div></AppShell>;

 const items = awr.additional_work_items || [];

 return (
 <AppShell title="Additional Work" actions={
 <Link className="btn btn-secondary btn-sm" to={`/app/quotes/${awr.quote_id}`}>← Back to quote</Link>
 }>
 <div className="qd-grid">

 {/* ── LEFT ── *comm-card awdp-s12-f682 <section className="qd-main">

 {/* Customer message / needs review */}
 {isNeedsReview && awr.customer_message && (
 <div className="comm-card" >
 <strong className="awdp-block-22b7"small awdp-s11-e058omer has a question</strong>
 <p className="awdp-fs-sm-d989">"{awr.customer_message}"</p>
 <div className="muted scomm-card awdp-s10-6aedply directly or update and resend the request.</div>
 </div>
 )}

 {isDeclined && (
 <div className="comm-card" >
 <strong className="awdp-block-f4c9">Customer declined</strong>
 {awr.customer_message && <p className="awdp-fs-sm-d989">"{awr.customer_message}"</p>}
 </div>
 )}

 {isApproved && (
 <div className="awdp-fs-sm-bc9d"-text-sm)' }}>
 <strong className="awdp-s9-286c">✅ Approved</strong>
 muted small awdp-s7-12e2pan className="muted" >This additional work has been approved by the customer.</span>
 {awr.approved_at && <div className="muted small"qb-card-header awdp-s6-239ermatDate(awr.approved_at)}</div>}
 </div>
 )}

 <div className="qb-card">
 <div className="qb-card-header" >
 <div>
 <div className="awdp-flex-343e">
 <span className="awdp-fs-2xs-30c9">Additional Work</span>
 </div>
 <h2 className="awdp-s5-d359">{awr.title}</h2>
 <div className="qb-muted">{awr.customer?.name || 'No custqd-meta awdp-s4-9313· Related to: {awr.quote?.title || 'Quote'}</div>
 </div>
 <StatusBadge status={awrqb-label awdp-s3-24e8 />
 </div>

 <div className="qd-meta" >
 <div className="qd-meta-item">
 <span className="qb-label" >Customeqb-label awdp-s3-24e8
 <span>{awr.customer?.name || 'Not linked'}</span>
 </div>
 <div className="qd-meta-item">
 <span className="qb-label" >Contact</span>
 <div className="awdp-flex-4ca2">
 {awr.customer?.phone && <a href={`tel:${awr.customer.phone}`} className="btn btn-secondary btn-sm" aria-label={`Call ${awr.customer.name || 'customer'}`} title="Call"><Phone size={14} /></a>}
 {awr.customer?.email && <a href={`mailto:${awr.customer.email}`} className="btn btn-secondary btn-sm" aria-label={`Email ${awr.customer.name || qb-label awdp-s3-24e8r'}`} title="Email"><Mail size={14} /></a>}
 </div>
 </div>
 <div className="qd-meta-item">
 <span className="qb-label" >Sent</span>
 <span>{awr.sent_at ? formatDate(awr.sent_at) : 'Not sent'}</span>
 </div>
 </div>

 {awr.reason && (
 <div className="awdp-s2-8ca1">
 <span className="qb-label">Reason</span>
 <p className="awdp-fs-sm-3106">{awr.reason}</p>
 </div>
 )}

 {/* Line items */}
 <div className="awdp-s1-d69a">
 <div className="qb-group-label">Additional items</div>
 {items.map(item => (
 <div key={item.id} className="qd-line-item">
 <div className="qd-li-info">
 <strong>{item.name}</strong>
 {item.notes && <span className="qb-muted">{item.notes}</span>}
 </div>
 <div className="qd-li-price">
 <span className="qb-muted">{item.quantity} × {currency(item.unit_price)}</span>
 <strong>{currency(Number(item.quantity || 0) * Number(item.unit_price || 0))}</strong>
 </div>
 </div>
 ))}
 </div>

 <div className="qd-totals">
 <div className="qb-total-row"><span>Subtotal</span><span>{currency(awr.subtotal)}</span></div>
 <div className="qb-total-row"><span>Tax</span><span>{currency(awr.tax)}</span></div>
 <div className="qb-total-row grand"><span>Total</span><span>{currency(awr.total)}</span></div>
 </div>
 </div>
 </section>

 {/* ── RIGHT SIDEBAR ── */}
 <aside className="qd-sidebar">

 {/* Send / share */}
 <div className="qb-card">
 <span className="qb-label">Send to customer</span>
 <div className="qd-send-grid">
 {awr.customer?.phone && <button className="btn btn-primary full-width" type="button" onClick={handleSendText}>Send via text</button>}
 <button className="btn btn-secondary full-width" type="button" onClick={handleCopyLink}>Copy link</button>
 </div>
 <a href={shareUrl} target="_blank" rel="noreferrer" className="qd-share-link">Preview customer view ↗</a>
 </div>

 {/* Actions */}
 <div className="qb-card">
 <span className="qb-label">Actions</span>
 <div className="qd-send-grid">
 <Link className="btn btn-secondary full-width" to={`btn btn-secondary full-width awdp-s0-622c}>View original quote</Link>
 {isDraft && !confirmDelete && (
 <button className="btn btn-secondary full-width" type="button" awdp-ta-center-99ae} onClick={() => setConfirmDelete(true)}>Delete draft</button>
 )}
 {confirmDelete && (
 <>
 <div className="qb-muted" >Thisbtn btn-secondary btn-sm awdp-s0-622c
 <div className="awdp-grid-93b7">
 <button className="btn btn-secondary btn-sm" type="button" onClick={handleDelete}>Delete</button>
 <button className="btn btn-secondary btn-sm" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
 </div>
 </>
 )}
 </div>
 </div>
 </aside>
 </div>
 </AppShell>
 );
}
