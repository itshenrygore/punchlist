import { SmsComposerField } from '../../components/ui';
import { useQuoteBuilder } from './quote-builder-context';
import { actions } from './use-quote-draft';
import { currency } from '../../lib/format';
import { estimateMonthly, showFinancing } from '../../lib/financing';

/* ═══════════════════════════════════════════════════════════
   SendDrawer — Modal for choosing delivery method + confirming.

   Phase 1 changes:
     • Removed 3-second undo delay — confirm button is the
       safety net. One fewer step = faster send.
     • Replaced "[link will be added automatically]" with a
       styled, non-editable preview block.
     • SMS confirm pending card (Twilio fallback) integrated.
   ═══════════════════════════════════════════════════════════ */

export default function SendDrawer() {
  const { state, dispatch, derived, handlers } = useQuoteBuilder();
  const {
    showSend, deliveryMethod, smsBody, smsConfirmPending,
    lineItems, saving, sending, country,
  } = state;
  const { grandTotal, selCustomer } = derived;

  if (!showSend && !smsConfirmPending) return null;

  // ── SMS Confirm Pending (Twilio fallback) ──
  if (smsConfirmPending) {
    return (
      <div className="qb-modal-bg">
        <div className="qb-modal qb-sms-confirm-modal" onClick={e => e.stopPropagation()}>
          <h3 className="qb-sms-confirm-title">Did you send it?</h3>
          <p className="qb-sms-confirm-body">
            We opened your Messages app. Tap "Yes, sent" once you've sent the quote
            to {smsConfirmPending.firstName || smsConfirmPending.phone}.
          </p>
          <div className="qb-sms-confirm-actions">
            <button
              className="btn btn-secondary btn-lg"
              type="button"
              onClick={handlers.handleSmsCancel}
            >
              No, cancel
            </button>
            <button
              className="btn btn-primary btn-lg"
              type="button"
              onClick={handlers.handleSmsConfirm}
            >
              Yes, sent ✓
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main send modal ──
  return (
    <div className="qb-modal-bg" onClick={() => dispatch(actions.setShowSend(false))}>
      <div className="qb-modal qb-send-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="qb-modal-top">
          <h3 className="qb-send-title">Send Quote</h3>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => dispatch(actions.setShowSend(false))}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="rq-send-body">
          {/* To: */}
          {selCustomer && (
            <div className="rq-send-to">
              <span className="rq-send-label">To</span>
              <span className="rq-send-value">
                {selCustomer.name}{selCustomer.phone ? ` · ${selCustomer.phone}` : ''}
              </span>
            </div>
          )}

          {/* Item preview */}
          <div className="rq-send-preview">
            {lineItems.filter(i => i.name?.trim()).slice(0, 3).map(i => (
              <div key={i.id} className="rq-send-item">
                <span>{i.name}</span>
                <span>{currency(Number(i.quantity || 0) * Number(i.unit_price || 0))}</span>
              </div>
            ))}
            {lineItems.length > 3 && (
              <div className="rq-send-more">+{lineItems.length - 3} more</div>
            )}
            <div className="rq-send-total">
              <span>Total</span>
              <span>
                {currency(grandTotal, country)}
                {showFinancing(grandTotal) && (
                  <span className="qb-send-monthly-hint">
                    or from {currency(estimateMonthly(grandTotal), country)}/mo
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Delivery method selector */}
          <div className="qb-send-method-section">
            <label className="jd-label qb-send-method-label">Send via</label>
            <div className="rq-send-methods">
              {[
                { v: 'text',  l: 'Text message' },
                { v: 'email', l: 'Email' },
                { v: 'copy',  l: 'Copy link' },
              ].map(o => (
                <button
                  key={o.v}
                  type="button"
                  className={`rq-send-method ${deliveryMethod === o.v ? 'active' : ''}`}
                  onClick={() => dispatch(actions.setDeliveryMethod(o.v))}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* SMS composer */}
          {deliveryMethod === 'text' && (
            <div className="qb-send-sms-section">
              <SmsComposerField
                id="qb-sms-body"
                label="Message"
                value={smsBody}
                onChange={v => dispatch(actions.setSmsBody(v))}
                rows={5}
                showLinkHint={true}
              />
            </div>
          )}

          {/* Email info */}
          {deliveryMethod === 'email' && (
            <div className="qb-send-info">
              A quote summary will be emailed to <strong>{selCustomer?.email || '—'}</strong>.
              Your customer can review, approve, and sign from the link in the email.
            </div>
          )}

          {/* Copy link info */}
          {deliveryMethod === 'copy' && (
            <div className="qb-send-info">
              A shareable link will be copied to your clipboard.
            </div>
          )}
        </div>

        {/* Confirm button — this IS the safety net (no undo delay) */}
        <div className="qb-modal-acts">
          <button
            className="btn btn-primary btn-lg rq-send-confirm-btn qb-send-confirm"
            type="button"
            disabled={sending || saving}
            onClick={handlers.handleConfirmSend}
          >
            {sending ? 'Sending…'
              : saving ? 'Saving…'
              : deliveryMethod === 'text'  ? `Text ${currency(grandTotal, country)} Quote`
              : deliveryMethod === 'email' ? `Email ${currency(grandTotal, country)} Quote`
              : 'Copy Quote Link'}
          </button>
        </div>

        {deliveryMethod === 'text' && (
          <p className="pl-sender-reassurance qb-reassurance">
            This goes out as your message. Your customer can review, approve, and sign
            from their phone — you'll see the moment they open it.
          </p>
        )}
      </div>
    </div>
  );
}
