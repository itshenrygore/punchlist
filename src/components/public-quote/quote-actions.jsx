import { MessageSquare, Pencil } from 'lucide-react';
import { usePublicQuote } from './public-quote-context';

/* ═══════════════════════════════════════════════════════════
   QuoteActions — Approve/sign CTA + secondary actions.

   Phase 5 changes:
     • CTA visible without scrolling on every device via
       sticky bottom bar
     • Approve button shows total in the CTA text
     • Question/changes buttons stay as bottom sheet triggers
   ═══════════════════════════════════════════════════════════ */

export default function QuoteActions() {
  const {
    quote, currency, adjustedTotal, isPreview, isExpired,
    isApproved, isDeclined, actionDone,
    termsAccepted, setTermsAccepted,
    openSignature, setActiveSheet,
    error, showSignature,
    contractorDisplayName,
  } = usePublicQuote();

  const canAct = !isPreview && !isExpired && !isApproved && !isDeclined && !actionDone;

  if (!canAct) return null;

  return (
    <>
      {/* Inline actions area */}
      <div className="pq-actions pqv-actions-padded">
        {/* Terms checkbox */}
        <label className="pq-terms-label">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => setTermsAccepted(e.target.checked)}
            className="pqv-terms-check"
          />
          <span className="pq-terms-text">
            I accept the <button type="button" className="pq-terms-link" onClick={() => document.querySelector('.doc-info-toggle')?.click()}>terms and scope</button> of this quote
          </span>
        </label>

        {/* Secondary actions */}
        <div className="pqv-secondary-actions">
          <button className="pq-btn-secondary" type="button" onClick={() => setActiveSheet('question')}>
            <MessageSquare size={14} className="pqv-inline-icon" />Ask a question
          </button>
          <button className="pq-btn-secondary" type="button" onClick={() => setActiveSheet('changes')}>
            <Pencil size={14} className="pqv-inline-icon" />Request changes
          </button>
        </div>
      </div>

      {/* Error */}
      {error && !showSignature && (
        <div className="pqv-error">{error}</div>
      )}

      {/* ── Sticky bottom CTA bar ──
           Phase 5: always visible without scrolling on any device. */}
      <div className="pqv-sticky-cta">
        <div className="pqv-sticky-total tabular">{currency(adjustedTotal)}</div>
        <button
          className="doc-cta-primary pqv-sticky-btn"
          disabled={!termsAccepted}
          onClick={openSignature}
        >
          Approve & Sign →
        </button>
      </div>

      {/* Reassurance text */}
      <div className="pqv-reassurance">
        <div className="pqv-reassurance-text">
          No payment required now · Price locked in · Cancel anytime before work starts
        </div>
      </div>
    </>
  );
}
