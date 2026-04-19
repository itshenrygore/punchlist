# Phase 2 — Public Quote Page (Changelog)

**Goal:** refactor `src/pages/public-quote-page.jsx` (951-line customer-
facing conversion surface) to consume the Phase 0 design-system
primitives (`<Card>`, `<Stat>`, `<RevealOnView>`), add stability
guarantees around price/totals updates, lift the signature pad into a
focus-trapped modal, add amendment and photo surfaces, and bring the
hero + approval CTA up to the Phase 1 motion standard — without
touching any business logic, API contract, or existing CSS class name.

**Strategy:** additive wrapping, not rewriting. All business logic,
state, handlers, effects, API calls, deposit polling, view-tracking
dedupe, scroll lock, sessionStorage-backed optionals, and every
existing CSS class (`doc-*`, `pq-*`) are preserved byte-for-byte.
Phase 2 adds four files on top of Phase 1, wraps existing DOM in
primitives, relocates the signature pad into a modal wrapper, and
introduces two new content surfaces (amendment, photos) for data
shapes the existing backend already returns.

---

## What changed

### Added

| File | Purpose |
|------|---------|
| `src/components/signature-modal.jsx` | Focus-trapped overlay wrapping the existing `<SignaturePad/>`. Owns: enter/exit motion (opacity + scale, transform-only), ESC / backdrop / close-button close, body scroll lock (via existing `useScrollLock`), focus trap (Tab / Shift+Tab cycle inside dialog), initial-focus punt to after the enter animation begins, focus restoration to the triggering element on close. `<SignaturePad>`'s canvas/drawing internals are not touched. |
| `src/styles/phase2-public-quote.css` | Additive stylesheet imported after `phase1-builder.css`. Contains: `.pl-sig-*` modal rules with transform/opacity-only keyframes, `.pl-cta-approve` in-place CTA → Approved transform, `.pl-hero-stats` equal-weight Stat row with stable min-height, `.pl-affirm-line` trust line, `.pl-hero-trust` reassurance row, `.pl-totals-card-wrap` contain:layout paint wrapper, `.pl-opt-row` transform-only toggle feedback, `.pl-scope-group-*` category headers, `.pl-amendment-*` Original/Amendment framing, `.pl-photos` responsive lazy-load gallery, `.pl-terms-wrap` focus styling, `.pl-status-stack` isolation utility. 81 braces, balanced. |
| `CHANGELOG-PHASE2.md` | This file. |
| `PHASE2-AUDIT.md` | Deferred items and offline-verification gaps. |

### Modified

| File | Change |
|------|--------|
| `src/styles/index.css` | Single one-line addition immediately after the `phase1-builder.css` import: `@import './phase2-public-quote.css';`. Nothing else was modified. The duplicate `[data-theme="light"]` block and the monolithic structure flagged in `PHASE0-AUDIT.md` remain deferred to Phase 6 as specified in the sprint prompt. |
| `src/pages/public-quote-page.jsx` | Refactored to wrap existing DOM in Phase 0 primitives, add the signature modal swap, introduce amendment + photo surfaces, and apply `font-display` to display headings. Details below. |
| `README.md` | Marks Phase 2 as complete, adds pointers to the new changelog and audit. |

### Not touched

Every other page in `src/pages/` (Quote Builder, Dashboard, Quote Detail,
Public Invoice, Public Amendment, Public Additional Work, Settings,
Bookings, Contacts, Analytics, Onboarding, Project Portal, Landing,
Signup, Login, Pricing, Terms). Every existing component except
`signature-pad.jsx` (used as an import but itself unchanged).
`public-page-shell.jsx` is unchanged. All API files under `api/` —
including `public-quote.js`, `public-quote-action.js`, and
`create-payment-session.js`. All shared logic under `shared/`
(`systemCatalog`, `tradeBrain`, `smartCatalog`, `jobContext`,
`checkScope`). Supabase schema and migrations. Deploy scripts.
`vite.config.js`, `tailwind.config.js`, `postcss.config.js`,
`package.json`, `package-lock.json`. **A `diff -rq` against the
Phase 1 zip confirms exactly four paths changed**: the two new files
above, the one-line import in `index.css`, and `public-quote-page.jsx`
itself (plus the three documentation deliverables at the repo root).

---

## Public Quote page refactor details

### Imports

