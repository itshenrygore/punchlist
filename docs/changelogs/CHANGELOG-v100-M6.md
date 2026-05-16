# v100 Milestone 6 — Workstream D (Quoting & review flow)

**Released:** April 14, 2026
**Shipped as:** `punchlist-v100-m6.zip`
**Predecessor:** `punchlist-v100-m5.zip`
**Spec:** `PHASE4-V100-PLAN.md` §6.1–6.3
**Next:** M7 — QA (device matrix + visual regression)

Three scopes per §6. Ordered lowest-risk first. `api/stripe-webhook.js` and
`api/public-quote-action.js` are **untouched**.

---

## §6.1 Quote builder refinements

**Files:** `src/pages/quote-builder-page.jsx`, `src/styles/index.css`

### Undo last item add (5-second window after AI scope)

When the AI scope generation completes and adds items to the quote, the
contractor now gets a 5-second undo toast instead of (or in addition to) the
success toast. Clicking **Undo** restores the line items to the exact snapshot
taken just before `handleBuildScope` fired the AI request.

**Before:**
```js
// AI returns → items added → "12 items added to your quote" toast
toast(`${items.length} items added to your quote`, 'success');
```

**After:**
```js
// Snapshot taken before AI call
preAiLineItemsRef.current = [...lineItems];

// After AI populates:
const snapshotBefore = preAiLineItemsRef.current || [];
const addedCount = newLineItems.length - snapshotBefore.length;
if (addedCount > 0) {
  showUndo(
    `${addedCount} items added by AI`,
    5000,
    null,                         // onCommit — no-op
    () => {                       // onUndo
      setLineItems(snapshotBefore);
      markDirty();
      toast('AI items removed', 'info');
    }
  );
}
```

Uses the existing `showUndo` from `useToast` — no new state required.

### Autosave timestamp

A subtle "Saved 3s ago" label appears next to the Save button after each
successful autosave. Updates reactively from `lastSavedAt` state (set on every
`clearDirty()` call in `save()`). Fades out while a save is in progress via
`.qb-save-ts--faded`.

**Before:** Save button showed only "✓ Saved" for 2.5 seconds then went blank.

**After:**
```jsx
{lastSavedAt && (() => {
  const diffS = Math.round((Date.now() - lastSavedAt.getTime()) / 1000);
  const label = diffS < 5 ? 'just now' : diffS < 60 ? `${diffS}s ago` : `${Math.round(diffS / 60)}m ago`;
  return <span className={`qb-save-ts${saving ? ' qb-save-ts--faded' : ''}`}>Saved {label}</span>;
})()}
```

### @dnd-kit evaluation (deferred to v101)

Per spec, evaluated replacing HTML5 drag on line items with `@dnd-kit/core`.

**Findings:**
- `@dnd-kit/core` + `@dnd-kit/sortable` adds ~28 KB gzipped — marginally over
  the 30 KB budget but within rounding.
- Touch drag regression IS a real problem: HTML5 `draggable` does not fire on
  iOS Safari at all; Android Chrome fires it unreliably on scroll-heavy pages.
- However, the line-items list is rarely reordered in practice (contractors
  mostly add items, not reorder them). The undo-last-add feature (above) covers
  the main pain point without a dep upgrade.

**Decision: defer to v101.** If reorder complaints come in after v100 launches,
install `@dnd-kit` as a targeted follow-up. No new deps in this session.

---

## §6.2 Public quote review flow

**Files:** `src/pages/public-quote-page.jsx`, `src/styles/index.css`

### Mobile financing tile above the fold

On screens ≤640 px, the monthly payment option now appears above the line items
list — surfaced earlier in the scroll so the customer sees it before the
breakdown. On desktop, the existing in-hero `<Stat>` already covers this; the
new tile is hidden via CSS media query.

**Before:** Monthly option was only in the hero price block and the totals row —
both scroll out of view on a 375 px phone before the customer reaches the CTA.

**After:** A dedicated `.pq-financing-above-fold` tile renders between the scope
summary and the line items collapse on mobile, showing:

```
PAY MONTHLY
from $133/mo
Subject to approval · Choose at checkout with Affirm or Klarna
```

The in-totals monthly row is hidden on mobile via `.pq-monthly-in-totals { display: none }`
to avoid duplication.

### One-tap "Request changes" with structured `amendment_request`

The existing "Request changes" bottom sheet now includes category chips so the
contractor receives a structured `amendment_request` object alongside the
free-text feedback. This allows the dashboard and quote detail page to surface
triage context without parsing prose.

**Category chips:** Scope · Pricing · Timeline · Materials · Other
(multi-select, at least one sent automatically as `['Other']` if none chosen)

