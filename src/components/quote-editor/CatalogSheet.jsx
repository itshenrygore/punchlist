import { useEffect, useRef, useState, useCallback } from 'react';
import { currency } from '../../lib/format';
import { X, Search } from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   CatalogSheet v2 — full-screen, multi-add, categorized.

   - Opens full-screen (95dvh) with search at the very top
   - Pre-populated: shows all trade items before typing
   - Stays open for multi-add — tap + for each item
   - Results grouped by category with sticky headers
   - Done button to close when finished
   ───────────────────────────────────────────────────────── */

export default function CatalogSheet({
  open,
  onClose,
  query,
  onQueryChange,
  results,
  lineItems,
  trade,
  onAddItem,
}) {
  const sheetRef = useRef(null);
  const backdropRef = useRef(null);
  const inputRef = useRef(null);
  const [closing, setClosing] = useState(false);
  const touchRef = useRef({ startY: 0, currentY: 0, dragging: false });

  // Focus search on open
  useEffect(() => {
    if (open && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 250);
  }, [onClose]);

  // Drag to dismiss
  const onTouchStart = useCallback((e) => {
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.touches[0].clientY - rect.top;
    if (y > 48) return;
    touchRef.current = { startY: e.touches[0].clientY, currentY: e.touches[0].clientY, dragging: true };
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!touchRef.current.dragging) return;
    touchRef.current.currentY = e.touches[0].clientY;
    const dy = e.touches[0].clientY - touchRef.current.startY;
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchRef.current.dragging) return;
    const dy = touchRef.current.currentY - touchRef.current.startY;
    touchRef.current.dragging = false;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.25s ease-out';
      if (dy > 100) {
        sheetRef.current.style.transform = 'translateY(100%)';
        setTimeout(handleClose, 250);
      } else {
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
  }, [handleClose]);

  if (!open && !closing) return null;

  const isAdded = (name) => lineItems.some(li => (li.name || '').toLowerCase() === name.toLowerCase());

  // Group results by category
  const grouped = {};
  results.forEach(item => {
    const cat = (item.category || 'other').toLowerCase();
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  const catOrder = ['services', 'labour', 'materials', 'other'];
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    const ai = catOrder.indexOf(a), bi = catOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const showCatHeaders = sortedGroups.length > 1;

  return (
    <div
      className={`cs-backdrop ${closing ? 'cs-backdrop--closing' : ''}`}
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) handleClose(); }}
    >
      <div
        ref={sheetRef}
        className={`cs-sheet ${closing ? 'cs-sheet--closing' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Handle */}
        <div className="cs-handle-area"><div className="cs-handle" /></div>

        {/* Search — pinned at top */}
        <div className="cs-search">
          <Search size={15} className="cs-search-icon" />
          <input
            ref={inputRef}
            className="cs-search-input"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder={`Search ${trade?.toLowerCase() || ''} items…`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button type="button" className="cs-clear" onClick={() => onQueryChange('')} aria-label="Clear">
              <X size={14} />
            </button>
          )}
          <button type="button" className="cs-done" onClick={handleClose}>Done</button>
        </div>

        {/* Results */}
        <div className="cs-results">
          {results.length > 0 ? (
            sortedGroups.map(([cat, items]) => (
              <div key={cat}>
                {showCatHeaders && (
                  <div className="cs-section">{cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
                )}
                {items.map((item, i) => {
                  const added = isAdded(item.name);
                  return (
                    <button
                      key={`${item.name}-${i}`}
                      type="button"
                      className={`cs-item ${added ? 'cs-item--added' : ''}`}
                      onClick={() => !added && onAddItem(item)}
                      disabled={added}
                    >
                      <div className="cs-item-info">
                        <span className="cs-item-name">{item.name}</span>
                        {item.desc && <span className="cs-item-desc">{item.desc}</span>}
                      </div>
                      <div className="cs-item-right">
                        <span className="cs-item-price">{currency(item.lo)}–{currency(item.hi)}</span>
                        <span className={`cs-item-icon ${added ? 'cs-item-icon--done' : ''}`}>
                          {added ? '✓' : '+'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="cs-empty">
              {query && query.length >= 2
                ? 'No matches — try different keywords'
                : `Type to search ${trade?.toLowerCase() || ''} items`
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
