import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useQuoteBuilder } from './quote-builder-context';
import { actions } from './use-quote-draft';
import { currency } from '../../lib/format';
import { makeId } from '../../lib/utils';
import { DUR, isReducedMotion } from '../../lib/motion';
import { searchCatalog } from '../../../shared/systemCatalog';
import { regionalize, normalizeTrade, anchorPrice } from '../../../shared/tradeBrain';

/* ═══════════════════════════════════════════════════════════
   LineItemList — Editable line item cards.

   Responsibilities:
     • Render, edit, reorder, add, remove, duplicate items
     • Price confidence hints (inline, per-item)
     • Leave animations (opacity + translate, no height)
     • Drag-and-drop reorder
   ═══════════════════════════════════════════════════════════ */

export default function LineItemList() {
  const { state, dispatch, handlers, derived } = useQuoteBuilder();
  const {
    lineItems, editingItemId, leavingItemIds,
    trade, province, country,
  } = state;

  const itemCount = lineItems.filter(i => i.name?.trim()).length;

  // ── Price range hints ──
  const priceRanges = useMemo(() => {
    const ranges = {};
    for (const item of lineItems) {
      const name = (item.name || '').trim();
      if (name.length < 3) continue;
      const hits = searchCatalog(name, trade, 1, province);
      if (hits.length > 0) {
        const hit = hits[0];
        const adj = regionalize(hit, province);
        const a = anchorPrice(adj.lo || hit.lo, adj.hi || hit.hi, normalizeTrade(trade), hit.c);
        if (a.lo > 0 && a.hi > 0) {
          ranges[item.id] = { lo: a.lo, hi: a.hi, name: hit.n };
        }
      }
    }
    return ranges;
  }, [lineItems.map(i => i.name + i.id).join(','), trade, province]);

  function updateItem(id, changes) {
    dispatch(actions.updateItem(id, changes));
  }

  function removeItem(id) {
    const r = lineItems.find(i => i.id === id);
    if (isReducedMotion()) {
      dispatch(actions.removeItem(id));
      if (r?.name) handlers.toast(`Removed: ${r.name}`, 'info');
      return;
    }
    dispatch(actions.markItemLeaving(id));
    setTimeout(() => {
      dispatch(actions.removeItem(id));
      dispatch(actions.clearItemLeaving(id));
      if (r?.name) handlers.toast(`Removed: ${r.name}`, 'info');
    }, Math.round((DUR?.base || 0.22) * 1000));
  }

  function duplicateItem(id) {
    const o = lineItems.find(i => i.id === id);
    if (!o) return;
    const newItems = [...lineItems];
    const idx = newItems.findIndex(i => i.id === id);
    newItems.splice(idx + 1, 0, { ...o, id: makeId() });
    dispatch(actions.setLineItems(newItems));
  }

  function adjustQty(id, delta) {
    const item = lineItems.find(i => i.id === id);
    if (!item) return;
    const newQty = Math.max(0.25, Math.round(((item.quantity || 1) + delta * 0.25) * 100) / 100);
    dispatch(actions.updateItem(id, { quantity: newQty }));
  }

  function handleDrop(e, toIdx) {
    e.preventDefault();
    e.currentTarget.classList.remove('rq-card-dragover');
    const from = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(from) || from === toIdx) return;
    dispatch(actions.reorderItems(from, toIdx));
  }

  function addEmptyItem() {
    dispatch(actions.addItem({
      id: 'new_' + Date.now(),
      name: '',
      quantity: 1,
      unit_price: 0,
      notes: '',
      included: true,
      category: '',
    }));
  }

  return (
    <div id="qb-line-items" className="rq-items-section pl-items-motion pl-items-stable">
      <div className="rq-items-head">
        <span className="rq-items-title">
          {itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : 'Line items'}
        </span>
      </div>

      {lineItems.map((item, idx) => {
        const itemTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
        const isLeaving = leavingItemIds.has(item.id);

        return (
          <div
            key={item.id}
            className={`rq-card ${editingItemId === item.id ? 'rq-card-editing' : ''} ${isLeaving ? 'pl-item-leave' : 'pl-item-enter'}`}
            draggable={!isLeaving}
            onDragStart={e => { e.dataTransfer.setData('text/plain', idx.toString()); e.currentTarget.style.opacity = '0.5'; }}
            onDragEnd={e => { e.currentTarget.style.opacity = '1'; }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('rq-card-dragover'); }}
            onDragLeave={e => { e.currentTarget.classList.remove('rq-card-dragover'); }}
            onDrop={e => handleDrop(e, idx)}
          >
            <div className="rq-card-drag-handle" title="Drag to reorder" aria-hidden="true">⠿</div>
            <div className="rq-card-main">
              <div className="rq-card-top">
                <input
                  className="rq-card-name"
                  value={item.name}
                  onChange={e => updateItem(item.id, { name: e.target.value })}
                  placeholder="Item name"
                  aria-label="Item name"
                  data-item-idx={idx}
                  onFocus={() => dispatch(actions.setEditingItem(item.id))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && idx === lineItems.length - 1) {
                      e.preventDefault();
                      addEmptyItem();
                    }
                  }}
                />
                <span className="rq-card-line-total tabular">{currency(itemTotal, country)}</span>
              </div>
              <div className="rq-card-controls">
                <div className="rq-qty-stepper">
                  <button type="button" className="rq-qty-btn" aria-label="Decrease quantity" onClick={() => adjustQty(item.id, -1)}>−</button>
                  <span className="rq-qty-val tabular">{Number(item.quantity).toFixed(item.quantity % 1 === 0 ? 0 : 2)}</span>
                  <button type="button" className="rq-qty-btn" aria-label="Increase quantity" onClick={() => adjustQty(item.id, 1)}>+</button>
                </div>
                <span className="rq-card-times">×</span>
                <div className="rq-price-wrap">
                  <span className="rq-price-prefix">$</span>
                  <input
                    className="rq-card-price-input tabular"
                    type="number"
                    min="0"
                    step="1"
                    value={item.unit_price}
                    aria-label="Unit price"
                    onChange={e => updateItem(item.id, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
                    onFocus={() => dispatch(actions.setEditingItem(item.id))}
                  />
                </div>
                <div className="rq-card-item-actions">
                  <button className="rq-card-action-btn" type="button" onClick={() => duplicateItem(item.id)} title="Duplicate" aria-label="Duplicate item">⧉</button>
                  <button className="rq-card-action-btn rq-card-action-del" type="button" onClick={() => removeItem(item.id)} title="Remove" aria-label={`Remove ${item.name || 'item'}`}>×</button>
                </div>
              </div>

              {/* Price confidence hint */}
              {editingItemId === item.id && priceRanges[item.id] && (() => {
                const r = priceRanges[item.id];
                const price = Number(item.unit_price || 0);
                if (price === 0) return <div className="rq-price-hint">Typical: ${r.lo}–${r.hi}</div>;
                if (price < r.lo * 0.6) return <div className="rq-price-hint rq-price-low">Below typical range (${r.lo}–${r.hi})</div>;
                if (price > r.hi * 1.8) return <div className="rq-price-hint rq-price-high">Above typical range (${r.lo}–${r.hi})</div>;
                return null;
              })()}

              {/* Notes */}
              {item.notes ? (
                <input
                  className="rq-card-notes"
                  value={item.notes}
                  onChange={e => updateItem(item.id, { notes: e.target.value })}
                  placeholder="Note (shown to customer)"
                  aria-label="Item note"
                />
              ) : (
                <button type="button" className="rq-card-add-note" onClick={() => updateItem(item.id, { notes: ' ' })}>
                  + note
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {lineItems.length === 0 && (
        <div className="rq-empty">
          <div className="rq-empty-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div className="rq-empty-text">No items yet</div>
          <div className="rq-empty-sub">
            Search the catalog, add custom items, or ask Foreman to help scope this job.
          </div>
        </div>
      )}
    </div>
  );
}
