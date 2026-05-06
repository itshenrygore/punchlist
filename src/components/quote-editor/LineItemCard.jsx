import { useState, useRef, useCallback, useEffect } from 'react';
import { currency } from '../../lib/format';

/* ─────────────────────────────────────────────────────────
   LineItemCard — single line item in the quote editor.
   
   Mobile-first: designed for 375px (iPhone X) as baseline.
   - Row 1: item name (full width)
   - Row 2: qty stepper | × $ price | line total | note icon
   - Note (optional, expands below)
   - Swipe left to reveal actions (delete, duplicate)
   ───────────────────────────────────────────────────────── */

const SWIPE_THRESHOLD = 50;
const SWIPE_MAX = 100;

export default function LineItemCard({
  item,
  index,
  country = 'CA',
  isEditing,
  priceRange,
  onUpdate,
  onRemove,
  onDuplicate,
  onAdjustQty,
  onFocus,
  onAddAfter,
  isLast,
}) {
  const [swiped, setSwiped] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!item.notes?.trim());
  const touchRef = useRef({ startX: 0, startY: 0, swiping: false, decided: false });
  const cardRef = useRef(null);
  const contentRef = useRef(null);

  const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
  const qtyDisplay = Number(item.quantity).toFixed(item.quantity % 1 === 0 ? 0 : 2);

  // ── Swipe handling via non-passive listeners ──
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const onStart = (e) => {
      if (swiped) return;
      const t = e.touches[0];
      touchRef.current = { startX: t.clientX, startY: t.clientY, swiping: false, decided: false };
    };

    const onMove = (e) => {
      const ref = touchRef.current;
      const t = e.touches[0];
      const dx = t.clientX - ref.startX;
      const dy = t.clientY - ref.startY;

      // First 10px of movement: decide if horizontal or vertical
      if (!ref.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // too small to decide
        ref.decided = true;
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical scroll — bail out completely
          ref.swiping = false;
          return;
        }
        ref.swiping = true;
      }

      if (!ref.swiping) return;

      e.preventDefault(); // This works because listener is { passive: false }
      const offset = Math.max(-SWIPE_MAX, Math.min(0, dx));
      if (contentRef.current) {
        contentRef.current.style.transform = `translateX(${offset}px)`;
        contentRef.current.style.transition = 'none';
      }
    };

    const onEnd = () => {
      const ref = touchRef.current;
      if (!ref.swiping) return;
      const el = contentRef.current;
      if (!el) return;

      const matrix = new DOMMatrix(getComputedStyle(el).transform);
      const currentX = matrix.m41;

      el.style.transition = 'transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94)';
      if (currentX < -SWIPE_THRESHOLD) {
        el.style.transform = `translateX(-${SWIPE_MAX}px)`;
        setSwiped(true);
      } else {
        el.style.transform = 'translateX(0)';
      }
      ref.swiping = false;
      ref.decided = false;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [swiped]);

  const closeSwipe = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.style.transition = 'transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94)';
      contentRef.current.style.transform = 'translateX(0)';
    }
    setSwiped(false);
  }, []);

  // ── Price hint ──
  const renderPriceHint = () => {
    if (!isEditing || !priceRange) return null;
    const price = Number(item.unit_price || 0);
    const { lo, hi } = priceRange;
    if (price === 0) return <div className="qe-price-hint">Typical: ${lo}–${hi}</div>;
    if (price < lo * 0.6) return <div className="qe-price-hint qe-price-low">Below typical (${lo}–${hi})</div>;
    if (price > hi * 1.8) return <div className="qe-price-hint qe-price-high">Above typical (${lo}–${hi})</div>;
    return null;
  };

  return (
    <div
      ref={cardRef}
      className={`qe-item ${isEditing ? 'qe-item--editing' : ''} ${swiped ? 'qe-item--swiped' : ''}`}
    >
      {/* Swipe-revealed actions */}
      <div className="qe-item-actions-revealed" aria-hidden={!swiped}>
        <button
          type="button"
          className="qe-action-dup"
          onClick={() => { onDuplicate(item.id); closeSwipe(); }}
          aria-label="Duplicate"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button
          type="button"
          className="qe-action-del"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name || 'item'}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>

      {/* Main card content (slides on swipe) */}
      <div ref={contentRef} className="qe-item-content" onClick={() => swiped && closeSwipe()}>
        {/* Row 1: Item name */}
        <input
          className="qe-item-name"
          value={item.name}
          onChange={e => onUpdate(item.id, { name: e.target.value })}
          placeholder="Item name"
          aria-label="Item name"
          onFocus={() => onFocus(item.id)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && isLast) {
              e.preventDefault();
              onAddAfter();
            }
          }}
        />

        {/* Row 2: Qty + Price + Total */}
        <div className="qe-item-row2">
          <div className="qe-qty">
            <button type="button" className="qe-qty-btn" onClick={() => onAdjustQty(item.id, -1)} aria-label="Decrease">−</button>
            <span className="qe-qty-val">{qtyDisplay}</span>
            <button type="button" className="qe-qty-btn" onClick={() => onAdjustQty(item.id, 1)} aria-label="Increase">+</button>
          </div>
          <span className="qe-times">×</span>
          <div className="qe-price">
            <span className="qe-price-dollar">$</span>
            <input
              className="qe-price-input"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={item.unit_price}
              onChange={e => onUpdate(item.id, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
              onFocus={() => onFocus(item.id)}
              aria-label="Unit price"
            />
          </div>
          <span className="qe-line-total">{currency(lineTotal, country)}</span>
          {!noteOpen && (
            <button type="button" className="qe-note-toggle" onClick={() => { setNoteOpen(true); onUpdate(item.id, { notes: item.notes || '' }); }} aria-label="Add note">
              ✎
            </button>
          )}
        </div>

        {renderPriceHint()}

        {/* Note input — only visible when open */}
        {noteOpen && (
          <input
            className="qe-item-note"
            value={item.notes || ''}
            onChange={e => onUpdate(item.id, { notes: e.target.value })}
            placeholder="Note (shown to customer)"
            aria-label="Item note"
          />
        )}
      </div>
    </div>
  );
}
