/**
 * UpdateCard — shared wrapper for Amendment and AdditionalWork cards
 * in the customer-facing project portal UpdatesTab.
 *
 * Extracted from project-portal-page.jsx (Phase 10.1 / UX-045).
 * Both AmendmentCard and AdditionalWorkCard are thin wrappers that
 * pass type-specific props to this component.
 */

import { useState } from 'react';
import { Check, MessageSquare } from 'lucide-react';
import SignaturePad from './signature-pad';
import { formatDate } from '../lib/format';

/* ─────────────────────────────────────────────
 AmendmentCard — thin wrapper
 ───────────────────────────────────────────── */
export function AmendmentCard({ amendment, quote, currency, state, onAction, sending }) {
 const effectiveStatus = state?.status || amendment.status;
 const isSigned = Boolean(amendment.signed_at) || effectiveStatus === 'approved';
 const isDeclined = effectiveStatus === 'declined';
 const canAct = !isSigned && !isDeclined && ['sent', 'viewed'].includes(amendment.status) && !state;

 return (
 <UpdateCard
 type="amendment"
 title={amendment.title}
 reason={amendment.reason}
 reasonStyle={{ fontStyle: 'italic' }}
 createdAt={amendment.created_at}
 items={amendment.items || []}
 total={amendment.total}
 totalLabel="Amendment total"
 signatureData={amendment.signature_data}
 signerName={amendment.signer_name}
 isSigned={isSigned}
 isDeclined={isDeclined}
 canAct={canAct}
 sending={sending}
 state={state}
 onApprove={(sigData) => onAction(amendment, 'approve', sigData)}
 onDecline={() => onAction(amendment, 'decline')}
 approveLabel="Sign & Approve"
 declineLabel="Decline"
 signLabel="Sign & Approve Amendment"
 signLegal="By signing, you agree to the additional scope and pricing in this amendment."
 successMsg="Amendment approved!"
 declinedMsg="Amendment declined."
 currency={currency}
 />
 );
}

/* ─────────────────────────────────────────────
 AdditionalWorkCard — thin wrapper
 ───────────────────────────────────────────── */
export function AdditionalWorkCard({ aw, currency, state, onAction, sending }) {
 const effectiveStatus = state?.status || aw.status;
 const isApproved = effectiveStatus === 'approved';
 const isDeclined = effectiveStatus === 'declined';
 const canAct = !isApproved && !isDeclined && !['cancelled'].includes(aw.status) && !state;

 return (
 <UpdateCard
 type="additional_work"
 title={aw.title}
 reason={aw.reason}
 createdAt={aw.created_at}
 items={aw.items || aw.additional_work_items || []}
 total={aw.total}
 totalLabel="Additional work total"
 isSigned={isApproved}
 isDeclined={isDeclined}
 canAct={canAct}
 sending={sending}
 state={state}
 onApprove={() => onAction(aw, 'approve')}
 onDecline={(feedback) => onAction(aw, 'decline', feedback)}
 onQuestion={(feedback) => onAction(aw, 'question', feedback)}
 approveLabel="Approve"
 declineLabel="Decline"
 successMsg="Additional work approved!"
 declinedMsg="Additional work declined."
 currency={currency}
 />
 );
}

/* ─────────────────────────────────────────────
 UpdateCard — shared implementation
 ───────────────────────────────────────────── */
