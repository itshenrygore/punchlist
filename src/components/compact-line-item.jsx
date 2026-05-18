import { useState, useRef, useEffect } from 'react';
import { X, GripVertical, ChevronDown } from 'lucide-react';
import { currency } from '../lib/format';

/**
 * CompactLineItem — Receipt-style line item row
 *
 * Replaces the oversized card-per-item that took 200px+ per item.
 * Each item is a single row: name left, price right, tap to edit.
 * Two items fit in ~120px instead of 400px+.
 *
 * Modes:
 *   - display: single row, name + total, tap anywhere to expand
 *   - editing: expanded with qty/price inputs + notes
 */
export default function CompactLineItem({
  item,
  index,
  onUpdate,
  onRemove,
  onReorder,
  isLast,
  onAddNew,
  country = 'CA',
  isLeaving = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const nameRef = useRef(null);
  const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);

  // Auto-expand new empty items
  useEffect(() => {
    if (!item.name && nameRef.current) {
      setExpanded(true);
      nameRef.current.focus();
    }
  }, []);

  function handleNameKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isLast) {
        onAddNew?.();
      } else {
        setExpanded(false);
      }
    }
    if (e.key === 'Escape') {
      setExpanded(false);
    }
  }

  return (
    <div
      className={`cli-row ${expanded ? 'cli-row--expanded' : ''} ${isLeaving ? 'cli-row--leaving' : ''}`}
      draggable={!isLeaving && !expanded}
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', index.toString());
        e.currentTarget.style.opacity = '0.5';
      }}
      onDragEnd={e => { e.currentTarget.style.opacity = '1'; }}
      onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('cli-row--dragover'); }}
      onDragLeave={e => { e.currentTarget.classList.remove('cli-row--dragover'); }}
      onDrop={e => {
        e.preventDefault();
        e.currentTarget.classList.remove('cli-row--dragover');
        const from = parseInt(e.dataTransfer.getData('text/plain'));
        if (!isNaN(from) && from !== index) onReorder?.(from, index);
      }}
    >
      {/* ── Collapsed: single row ── */}
      {!expanded && (
        <button
          type="button"
          className="cli-summary"
          onClick={() => setExpanded(true)}
          aria-label={`Edit ${item.name || 'item'}`}
        >
          <span className="cli-drag" aria-hidden="true">
            <GripVertical size={14} />
          </span>
          <span className="cli-name">{item.name || 'Untitled item'}</span>
          {item.quantity > 1 && (
            <span className="cli-qty">{item.quantity}×</span>
          )}
          <span className="cli-total tabular">{currency(lineTotal, country)}</span>
          <ChevronDown size={14} className="cli-expand-icon" />
        </button>
      )}

      {/* ── Expanded: editable fields ── */}
      {expanded && (
        <div className="cli-edit">
          <div className="cli-edit-header">
            <span className="cli-drag" aria-hidden="true">
              <GripVertical size={14} />
            </span>
            <input
              ref={nameRef}
              className="cli-name-input"
              value={item.name}
              onChange={e => onUpdate(item.id, { name: e.target.value })}
              placeholder="Item name"
              onKeyDown={handleNameKeyDown}
            />
            <button
              type="button"
              className="cli-remove"
              onClick={() => onRemove(item.id)}
              aria-label="Remove item"
            >
              <X size={14} />
            </button>
          </div>

          <div className="cli-edit-row">
            <div className="cli-field cli-field--qty">
              <label className="cli-field-label">Qty</label>
              <div className="cli-qty-group">
                <button
                  type="button"
                  className="cli-qty-btn"
                  onClick={() => onUpdate(item.id, { quantity: Math.max(1, (item.quantity || 1) - 1) })}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  className="cli-qty-input tabular"
                  type="number"
                  min="1"
                  value={item.quantity || 1}
                  onChange={e => onUpdate(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="cli-qty-btn"
                  onClick={() => onUpdate(item.id, { quantity: (item.quantity || 1) + 1 })}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            <div className="cli-field cli-field--price">
              <label className="cli-field-label">Price</label>
              <div className="cli-price-group">
                <span className="cli-price-prefix">$</span>
                <input
                  className="cli-price-input tabular"
                  type="number"
                  min="0"
                  step="1"
                  value={item.unit_price || ''}
                  onChange={e => onUpdate(item.id, { unit_price: Number(e.target.value) || 0 })}
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="cli-field cli-field--total">
              <label className="cli-field-label">Total</label>
              <span className="cli-line-total tabular">{currency(lineTotal, country)}</span>
            </div>
          </div>

          {/* Notes — only show input when expanded */}
          <input
            className="cli-notes-input"
            value={item.notes || ''}
            onChange={e => onUpdate(item.id, { notes: e.target.value })}
            placeholder="Add a note (optional)"
          />

          <button
            type="button"
            className="cli-collapse-btn"
            onClick={() => setExpanded(false)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
