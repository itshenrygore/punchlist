import { useState, useMemo } from 'react';
import LineItemCard from './LineItemCard';
import CatalogSheet from './CatalogSheet';
import { currency } from '../../lib/format';
import { genLineItemId } from '../../lib/utils';

/* ─────────────────────────────────────────────────────────
   QuoteItemsEditor — the complete line-items editing UI.
   
   Replaces the inline JSX in quote-builder-page.jsx's
   review phase (the rq-builder-left area). Drop-in
   replacement that accepts the same data model.
   
   Props:
     lineItems, setLineItems, markDirty
     trade, province, country
     editingItemId, setEditingItemId
     priceRanges
     confidence
     catalogQuery, setCatalogQuery, catalogResults
     suggestions (visibleSuggestions)
     onAddSuggestion, onDismissSuggestion
     onOpenForeman(ctx)
     onRetryScopeAI
     scopeError
     quoteId
     grandTotal
     toast
   ───────────────────────────────────────────────────────── */

export default function QuoteItemsEditor({
  lineItems,
  setLineItems,
  markDirty,
  trade,
  province,
  country = 'CA',
  editingItemId,
  setEditingItemId,
  priceRanges = {},
  confidence,
  catalogQuery,
  setCatalogQuery,
  catalogResults,
  suggestions = [],
  onAddSuggestion,
  onDismissSuggestion,
  onOpenForeman,
  onRetryScopeAI,
  scopeError,
  quoteId,
  grandTotal,
  toast,
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);

  const itemCount = lineItems.filter(i => i.name?.trim()).length;

  // ── Item CRUD ──
  function updateItem(id, changes) {
    markDirty();
    setLineItems(p => p.map(i => i.id === id ? { ...i, ...changes } : i));
  }

  function removeItem(id) {
    const r = lineItems.find(i => i.id === id);
    markDirty();
    setLineItems(p => p.filter(i => i.id !== id));
    if (r?.name) toast?.(`Removed: ${r.name}`, 'info');
  }

  function duplicateItem(id) {
    const o = lineItems.find(i => i.id === id);
    if (!o) return;
    setLineItems(p => {
      const idx = p.findIndex(i => i.id === id);
      const n = [...p];
      n.splice(idx + 1, 0, { ...o, id: genLineItemId() });
      return n;
    });
    markDirty();
  }

  function adjustQty(id, delta) {
    setLineItems(p => p.map(i =>
      i.id === id
        ? { ...i, quantity: Math.max(0.25, Math.round(((i.quantity || 1) + delta * 0.25) * 100) / 100) }
        : i
    ));
    markDirty();
  }

  function addBlankItem() {
    setLineItems(p => [...p, {
      id: genLineItemId(),
      name: '',
      quantity: 1,
      unit_price: 0,
      notes: '',
      included: true,
      category: '',
    }]);
    markDirty();
  }

  function addCatalogItem(item) {
    if (lineItems.some(li => (li.name || '').toLowerCase() === item.name.toLowerCase())) return;
    const lo = item.lo || 0, hi = item.hi || 0;
    const price = hi > lo ? Math.round(lo + (hi - lo) * 0.55) : (item.mid || 0);
    setLineItems(p => [...p, {
      id: genLineItemId(),
      name: item.name,
      quantity: 1,
      unit_price: price,
      notes: '',
      category: item.category || '',
      included: true,
    }]);
    markDirty();
    toast?.(`Added: ${item.name}`, 'success');
  }

  // ── Foreman context builder ──
  function handleOpenForeman() {
    if (!onOpenForeman) return;
    const jobDesc = '';  // parent passes this via onOpenForeman
    onOpenForeman();
  }

  return (
    <div className="qe-root">
      {/* ── Items list ── */}
      <div className="qe-items-section">
        <div className="qe-items-header">
          <span className="qe-items-count">
            {itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : 'Line items'}
          </span>
        </div>

        {lineItems.length > 0 && (
          <div className="qe-items-list">
            {lineItems.map((item, idx) => (
              <LineItemCard
                key={item.id}
                item={item}
                index={idx}
                country={country}
                isEditing={editingItemId === item.id}
                priceRange={priceRanges[item.id]}
                onUpdate={updateItem}
                onRemove={removeItem}
                onDuplicate={duplicateItem}
                onAdjustQty={adjustQty}
                onFocus={setEditingItemId}
                onAddAfter={addBlankItem}
                isLast={idx === lineItems.length - 1}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {lineItems.length === 0 && !scopeError && (
          <div className="qe-empty">
            <div className="qe-empty-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div className="qe-empty-title">No items yet</div>
            <div className="qe-empty-desc">
              Search the catalog or add items manually to build your quote.
            </div>
          </div>
        )}

        {/* AI error state */}
        {lineItems.length === 0 && scopeError && (
          <div className="qe-empty qe-empty--error">
            <div className="qe-empty-title">AI couldn't generate items</div>
            <div className="qe-empty-desc">
              Try adding more detail to the description, or add items manually.
            </div>
            <div className="qe-empty-actions">
              {onRetryScopeAI && (
                <button type="button" className="qe-btn qe-btn--primary" onClick={onRetryScopeAI}>
                  Edit & retry
                </button>
              )}
              <button type="button" className="qe-btn qe-btn--secondary" onClick={addBlankItem}>
                + Add manually
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add item bar ── */}
      <div className="qe-add-bar">
        <button
          type="button"
          className="qe-add-btn qe-add-btn--primary"
          onClick={() => setCatalogOpen(true)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Catalog
        </button>
        <button
          type="button"
          className="qe-add-btn"
          onClick={addBlankItem}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Custom
        </button>
        <button
          type="button"
          className="qe-add-btn qe-add-btn--foreman"
          onClick={handleOpenForeman}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Foreman
        </button>
        {quoteId && scopeError && (
          <button type="button" className="qe-add-btn" onClick={onRetryScopeAI}>
            ✦ Retry AI
          </button>
        )}
      </div>

      {/* ── Confidence / commonly missed ── */}
      {lineItems.length > 0 && confidence && (
        confidence.readiness === 'ready' ? (
          <div className="qe-confidence qe-confidence--ready">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Ready to send
          </div>
        ) : (
          <ConfidencePanel confidence={confidence} />
        )
      )}

      {/* ── Foreman suggestions ── */}
      {suggestions.length > 0 && (
        <div className="qe-suggestions">
          <div className="qe-sug-header">
            <span className="qe-sug-title">Foreman suggests</span>
            <span className="qe-sug-count">{suggestions.length}</span>
          </div>
          <div className="qe-sug-list">
            {suggestions.map(sug => (
              <div key={sug.id} className="qe-sug-item">
                <div className="qe-sug-info">
                  <span className="qe-sug-name">{sug.name}</span>
                  <span className="qe-sug-meta">
                    {Number(sug.unit_price || 0) > 0 ? currency(sug.unit_price, country) : 'Set price'}
                    {sug.category ? ` · ${sug.category}` : ''}
                  </span>
                  {sug.why && <span className="qe-sug-why">{sug.why}</span>}
                </div>
                <div className="qe-sug-actions">
                  <button
                    type="button"
                    className="qe-sug-btn qe-sug-btn--add"
                    onClick={() => onAddSuggestion(sug)}
                  >Add</button>
                  <button
                    type="button"
                    className="qe-sug-btn"
                    onClick={() => onDismissSuggestion(sug.id)}
                  >Skip</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Catalog search sheet ── */}
      <CatalogSheet
        open={catalogOpen}
        onClose={() => { setCatalogOpen(false); setCatalogQuery(''); }}
        query={catalogQuery}
        onQueryChange={setCatalogQuery}
        results={catalogResults}
        lineItems={lineItems}
        trade={trade}
        onAddItem={addCatalogItem}
      />
    </div>
  );
}


/* ── Confidence panel sub-component ── */
function ConfidencePanel({ confidence }) {
  const [open, setOpen] = useState(false);
  const issues = (confidence.checks || []).filter(c => c.state !== 'good');

  return (
    <div className={`qe-confidence qe-confidence--${confidence.readiness}`}>
      <button type="button" className="qe-conf-toggle" onClick={() => setOpen(!open)}>
        <span className="qe-conf-score">{confidence.score}%</span>
        <span className="qe-conf-label">
          {confidence.readiness === 'review' ? 'Almost ready' : 'Commonly missed items'}
        </span>
        <span className={`qe-conf-chevron ${open ? 'qe-conf-chevron--open' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      {open && issues.length > 0 && (
        <div className="qe-conf-checks">
          {issues.map((c, i) => (
            <div key={i} className={`qe-conf-check qe-conf-check--${c.state}`}>
              <span className="qe-conf-dot" />
              {c.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
