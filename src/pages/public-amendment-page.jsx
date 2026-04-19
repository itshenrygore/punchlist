import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { currency as formatCurrency, formatDate } from '../lib/format';
import PublicPageShell from '../components/public-page-shell';
import SignaturePad from '../components/signature-pad';
import AmendmentDiff from '../components/amendment-diff';
import PublicLoadingState from '../components/public-loading-state';
import PublicErrorState from '../components/public-error-state';
import '../styles/document.css';
import { estimateMonthly, showFinancing } from '../lib/financing';

/* ═══════════════════════════════════════════════════════════════════════════
 PUNCHLIST — Public Amendment Page (M6 §6.3)
 Merges original quote + amendment into a single timeline document.
 Customer sees: Pricing hero → Combined diff (original + delta) → Sign CTA.
 ═══════════════════════════════════════════════════════════════════════════ */

export default function PublicAmendmentPage() {
 const { shareToken } = useParams();
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [data, setData] = useState(null);
 const [mode, setMode] = useState(null); // 'sign' | 'decline' | null
 const [sending, setSending] = useState(false);
 const [actionDone, setActionDone] = useState('');

 useEffect(() => {
 fetch(`/api/public-amendment?token=${shareToken}`)
 .then(async r => {
 const text = await r.text();
 let j;
 try { j = JSON.parse(text); } catch { throw new Error('Server error'); }
 if (!r.ok) throw new Error(j.error || 'Amendment not found');
 return j;
 })
 .then(setData)
 .catch(e => setError(e.message || 'Could not load amendment'))
 .finally(() => setLoading(false));
 }, [shareToken]);

 async function submitSignature(sigData) {
 setSending(true); setError('');
 try {
 const r = await fetch('/api/public-amendment', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ token: shareToken, action: 'approve', ...sigData }),
 });
 const result = await r.json();
 if (!r.ok) throw new Error(result.error || 'Failed');
 setData(prev => ({
 ...prev,
 amendment: {
 ...prev.amendment,
 status: 'approved',
 signed_at: new Date().toISOString(),
 signature_data: sigData.signature_data,
 signer_name: sigData.signer_name,
 },
 }));
 setMode(null);
 setActionDone('approved');
 } catch (e) { setError(e.message || 'Could not submit'); }
 finally { setSending(false); }
 }

 async function submitDecline() {
 setSending(true); setError('');
 try {
 const r = await fetch('/api/public-amendment', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ token: shareToken, action: 'decline' }),
 });
 const result = await r.json();
 if (!r.ok) throw new Error(result.error || 'Failed');
 setData(prev => ({
 ...prev,
 amendment: { ...prev.amendment, status: 'declined' },
 }));
 setMode(null);
 setActionDone('declined');
 } catch (e) { setError(e.message || 'Could not submit'); }
 finally { setSending(false); }
 }

 const country = data?.amendment?.country || data?.quote?.country || 'CA';
 const currency = useCallback((n) => formatCurrency(n, country), [country]);

 if (loading) return <PublicLoadingState label="Loading amendment…" />;

 if (error && !data) return (
 <PublicErrorState
 docType="amendment"
 contractorName={null}
 onRetry={() => window.location.reload()}
 />
 );

 if (!data) return null;

 const { amendment, quote } = data;
 const contractorName = data.contractor_company || data.contractor_name || 'Your Contractor';
 const isSigned = Boolean(amendment.signed_at);
 const isApproved = amendment.status === 'approved';
 const isDeclined = amendment.status === 'declined';
 const canAct = !isSigned && !isApproved && !isDeclined && ['sent', 'viewed'].includes(amendment.status);
 const newTotal = Number(quote.total || 0) + Number(amendment.total || 0);

 return (
 <PublicPageShell contractorName={contractorName} logoUrl={data.contractor_logo}>
 <div className="doc-shell">
 <div className="doc-container">
 <div className="doc-card">

 {/* Header */}
 <div className="doc-header">
 <div className="doc-brand">
 {data.contractor_logo && <img src={data.contractor_logo} alt="" className="doc-logo" />}
 <div className="doc-company">{contractorName}</div>
 <div className="doc-contact">
 {data.contractor_phone && <a href={`tel:${data.contractor_phone}`}>{data.contractor_phone}</a>}
 {data.contractor_email && <a href={`mailto:${data.contractor_email}`}>{data.contractor_email}</a>}
 </div>
 </div>
 <div className="doc-meta">
 <div className="doc-type">Amendment</div>
 <div className="doc-date">{formatDate(amendment.created_at)}</div>
 </div>
 </div>

 doc-status-icon pam-inline-flex-0510atus banners */}
 {isApproved && !actionDone && (
 <div className="doc-status doc-status--approved">
 <span className="doc-status-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
 <span>Amendment signed and approved{amendment.signer_name ? ` by ${amendment.signer_name}` : ''}{amendment.signed_at ? ` on ${formatDate(amendment.signed_at)}` : ''}</span>
 </div>
 )}
 {isDeclined && !actionDone && (
 <div className="doc-status doc-status--warning">
 <span className="doc-status-icon">✗</span>
 <span>Amendment declined — original scope unchanged</span>
doc-status-icon pam-inline-flex-0510iv>
 )}
 {actionDone === 'approved' && (
 <div className="doc-status doc-status--approved">
 <span className="doc-status-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
 <span>Amendment approved! {contractorName} has been notified.</span>
 </div>
 )}
 {actionDone === 'declined' && (
 <div className="doc-status doc-status--warning">
 <span className="doc-status-icon">✗</span>
 <span>Amendment declined. Your original scope is unchanged.</span>
 </div>
 )}

 <div className="doc-body">

 {/* Customer */}
 {data.customer_name && (
 <div className="pam-s7-eb4a">
 <div className="pam-fs-xs-aca6">Prepared for</div>
 <div className="pam-fs-lg-aab4">{data.customer_name}</div>
 </div>
 )}

 {/* Pricing hero */}
 <div className="pam-ta-center-f62e">
 <div className="pam-fs-xs-aca6">Revised total</div>
 <div className="pam-fs-5xl-789c">{currency(newTotal)}</div>
 {showFinancing(newTotal) && (
 <div className="pam-fs-sm-b728">
 or as low as {currency(estimateMonthly(newTotal))}/mo · subject to approval
 </div>
 )}
 <div className="pam-flex_fs-xs-1734">
 <span>No payment now</span>
 <span>Price locked in once you sign</span>
 </div>
 </div>

 {/* §6.3 Combined diff view — original + delta in one document */}
 <div className="pam-s6-7a5f">
 <div className="pam-fs-2xs-2d64">
 What's changing
 </div>
 <AmendmentDiff
 quote={quote}
 amendment={amendment}
 country={country}
 />
 </div>

 {/* Error */}
 {error && (
 <div className="pam-fs-sm-b875">{error}</div>
 )}

 {/* Action buttons */}
 {canAct && !mode && (
 <div className="pam-flex-968e">
 <button type="button"
 className="doc-cta-primary"
 
 onClick={() => setMode('sign')}
 >
 Sign & Approve Amendment
 </button>
 <div className="pam-ta-center_fs-xs-4d86"c-cta-secondary pam-ta-center-99ae No payment now · Original scope remains if you decline
 </div>
 <button type="button" className="doc-cta-secondary" onClick={() => setMode('decline')}>
 Decline this amendment
 </button>
 </div>
 )}

 {/* Sign mode */}
 {mode === 'sign' && (
 <div className="pam-s5-dbbe">
 <SignaturePad
 onSave={submitSignature}
 onCancel={() => setMode(null)}
 saveLabel="Sign & Approve Amendment"
 legalText={`By signing, you agree to the additional scope and pricing in this amendment. New total: ${currency(newTotal)}.`}
 />
 </div>
 )}

 {/* Decline confirmation */}
 {mode === 'decline' && (
 <div className="pam-ta-center-dffe">
 <p className="pam-fs-md-c7ae">Decline this amendment?</p>
 <p className="pam-fs-sm-0b76">Your original signed scope and pricing will remain unchanged.</p>
 <div className="pam-flex-c01b">
 <button type="button"
 className="doc-cta-secondary"
 
 disabled={sending}
 onClick={submitDecline}
 >
 {sending ? 'Declining…' : 'Confirm Decline'}
 </button>
 <button type="button" className="doc-cta-secondary" onClick={() => setMode(null)}>Cancel</button>
 </div>
 </div>
 )}

 {/* Post-approval signed summary */}
 {(isApproved || actionDone === 'approved') && (
 <div className="pam-s3-6df8">
 <div className="pam-fs-md-8134">Amendment approved</div>
 <div className="pam-fs-sm-b869">
 {contractorName} has been notified. The amended scope is now in effect.
 </div>
 {amendment.signature_data && (
 <div className="pam-flex-e357">
 <img src={amendment.signature_data} alt="Amendment signature" className="pam-s2-e765" />
 <div className="pam-fs-xs-391d">
 Signed by {amendment.signer_name || 'Customer'} · {formatDate(amendment.signed_at)}
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="doc-footer">
 <div>
 <div className="pam-s1-6e08">{contractorName}</div>
 {data.contractor_phone && <div className="pam-s0-816b">{data.contractor_phone}</div>}
 {data.contractor_email && <div className="pam-s0-816b">{data.contractor_email}</div>}
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Mobile sticky approve CTA */}
 {canAct && !mode && (
 <div className="doc-sticky-cta">
 <div className="doc-sticky-total">{currency(newTotal)}</div>
 <button className="doc-cta-primary" type="button" onClick={() => setMode('sign')}>
 Sign & Approve
 </button>
 </div>
 )}

 </PublicPageShell>
 );
}
