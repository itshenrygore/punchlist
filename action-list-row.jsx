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
  const isSigned   = Boolean(amendment.signed_at) || effectiveStatus === 'approved';
  const isDeclined = effectiveStatus === 'declined';
  const canAct     = !isSigned && !isDeclined && ['sent', 'viewed'].includes(amendment.status) && !state;

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
  const canAct     = !isApproved && !isDeclined && !['cancelled'].includes(aw.status) && !state;

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
  const [mode, setMode]         = useState(null); // 'sign' | 'decline' | 'question'
  const [feedback, setFeedback] = useState('');

  const isAmendment = type === 'amendment';
  const typeLabel   = isAmendment ? 'Amendment' : 'Additional Work';
  const typeStyle   = isAmendment
    ? {}
    : { background: 'var(--doc-accent-soft)', color: 'var(--doc-accent)' };

  const statusKey = isSigned ? 'approved' : isDeclined ? 'declined' : 'pending';
  const statusText = isSigned ? 'Approved' : isDeclined ? 'Declined' : 'Needs approval';

  return (
    <div className="pp-update-card">
      {/* Header */}
      <div className="pp-update-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="pp-update-type" style={typeStyle}>{typeLabel}</span>
          <span className={`pp-update-status pp-update-status--${statusKey}`}>
            {statusText}
          </span>
        </div>
        <div className="pp-update-date">{formatDate(createdAt)}</div>
      </div>

      {/* Title + reason */}
      <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', marginBottom: 4 }}>{title}</div>
      {reason && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--doc-text-2)', margin: '0 0 12px', ...reasonStyle }}>
          Reason: {reason}
        </p>
      )}

      {/* Line items */}
      {items.map((item, idx) => (
        <div key={item.id || idx} className="doc-item" style={{ borderLeft: '3px solid var(--doc-accent)' }}>
          <div className="doc-item-left">
            <div className="doc-item-name">{item.name}</div>
            {item.notes && <div className="doc-item-note">{item.notes}</div>}
          </div>
          <div className="doc-item-right" style={{ color: 'var(--doc-accent)' }}>
            +{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
          </div>
        </div>
      ))}

      {/* Total row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 700, borderTop: '1px solid var(--doc-line)', marginTop: 8 }}>
        <span>{totalLabel}</span>
        <span style={{ color: 'var(--doc-accent)' }}>+{currency(total)}</span>
      </div>

      {/* Signature display (amendments only) */}
      {signatureData && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '8px 12px', background: 'var(--doc-green-soft)', borderRadius: 8 }}>
          <img src={signatureData} alt="Signature" style={{ maxHeight: 28, maxWidth: 100 }} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--doc-green)' }}>
            Signed {signerName ? `by ${signerName}` : ''}
          </span>
        </div>
      )}

      {/* CTA row */}
      {canAct && !mode && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {isAmendment ? (
            <>
              <button className="doc-cta-primary" style={{ flex: 1, fontSize: 'var(--text-base)' }} onClick={() => setMode('sign')} disabled={sending}>
                {approveLabel}
              </button>
              <button className="doc-cta-secondary" style={{ fontSize: 'var(--text-base)' }} onClick={() => setMode('decline')} disabled={sending}>
                {declineLabel}
              </button>
            </>
          ) : (
            <>
              <button className="doc-cta-primary" style={{ flex: 1, fontSize: 'var(--text-base)' }} disabled={sending} onClick={() => onApprove()}>
                {approveLabel}
              </button>
              <button className="doc-cta-secondary" style={{ fontSize: 'var(--text-base)' }} onClick={() => setMode('question')}>
                Ask a question
              </button>
              <button className="doc-cta-secondary" style={{ fontSize: 'var(--text-base)', color: 'var(--doc-muted)' }} onClick={() => setMode('decline')}>
                {declineLabel}
              </button>
            </>
          )}
        </div>
      )}

      {/* Sign mode (amendments) */}
      {mode === 'sign' && (
        <div style={{ marginTop: 12 }}>
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
        <div style={{ marginTop: 12 }}>
          <textarea
            className="pq-sheet-textarea"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="What would you like to know?"
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="doc-cta-primary" style={{ flex: 1 }} disabled={sending || !feedback.trim()}
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
          <div style={{ marginTop: 12, padding: '16px', background: 'var(--doc-red-soft)', borderRadius: 10, textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--text-base)', fontWeight: 600 }}>Decline this amendment?</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="doc-cta-secondary" style={{ background: 'var(--doc-red)', color: 'var(--always-white, #fff)', border: 'none' }}
                disabled={sending} onClick={() => { onDecline(); setMode(null); }}>
                Confirm Decline
              </button>
              <button className="doc-cta-secondary" onClick={() => setMode(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <textarea
              className="pq-sheet-textarea"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Reason (optional)"
              rows={2}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="doc-cta-secondary"
                style={{ background: 'var(--doc-red)', color: 'var(--always-white, #fff)', border: 'none', flex: 1 }}
                disabled={sending}
                onClick={() => { onDecline(feedback); setMode(null); setFeedback(''); }}>
                Confirm Decline
              </button>
              <button className="doc-cta-secondary" onClick={() => { setMode(null); setFeedback(''); }}>Cancel</button>
            </div>
          </div>
        )
      )}

      {/* Result banners */}
      {state?.actionDone === 'approved' && (
        <div className="doc-status doc-status--approved" style={{ marginTop: 12 }}>
          <span className="doc-status-icon" style={{ display: 'inline-flex' }}><Check size={14} /></span>
          <span>{successMsg}</span>
        </div>
      )}
      {state?.actionDone === 'approve' && (
        <div className="doc-status doc-status--approved" style={{ marginTop: 12 }}>
          <span className="doc-status-icon" style={{ display: 'inline-flex' }}><Check size={14} /></span>
          <span>{successMsg}</span>
        </div>
      )}
      {state?.actionDone === 'question' && (
        <div className="doc-status doc-status--info" style={{ marginTop: 12 }}>
          <span className="doc-status-icon" style={{ display: 'inline-flex' }}><MessageSquare size={14} /></span>
          <span>Question sent</span>
        </div>
      )}
      {state?.actionDone === 'declined' && (
        <div className="doc-status doc-status--warning" style={{ marginTop: 12 }}>
          <span className="doc-status-icon">×</span>
          <span>{declinedMsg}</span>
        </div>
      )}
      {state?.actionDone === 'decline' && (
        <div className="doc-status doc-status--warning" style={{ marginTop: 12 }}>
          <span className="doc-status-icon">×</span>
          <span>{declinedMsg}</span>
        </div>
      )}
    </div>
  );
}

export default UpdateCard;
