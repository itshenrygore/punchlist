import { useState, useMemo, useRef, useEffect } from 'react';
import LineItemCard from './LineItemCard';
import CatalogSheet from './CatalogSheet';
import { currency } from '../../lib/format';
import { genLineItemId } from '../../lib/utils';

/* ─────────────────────────────────────────────────────────
   QuoteItemsEditor v2

   - Category grouping (Services / Labour / Materials)
   - Compact collapsed rows, tap-to-expand (one at a time)
   - Inline "+ Add item" row inside the list container
   - Tap outside expanded item to collapse
   ───────────────────────────────────────────────────────── */

const CATEGORY_ORDER = ['services', 'labour', 'materials', ''];
const CATEGORY_LABELS = { services: 'SERVICES', labour: 'LABOUR', materials: 'MATERIALS', '': '' };

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
  onAddAllSuggestions,
  onDismissSuggestion,
  onOpenForeman,
  onRetryScopeAI,
  scopeError,
  quoteId,
  grandTotal,
  toast,
  hideConfidence = false,
  frequentItems = [],
  labourRate = 0,
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const listRef = useRef(null);

  const itemCount = lineItems.filter(i => i.name?.trim()).length;

  // Close expanded item when tapping outside the list
  useEffect(() => {
    if (!editingItemId) return;
    const handler = (e) => {
      if (listRef.current && !listRef.current.contains(e.target)) {
        setEditingItemId(null);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [editingItemId, setEditingItemId]);

  // ── Item CRUD ──
  function updateItem(id, changes) {
    markDirty();
    setLineItems(p => p.map(i => i.id === id ? { ...i, ...changes } : i));
  }

  function removeItem(id) {
    const r = lineItems.find(i => i.id === id);
    markDirty();
    setLineItems(p => p.filter(i => i.id !== id));
    if (editingItemId === id) setEditingItemId(null);
    if (r?.name) toast?.(`Removed: ${r.name}`, 'info');
  }

  function duplicateItem(id) {
    const o = lineItems.find(i => i.id === id);
    if (!o) return;
    const newId = genLineItemId();
    setLineItems(p => {
      const idx = p.findIndex(i => i.id === id);
      const n = [...p];
      n.splice(idx + 1, 0, { ...o, id: newId });
      return n;
    });
    markDirty();
    setEditingItemId(newId);
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
    const newId = genLineItemId();
    setLineItems(p => [...p, {
      id: newId,
      name: '',
      quantity: 1,
      unit_price: 0,
      notes: '',
      included: true,
      category: '',
    }]);
    markDirty();
    setEditingItemId(newId);
    setAddMenuOpen(false);
  }

  function addCatalogItem(item) {
    if (lineItems.some(li => (li.name || '').toLowerCase() === item.name.toLowerCase())) return;
    const lo = item.lo || 0, hi = item.hi || 0;
    const cat = (item.category || '').toLowerCase();
    const isLabour = cat === 'labour' || cat === 'labor';
    const price = isLabour && labourRate > 0
      ? labourRate
      : hi > lo ? Math.round(lo + (hi - lo) * 0.55) : (item.mid || 0);
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

  function handleOpenForeman() {
    setAddMenuOpen(false);
    if (!onOpenForeman) return;
    onOpenForeman();
  }

  // ── Group items by category ──
  const groupedItems = useMemo(() => {
    const groups = {};
    lineItems.forEach((item, idx) => {
      const cat = (item.category || '').toLowerCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ item, idx });
    });
    const ordered = [];
    CATEGORY_ORDER.forEach(cat => {
      if (groups[cat]) ordered.push({ category: cat, label: CATEGORY_LABELS[cat], items: groups[cat] });
    });
    Object.keys(groups).forEach(cat => {
      if (!CATEGORY_ORDER.includes(cat)) {
        ordered.push({ category: cat, label: cat.toUpperCase(), items: groups[cat] });
      }
    });
    return ordered;
  }, [lineItems]);

  const hasCategories = groupedItems.some(g => g.label);

  // ── Render helper for items ──
  const renderItem = ({ item, idx }) => (
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
  );

  return (
    <div className="qe-root">
      <div className="qe-items-section" ref={listRef}>
        {/* Header */}
        <div className="qe-items-header">
          <span className="qe-items-count">
            {itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : 'Line items'}
          </span>
        </div>

        {/* Items list */}
        {lineItems.length > 0 && (
          <div className="qe-items-list">
            {hasCategories ? (
              groupedItems.map(group => (
                <div key={group.category} className="qe-cat-group">
                  {group.label && (
                    <div className="qe-cat-label">
                      {group.label}
                      {group.category === 'labour' && labourRate > 0 && (
                        <span className="qe-labour-rate-badge">{currency(labourRate, country)}/hr</span>
                      )}
                    </div>
                  )}
                  {group.items.map(renderItem)}
                </div>
              ))
            ) : (
              lineItems.map((item, idx) => renderItem({ item, idx }))
            )}

            {/* Inline add row — lives inside the list container */}
            <div className="qe-add-row">
              <button
                type="button"
                className="qe-add-row-btn"
                onClick={() => setAddMenuOpen(!addMenuOpen)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add item
              </button>
            </div>

            {/* Add menu popover */}
            {addMenuOpen && (
              <div className="qe-add-menu">
                <button type="button" className="qe-add-menu-item" onClick={() => { setCatalogOpen(true); setAddMenuOpen(false); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  From catalog
                </button>
                <button type="button" className="qe-add-menu-item" onClick={addBlankItem}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Custom item
                </button>
                <button type="button" className="qe-add-menu-item" onClick={handleOpenForeman}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Ask Foreman
                </button>
                {frequentItems.length > 0 && (
                  <>
                    <div className="qe-add-menu-divider" />
                    <div className="qe-add-menu-label">Frequent items</div>
                    {frequentItems.slice(0, 5).map(fi => {
                      const fiCat = (fi.category || '').toLowerCase();
                      const fiIsLabour = fiCat === 'labour' || fiCat === 'labor';
                      const fiPrice = fiIsLabour && labourRate > 0 ? labourRate : Number(fi.unit_price || 0);
                      return (<button key={fi.name} type="button" className="qe-add-menu-item" onClick={() => {
                        setLineItems(p => [...p, { id: genLineItemId(), name: fi.name, quantity: 1, unit_price: fiPrice, notes: '', category: fi.category || '', included: true }]);
                        markDirty();
                        setAddMenuOpen(false);
                      }}>
                        <span style={{ flex: 1 }}>{fi.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>${fiPrice.toFixed(0)}</span>
                      </button>);
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state — suppressed when there are suggestions to accept,
            since the user's obvious next action is the panel below, not
            "Browse catalog". */}
        {lineItems.length === 0 && !scopeError && suggestions.length === 0 && (
          <div className="qe-empty">
            <div className="qe-empty-title">No items yet</div>
            <div className="qe-empty-desc">Add items from the catalog or create custom line items.</div>
            <div className="qe-empty-actions">
              <button type="button" className="qe-btn qe-btn--primary" onClick={() => setCatalogOpen(true)}>
                Browse catalog
              </button>
              <button type="button" className="qe-btn qe-btn--secondary" onClick={addBlankItem}>
                + Custom item
              </button>
            </div>
          </div>
        )}

        {/* Error fallback — catalog returned nothing either. Rare. */}
        {lineItems.length === 0 && scopeError && (
          <div className="qe-empty qe-empty--error">
            <div className="qe-empty-title">No suggestions yet</div>
            <div className="qe-empty-desc">Add more detail to your job description, or build the scope manually from the catalog.</div>
            <div className="qe-empty-actions">
              {onRetryScopeAI && (
                <button type="button" className="qe-btn qe-btn--primary" onClick={onRetryScopeAI}>Edit description</button>
              )}
              <button type="button" className="qe-btn qe-btn--secondary" onClick={() => setCatalogOpen(true)}>Browse catalog</button>
              <button type="button" className="qe-btn qe-btn--secondary" onClick={addBlankItem}>+ Add manually</button>
            </div>
          </div>
        )}
      </div>

      {/* Confidence / commonly missed — hidden when parent renders its own */}
      {!hideConfidence && lineItems.length > 0 && confidence && (
        confidence.readiness === 'ready' ? (
          <div className="qe-confidence qe-confidence--ready">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Ready to send
          </div>
        ) : (
          <ConfidencePanel confidence={confidence} onFixIssue={(issue) => {
            if (/no customer/i.test(issue.label || '')) {
              const el = document.querySelector('.rq-customer-section input, .jd-input[placeholder*="Search or add customer"], [placeholder*="Search or add customer"]');
              if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            } else if (/cleanup|haul|disposal/i.test(issue.label || '')) {
              const newId = genLineItemId();
              setLineItems(p => [...p, { id: newId, name: 'Site cleanup & debris removal', quantity: 1, unit_price: 0, notes: '', included: true, category: 'services' }]);
              markDirty();
              setEditingItemId(newId);
              toast?.('Added cleanup item — set your price', 'success');
            } else if (/permit/i.test(issue.label || '')) {
              const newId = genLineItemId();
              setLineItems(p => [...p, { id: newId, name: 'Permit & inspection fees', quantity: 1, unit_price: 0, notes: '', included: true, category: 'services' }]);
              markDirty();
              setEditingItemId(newId);
              toast?.('Added permit item — set your price', 'success');
            }
          }} />
        )
      )}

      {/* Suggested items — contractor accepts each (or all) before they
          land in the scope. Nothing gets added without their sign-off. */}
      {suggestions.length > 0 && (
        <div className="qe-suggestions">
          <div className="qe-sug-header">
            <div className="qe-sug-header-text">
              <span className="qe-sug-title">Suggested for this job</span>
              <span className="qe-sug-subtitle">Catalog matches based on your description. Review and add the ones you want — you're in control.</span>
            </div>
            <button
              type="button"
              className="qe-sug-add-all"
              onClick={() => onAddAllSuggestions ? onAddAllSuggestions(suggestions) : suggestions.forEach(sug => onAddSuggestion(sug))}
            >
              Add all ({suggestions.length})
            </button>
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
                  <button type="button" className="qe-sug-btn qe-sug-btn--add" onClick={() => onAddSuggestion(sug)}>+ Add</button>
                  <button type="button" className="qe-sug-btn" onClick={() => onDismissSuggestion(sug.id)}>Skip</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog sheet */}
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
function ConfidencePanel({ confidence, onFixIssue }) {
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
            <div key={i} className={`qe-conf-check qe-conf-check--${c.state}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="qe-conf-dot" />
                {c.label}
              </div>
              {onFixIssue && c.label && /cleanup|haul|disposal|permit|no customer/i.test(c.label) && (
                <button type="button" className="qe-conf-fix-btn" onClick={(e) => { e.stopPropagation(); onFixIssue(c); }}>
                  {/no customer/i.test(c.label) ? 'Add' : '+ Add'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