function UpdateCard({
 type,
 title,
 reason,
 reasonStyle,
 createdAt,
 items,
 total,
 totalLabel,
 signatureData,
 signerName,
 isSigned,
 isDeclined,
 canAct,
 sending,
 state,
 onApprove,
 onDecline,
 onQuestion,
 approveLabel,
 declineLabel,
 signLabel,
 signLegal,
 successMsg,
 declinedMsg,
 currency,
}) {
 const [mode, setMode] = useState(null); // 'sign' | 'decline' | 'question'
 const [feedback, setFeedback] = useState('');

 const isAmendment = type === 'amendment';
 const typeLabel = isAmendment ? 'Amendment' : 'Additional Work';
 const typeStyle = isAmendment
 ? {}
 : { background: 'var(--doc-accent-soft)', color: 'var(--doc-accent)' };

 const statusKey = isSigned ? 'approved' : isDeclined ? 'declined' : 'pending';
 const statusText = isSigned ? 'Approved' : isDeclined ? 'Declined' : 'Needs approval';

 return (
 <div className="pp-update-card">
 {/* Header */}
 <div className="pp-update-header">
 <div className="uc-flex-a37f">
 <span className="pp-update-type" style={typeStyle}>{typeLabel}</span>
 <span className={`pp-update-status pp-update-status--${statusKey}`}>
 {statusText}
 </span>
 </div>
 <div className="pp-update-date">{formatDate(createdAt)}</div>
 </div>

 {/* Title + reason */}
 <div className="uc-fs-md-ba9d">{title}</div>
 {reason && (
 <p style={{ fontSize: 'var(--text-sm)', color: 'var(--doc-text-2)', margin: '0 0 12px', ...reasonStyle }}>
doc-item uc-s7-1040 Reason: {reason}
 </p>
 )}

 {/* Line items */}
 {items.map((item, idx) => (
 <div key={item.id || idx} className="doc-item">
 <div className="doc-item-left">
 <doc-item-right uc-s6-a972"doc-item-name">{item.name}</div>
 {item.notes && <div className="doc-item-note">{item.notes}</div>}
 </div>
 <div className="doc-item-right">
 +{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
 </div>
 </div>
 ))}

 {/* Total row */}
 <div className="uc-flex-3ea4">
 <span>{totalLabel}</span>
 <span className="uc-s6-a972">+{currency(total)}</span>
 </div>

 {/* Signature display (amendments only) */}
 {signatureData && (
 <div className="uc-flex-c0d3">
 <img src={signatureData} alt="Signature" className="uc-s5-693f" />
 <span className="uc-fs-xs-b5ea">
 Signed {signerName ? `by ${signerName}` : ''}
 </span>
 </div>
 )}

 {/* CTA row */}
 doc-cta-primary uc-fs-base-3581mode && (
 <div className="uc-flex-a60c">
 {isAmendment ? (
 <>
 <button className="doc-cta-primary" s-base-a3b5)' }} onClick={() => setMode('sign')} disabled={sending}>
 {approveLabel}
 </button>
 <button className="doc-cta-secondary" onClick={() => setMode('ddoc-cta-primary uc-fs-base-3581led={sending}>
 {declineLabel}
 </button>
 </>
 ) : (
 <>
 <button className="doc-cta-primary" se-a3b5base)' }} disabled={sending} onClick={() => onApprove()}>
 {approveLabel}
 </button>
 <button className="doc-cta-secondary" --text-base)' }} onClick={() => setMode('question')}>
 Ask a question
 </button>
 <button className="doc-cta-secondary" onClick={() => setMode('decline')}>
 {declineLabel}
 </button>
 </>
 )}
 </div>
 )}

 {/* Sign mode (amendments) */}
 {mode === 'sign' && (
 <div className="uc-s0-9313">
 <SignaturePad
 onSave={(sigData) => { onApprove(sigData); setMode(null); }}
 onCancel={() => setMode(null)}
 saveLabel={signLabel}
 legalText={signLegal}
 />
 </div>
 )}

 {/* Question mode (additional work) */}
 {mode === 'question' && (
 <div className="uc-s0-9313">
 <textarea
 className="pq-sheet-textarea"
 value={feedback}
 onChange={e => setFeedback(e.target.value)}
 placeholder="What would you like to know?"
 rows={3}
 doc-cta-primary uc-s4-f72fuc-s2-2bdc"
 />
 <div className="uc-flex-0a8a">
 <button className="doc-cta-primary" disabled={sending || !feedback.trim()}
 onClick={() => { onQuestion(feedback); setMode(null); setFeedback(''); }}>
 Send question
 </button>
 <button className="doc-cta-secondary" onClick={() => { setMode(null); setFeedback(''); }}>
 Cancel
 </button>
 </div>
 </div>
 )}

 {/* Decline mode */}
 {mode === 'decline' && (
 isAmendment ? (
 <div className="uc-ta-center-13d0">
 <p className="uc-fs-base-f73f">Decline this amendment?</p>
 <div className="uc-flex-c01b">
 <button className="doc-cta-secondary" 
 disabled={sending} onClick={() => { onDecline(); setMode(null); }}>
 Confirm Decline
 </button>
 <button className="doc-cta-secondary" onClick={() => setMode(null)}>Cancel</button>
 </div>
 </div>
 ) : (
 <div className="uc-s0-9313">
 <textarea
 className="pq-sheet-textarea"
 value={feedback}
 onChange={e => setFeedback(e.target.value)}
 placeholder="Reason (optional)"
 rows={2}
 className="uc-s2-2bdc"der-box' }}
 />
 <div className="uc-flex-0a8a">
 <button className="doc-cta-secondary"
 
 disabled={sending}
 onClick={() => { onDecline(feedback); setMode(null); setFeedback(''); }}>
 Confirm Decline
 </button>
 <button className="doc-cta-secondary" onClick={() => { setMode(null); setFeedback(''); }}>Cancel</button>
 doc-status doc-status--approved uc-s0-9313v>
 )
 )}

 {/* Result bdoc-status-icon uc-inline-flex-0510 {state?.actionDone === 'approved' && (
 <div className="doc-status doc-status--approved">
 <span className="doc-status-icon"><Chdoc-status doc-status--approved uc-s0-9313 <span>{successMsg}</span>
 </didoc-status-icon uc-inline-flex-0510 {state?.actionDone === 'approve' && (
 <div className="doc-status doc-status--approved">
 <span className="doc-status-icon">doc-status doc-status--info uc-s0-9313 <span>{successMsg}</span>
 <doc-status-icon uc-inline-flex-0510 {state?.actionDone === 'question' && (
 <div className="doc-status doc-status--info">
 <span className="doc-status-icon"><MessageSquadoc-status doc-status--warning uc-s0-9313 <span>Question sent</span>
 </div>
 )}
 {state?.actionDone === 'declined' && (
 <div className="doc-status doc-status--warning">
 <span className="dodoc-status doc-status--warning uc-s0-9313 <span>{declinedMsg}</span>
 </div>
 )}
 {state?.actionDone === 'decline' && (
 <div className="doc-status doc-status--warning">
 <span className="doc-status-icon">×</span>
 <span>{declinedMsg}</span>
 </div>
 )}
 </div>
 );
}

export default UpdateCard;
