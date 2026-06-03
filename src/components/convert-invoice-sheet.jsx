import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, MessageSquare, Mail, Link2 } from 'lucide-react';
import useScrollLock from '../hooks/use-scroll-lock';

/**
 * ConvertInvoiceSheet — the bottom-sheet that the contractor sees
 * after tapping "Create invoice" on an approved quote. Previously the
 * convert was a black-box one-tap → navigate; this gives the contractor
 * the three decisions that actually matter and lets them send in one
 * step instead of "create → re-open → send" two-step.
 *
 * Props:
 *   open: boolean
 *   quote: the source quote (line_items + customer + deposit info)
 *   defaultDueDays: number — from profile.invoice_due_days
 *   onCancel: () => void
 *   onConfirm: ({ amountMode, customAmount, dueAt, sendChannel }) => Promise<void>
 *                amountMode: 'balance' | 'full' | 'custom'
 *                customAmount: number | null (only when amountMode='custom')
 *                dueAt: ISO string
 *                sendChannel: null | 'sms' | 'email' | 'copy'
 *
 * Visual model:
 *   - Top: customer name + quote title (anchor — "what am I invoicing?")
 *   - Three radio chips for amount: Full balance / Just the balance / Custom
 *   - Due date pill: tap to expand to a date picker
 *   - Line-item preview (collapsed by default; tap to expand)
 *   - Primary CTA: "Create & send via {channel}" — auto-picked from
 *     what contact info the customer has, with a chip switcher
 *   - Secondary: "Save as draft"
 */
