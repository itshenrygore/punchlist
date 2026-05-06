import { useEffect, useRef, useState, useCallback } from 'react';
import { currency } from '../../lib/format';
import { X, Search } from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   CatalogSheet — iOS-style bottom sheet for catalog search.
   
   Slides up from bottom, full-screen on mobile.
   Drag handle to dismiss. Search auto-focuses.
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

  // Focus search input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      // Small delay so the sheet animation completes
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  }, [onClose]);

  // Drag to dismiss
  const onTouchStart = useCallback((e) => {
    // Only drag from the handle area (top 48px)
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.touches[0].clientY - rect.top;
    if (y > 48) return;
    touchRef.current = { startY: e.touches[0].clientY, currentY: e.touches[0].clientY, dragging: true };
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!touchRef.current.dragging) return;
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
      sheetRef.current.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
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
    const cat = (item.category || 'Other').toLowerCase();
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  const categoryOrder = ['services', 'labour', 'materials', 'other'];
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    const ai = categoryOrder.indexOf(a), bi = categoryOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className={`qe-sheet-backdrop ${closing ? 'qe-sheet-backdrop--closing' : ''}`} ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) handleClose(); }}>
      <div
        ref={sheetRef}
        className={`qe-sheet ${closing ? 'qe-sheet--closing' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div className="qe-sheet-handle-area">
          <div className="qe-sheet-handle" />
        </div>

        {/* Search bar — pinned */}
        <div className="qe-sheet-search">
          <Search size={16} className="qe-sheet-search-icon" />
          <input
            ref={inputRef}
            className="qe-sheet-input"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder={`Search ${trade?.toLowerCase() || ''} items…`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button type="button" className="qe-sheet-clear" onClick={() => onQueryChange('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
          <button type="button" className="qe-sheet-close" onClick={handleClose} aria-label="Close">
            Done
          </button>
        </div>

        {/* Results */}
        <div className="qe-sheet-results">
          {results.length > 0 ? (
            sortedGroups.map(([cat, items]) => (
              <div key={cat}>
                {sortedGroups.length > 1 && (
                  <div className="qe-cat-section-header">{cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
                )}
                {items.map((item, i) => {
                  const added = isAdded(item.name);
                  return (
                    <button
                      key={`${item.name}-${i}`}
                      type="button"
                      className={`qe-cat-item ${added ? 'qe-cat-item--added' : ''} ${item.isContextRelevant ? 'qe-cat-item--relevant' : ''}`}
                      onClick={() => !added && onAddItem(item)}
                      disabled={added}
                    >
                      <div className="qe-cat-info">
                        <span className="qe-cat-name">{item.name}</span>
                        {item.desc && <span className="qe-cat-desc">{item.desc}</span>}
                      </div>
                      <div className="qe-cat-right">
                        <span className="qe-cat-price">{currency(item.lo)}–{currency(item.hi)}</span>
                        <span className={`qe-cat-add-icon ${added ? 'qe-cat-add-icon--done' : ''}`}>
                          {added ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="qe-sheet-empty">
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