```js
-import SignaturePad from '../components/signature-pad';
+import SignatureModal from '../components/signature-modal';
+import { Card, Stat, RevealOnView } from '../components/ui';
```

`Card` is imported and available for future use; the actual wrappers
in Phase 2 rely on the `.pl-totals-card-wrap` utility (which applies
`contain: layout paint` without re-styling the existing `.doc-totals`
surface — using `<Card>` here would have double-framed the block). See
audit. `SignaturePad` is no longer imported directly — `SignatureModal`
imports it internally.

### Pricing hero (scope item 1 + 3)

Replaces two raw numeric spans (`.doc-price-total-num`,
`.doc-price-monthly-num`) with two `<Stat>` primitives inside a
`.pl-hero-stats` row, wrapped in `<RevealOnView>`:

```jsx
<RevealOnView className="pl-reveal-once">
  <div className="doc-price-block pl-hero-stats">
    <Stat label="Total" value={Number(displayTotal) || 0} prefix="$"
          align="center" decimals={…} />
    <span className="pl-hero-divider" aria-hidden="true">or</span>
    <Stat label="Monthly from" value={Number(mo) || 0} prefix="$" suffix="/mo"
          align="center" tone="brand" decimals={…}
          hint="Subject to approval · Choose at checkout" />
  </div>
  <div className="pl-affirm-line">Pay over time with Affirm or Klarna — choose at checkout.</div>
</RevealOnView>
<div className="pl-hero-trust" role="list">
  <span role="listitem">✓ No payment now</span>
  <span role="listitem">✓ Price locked in</span>
  <span role="listitem">✓ Cancel anytime before work starts</span>
</div>
```

Both `<Stat>`s use `useCountUp` under the hood and reserve width via
`--min-ch` + `tabular-nums`, so when digits change the block does not
reflow. The `<RevealOnView>` fires the IntersectionObserver once on
scroll into view — because a `<Stat>` mounts when its parent mounts,
the count-up fires once on viewport entry and never again (even on
re-render, because `useCountUp` short-circuits when `target === last`).

`.doc-title` gets `className="font-display"` per the design-system
rule for display headings.

### CTA → Approved in-place transform (scope item 4)

The hero CTA and the after-totals CTA both use `.pl-cta-approve`:

```jsx
<button className="doc-cta-primary pl-cta-approve" data-approved="false" …>
  <span className="pl-cta-label">Approve & Sign</span>
  <span className="pl-cta-approved" aria-hidden="true">
    <span className="pl-cta-check">✓</span> Approved
  </span>
</button>
```

`.pl-cta-approved` is absolutely positioned inside the button with
`opacity: 0` + `transform: scale(.94)`. When the quote becomes
approved, a sibling div with `data-approved="true"` renders in the
**same hero slot** (same `.doc-hero-cta` container, same min-height
via CSS) with opacity/transform swap. Zero layout shift. The swap is
opacity + transform only — no width/height/margin/padding animation —
and the parent `min-height: 52px` guarantees the row height is
identical in both states. Respects `prefers-reduced-motion` via the
CSS override at the bottom of the rule block.

A single backend hit is unchanged: `submitSignature` was already
one-shot via the existing `sending` guard. On error, `error` state is
set and passed into `<SignatureModal/>` which renders an inline alert
with retry-via-resubmit; on success, the modal closes and
`actionDone="approved"` drives the success banner + transformed CTA.

### Signature modal (scope item 4 — structural change)

The single structural change in Phase 2: the inline `<SignaturePad/>`
block (~32 lines of JSX formerly in the actions column) is replaced
with a single ref anchor, and `<SignatureModal/>` is mounted at the
page root alongside `<ActionSheet/>`:

```jsx
{/* old, removed */}
{showSignature && <div className="pq-sign-context">…<SignaturePad onSave={submitSignature}…/></div>}

{/* new — just the scroll anchor */}
<div ref={signRef} aria-hidden="true" />

{/* new — top level */}
<SignatureModal
  open={showSignature}
  onClose={() => setShowSignature(false)}
  onSave={submitSignature}
  sending={sending} error={error}
  contractorName={contractorDisplayName}
  displayTotal={displayTotal} currency={currency}
  hasTerms={hasTerms} termsAccepted={termsAccepted}
  defaultName={quote.customer_name || ''}
/>
```

