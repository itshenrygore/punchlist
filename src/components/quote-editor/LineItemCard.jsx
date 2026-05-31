import { useState, useRef, useCallback, useEffect } from 'react';
import { currency } from '../../lib/format';

/* ─────────────────────────────────────────────────────────
   LineItemCard v2 — collapsed / expanded paradigm.

   COLLAPSED (default):
     Single row: name … qty × $price   $total
     ~38px. Tap to expand. Swipe left → delete.

   EXPANDED (one at a time):
     Name input, qty stepper, price input, note, delete btn.
     Tap outside or tap another item → collapse.
   ───────────────────────────────────────────────────────── */

const SWIPE_THRESHOLD = 50;
const SWIPE_MAX = 88;

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
  const nameRef = useRef(null);

  const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
  const qty = Number(item.quantity || 1);
  const qtyDisplay = qty.toFixed(qty % 1 === 0 ? 0 : 2);
  const expanded = isEditing;

  // Auto-focus name when expanding
  useEffect(() => {
    if (expanded && nameRef.current) {
      const t = setTimeout(() => nameRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [expanded]);

  // ── Swipe handling ──
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const onStart = (e) => {
      if (swiped || expanded) return;
      const t = e.touches[0];
      touchRef.current = { startX: t.clientX, startY: t.clientY, swiping: false, decided: false };
    };

    const onMove = (e) => {
      const ref = touchRef.current;
      if (!ref.startX) return;
      const t = e.touches[0];
      const dx = t.clientX - ref.startX;
      const dy = t.clientY - ref.startY;

      if (!ref.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        ref.decided = true;
        if (Math.abs(dy) > Math.abs(dx)) { ref.swiping = false; return; }
        ref.swiping = true;
      }
      if (!ref.swiping) return;

      e.preventDefault();
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
      el.style.transition = 'transform 0.2s ease-out';
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
  }, [swiped, expanded]);

  const closeSwipe = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.style.transition = 'transform 0.2s ease-out';
      contentRef.current.style.transform = 'translateX(0)';
    }
    setSwiped(false);
  }, []);

  const renderPriceHint = () => {
    if (!expanded || !priceRange) return null;
    const price = Number(item.unit_price || 0);
    const { lo, hi } = priceRange;
    if (price === 0) return <div className="li-hint">Typical: ${lo}–${hi}</div>;
    if (price < lo * 0.6) return <div className="li-hint li-hint--low">Below typical (${lo}–${hi})</div>;
    if (price > hi * 1.8) return <div className="li-hint li-hint--high">Above typical (${lo}–${hi})</div>;
    return null;
  };

  const handleRowTap = () => {
    if (swiped) { closeSwipe(); return; }
    if (!expanded) onFocus(item.id);
  };

  return (
    <div
      ref={cardRef}
      className={`li-row ${expanded ? 'li-row--open' : ''} ${swiped ? 'li-row--swiped' : ''}`}
    >
      {/* Swipe actions */}
      <div className="li-swipe-actions" aria-hidden={!swiped}>
        <button type="button" className="li-swipe-btn li-swipe-del" onClick={() => onRemove(item.id)} aria-label="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          <span className="li-swipe-label">Delete</span>
        </button>
      </div>

      {/* Main content */}
      <div ref={contentRef} className="li-content" onClick={!expanded ? handleRowTap : undefined}>

        {/* COLLAPSED */}
        {!expanded && (
          <div className="li-summary">
            <span className="li-summary-name">{item.name || 'Untitled item'}</span>
            <span className="li-summary-meta">
              {qty !== 1 && <span className="li-summary-qty">{qtyDisplay}×</span>}
            </span>
            <span className="li-summary-total">{currency(lineTotal, country)}</span>
          </div>
        )}

        {/* EXPANDED */}
        {expanded && (
          <div className="li-edit">
            <input
              ref={nameRef}
              className="li-edit-name"
              value={item.name}
              onChange={e => onUpdate(item.id, { name: e.target.value })}
              placeholder="Item name"
              aria-label="Item name"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && isLast) { e.preventDefault(); onAddAfter(); }
              }}
            />

            <div className="li-edit-row">
              <div className="li-qty">
                <button type="button" className="li-qty-btn" onClick={() => onAdjustQty(item.id, -1)} aria-label="Decrease">−</button>
                <span className="li-qty-val">{qtyDisplay}</span>
                <button type="button" className="li-qty-btn" onClick={() => onAdjustQty(item.id, 1)} aria-label="Increase">+</button>
              </div>
              <span className="li-times">×</span>
              <div className="li-price">
                <span className="li-price-sign">$</span>
                <input
                  className="li-price-input"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={item.unit_price}
                  onChange={e => onUpdate(item.id, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
                  aria-label="Unit price"
                />
              </div>
              <span className="li-total">{currency(lineTotal, country)}</span>
            </div>

            {/* Make labour editability obvious — for labour lines, qty = hours
                and price = your hourly rate, both tappable above. */}
            {/labou?r/i.test(item.category || '') && (
              <div className="li-labour-hint" style={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', marginTop: 4 }}>
                Labour — adjust hours (qty) and your rate (price) to fit this job
              </div>
            )}

            {renderPriceHint()}

            {noteOpen ? (
              <input
                className="li-note"
                value={item.notes || ''}
                onChange={e => onUpdate(item.id, { notes: e.target.value })}
                placeholder="Note (visible to customer)"
                aria-label="Item note"
              />
            ) : (
              <button type="button" className="li-note-toggle" onClick={() => { setNoteOpen(true); onUpdate(item.id, { notes: item.notes || '' }); }}>
                + Add note
              </button>
            )}

            <div className="li-actions">
              <button type="button" className="li-action-btn" onClick={() => onDuplicate(item.id)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Duplicate
              </button>
              <button type="button" className="li-action-btn li-action-btn--danger" onClick={() => onRemove(item.id)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
