import { useState, useMemo } from 'react';
import CompactLineItem from '../compact-line-item';
import CustomerPicker from './customer-picker';
import { currency } from '../../lib/format';
import { showFinancing, estimateMonthly } from '../../lib/financing';
import { genLineItemId } from '../../lib/utils';

/**
 * ReviewStep — Customer + Items + Scope + Total
 *
 * The heart of the quote builder. Designed for the 30-90 second
 * window where a contractor confirms what the AI built.
 *
 * Key differences from the old review zone:
 *   1. Customer is FIRST (above title, not below)
 *   2. Line items use CompactLineItem (receipt rows, not chunky cards)
 *   3. Sticky footer says "Send Quote →" not "Copy Quote Link"
 *   4. Scope/terms collapsed by default with content indicator
 *
 * Props:
 *   draft — the quote draft object
 *   onDraftChange(key, value) — update a draft field
 *   lineItems, onLineItemsChange — array + setter
 *   customers — customer list for picker
 *   customersLoading — boolean
 *   onCustomerSelect(customer) — pick a customer
 *   onCustomerCreate(data) — create a customer
 *   selectedCustomer — currently selected customer object
 *   scopeMeta — { scope_summary, assumptions, exclusions }
 *   country — 'CA' | 'US'
 *   grandTotal — computed total
 *   onSend — open send sheet
 *   onSave — save draft
 *   saving, saveState, lastSavedAt
 *   isLocked — quote is locked (already sent/approved)
 *   sending — in send flow
 *   error — error message
 *   onAddCatalogItem — open catalog
 *   onAddCustomItem — add blank item
 */
