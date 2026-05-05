# Quote Editor — Integration Guide

## What changed

The inline JSX for line items, catalog search, add-item bar, confidence panel, and Foreman suggestions has been extracted into self-contained components in `src/components/quote-editor/`.

### New files

```
src/components/quote-editor/
├── index.js                 # Exports + CSS import
├── QuoteItemsEditor.jsx     # Main composition component
├── LineItemCard.jsx          # Individual line item card
├── CatalogSheet.jsx          # iOS-style bottom sheet for catalog search
└── quote-editor.css          # All styles — self-contained, no !important
```

### What the new components replace

In `pages/quote-builder-page.jsx`, the review phase contains ~250 lines of inline JSX for:
- The `rq-items-section` (line items list)
- The `rq-add-bar` (Search catalog / + Custom item / Ask Foreman buttons)
- The `rq-catalog-overlay` (catalog search modal)
- The `rq-confidence` panel (commonly missed items)
- The `pl-sug-panel` (Foreman suggestions)

All of this is replaced by a single `<QuoteItemsEditor />` component.

---

## Integration steps

### 1. Import the component

At the top of `pages/quote-builder-page.jsx`, add:

```jsx
import { QuoteItemsEditor } from '../components/quote-editor';
```

### 2. Replace the inline JSX

Find the section in the `phase === 'review'` block that starts with:

```jsx
{/* Line Items */}
<div className="rq-builder-layout">
  <div className="rq-builder-left">
```

Replace everything inside `rq-builder-left` (lines ~1264–1349) with:

```jsx
<div className="rq-builder-left">
  <QuoteItemsEditor
    lineItems={lineItems}
    setLineItems={setLineItems}
    markDirty={markDirty}
    trade={trade}
    province={province}
    country={country}
    editingItemId={editingItemId}
    setEditingItemId={setEditingItemId}
    priceRanges={priceRanges}
    confidence={confidence}
    catalogQuery={catalogQuery}
    setCatalogQuery={setCatalogQuery}
    catalogResults={catalogResults}
    suggestions={visibleSuggestions}
    onAddSuggestion={addSuggestionToItems}
    onDismissSuggestion={dismissSuggestion}
    onOpenForeman={() => {
      if (window.__punchlistOpenForeman) {
        const jobDesc = description || title || '';
        window.__punchlistOpenForeman({
          starters: [
            `What else should I include for this ${trade.toLowerCase()} job?`,
            jobDesc
              ? `Review my scope: "${jobDesc.slice(0, 80)}${jobDesc.length > 80 ? '…' : ''}"`
              : 'Help me scope this quote',
            `What do ${trade.toLowerCase()}s commonly forget to quote?`,
          ],
          quoteContext: {
            description: jobDesc,
            trade,
            title: title || '',
            items: lineItems.filter(i => i.name?.trim()).map(i => ({
              name: i.name,
              qty: i.quantity,
              price: i.unit_price,
            })),
            total: grandTotal,
            province,
            country,
          },
        });
      }
    }}
    onRetryScopeAI={() => {
      setScopeError(false);
      setPhase('describe');
    }}
    scopeError={scopeError}
    quoteId={quoteId}
    grandTotal={grandTotal}
    toast={toast}
  />
</div>
```

### 3. Remove the standalone confidence panel

Also remove the confidence panel that appears *outside* the sidebar (around line 1405):

```jsx
{/* DELETE THIS: */}
{lineItems.length > 0 && confidence && (confidence.readiness === 'ready' ? ...)}
```

It's now rendered inside `QuoteItemsEditor`.

### 4. Remove the `addMode === 'catalog'` scroll lock

The catalog is now a proper bottom sheet that handles its own scroll locking. Remove:

```jsx
useScrollLock(addMode === 'catalog');
```

And you can remove the `addMode` state entirely since it's now internal to `QuoteItemsEditor`.

### 5. Clean up unused functions

These functions are now handled inside `QuoteItemsEditor` and can be removed from `quote-builder-page.jsx`:

- `updateItem` (line 551)
- `removeItem` (line 552–568)
- `duplicateItem` (line 569)
- `adjustQty` (line 570)
- `addCatalogItem` (line 620–626)

Keep `addSuggestionToItems` and `dismissSuggestion` — they're passed as callbacks.

### 6. Keep the catalog search effect

The `useEffect` that populates `catalogResults` based on `catalogQuery` (lines 609-618) still lives in the parent. The new component just passes `catalogQuery` up via `setCatalogQuery` and receives `catalogResults` down.

---

## What's different

### Mobile (375px) — no more overflow
- Item name is on its own full-width line
- Qty stepper, price input, and line total are on a second row
- No duplicate/delete buttons visible by default — **swipe left to reveal**
- All elements are constrained with `min-width: 0` and `flex-shrink`

### Catalog search — proper bottom sheet
- Slides up from bottom with drag handle
- `Done` button to dismiss (iOS convention)
- Drag-to-dismiss support
- Full-screen on mobile, centered 480px on desktop
- Search auto-focuses
- Body scroll locked while open

### Confidence panel — integrated
- Sits between the add bar and suggestions
- Expandable with chevron animation
- Color-coded by readiness state

### No CSS conflicts
- All classes prefixed with `qe-` (quote-editor)
- Zero `!important` declarations
- Uses existing CSS custom properties from `tokens.css`
- Self-contained in one file: `quote-editor.css`

### Font-size: iOS zoom prevention
- All inputs use `font-size: max(16px, ...)` to prevent Safari auto-zoom
- This was inconsistently applied in the old code

---

## What's NOT changed

- The data model (`lineItems` array shape) is identical
- The `rq-builder-right` sidebar (totals, financing, tracking) is untouched
- The header card (title + customer picker) is untouched
- The scope/terms/notes `<details>` section is untouched
- The sticky footer is untouched
- All business logic (save, send, AI scope, etc.) stays in the parent
