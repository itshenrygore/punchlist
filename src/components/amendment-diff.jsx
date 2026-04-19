import { useMemo } from 'react';
import { currency as formatCurrency, formatDate } from '../lib/format';
import { estimateMonthly, showFinancing } from '../lib/financing';

/* ═══════════════════════════════════════════════════════════════════════
   AmendmentDiff — Combined original + amendment view for quote timeline.
   Shows Original scope + Amendment delta with green/red diff highlighting.
   M6 §6.3 — amendment flow merge into main quote timeline.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Props:
 *  quote        — full quote object (has .line_items, .total, .subtotal, etc.)
 *  amendment    — amendment object (has .items, .title, .reason, .total, etc.)
 *  country      — 'CA' | 'US' for currency formatting
 *  compact      — boolean, render a compact version (no headers, fewer rows)
 */
export default function AmendmentDiff({ quote, amendment, country = 'CA', compact = false }) {
  const currency = (n) => formatCurrency(n, country);

  // Derive removed items: items in original quote NOT in the amendment
  // If the amendment has a removedItems[] list, use that. Otherwise compute by name comparison.
  const removedItems = useMemo(() => {
    if (Array.isArray(amendment.removed_items) && amendment.removed_items.length > 0) {
      return amendment.removed_items;
    }
    // No explicit removed list — return empty (added-only amendments are the common case)
    return [];
  }, [amendment]);

  const addedItems = useMemo(() => (amendment.items || amendment.line_items || []), [amendment]);

  const origItems = useMemo(
    () => (quote.line_items || []).filter(i => i.included !== false),
    [quote]
  );

  const newTotal = Number(quote.total || 0) + Number(amendment.total || 0);

  if (!addedItems.length && !removedItems.length) return null;

  if (compact) {
    return (
      <div className="amd-diff amd-diff--compact" role="region" aria-label="Amendment changes">
        {removedItems.map((item, i) => (
          <div key={`rm-${item.id || i}`} className="amd-row amd-row--removed">
            <span className="amd-badge amd-badge--removed" aria-hidden="true">−</span>
            <span className="amd-item-name">{item.name}</span>
            <span className="amd-item-price tabular">
              −{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
            </span>
          </div>
        ))}
        {addedItems.map((item, i) => (
          <div key={`add-${item.id || i}`} className="amd-row amd-row--added">
            <span className="amd-badge amd-badge--added" aria-hidden="true">+</span>
            <span className="amd-item-name">{item.name}</span>
            <span className="amd-item-price tabular">
              +{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
            </span>
          </div>
        ))}
        <div className="amd-summary-row">
          <span>New total</span>
          <span className="tabular">{currency(newTotal)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="amd-diff" role="region" aria-label="Quote amendment timeline">

      {/* ── Original scope section ── */}
      <div className="amd-section amd-section--original">
        <div className="amd-section-head">
          <span className="amd-section-label">Original scope</span>
          {quote.signed_at && (
            <span className="amd-signed-badge">
              <span aria-hidden="true">✓</span> Signed {formatDate(quote.signed_at)}
            </span>
          )}
        </div>

        {/* Original line items — muted, read-only presentation */}
        <div className="amd-orig-items">
          {origItems.map(item => (
            <div
              key={item.id}
              className={`amd-row amd-row--original${removedItems.some(r => r.id === item.id || r.name === item.name) ? ' amd-row--struck' : ''}`}
            >
              {removedItems.some(r => r.id === item.id || r.name === item.name) && (
                <span className="amd-badge amd-badge--removed" aria-label="Removed">−</span>
              )}
              <span className="amd-item-name">{item.name}</span>
              {item.notes && <span className="amd-item-note">{item.notes}</span>}
              <span className="amd-item-price tabular">
                {currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
              </span>
            </div>
          ))}
        </div>

        <div className="amd-subtotal amd-subtotal--original">
          <span>Original total</span>
          <span className="tabular">{currency(quote.total)}</span>
        </div>
      </div>

      {/* ── Amendment delta section ── */}
      <div className="amd-section amd-section--delta">
        <div className="amd-section-head">
          <span className="amd-section-label amd-section-label--delta">
            + Amendment{amendment.title ? ` — ${amendment.title}` : ''}
          </span>
          {amendment.signed_at && (
            <span className="amd-signed-badge">
              <span aria-hidden="true">✓</span> Signed {formatDate(amendment.signed_at)}
            </span>
          )}
        </div>

        {amendment.reason && (
          <p className="amd-reason">Reason: {amendment.reason}</p>
        )}

        {/* Added items — highlighted green */}
        {addedItems.map((item, i) => (
          <div key={`add-${item.id || i}`} className="amd-row amd-row--added">
            <span className="amd-badge amd-badge--added" aria-label="Added">+</span>
            <div className="amd-item-body">
              <span className="amd-item-name">{item.name}</span>
              {item.notes && <span className="amd-item-note">{item.notes}</span>}
              {Number(item.quantity) > 1 && (
                <span className="amd-item-qty">{item.quantity} × {currency(item.unit_price)}</span>
              )}
            </div>
            <span className="amd-item-price amd-item-price--added tabular">
              +{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
            </span>
          </div>
        ))}

        {/* Removed items (explicit, if amendment carries a removedItems list) */}
        {removedItems.map((item, i) => (
          <div key={`rm-${item.id || i}`} className="amd-row amd-row--removed">
            <span className="amd-badge amd-badge--removed" aria-label="Removed">−</span>
            <div className="amd-item-body">
              <span className="amd-item-name">{item.name}</span>
            </div>
            <span className="amd-item-price amd-item-price--removed tabular">
              −{currency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
            </span>
          </div>
        ))}

        <div className="amd-subtotal amd-subtotal--delta">
          <span>Amendment total</span>
          <span className="tabular amd-item-price--added">+{currency(amendment.total)}</span>
        </div>
      </div>

      {/* ── Combined new total ── */}
      <div className="amd-combined">
        <div className="amd-combined-row">
          <span>Original</span>
          <span className="tabular">{currency(quote.total)}</span>
        </div>
        <div className="amd-combined-row amd-combined-row--delta">
          <span>Amendment</span>
          <span className="tabular">+{currency(amendment.total)}</span>
        </div>
        <div className="amd-combined-row amd-combined-row--total">
          <span>New total</span>
          <span className="tabular">{currency(newTotal)}</span>
        </div>
        {showFinancing(newTotal) && (
          <div className="amd-combined-row amd-combined-row--monthly">
            <span>or as low as</span>
            <span>{currency(estimateMonthly(newTotal))}/mo · subject to approval</span>
          </div>
        )}
      </div>
    </div>
  );
}
