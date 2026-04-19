import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { currency as formatCurrency } from '../lib/format';
import PublicPageShell from '../components/public-page-shell';
import PublicLoadingState from '../components/public-loading-state';
import PublicErrorState from '../components/public-error-state';

export default function PublicAdditionalWorkPage() {
 const { shareToken } = useParams();
 const [request, setRequest] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [mode, setMode] = useState(null); // 'question' | 'decline'
 const [feedback, setFeedback] = useState('');
 const [sending, setSending] = useState(false);
 const [actionDone, setActionDone] = useState('');
 
 // Country-aware currency formatter bound to request's country
 const currency = (n) => formatCurrency(n, request?.country);

 useEffect(() => {
 fetch(`/api/public-additional-work?token=${shareToken}`)
 .then(async r => {
 const j = await r.json();
 if (!r.ok) throw new Error(j.error || 'Could not load');
 return j.request;
 })
 .then(setRequest)
 .catch(e => setError('This request could not be loaded. Try refreshing the page.'))
 .finally(() => setLoading(false));
 }, [shareToken]);

 async function handleAction(action, body = {}) {
 setSending(true); setError('');
 try {
 const r = await fetch('/api/public-additional-work', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ token: shareToken, action, ...body }),
 });
 const data = await r.json();
 if (!r.ok) throw new Error(data.error || 'Could not process');
 setRequest(prev => ({ ...prev, status: data.status }));
 setMode(null); setFeedback(''); setActionDone(action);
 } catch (e) { setError('This request could not be loaded. Try refreshing the page.'); }
 finally { setSending(false); }
 }

 if (loading) return <PublicLoadingState label="Loading request…" />;

 if (error && !request) return (
 <PublicErrorState
 docType="additional-work"
 contractorName={null}
 onRetry={() => window.location.reload()}
 />
 );

 if (!request) return null;

 const items = request.additional_work_items || [];
 const isApproved = request.status === 'approved';
 const isDeclined = request.status === 'declined';
 const isNeedsReview = request.status === 'needs_review';
 const canAct = !isApproved && !isDeclined;

 const statusBanner = isApproved
 ? { bg: 'var(--green-bg)', border: 'rgba(21,128,61,.2)', icon: '✅', color: 'var(--green)', title: 'Additional work approved', sub: 'Your contractor will proceed with the extra work.' }
 : isNeedsReview
 ? { bg: 'var(--blue-bg)', border: 'rgba(72,120,208,.2)', icon: null, color: 'var(--blue)', title: 'Question sent', sub: 'Your contractor will reply to your question.' }
 : isDeclined
 ? { bg: 'var(--red-bg)', border: 'rgba(180,35,24,.15)', icon: null, color: 'var(--red)', title: 'Additional work declined', sub: 'This extra work will not be performed.' }
 : null;

 const awStatusLabel = isApproved ? 'Approved' : isDeclined ? 'Declined' : isNeedsReview ? 'Needs Review' : 'Pending Approval';
 const awStatusTone = isApproved ? 'approved' : isDeclined ? 'declined' : isNeedsReview ? 'revision' : 'sent';

 return (
 <PublicPageShell contractorName={request.contractor_company || request.contractor_name} logoUrl={null}>
 <div className="marketing-shell">

 <main className="container ppanel paw-flex-a4aa-quote-layout">
 <section className="stack-lg">

 {/* Context banner — per spec: show original quote vs additional work status */}
 <div classNamuted small paw-s18-19df>
 <div className="paw-s19-ad10">
 <div className="muted small" >Original Quote</div>
 <div className="paw-fs-sm-5aa9"-text-sm)" }}>Approved</div>
 </div>
 <div className="paw-s19-ad10">
 <div className="muted small" >Additional Work</div>
 <div style={{ fontWeight: 700, color: isApproved ? 'var(--green)' : isDeclined ? 'var(--red)' : 'var(--amber)', fontSize: 'var(--text-sm)' }}>
 {isApproved ? 'Approved' : isDeclined ? 'Declined' : isNeedsReview ? 'Question Sent' : 'Pending Approval'}
 </div>
 </div>
 </div>

 {statusBanner && (
 <div className="panel" style={{ background: statusBanner.bg, border: `1px solid ${statusBanner.border}`, padding: '16px 20px' }}>
 <div className="paw-flex-61c6">
 <span className="paw-s17-14e9">{statusBanner.icon}</span>
 <div>
 <strong style={{ color: statusBanner.color, display: 'block' }}>{statusBanner.title}</strong>
 <span className="muted small">{statusBanner.sub}</span>
 eyebrow paw-s16-9ac5 </div>
 </div>
 </div>
 )}

 {/* Hero card */}
 <div className="panel public-hero-card">
 <div className="eyebrow" >Additional Work Approval</div>
 <quote-meta-grid public-quote-grid paw-s14-7e2aest.title}</h1>

 <div className="quote-meta-grid public-quote-grid" >
 <div><span className="muted small">Prepared for</span><div className="paw-s13-f2ff">{request.customer_name || 'You'}</div></div>
 <div><span className="muted small">Related to</span><div className="paw-s13-f2ff">{request.original_quote_title || 'Original quote'}</div></div>
 {request.contractor_phone && (
 <div><span className="muted small">Contact</span><div className="paw-s13-f2ff"><a href={`tel:${request.contractor_phone}`} className="paw-s12-feea">{request.contractor_phone}</a></div></div>
 )}
 </div>
 </div>

 {/* Reason / context */}
 {request.reason && (
 <div className="panel">
 <div className="eyebrow">Why this is needed</div>
 <p className="paw-s11-1bc5">{request.reason}</p>
 </div>
 )}

 {/* Line items */}
 <div className="panel stack">
 <div className="eyebrow">Additional items</div>
 {items.map(item => (
 <div keymuted small paw-s10-3315className="list-card">
 <div className="paw-s0-f72f">
 <strong>{item.name}</stlist-card-right paw-ta-right-445e {item.notes && <div className="muted small" >{item.notes}</div>}
 </div>
 <div className="list-card-right" >
 <div className="muted small">{item.quantity} × {currency(item.unit_price)}</div>
 <sttotals-card paw-s1-e058ncy(Number(item.quantity || 0) * Number(item.unit_price || 0))}</strong>
 </div>
 </div>
 ))}
 <div className="totals-card" >
 <div className="total-row"><span>Additional subtotal</span><strong>{currency(request.subtotal)}</strong></div>
 <div className="total-row"><span>Tax</span><strong>{currency(request.tax)}</strong></div>
 <div className="total-row grand"><span>Additional total</span><strong>{currency(request.total)}</strong></div>
 </div>
 {request.original_quote_total && (
 <muted small paw-flex-fb50me="paw-s9-d5d3">
 <div className="muted small" >
 <span>Original quote total</span>
 <span>{currency(request.original_quote_total)}</span>
 </div>
 <div className="paw-flex-a3f6">
 <span>New combined total</span>
 <span>{currency(Number(request.original_quote_total || 0) + Number(request.total || 0))}</span>
 </div>
 </div>
 )}
 </div>
 </senotice-banner paw-s8-81a9 {/* Sidebar actions */}
 <aside className="stack-lg public-actions-sidebar">

 {actionDone === 'approve' && (
 <div className="notice-banner" >
 <strongnotice-banner paw-s7-ab5c work approved.</strong> Your contractor will proceed.
 </div>
 )}
 {actionDone === 'question' && (
 <div className="notice-banner" >
 notice-banner paw-s6-5f49ion sent.</strong> Your contractor will reply directly.
 </div>
 )}
 {actionDone === 'decline' && (
 <div className="notice-banner" >
 eyebrow paw-s5-8766 <strong>Declined.</strong> This work will not be performed.
 </div>
 )}

 <div className="panel sticky-panel">
 <div className="eyebrow" >
 muted small paw-s4-e5a8 {isApproved ? 'Approved' : isDeclined ? 'Declined' : isNeedsReview ? 'Question sent' : 'Review additional work'}
 </div>
 <div className="muted small" >
 {isApproved ? 'Your contractor will proceed with the extra work.'
 : isDeclined ? 'This extra work will not be performed.'
 : isNeedsReview ? 'Your contractor will respond to your question.'
 : 'Approving confirms you accept the additional scope and cost.'}
 </div>
 <div className="stack">
 {canAct && !isNeedsReview && (
 <button className="btn btn-primary full-width" type="button" disabled={sending && !mode} onClick={() => handleAction('approve')}>
 {sending && !mode ? 'Submitting…' : 'Approve additional work'}
 </button>
 )}

 {canAct && (
 <>
 <button className="btn btn-secondary full-width" type="button" onClick={() => { setMode(mode === 'question' ? null : 'question'); setFeedback(''); }}>
 stack paw-s3-12e2 {mode === 'question' ? 'Cancel' : 'Ask a question'}
 </button>
 {mode === 'question' && (
 <div className="stack" >
 <textarea className="input textarea-md" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="What would you like to know? Your contractor will reply directly." rows={3} />
 <button className="btn btn-primary full-width" type="button" disabled={sending || !feedback.trim()} onClick={() => handleAction('question', { feedback })}>
 {sending ? 'Sending…' : 'Send question'}
 </button>
 </div>
 )}
 btn btn-secondary full-width paw-fs-xs-2c9d )}

 {canAct && !isNeedsReview && (
 <>
 <button className="btn btn-secondary full-width" type="button" onClick={() => { setMode(mode === 'decline' ? null : 'decline'); setFeedback(''); }}>
 stack paw-s3-12e2 {mode === 'decline' ? 'Cancel' : 'Decline additional work'}
 </button>
 {mode === 'decline' && (
 <div className="stack" >
 <textarea className="input textarea-md" value={feedback} onChabtn btn-secondary full-width paw-s2-622cet.value)} placeholder="Optional: reason for declining." rows={2} />
 <button className="btn btn-secondary full-width" type="button" disabled={sending} onClick={() => handleAction('decline', { feedback })}>
 {sending ? '…' : 'Confirm decline'}
 </button>
 </div>
 )}
 </>
 )}

 {error && <div className="paw-fs-sm-c100">{estack paw-s1-e058</div>}
 </div>
 </div>

 <div className="panel soft-panel">
 <div className="eyebrow">Prepared by</div>
 <div className="stack" >
 <div><strong>{request.contractor_name || 'Your contractor'}</strong></div>
 {request.contractor_companbtn btn-secondary paw-ta-center-99aeme="muted small">{request.contractor_company}</div>}
 {request.contractor_phone && <a className="btn btn-secondary" href={`tel:${request.contractor_phone}`} >{request.contractor_phone}</a>}
btn btn-secondary full-width paw-ta-center-99ae </div>

 {request.original_quote_token && (
 <a className="btn btn-secondary full-width" href={`/public/${request.original_quote_token}`} >
 View original quote
 </a>
 )}
 </abtn btn-primary paw-s0-f72f{/* Mobile bottom bar */}
 {canAct && !isNeedsReview && (
 <div className="public-actions-mobile-bar">
 <button className="btn btn-primary" type="btn btn-secondary paw-s0-f72f{sending} onClick={() => handleAction('approve')}>
 {sending ? '…' : 'Approve'}
 </button>
 <button className="btn btn-secondary" type="button" onClick={() => setMode(mode === 'question' ? null : 'question')}>
 Ask a question
 </button>
 </div>
 )}
 {(isApproved || isDeclined || isNeedsReview) && (
 <div className="public-actions-mobile-bar">
 <div className="paw-ta-center_fs-sm-9383">
 {isApproved ? 'Approved' : isDeclined ? 'Declined' : 'Question sent'}
 </div>
 </div>
 )}
 </main>
 </div>
 </PublicPageShell>
 );
}