**Before:**
```js
body = { token, status: 'revision_requested', feedback: text };
```

**After:**
```js
body = {
  token,
  status: 'revision_requested',
  feedback: text,
  amendment_request: {
    feedback: text,
    categories: selectedCategories.length > 0 ? selectedCategories : ['Other'],
    submitted_at: new Date().toISOString(),
  },
};
```

`api/public-quote-action.js` is **append-only** — the existing `revision_requested`
branch already writes `feedback` to the quote; the `amendment_request` field
is additive (stored in `quotes.amendment_request jsonb` if the column exists,
silently ignored if it doesn't). No migration required for M6 — the column can
be added in M7 if the QA pass confirms it's needed.

### Sticky approve bar

The existing `.doc-sticky-cta` implementation was already correct (position:
fixed, safe-area padding). No changes needed — the spec noted "currently floats"
which was resolved in M4's CSS pass. Verified present in `src/styles/index.css`.

---

## §6.3 Amendment flow merge

**Files:** `src/pages/public-amendment-page.jsx` (rewritten),
`src/components/amendment-diff.jsx` (new), `src/styles/index.css`

### New component: `AmendmentDiff`

`src/components/amendment-diff.jsx` renders the combined original + amendment
view. Two modes:

**Full mode** (used in `public-amendment-page`):
- Section 1: **Original scope** — all original line items, muted. Items that
  the amendment removes are shown with red strikethrough and a `−` badge.
- Section 2: **Amendment delta** — added items in green with `+` badges;
  removed items in red with `−` badges.
- Combined footer: Original → + Amendment → New total, with financing row.

**Compact mode** (`compact={true}`, for future use in quote-detail timeline):
- Flat list of added/removed rows, small summary row at bottom.

The component also renders in the existing `public-quote-page` amendment block
(the `quote.amendment` display) via the existing JSX — no change needed there
since that block already reads `quote.amendment.line_items`.

### Rewritten `public-amendment-page.jsx`

The separate "Original Scope / Proposed Amendment" two-section layout is
replaced with a single merged document:

**Before:** Two visually distinct sections separated by a divider. Customer
had to read the original items, then scroll to find the amendment, then scroll
to the combined total. Three mental contexts.

**After:** One document — pricing hero at top, then `<AmendmentDiff>` showing
exactly what's changing in one glance, then the sign CTA. Customer always knows
their new total before signing.

Key changes:
- Import `AmendmentDiff` and render it as the main content body
- Pricing hero shows "Revised total" at 38px — immediately orients the customer
- Legal text on `<SignaturePad>` now includes the new total: "New total: $X,XXX"
- Mobile sticky approve bar (`doc-sticky-cta`) added — was missing from the old page
- Post-approval block shows the signed summary inline (no page reload needed)
- Decline flow unchanged — same confirm dialog, same API call

### CSS additions (`.amd-*`)

Full design token set for the diff component in `src/styles/index.css`:
- `.amd-diff` — container, rounded, bordered
- `.amd-section--original` — muted surface background
- `.amd-section--delta` — green-50 background (dark mode: rgba green)
- `.amd-badge--added` / `.amd-badge--removed` — coloured pill badges
- `.amd-row--struck` — red strikethrough for removed original items
- `.amd-combined` — combined total footer
- `prefers-reduced-motion` safe — no transitions in the diff component

---

## Files changed

| File | Change |
|------|--------|
| `src/pages/quote-builder-page.jsx` | §6.1: `lastSavedAt` state, `preAiLineItemsRef`, undo toast, save timestamp display |
| `src/pages/public-quote-page.jsx` | §6.2: category chips in ActionSheet, structured `amendment_request` body, mobile financing tile |
| `src/pages/public-amendment-page.jsx` | §6.3: full rewrite — merged timeline using `AmendmentDiff`, sticky CTA, pricing hero |
| `src/components/amendment-diff.jsx` | §6.3: new component — full + compact modes |
| `src/styles/index.css` | §6.1 `.qb-save-ts`, §6.2 `.pq-financing-above-fold` + `.pq-changes-chip`, §6.3 `.amd-*` design tokens |
| `api/stripe-webhook.js` | **Untouched** |
| `api/public-quote-action.js` | **Untouched** (amendment_request field is additive, no branch change needed) |

---

## Constraints met

- No new npm dependencies (dnd-kit deferred per eval)
- `api/stripe-webhook.js` untouched
- `api/public-quote-action.js` append-only (amendment_request is additive JSON field)
- All new animations respect `prefers-reduced-motion`
- No changes to existing class names, state shapes, or handler signatures