export default function ConvertInvoiceSheet({
  open,
  quote,
  defaultDueDays = 30,
  onCancel,
  onConfirm,
}) {
  useScrollLock(Boolean(open));
  const dialogRef = useRef(null);

  const depositCredited = useMemo(
    () => (quote?.deposit_status === 'paid' ? Number(quote?.deposit_amount || 0) : 0),
    [quote?.deposit_status, quote?.deposit_amount],
  );
  const fullTotal = Number(quote?.total || 0);
  const balanceTotal = Math.max(0, fullTotal - depositCredited);
  const country = quote?.country || 'CA';
  const customer = quote?.customer || null;
  const firstName = customer?.name?.split(' ')[0] || '';

  // ── Choice 1: how much to invoice. Default to 'balance' when there's
  //   a paid deposit (so the customer isn't asked to pay it twice), else 'full'.
  const [amountMode, setAmountMode] = useState(() => (depositCredited > 0 ? 'balance' : 'full'));
  // Milestone default: 50% of the balance, rounded to the nearest $50 — a
  // common "halfway / midpoint" billing draw. Contractors edit if needed.
  const [customAmount, setCustomAmount] = useState(() => Math.max(0, Math.round((balanceTotal / 2) / 50) * 50));

  // ── Choice 2: due date. We render a friendly pill; tapping reveals the input.
  const [dueDays, setDueDays] = useState(defaultDueDays);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const dueAt = useMemo(
    () => new Date(Date.now() + Math.max(1, Math.min(180, Number(dueDays) || defaultDueDays)) * 86400000),
    [dueDays, defaultDueDays],
  );

  // ── Choice 3: send channel. Auto-pick based on customer contact info.
  //   The picker shows what's available; null = save as draft.
  const channels = useMemo(() => {
    const list = [];
    if (customer?.phone) list.push({ id: 'sms', label: `Text ${firstName || customer.name || 'customer'}`, Icon: MessageSquare });
    if (customer?.email) list.push({ id: 'email', label: `Email ${firstName || customer.name || 'customer'}`, Icon: Mail });
    list.push({ id: 'copy', label: 'Copy link', Icon: Link2 });
    return list;
  }, [customer, firstName]);
  const [sendChannel, setSendChannel] = useState(() => channels[0]?.id || null);
  useEffect(() => { if (!channels.find(c => c.id === sendChannel)) setSendChannel(channels[0]?.id || null); }, [channels, sendChannel]);

  // ── Esc to close ──
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  // Focus the primary CTA when opened so Enter sends.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const target = dialogRef.current?.querySelector('[data-pl-primary-cta]');
      try { target?.focus(); } catch { /* */ }
    }, 80);
    return () => clearTimeout(t);
  }, [open]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open || !quote) return null;

  const includedLineItems = (quote.line_items || []).filter(i => i.included !== false);
  const fmt = (n) => {
    const num = Number(n || 0);
    return new Intl.NumberFormat(country === 'US' ? 'en-US' : 'en-CA', {
      style: 'currency', currency: country === 'US' ? 'USD' : 'CAD', maximumFractionDigits: 0,
    }).format(num);
  };

  const headlineAmount =
    amountMode === 'full'    ? fullTotal :
    amountMode === 'balance' ? balanceTotal :
    Math.max(0, Math.min(1e7, Number(customAmount) || 0));

  async function handlePrimary(channelOverride) {
    if (submitting) return;
    if (amountMode === 'custom' && headlineAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm({
        amountMode,
        customAmount: amountMode === 'custom' ? headlineAmount : null,
        dueAt: dueAt.toISOString(),
        sendChannel: channelOverride === false ? null : (channelOverride || sendChannel),
      });
    } catch (e) {
      setError(e?.message || 'Could not create invoice');
      setSubmitting(false);
    }
  }

  const dueLabel = (() => {
    const d = dueAt;
    const now = new Date();
    const days = Math.round((d.getTime() - now.getTime()) / 86400000);
    if (days <= 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days <= 14) return `Due in ${days} days`;
    return `Due ${d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`;
  })();

  const sendChannelMeta = channels.find(c => c.id === sendChannel);
  const SendIcon = sendChannelMeta?.Icon || Check;

  return (
    <div className="cvt-overlay" role="dialog" aria-modal="true" aria-label="Create invoice" onClick={onCancel}>
      <div className="cvt-sheet" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="cvt-handle" aria-hidden="true" />
        <div className="cvt-body">
        <div className="cvt-head">
          <div className="cvt-head-text">
            <div className="cvt-eyebrow">Create invoice</div>
            <h2 className="cvt-title">{quote.title || 'Invoice'}</h2>
            {customer?.name && <div className="cvt-customer">for {customer.name}</div>}
          </div>
          <button type="button" className="cvt-close qb-modal-close" onClick={onCancel} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Amount picker — three chips */}
        <div className="cvt-section">
          <div className="cvt-section-label">Bill amount</div>
          <div className="cvt-amount-grid">
            {depositCredited > 0 && (
              <button
                type="button"
                className={`cvt-amount-chip${amountMode === 'balance' ? ' is-selected' : ''}`}
                onClick={() => setAmountMode('balance')}
              >
                <span className="cvt-amount-chip-label">Remaining balance</span>
                <span className="cvt-amount-chip-val">{fmt(balanceTotal)}</span>
                <span className="cvt-amount-chip-hint">{fmt(fullTotal)} − {fmt(depositCredited)} deposit</span>
              </button>
            )}
            <button
              type="button"
              className={`cvt-amount-chip${amountMode === 'full' ? ' is-selected' : ''}`}
              onClick={() => setAmountMode('full')}
            >
              <span className="cvt-amount-chip-label">Full quote</span>
              <span className="cvt-amount-chip-val">{fmt(fullTotal)}</span>
              {depositCredited > 0 && <span className="cvt-amount-chip-hint">No deposit credit</span>}
            </button>
            <button
              type="button"
              className={`cvt-amount-chip${amountMode === 'custom' ? ' is-selected' : ''}`}
              onClick={() => setAmountMode('custom')}
            >
              <span className="cvt-amount-chip-label">Milestone</span>
              <span className="cvt-amount-chip-val">{amountMode === 'custom' ? fmt(headlineAmount) : 'Custom $'}</span>
              <span className="cvt-amount-chip-hint">Bill a partial amount</span>
            </button>
          </div>
          {amountMode === 'custom' && (
            <div className="cvt-custom-row">
              <span className="cvt-custom-prefix">$</span>
              <input
                type="number"
                inputMode="decimal"
                className="cvt-custom-input input"
                value={customAmount}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setCustomAmount(!Number.isFinite(n) || n < 0 ? 0 : Math.min(n, 1e7));
                }}
                aria-label="Custom amount"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Due date — collapsible */}
        <div className="cvt-section">
          <div className="cvt-section-label">Due</div>
          {!showDuePicker ? (
            <button type="button" className="cvt-due-pill" onClick={() => setShowDuePicker(true)}>
              <span>{dueLabel}</span>
              <span className="cvt-due-pill-edit">change</span>
            </button>
          ) : (
            <div className="cvt-due-picker">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`cvt-due-quick${Number(dueDays) === d ? ' is-selected' : ''}`}
                  onClick={() => setDueDays(d)}
                >
                  {d} days
                </button>
              ))}
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="180"
                className="cvt-due-input input"
                value={dueDays}
                onChange={(e) => setDueDays(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
                aria-label="Days until due"
              />
              <span className="cvt-due-input-suffix">days</span>
            </div>
          )}
        </div>

        {/* Line-item preview — collapsed */}
        <details className="cvt-section cvt-items">
          <summary className="cvt-items-summary">
            <span>{includedLineItems.length} line item{includedLineItems.length !== 1 ? 's' : ''}</span>
            <span className="cvt-items-summary-hint">preview</span>
          </summary>
          <div className="cvt-items-list">
            {includedLineItems.map((it, i) => (
              <div key={it.id || i} className="cvt-item-row">
                <div className="cvt-item-name">{it.name}</div>
                <div className="cvt-item-price">{fmt(Number(it.quantity || 1) * Number(it.unit_price || 0))}</div>
              </div>
            ))}
          </div>
        </details>

        {/* Channel switcher row — only shown if more than one option */}
        {channels.length > 1 && sendChannel && (
          <div className="cvt-section cvt-channel-row">
            <span className="cvt-channel-label">Send via</span>
            <div className="cvt-channel-chips">
              {channels.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`cvt-channel-chip${sendChannel === id ? ' is-selected' : ''}`}
                  onClick={() => setSendChannel(id)}
                  aria-pressed={sendChannel === id}
                >
                  <Icon size={13} strokeWidth={2} />
                  <span>{label.replace(/^(Text|Email|Copy)\s.*/, '$1')}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="cvt-error" role="alert">{error}</div>}
        </div>

        {/* Primary CTA — single tap creates AND sends */}
        <div className="cvt-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg full-width cvt-primary"
            data-pl-primary-cta
            disabled={submitting || headlineAmount <= 0}
            onClick={() => handlePrimary()}
          >
            {submitting
              ? 'Creating…'
              : sendChannel
                ? <><SendIcon size={15} strokeWidth={2} /> Create &amp; {(() => { const lbl = sendChannelMeta?.label || 'send'; return lbl.replace(/^(\S+)/, m => m.toLowerCase()); })()}</>
                : `Create draft — ${fmt(headlineAmount)}`}
          </button>
          {sendChannel && (
            <button
              type="button"
              className="btn-link cvt-secondary"
              disabled={submitting}
              onClick={() => handlePrimary(false)}
            >
              or save as draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
