import { useState, useRef, useCallback } from 'react';
import { currency } from '../../lib/format';

/* ─────────────────────────────────────────────────────────
   LineItemCard — single line item in the quote editor.
   
   Mobile-first: designed for 375px (iPhone X) as baseline.
   - Row 1: item name (full width)
   - Row 2: qty stepper | × $ price | line total
   - Row 3 (optional): note
   - Swipe left to reveal actions (delete, duplicate)
   ───────────────────────────────────────────────────────── */

const SWIPE_THRESHOLD = 60;

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
  const touchRef = useRef({ startX: 0, startY: 0, swiping: false });
  const cardRef = useRef(null);
  const contentRef = useRef(null);

  const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
  const qtyDisplay = Number(item.quantity).toFixed(item.quantity % 1 === 0 ? 0 : 2);

  // ── Swipe handling ──
  const handleTouchStart = useCallback((e) => {
    if (swiped) return;
    const touch = e.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY, swiping: false };
  }, [swiped]);

  const handleTouchMove = useCallback((e) => {
    const { startX, startY } = touchRef.current;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // If scrolling vertically, bail
    if (!touchRef.current.swiping && Math.abs(dy) > Math.abs(dx)) return;

    if (dx < -10) {
      touchRef.current.swiping = true;
      e.preventDefault();
      const offset = Math.max(-120, dx);
      if (contentRef.current) {
        contentRef.current.style.transform = `translateX(${offset}px)`;
        contentRef.current.style.transition = 'none';
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchRef.current.swiping) return;
    const el = contentRef.current;
    if (!el) return;
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    const currentX = matrix.m41;

    if (currentX < -SWIPE_THRESHOLD) {
      el.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
      el.style.transform = 'translateX(-120px)';
      setSwiped(true);
    } else {
      el.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
      el.style.transform = 'translateX(0)';
    }
    touchRef.current.swiping = false;
  }, []);

  const closeSwipe = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
        </div>

        {renderPriceHint()}

        {/* Row 3: Note toggle */}
        {noteOpen ? (
          <input
            className="qe-item-note"
            value={item.notes || ''}
            onChange={e => onUpdate(item.id, { notes: e.target.value })}
            placeholder="Note (shown to customer)"
            aria-label="Item note"
          />
        ) : (
          <button type="button" className="qe-note-toggle" onClick={() => { setNoteOpen(true); onUpdate(item.id, { notes: item.notes || '' }); }}>
            + note
          </button>
        )}
      </div>
    </div>
  );
}
