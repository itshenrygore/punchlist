/* ═══════════════════════════════════════════════════════════════
   FinancingStep — final "review & send" step.

   Shows the contractor a faithful preview of what the customer will
   see (total as the headline, with the monthly option beneath it),
   then collects the two things that still need setting before send:
   quote expiry and an optional personal note. We deliberately do NOT
   expose a term picker or financing toggle — the real term, rate, and
   eligibility are decided by Affirm/Klarna at checkout, so any control
   here would misrepresent what the contractor actually governs.

   Props:
     grandTotal     — computed total including tax
     country        — 'CA' | 'US'
     customerName   — for the preview label
     itemCount      — number of line items
     onBack         — go back to scope/review
     onContinue     — proceed to send
     note           — personal note for the customer
     onNoteChange   — setter for note
     expiryDays     — quote expiry
     onExpiryChange — setter for expiry
   ═══════════════════════════════════════════════════════════════ */
import { estimateMonthly, showFinancing } from '../../lib/financing';
import { currency } from '../../lib/format';

const EXPIRY_OPTIONS = [
  { value: 7,  label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 21, label: '21 days' },
  { value: 30, label: '30 days' },
];

export default function FinancingStep({
  grandTotal = 0,
  country = 'CA',
  customerName = '',
  itemCount = 0,
  onBack,
  onContinue,
  note = '',
  onNoteChange,
  expiryDays = 14,
  onExpiryChange,
}) {
  const monthly = estimateMonthly(grandTotal);
  const canFinance = showFinancing(grandTotal);
  const firstName = customerName?.split(' ')[0] || 'your customer';

  return (
    <div className="financing-step">
      <style>{`
        .financing-step {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .fs-eyebrow {
          text-align: center;
          font-size: var(--text-xs, 11px);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-2, #344054);
        }
        .fs-money-card {
          padding: 28px 20px 24px;
          border-radius: 16px;
          text-align: center;
          background: var(--panel, #fff);
          box-shadow: 0 2px 6px rgba(28,20,12,0.06), 0 8px 24px rgba(28,20,12,0.10);
          border: 1px solid var(--line, rgba(17,24,39,0.06));
        }
        .fs-total-alt {
          font-size: 14px;
          color: var(--muted, #667085);
          margin-top: 6px;
          font-weight: 500;
        }
        .fs-total-alt strong { color: var(--text, #161616); font-weight: 700; }
        .fs-total-only {
          font-size: 42px;
          font-weight: 800;
          color: var(--text, #161616);
          font-family: var(--font-display, 'Clash Display', system-ui, sans-serif);
          letter-spacing: -0.03em;
        }
        .fs-note {
          width: 100%;
          resize: none;
          border: 1px solid var(--line-2, rgba(17,24,39,0.12));
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          font-family: inherit;
          background: var(--panel, #fff);
          color: var(--text, #161616);
        }
        .fs-note:focus {
          outline: none;
          border-color: var(--brand-line, rgba(184,81,40,0.15));
          box-shadow: 0 0 0 3px var(--brand-bg, rgba(184,81,40,0.06));
        }
        .fs-expiry-select {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--line-2, rgba(17,24,39,0.12));
          background: var(--panel, #fff);
          font-size: 13px;
          font-family: inherit;
          color: var(--text, #161616);
          cursor: pointer;
        }
      `}</style>

      {/* Eyebrow */}
      <div className="fs-eyebrow">
        {firstName} will see
      </div>

      {/* The money card — mirrors the customer's view: total is the
          headline, the monthly option sits beneath it as "or from $X/mo".
          We don't let the contractor tweak the term — the real term and
          rate are set by Affirm/Klarna at checkout, so showing a picker
          here would imply a control the contractor doesn't have. */}
      <div className="fs-money-card">
        <div className="fs-total-only">
          {currency(grandTotal, country)}
        </div>
        {canFinance && monthly ? (
          <div className="fs-total-alt">
            or from <strong>{currency(monthly, country)}/mo</strong> · monthly option shown at checkout
          </div>
        ) : (
          <div className="fs-total-alt">
            {itemCount} item{itemCount !== 1 ? 's' : ''} · tax included
          </div>
        )}
      </div>

      {/* Expiry */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
          Expires in
        </span>
        <select
          className="fs-expiry-select"
          value={expiryDays}
          onChange={e => onExpiryChange?.(Number(e.target.value))}
        >
          {EXPIRY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Note */}
      <textarea
        className="fs-note"
        value={note}
        onChange={e => onNoteChange?.(e.target.value)}
        placeholder={`Add a personal note for ${firstName} (optional)…`}
        rows={2}
      />
    </div>
  );
}