export default function ReviewStep({
  draft,
  onDraftChange,
  lineItems,
  onLineItemsChange,
  customers,
  customersLoading,
  onCustomerSelect,
  onCustomerCreate,
  selectedCustomer,
  scopeMeta,
  country = 'CA',
  grandTotal = 0,
  onSend,
  onSave,
  saving,
  saveState,
  lastSavedAt,
  isLocked,
  sending,
  error,
  onAddCatalogItem,
  onAddCustomItem,
  frequentItems = [],
  onAddFrequentItem,
}) {
  const [leavingItemIds, setLeavingItemIds] = useState(() => new Set());
  const [showFrequent, setShowFrequent] = useState(false);

  const itemCount = lineItems.filter(i => i.name?.trim()).length;

  function updateItem(itemId, updates) {
    onLineItemsChange(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));
  }

  function removeItem(itemId) {
    setLeavingItemIds(prev => new Set([...prev, itemId]));
    setTimeout(() => {
      onLineItemsChange(prev => prev.filter(i => i.id !== itemId));
      setLeavingItemIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }, 200);
  }

  function reorderItems(fromIdx, toIdx) {
    onLineItemsChange(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  function addBlankItem() {
    onLineItemsChange(prev => [
      ...prev,
      { id: genLineItemId(), name: '', quantity: 1, unit_price: 0, notes: '' },
    ]);
  }

  // Scope content indicator
  const scopeHasContent = scopeMeta?.scope_summary || scopeMeta?.assumptions || scopeMeta?.exclusions;
  const scopeLineCount = [scopeMeta?.scope_summary, scopeMeta?.assumptions, scopeMeta?.exclusions].filter(Boolean).length;

  // Save timestamp label
  const savedLabel = lastSavedAt
    ? (() => {
      const diffS = Math.round((Date.now() - lastSavedAt.getTime()) / 1000);
      return diffS < 5 ? 'just now' : diffS < 60 ? `${diffS}s ago` : `${Math.round(diffS / 60)}m ago`;
    })()
    : null;

  return (
    <div className="rs-root">

      {/* ═══ CUSTOMER (first!) ═══ */}
      <section className="rs-section">
        <label className="rs-section-label">Customer</label>
        <CustomerPicker
          customers={customers}
          selectedId={draft.customer_id}
          onSelect={onCustomerSelect}
          onCreate={onCustomerCreate}
          loading={customersLoading}
        />
      </section>

      {/* ═══ TITLE ═══ */}
      <section className="rs-section">
        <input
          className="rs-title-input"
          type="text"
          value={draft.title || ''}
          onChange={e => onDraftChange('title', e.target.value)}
          placeholder="Quote title"
        />
      </section>

      {/* ═══ LINE ITEMS ═══ */}
      <section className="rs-section">
        <div className="rs-section-header">
          <label className="rs-section-label">{itemCount} item{itemCount !== 1 ? 's' : ''}</label>
        </div>

        <div className="rs-items">
          {lineItems.map((item, idx) => (
            <CompactLineItem
              key={item.id}
              item={item}
              index={idx}
              onUpdate={updateItem}
              onRemove={removeItem}
              onReorder={reorderItems}
              isLast={idx === lineItems.length - 1}
              onAddNew={addBlankItem}
              country={country}
              isLeaving={leavingItemIds.has(item.id)}
            />
          ))}
        </div>

        {/* Add item actions — stacked on mobile */}
        <div className="rs-add-actions">
          {onAddCatalogItem && (
            <button className="btn btn-secondary rs-add-btn" type="button" onClick={onAddCatalogItem}>
              Search catalog
            </button>
          )}
          <button className="btn-link rs-add-btn" type="button" onClick={onAddCustomItem || addBlankItem}>
            + Custom item
          </button>
          {frequentItems.length > 0 && (
            <div className="rs-freq-wrap" style={{ position: 'relative' }}>
              <button className="btn-link rs-add-btn" type="button" onClick={() => setShowFrequent(p => !p)}>
                Frequent items
              </button>
              {showFrequent && (
                <div className="rs-freq-dropdown">
                  {frequentItems.map(fi => (
                    <button key={fi.name} type="button" className="rs-freq-item" onClick={() => { onAddFrequentItem?.(fi); setShowFrequent(false); }}>
                      <span className="rs-freq-name">{fi.name}</span>
                      <span className="rs-freq-price">${Number(fi.unit_price || 0).toFixed(0)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ═══ SCOPE, TERMS & NOTES ═══ */}
      {scopeHasContent && (
        <details className="rs-scope-collapse">
          <summary className="rs-scope-summary">
            Scope, terms & notes
            <span className="rs-scope-count">{scopeLineCount} section{scopeLineCount > 1 ? 's' : ''}</span>
          </summary>
          <div className="rs-scope-body">
            {scopeMeta.scope_summary && (
              <div className="rs-scope-section">
                <label className="rs-scope-label">Scope Summary</label>
                <textarea
                  className="rs-scope-textarea"
                  value={scopeMeta.scope_summary}
                  onChange={e => onDraftChange('scope_summary', e.target.value)}
                  rows={3}
                />
              </div>
            )}
            {scopeMeta.assumptions && (
              <div className="rs-scope-section">
                <label className="rs-scope-label">Assumptions</label>
                <textarea
                  className="rs-scope-textarea"
                  value={scopeMeta.assumptions}
                  onChange={e => onDraftChange('assumptions', e.target.value)}
                  rows={2}
                />
              </div>
            )}
            {scopeMeta.exclusions && (
              <div className="rs-scope-section">
                <label className="rs-scope-label">Exclusions</label>
                <textarea
                  className="rs-scope-textarea"
                  value={scopeMeta.exclusions}
                  onChange={e => onDraftChange('exclusions', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
        </details>
      )}

      {/* ═══ ERROR ═══ */}
      {error && <div className="jd-error" role="alert">{error}</div>}

      {/* ═══ STICKY FOOTER — total + primary CTA ═══ */}
      <div className="rs-footer">
        <div className="rs-footer-left">
          <button
            className={`btn btn-secondary btn-sm ${saveState === 'saved' ? 'btn-saved' : ''}`}
            type="button"
            disabled={saving || isLocked}
            onClick={onSave}
          >
            {saving ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Save'}
          </button>
          {savedLabel && (
            <span className="rs-save-ts">{savedLabel}</span>
          )}
        </div>
        <div className="rs-footer-right">
          <div className="rs-footer-total tabular">
            {currency(grandTotal, country)}
            {/* Monthly estimate intentionally hidden on contractor
                surfaces — that number is meaningful to the customer
                on the public quote, not to the contractor while
                building. */}
          </div>
          {itemCount === 0 ? (
            <button className="btn btn-primary btn-lg rs-send-btn" type="button" disabled>
              Add items to send
            </button>
          ) : selectedCustomer?.phone ? (
            <button className="btn btn-primary btn-lg rs-send-btn" type="button" disabled={sending || isLocked} onClick={onSend}>
              {sending ? 'Sending…' : `Text to ${selectedCustomer.name?.split(' ')[0] || 'customer'} →`}
            </button>
          ) : (
            <button className="btn btn-primary btn-lg rs-send-btn" type="button" disabled={sending || isLocked} onClick={onSend}>
              {sending ? 'Sending…' : 'Send Quote →'}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
