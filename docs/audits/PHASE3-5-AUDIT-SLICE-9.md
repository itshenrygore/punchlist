# Phase 3.5 Slice 9 — Audit

**Slice:** B11 Coachmarks + B12 Keyboard Shortcuts
**Status:** Shipped with one minor deviation noted below. No deferred risks.

---

## Deviations from plan

### D1 — Coachmark spotlight uses box-shadow, not SVG clip-path

**Plan implied:** A semi-transparent backdrop with a "cut-out" over the target element.

**Shipped:** The spotlight is implemented as a `position: absolute` `<div>` sized to the target's bounding rect with `box-shadow: 0 0 0 9999px rgba(0,0,0,0.45)`. The backdrop `<div>` behind it (`position: fixed; inset: 0`) captures clicks to dismiss. This achieves the visual identical to a clip-path approach with less complexity and better cross-browser support.

**Impact:** None — visually equivalent. Scroll events and resize events re-measure the bounding rect so the spotlight tracks the element correctly.

### D2 — `⌘K` targets first matching input, not a named ref

**Plan stated:** "Focus the customer search input."

**Shipped:** Uses `document.querySelector('.rq-customer-section input, .jd-input[placeholder*="Search or add customer"]')` rather than passing a ref prop. This is safe because: (a) the customer section is only rendered in the review phase when the shortcut is live, and (b) the selector is stable — the class and placeholder text are not generated dynamically.

**Impact:** None. A named ref would add prop-drilling across the component; the selector approach is simpler and equally reliable given the stable DOM structure.

---

## Files NOT touched (regression guard)

| File | Status |
|---|---|
| `api/stripe-webhook.js` | Unchanged — diff clean |
| `api/public-quote-action.js` | Unchanged — diff clean |
| All prior slice files (1–8) | Not opened |
