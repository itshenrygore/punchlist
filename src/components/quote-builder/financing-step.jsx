/* ═══════════════════════════════════════════════════════════════
   FinancingStep — The centerpiece of Punchlist 2.0
   
   This is the "money moment." The contractor sees exactly what
   their customer will see: monthly payment displayed LARGER than
   the total. Term selector updates the number live.
   
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
import { useState } from 'react';
import { estimateMonthly, showFinancing, getFinancingCopy } from '../../lib/financing';
import { currency } from '../../lib/format';

const TERMS = [6, 12, 18, 24];
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
  const [termMonths, setTermMonths] = useState(12);
  const [financingEnabled, setFinancingEnabled] = useState(true);
  
  const monthly = estimateMonthly(grandTotal, termMonths);
  const canFinance = showFinancing(grandTotal);
  const firstName = customerName?.split(' ')[0] || 'your customer';
  const copy = getFinancingCopy('review');

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
        .fs-monthly {
          font-size: 48px;
          font-weight: 800;
          color: var(--brand, #B85128);
          font-family: var(--font-display, 'Clash Display', system-ui, sans-serif);
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .fs-monthly-suffix {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-2, #344054);
        }
        .fs-total-alt {
          font-size: 14px;
          color: var(--muted, #667085);
          margin-top: 6px;
          font-weight: 500;
        }
        .fs-total-only {
          font-size: 42px;
          font-weight: 800;
          color: var(--text, #161616);
          font-family: var(--font-display, 'Clash Display', system-ui, sans-serif);
          letter-spacing: -0.03em;
        }
        .fs-terms {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }
        .fs-term-btn {
          padding: 10px 0;
          border-radius: 10px;
          border: 1.5px solid var(--line-2, rgba(17,24,39,0.12));
          background: var(--panel, #fff);
          color: var(--text-2, #344054);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
          text-align: center;
        }
        .fs-term-btn:hover {
          border-color: var(--brand-line, rgba(184,81,40,0.15));
        }
        .fs-term-btn.active {
          border-color: var(--brand, #B85128);
          background: var(--brand-bg, rgba(184,81,40,0.06));
          color: var(--brand, #B85128);
        }
        .fs-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--panel, #fff);
          border: 1px solid var(--line, rgba(17,24,39,0.06));
        }
        .fs-toggle-track {
          width: 44px;
          height: 26px;
          border-radius: 13px;
          border: none;
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .fs-toggle-thumb {
          width: 20px;
          height: 20px;
          border-radius: 10px;
          background: var(--panel, #fff);
          position: absolute;
          top: 3px;
          transition: left 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .fs-panel {
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--panel, #fff);
          border: 1px solid var(--line, rgba(17,24,39,0.06));
        }
        .fs-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--muted, #667085);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 8px;
        }
        .fs-scope-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 13px;
        }
        .fs-total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0 0;
          margin-top: 6px;
          border-top: 1px solid var(--line, rgba(17,24,39,0.06));
          font-size: 14px;
          font-weight: 700;
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
        .fs-hint {
          font-size: 11px;
          color: var(--muted, #667085);
          text-align: center;
          line-height: 1.4;
        }
      `}</style>

      {/* Eyebrow */}
      <div className="fs-eyebrow">
        {firstName} will see
      </div>

      {/* The money card — the centerpiece */}
      <div className="fs-money-card">
        {canFinance && financingEnabled && monthly ? (
          <>
            <div className="fs-monthly">
              {currency(monthly, country)}
              <span className="fs-monthly-suffix">/mo</span>
            </div>
            <div className="fs-total-alt">
              for {termMonths} months · or {currency(grandTotal, country)} total
            </div>
          </>
        ) : (
          <>
            <div className="fs-total-only">
              {currency(grandTotal, country)}
            </div>
            <div className="fs-total-alt">
              {itemCount} item{itemCount !== 1 ? 's' : ''} · tax included
            </div>
          </>
        )}
      </div>

      {/* Term selector */}
      {canFinance && financingEnabled && (
        <div>
          <div className="fs-label">Payment term</div>
          <div className="fs-terms">
            {TERMS.map(t => (
              <button
                key={t}
                type="button"
                className={`fs-term-btn ${termMonths === t ? 'active' : ''}`}
                onClick={() => setTermMonths(t)}
              >
                {t}mo
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Financing toggle */}
      {canFinance && (
        <div className="fs-toggle-row">
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              Show monthly payments
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
              {copy.hint}
            </div>
          </div>
          <button
            type="button"
            className="fs-toggle-track"
            style={{ background: financingEnabled ? 'var(--brand, #B85128)' : 'var(--line-2, rgba(17,24,39,0.12))' }}
            onClick={() => setFinancingEnabled(!financingEnabled)}
            aria-label="Toggle monthly payments"
          >
            <div
              className="fs-toggle-thumb"
              style={{ left: financingEnabled ? 21 : 3 }}
            />
          </button>
        </div>
      )}

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

      {/* Financing hint */}
      {canFinance && financingEnabled && (
        <div className="fs-hint">
          {copy.badge} · {copy.label} {currency(monthly, country)}/mo
        </div>
      )}
    </div>
  );
}