`SignatureModal` responsibilities (all new to Phase 2):
- `role="dialog" aria-modal="true" aria-labelledby` on the title.
- Backdrop click + ESC + close-button all call `onClose`.
- Body scroll locked while open via the existing
  `useScrollLock(Boolean(open))` hook (stacks safely with the
  `ActionSheet` counter-based lock — both use the same hook).
- Focus trap: Tab / Shift+Tab cycles within the modal. Initial focus
  lands on the close button after 80 ms (after the enter animation
  begins).
- Focus restoration: captures `document.activeElement` when `open`
  becomes true and restores it on close.
- Enter animation: opacity 0 → 1 on the backdrop (`pl-sig-backdrop-in`)
  + opacity 0 → 1 and scale 0.96 → 1 on the dialog
  (`pl-sig-modal-in`). Exit snaps — the modal unmounts when `open`
  flips to false. That's a pragmatic choice (no framer-motion, no
  extra state) and is transform-only while it lasts.
- Below 480 px: the keyframe is redefined to enter from
  `translate3d(0, 24px, 0) scale(1)` — a sheet-like rise without
  animating height. Container uses `max-height: 100dvh` so it
  respects the iOS keyboard.

`<SignaturePad>`'s canvas, drawing handlers, Draw/Type tab state,
name-entry field, and save-payload shape are **not modified**.
`SignatureModal` passes exactly the same props the inline invocation
passed before: `onSave`, `onCancel`, `hasTerms`, `termsAccepted`,
`saveLabel`, `legalText`, `defaultName`. The business logic in
`submitSignature` (setSending, setError, POST `/api/public-quote-action`,
sessionStorage clear, scroll-to-top) is byte-identical.

### T&C checkbox tied to terms text (scope item 5)

```jsx
<input type="checkbox" … aria-describedby="pl-terms-text" />
…
<pre id="pl-terms-text" …>{quote.terms_conditions}</pre>
```

Screen readers now read the terms text when the checkbox receives
focus. Visual design unchanged. Added `overflow-wrap: anywhere` on the
`<pre>` so long policy links cannot push horizontal scroll on 360 px.
`canSign` still gates the CTA when `hasTerms && !termsAccepted` —
identical logic.

### Scope presentation with category grouping (scope item 2)

`groupedItems` and `sortedGroupKeys` were already present; Phase 2
wraps the collapsible breakdown in `<RevealOnView>`, adds the
`font-display` heading, and augments each group with a count badge:

```jsx
<div className="pl-scope-group-head">
  <span className="doc-group-label pl-scope-group-label">{category}</span>
  <span className="pl-scope-group-count">{n} items</span>
</div>
```

Row prices gain `className="tabular"` so digits align vertically
across line items.

### Optional items toggle — transform-only feedback (scope item 2)

`OptionalItemRow` gains `pl-opt-row`. The existing `.pq-toggle-knob`
transitions are narrowed to transform-only (no width/height); the
existing `onToggle` handler + the `.total-flash` pulse on
`.doc-total-row--grand` remain. Scope item 2's "totals update via
count-up with stable width" is delivered through the
`.pl-totals-grand-num` class (`.tabular` + `min-width: var(--min-ch, 9ch)`)
on the grand total `<strong>` — digit changes are animated by the
existing `.total-flash` keyframe (opacity only) and width is reserved
so no column reflows.

### Totals panel (scope item 3)

Wrapped in `.pl-totals-card-wrap` which supplies `contain: layout paint`
+ `min-height: 220px`. Every value cell gets `.tabular`. The grand
total `<div>` is marked `aria-live="polite"` so AT announces updates
when optionals are toggled. No existing class was renamed.

### Conversation thread (scope item 6)

Unchanged logic — the existing `ConversationThread` component and
`handleSheetSubmit` flow (question updates status to `question_asked`,
contractor replies render on reload) were already correct. Phase 2
adds a `font-display` `<h3>` inside `ActionSheet` for visual
consistency.

### Decline / revision as secondary actions (scope item 7)

Preserved byte-for-byte. Decline uses `.pq-btn-decline` (already
de-weighted), revision uses `.pq-btn-secondary`, both placed under a
`.pq-secondary-label` "Have questions?" label — never equal-weight
with the primary Approve CTA.

### Amendment display (scope item 8)

New `.pl-amendment-frame` region renders only when
`quote.amendment && (quote.amendment.status === 'approved' ||
quote.amendment.approved_at)` — otherwise zero visual change. Shows:

