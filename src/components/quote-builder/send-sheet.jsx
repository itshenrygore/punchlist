import { useState } from 'react';
import { X } from 'lucide-react';
import { SmsComposerField } from '../ui';
import { currency } from '../../lib/format';

/**
 * SendSheet — Send confirmation overlay
 *
 * A focused modal for the send action. Shows:
 *   - Delivery method toggle (Text / Email / Copy link)
 *   - SMS composer (when text selected)
 *   - Quote summary with line items + total
 *   - Send confirmation button
 *
 * Props:
 *   open — boolean
 *   onClose — dismiss handler
 *   onConfirmSend — (deliveryMethod) => void
 *   customer — selected customer object
 *   lineItems — array of line items
 *   grandTotal — number
 *   country — 'CA' | 'US'
 *   smsBody, onSmsBodyChange — SMS text content
 *   sending — boolean loading state
 *   saving — boolean
 */
export default function SendSheet({
  open,
  onClose,
  onConfirmSend,
  customer,
  lineItems = [],
  grandTotal = 0,
  country = 'CA',
  smsBody = '',
  onSmsBodyChange,
  sending = false,
  saving = false,
}) {
  const [method, setMethod] = useState('text');

  if (!open) return null;

  const firstName = customer?.name?.split(' ')[0] || 'customer';
  const displayItems = lineItems.filter(i => i.name?.trim()).slice(0, 3);
  const moreCount = lineItems.length - displayItems.length;

  const confirmLabel =
    sending ? 'Sending…'
    : saving ? 'Saving…'
    : method === 'text' ? `Text ${currency(grandTotal, country)} Quote`
    : method === 'email' ? `Email ${currency(grandTotal, country)} Quote`
    : 'Copy Quote Link';

  return (
    <div className="ss-overlay" onClick={onClose}>
      <div className="ss-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Send quote">

        {/* Header */}
        <div className="ss-header">
          <h3 className="ss-title">Send Quote</h3>
          <button className="ss-close" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* To line */}
        {customer && (
          <div className="ss-to">
            <span className="ss-to-label">To</span>
            <span className="ss-to-value">
              {customer.name}{customer.phone ? ` · ${customer.phone}` : ''}
            </span>
          </div>
        )}

        {/* Quote summary */}
        <div className="ss-summary">
          {displayItems.map(item => (
            <div key={item.id} className="ss-item">
              <span className="ss-item-name">{item.name}</span>
              <span className="ss-item-price tabular">
                {currency((item.quantity || 1) * (item.unit_price || 0), country)}
              </span>
            </div>
          ))}
          {moreCount > 0 && (
            <div className="ss-more">+{moreCount} more item{moreCount > 1 ? 's' : ''}</div>
          )}
          <div className="ss-total">
            <span>Total</span>
            <span className="tabular">{currency(grandTotal, country)}</span>
          </div>
        </div>

        {/* Delivery method toggle */}
        <div className="ss-methods">
          {[
            { v: 'text',  l: 'Text message' },
            { v: 'email', l: 'Email' },
            { v: 'copy',  l: 'Copy link' },
          ].map(o => (
            <button
              key={o.v}
              type="button"
              className={`ss-method ${method === o.v ? 'ss-method--active' : ''}`}
              onClick={() => setMethod(o.v)}
            >
              {o.l}
            </button>
          ))}
        </div>

        {/* Method-specific content */}
        {method === 'text' && (
          <div className="ss-compose">
            <SmsComposerField
              id="ss-sms-body"
              label="Message"
              value={smsBody}
              onChange={onSmsBodyChange}
              rows={4}
              showLinkHint={true}
            />
          </div>
        )}
        {method === 'email' && (
          <div className="ss-note">
            A quote summary will be emailed to <strong>{customer?.email || '—'}</strong>.
            Your customer can review, approve, and sign from the link.
          </div>
        )}
        {method === 'copy' && (
          <div className="ss-note">
            A shareable link will be copied to your clipboard.
          </div>
        )}

        {/* Confirm */}
        <button
          className="btn btn-primary btn-lg full-width ss-confirm"
          type="button"
          disabled={sending || saving}
          onClick={() => onConfirmSend(method)}
        >
          {confirmLabel}
        </button>

        {method === 'text' && (
          <p className="ss-reassurance">
            This goes out as your message. Your customer can review, approve, and sign
            from their phone — you'll see the moment they open it.
          </p>
        )}
      </div>
    </div>
  );
}