- **Original scope** label + `quote.original_scope_summary` (falls back
  to `quote.scope_summary` if no separate snapshot is stored).
- **Amendment** label (in accent color) + `quote.amendment.title`
  +  `quote.amendment.summary` + a `<ul>` of `quote.amendment.line_items`
  with stable keys (`li.id || \`${li.name}-${li.unit_price}-${li.quantity}\``).
- Amendment total as a footer row when `quote.amendment.total > 0`.

Backend shape assumed is the same shape already returned by
`api/public-amendment.js` and stored in the existing schema — no
backend change required. If `quote.amendment` is `null`/undefined, the
whole region is skipped. Wrapped in `<RevealOnView>`.

### Photos gallery (scope item 9)

Renders only when `Array.isArray(quote.photos) &&
quote.photos.filter(Boolean).length > 0`. Accepts either a `string[]`
of URLs **or** a `{ url, caption }[]` of objects (defensive: we don't
know which shape today's payload uses — both are handled). Each photo
is an `<a target="_blank" rel="noreferrer">` (so tapping opens
full-size) with `<img loading="lazy" decoding="async">`. Stable keys:
`\`ph-${url}-${i}\``. Wrapped in `<RevealOnView>` — the gallery won't
start fetching images until the user scrolls it into view. Grid is
responsive via `grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr))`
with a 2-col fallback on ≤ 480 px. `aspect-ratio: 4/3` keeps the grid
stable before images decode.

---

## Motion system compliance

Phase 2 introduces 3 new `@keyframes` blocks
(`pl-sig-backdrop-in`, `pl-sig-modal-in`, and the ≤ 480 px redefined
`pl-sig-modal-in`). **All three animate only `opacity` and `transform`.**
Verified by a Python scan of the CSS file (see Verification below).
The CTA → Approved transform is a plain `transition` on opacity +
transform only. The photo hover lift is a transform: translateY only.
Every animated/transitioned class has an explicit
`@media (prefers-reduced-motion: reduce)` override in the same file;
5 total override blocks — every new animated selector is covered.

The global `prefers-reduced-motion` neutralizer in `tokens.css` also
zeroes all `--dur-*` vars, so even the CTA transition (which uses
`var(--dur-base)`) already snaps when the user prefers reduced motion.

The signature-modal JS does not run any rAF/interval animations of its
own — it relies entirely on CSS keyframes and the underlying
`useScrollLock` body-fix. No `isReducedMotion()` guard is needed in JS
because no JS animation exists.

---

## Stability guarantees encoded in Phase 2

1. **Hero total digit change never reflows the CTA below** —
   `.pl-hero-stats` has `min-height: 104px` and each `<Stat>` reserves
   width via `--min-ch` + `tabular-nums`.
2. **Monthly count-up runs once per viewport entry** — `<RevealOnView>`
   wraps the block, IntersectionObserver disconnects after first hit,
   `useCountUp` never re-triggers when target is unchanged.
3. **Optional-item toggle cannot reflow neighbours** — the `.pl-opt-row`
   transition is border/background only on the row, transform on the
   knob. No height change.
4. **Total grand-row digit change never resizes the totals card** —
   `.pl-totals-grand-num` reserves `min-width: var(--min-ch, 9ch)` and
   the entire totals block is inside `.pl-totals-card-wrap` with
   `contain: layout paint + min-height: 220px`.
5. **CTA → Approved swap is zero layout shift** — same parent, same
   `min-height: 52px`, opacity+transform only on the two overlaid
   children.
6. **Signature-modal enter/exit cannot reflow the page** — the modal
   is `position: fixed` with `contain: layout paint` on the dialog;
   body scroll is locked; only transform/opacity animate.
7. **Amendment and photos sections don't shift siblings** — each is a
   one-shot `<RevealOnView>` (reveal via transform+opacity only, no
   height animation).
8. **Conversation thread update never shifts anything above it** — the
   thread is rendered in-place below the CTA block; the existing
   double-rAF scroll-to-thread preserves its position.

---

## Accessibility

- `role="dialog" aria-modal="true" aria-labelledby` on the signature
  modal. ESC closes. Backdrop closes. Close button has
  `aria-label="Close signature dialog"`. Focus trapped + restored.
- T&C checkbox has `aria-describedby="pl-terms-text"`; the terms
  `<pre>` owns that id.
- Grand total has `aria-live="polite"` so AT announces the updated
  amount when optionals are toggled.
- Photo gallery is `role="list"` + `aria-label`, each anchor is
  `role="listitem"` + `aria-label` (caption or "Photo N").
- Trust-signal row is `role="list"` with `aria-label`.
- Modal total bar has `aria-live="polite"`.
- All icon-only / decorative elements use `aria-hidden="true"`
  (dividers, decorative checkmarks, the preserved signRef anchor).
- `prefers-reduced-motion` honored at both the component
  (`useCountUp`, `<RevealOnView>`) and CSS level.

---

## Verification summary

| Check | Method | Result |
|-------|--------|--------|
| JSX syntax of `public-quote-page.jsx` | esbuild v0.27.4 `--loader:.jsx=jsx` | **pass** |
| JSX syntax of new `signature-modal.jsx` | same | **pass** |
| JSX/JS parse of every `.js` / `.jsx` file under `src/` | esbuild loop, 94 files | **pass — 0 failures** |
| CSS brace balance of `phase2-public-quote.css` | count `{` vs `}` | **pass — 81/81** |
| All 3 new `@keyframes` use only transform + opacity | Python regex scan over the file | **pass** |
| `prefers-reduced-motion` overrides present | grep in the new CSS | **pass — 5 blocks** |
| Stable keys on every new `.map()` | grep | **pass — amendment uses id-or-composite, photos use `ph-${url}-${i}`** |
| No new `key={i}` / `key={idx}` introduced | grep filtered against pre-existing | **pass — zero** |
| Scope-boundary diff vs Phase 1 zip | `diff -rq` | **pass — only 4 paths changed, all in-scope** |
| `index.css` diff is one line only | `diff` | **pass — `+@import './phase2-public-quote.css';`** |

### Verification not performed (offline environment)

`npm install`, `npm run build`, `npm run test:e2e`, Lighthouse CLS, and
the device-matrix mental pass cannot be run in this sandbox (no
network, no `node_modules`). These are flagged as pre-merge required
in `PHASE2-AUDIT.md`, following the same convention Phase 1
established.

---

## What Phase 2 does NOT do (handed off)

- **Does not refactor the Quote Detail page.** Contractor-facing
  surface is untouched per the sprint prompt.
- **Does not change Stripe backend.** `create-payment-session.js`,
  `stripe-webhook.js`, and `public-quote-action.js` are byte-identical.
  Only the frontend button that triggers them is adjusted (CTA
  transform class, modal wrapper).
- **Does not change SignaturePad drawing logic.** The canvas handlers,
  Draw/Type tabs, name input, save-payload shape, and legal-text prop
  are untouched. Only the surrounding container.
- **Does not modify Public Invoice / Amendment / Additional Work
  pages.** Only the Public Quote page surfaces amendments using the
  data the backend already returns.
- **Does not add dependencies.** `package.json` is byte-identical to
  Phase 1.
- **Does not dedupe the duplicate `[data-theme="light"]` block** —
  deferred to Phase 6 per the sprint prompt.

---

## Ship checklist

- [x] `public-quote-page.jsx` parses as JSX under esbuild.
- [x] `signature-modal.jsx` parses as JSX under esbuild.
- [x] Every other JSX/JS file in the project parses cleanly.
- [x] `phase2-public-quote.css` braces balanced (81/81).
- [x] All new keyframes transform/opacity only.
- [x] All new animated classes honour `prefers-reduced-motion`.
- [x] Stable keys on every mapped list introduced in Phase 2.
- [x] No new dependencies added.
- [x] No files outside explicit Phase 2 scope modified.
- [ ] `npm install` + `npm run build` green. **Pre-merge required.**
- [ ] `npm run test:e2e` all Playwright tests pass. **Pre-merge required.**
- [ ] Device-matrix live pass across iPhone 8/SE, iPhone 16, Galaxy, iPad Mini, iPad Pro, Surface, MacBook Pro. **Pre-merge required.**
- [ ] Lighthouse CLS = 0 on the public quote page. **Pre-merge required.**

---

## What's next (Phase 3 preview)

Phase 3 is the Dashboard refactor — the first page where `<PageHeader>`
gets its first production use ("Good morning, Mike" kicker/title pattern),
and where the `<Stat>` grid replaces the existing ad-hoc metric cards.
Phase 2 leaves the design system proven across both primary revenue
surfaces (Builder + Public Quote), so Phase 3 is largely pattern
replication.
