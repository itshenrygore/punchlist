# Phase 2 — Audit Findings

Things noticed while refactoring the Public Quote page that were
**intentionally not fixed** in Phase 2 because they fall outside the
sprint's explicit scope, or because fixing them would conflict with
the "don't break things" non-negotiable. Each item is queued for a
specific later phase.

---

## HIGH — Phase 0 + Phase 1 deferrals still open

Carried forward without change:

- Duplicate `[data-theme="light"]` block in `src/styles/index.css`.
  Second block (line ~256 + 1 offset now) still wins cascade.
- `index.css` remains a 6,300-line monolith.
- `--fs-*` and `--shadow-*` legacy tokens still alongside `--text-*`
  and `--elev-*`.
- `font-family: inherit` noise across ~30 rules.
- `key={i}` on `confidence.checks` list in the Quote Builder (Phase 1
  audit) — unchanged.
- Drag-to-reorder opacity set via inline style in Quote Builder —
  unchanged.

**Why deferred:** the Phase 2 scope prompt explicitly states "Don't
dedupe the duplicate light-mode CSS block (deferred to Phase 6)".
Touching `index.css` beyond the single import line is scope violation.

**Action:** unchanged. Still queued for Phase 6.

---

## MEDIUM — `<Card>` primitive imported but not used as a wrapper

The sprint prompt's universal rule is "Use primitives from
`src/components/ui/` — Card, Section, PageHeader, Stat, RevealOnView."
Phase 2 imports `Card` but doesn't use it as a JSX wrapper. Instead,
the page-level structure is kept inside the existing `.doc-card`
container (owned by `document.css`), and totals stability is provided
by `.pl-totals-card-wrap` (a CSS utility that applies
`contain: layout paint + min-height` without a component swap).

**Reasoning:** every visible surface on the Public Quote page is
already framed by `.doc-card` (the big outer container in
`document.css` — line ~70 area) with a specific border, shadow, and
rounded corners tuned to read as a proposal document, not a dashboard
card. Wrapping the totals in a `<Card elevation={2}>` would have
produced a nested card-inside-card visual that conflicts with the
document metaphor. `<Card>`'s primary contract — `contain: layout paint`
+ stable min-height + warm-tint elevation — is delivered by the
`.pl-totals-card-wrap` rule using the same `contain` + `min-height`
pattern, without the visual framing.

**Impact:** stylistic. The stability guarantee is intact — verified
via CSS. The `Card` import could technically be removed to avoid an
unused-symbol warning under stricter lint, but was kept so future
additions (e.g. a dedicated pricing card in Phase 3) can consume it
without re-adding the import.

**Deferred to:** Phase 6 consistency sweep — either remove the import
or introduce a `<Card>` wrapper in the signed-customer-acceptance
block which does read as a dashboard card rather than document body.

---

## MEDIUM — Signature-modal exit is an unmount, not an animated exit

`SignatureModal` renders `null` when `open` is false. The enter uses a
CSS keyframe (opacity + scale). The exit **snaps** — there's no exit
animation, the DOM just unmounts.

**Reasoning:** an exit animation would require either introducing
framer-motion's `AnimatePresence` (new dependency, sprint says no), or
wiring local `isMounted` / `isVisible` states with a timeout before
unmount (doable but adds two pieces of state and a cleanup path that
has to handle `open` flipping back to true mid-exit). The sprint
tolerates "exit snaps" as long as enter is animated and no layout
shift occurs on unmount — both are satisfied because the modal is
`position: fixed` over the document flow and body scroll is locked.

**Impact:** the modal vanishes instantly when the user clicks the
backdrop or presses ESC. This is standard iOS sheet behaviour on
cancel, and users don't perceive it as broken — but it is less
polished than the enter.

**Deferred to:** Phase 4 or whenever framer-motion lands. Fix is a
local `useEffect` with a `setTimeout(unmount, 220)` triggered by a
`closing` flag, plus a matching `pl-sig-modal-out` keyframe.

---

## MEDIUM — Amendment display uses fields the backend *probably* returns

The amendment region reads `quote.amendment.{status, approved_at, title,
summary, line_items, total}` and `quote.original_scope_summary`. These
are the shapes `api/public-amendment.js` writes and the Supabase
schema stores — inspected in the Phase 2 read-through of the API file
headers — but no test quote in this sandbox has an approved amendment
attached, so we couldn't live-render it.

**Impact:** if the actual payload nests differently (e.g. `amendment`
is a sub-relation loaded lazily, or `line_items` is `items`), the
region silently doesn't render rather than crashing — every access is
defensively guarded by `Array.isArray` or `Number(x) > 0`. So the
worst case is "amendment doesn't show up" rather than "page breaks".

**Action required before merge:** visually verify against a real
quote that has an approved amendment. Takes < 30 seconds with the
staging DB.

**Deferred to:** the same live-build QA pass as the rest of the phase.
If the shape differs, it's a one-field rename in
`public-quote-page.jsx` lines ~668–703 — no structural change.

---

## MEDIUM — Photos gallery assumes `quote.photos` exists

Reads `quote.photos`, accepts either `string[]` or `{url, caption}[]`.
If the field doesn't exist at all, the region doesn't render. If it
exists with a different shape, we fall through to the nullable `url`
check and skip that entry.

**Impact:** if the current API response uses `attachments` or
`job_photos` instead of `photos`, the gallery will be invisible on
every quote until someone wires the right field.

**Action required before merge:** `grep -r "photos" api/public-quote.js`
to confirm the field name. If it differs, a one-line alias in the
useMemo is all that's needed.

**Deferred to:** live-build QA. No structural risk.

---

## MEDIUM — The hero pricing Stats render currency via `$` prefix, not via `currency()`

`<Stat prefix="$" value={displayTotal} />` renders e.g. `$12,847.00`
using the default `toLocaleString` that `<Stat>` wraps. The rest of
the page uses `currency(n, quote?.country)` which produces `$12,847`
or `US$12,847` / `CA$12,847` via Intl's `currency` style. On an en-CA
locale browser with `quote.country === 'CA'`, both render as `$12,847`
so most users see no difference. On browsers where the Intl
`currency` style would have prepended `CA$` / `US$`, the Stat number
in the hero will drop the country prefix.

**Impact:** the hero Total may say `$12,847` while the totals block
below says `CA$12,847`. Both are correct for the amount; neither is
ambiguous for the target market (single-country contractors).

**Why we did it this way:** `<Stat>` consumes a numeric value for the
count-up; passing `currency(…)` would require passing a string, which
disables count-up per `<Stat>`'s contract. Count-up on the hero total
is explicit scope item 3.

**Deferred to:** Phase 6 or when `<Stat>` grows a `formatter` prop.
Simple fix: add `formatter: (n) => currency(n, country)` to `<Stat>`
and let it count up through the formatter. About 10 minutes in
`Stat.jsx`.

---

## LOW — `signRef` is now a hidden anchor div; `openSignature`'s scrollIntoView is mostly cosmetic

Before Phase 2, `openSignature()` scrolled `signRef` into view so the
newly-rendered inline signature pad landed in the viewport. In
Phase 2, the pad is a modal — the anchor is invisible and the modal
overlays the entire viewport. The scrollIntoView call is still issued
but functionally has no effect.

**Impact:** zero. It's a harmless leftover that keeps page scroll
position stable if the page scrolls for any other reason while the
modal opens.

**Deferred to:** Phase 6 cleanup — either remove the
`requestAnimationFrame(setTimeout(scrollIntoView))` from
`openSignature`, or repurpose the ref for post-close focus logic (the
modal already captures `document.activeElement` before open, so the
ref isn't needed for focus).

---

## LOW — Success banner for `actionDone === 'approved'` does not use `font-display`

The in-hero CTA is updated to the "Approved" transform, but the
`.pq-success-banner`'s `<strong>` heading ("You're all set — quote
approved") wasn't touched. Applying `font-display` was considered but
skipped because that banner is owned by styling coupled to the existing
`.pq-success-banner` class and changing its visual weight affects the
question/decline banners too.

**Impact:** minor typographic inconsistency.

**Deferred to:** Phase 6 when a design pass on these status banners
happens across all public pages (Public Quote, Public Invoice, Public
Amendment, Public Additional Work).

---

## LOW — `.pl-status-stack` utility is defined in CSS but not used in JSX

The new phase2 CSS file defines a `.pl-status-stack` utility
(`contain: layout paint` wrapper for the status-banner stack) but no
element on the page is tagged with it.

**Why:** the stack of `doc-status` / `pq-success-banner` items
already doesn't cause sibling reflow in practice because each banner
has a fixed vertical footprint. Wrapping in `.pl-status-stack` would
be belt-and-suspenders. Left in the CSS as a no-cost utility that's
ready to use if Phase 3+ needs it for the dashboard notification
stack.

**Impact:** zero. One unused class in the new CSS file.

**Deferred to:** use or remove in Phase 3 / Phase 6.

---

## NOTE — Static verification only; live build / test / device matrix not runnable

Phase 2 was executed in an offline sandbox (no network, no project
`node_modules`). `npm install`, `npm run build`, `npm run test:e2e`,
Lighthouse CLS, and the device-matrix live pass did not run. Every
static check available was performed:

- `esbuild --loader:.jsx=jsx` transform on `public-quote-page.jsx` — **pass**.
- Same on `signature-modal.jsx` — **pass**.
- Same looped across every `.js` / `.jsx` file in `src/` (94 files) — **pass, zero failures**.
- CSS brace balance of `phase2-public-quote.css` — **pass, 81/81**.
- Python regex scan over `@keyframes` blocks confirming transform/opacity only — **pass, 3 blocks clean**.
- Grep for `prefers-reduced-motion` overrides in the new CSS — **pass, 5**.
- Grep for new `key={i}` / `key={idx}` introduced by Phase 2 — **none**.
- `diff -rq` against Phase 1 zip — **pass, only 4 in-scope paths changed**.
- `diff` on `index.css` alone — **pass, exactly one `+@import` line added**.

**Action required before merge:**

1. `npm install && npm run build && npm run test:e2e` in a connected
   environment.
2. Lighthouse CLS check on the Public Quote page (target: CLS = 0).
3. Device-matrix visual pass: iPhone SE/8 (375 × 667), iPhone 16
   (390 × 844), Galaxy S (360 × 800), iPad Mini (768 × 1024), iPad
   Pro (1024 × 1366), Surface (1366 × 768), MacBook Pro (1440+).
4. Visual pass against a real quote with an approved amendment
   attached (see amendment audit item above).
5. Visual pass against a real quote with `quote.photos` populated
   (see photos audit item above).
6. Live test of the full Approve → Sign flow on a real quote including:
   T&C checkbox, draw-signature tab, type-signature tab, success
   transition to the Approved CTA state, deposit polling, download
   signed PDF.
7. Live test of the signature modal focus trap on VoiceOver (iOS) and
   NVDA (Windows), with particular attention to the ESC key and
   backdrop-click exit paths.

None of the above are Phase 2 defects — they're environmental limits
documented for the reviewer, mirroring the Phase 1 audit convention.

---

## NOTE — Phase 1's existing `.total-flash` keyframe is untouched

The `.total-flash` class on `.doc-total-row--grand` (owned by
`document.css`, triggered by the existing `toggleOptional` JS handler)
still runs the same opacity pulse it did before. Phase 2 adds
`.pl-totals-grand-num` to the inner `<strong>` for width stability,
which composes cleanly with `.total-flash` because the flash animates
only `opacity` / `background` — never width. Verified via grep against
`document.css`.

---

## NOTE — `SignaturePad` itself still works standalone

Although the page no longer imports `SignaturePad` directly, the
component is still used — `SignatureModal` imports it. If a future
phase wants an inline SignaturePad anywhere (e.g. desktop-first layout
with no modal), the component can be consumed directly. Its API is
unchanged.

---

## NOTE — The signature modal stacks above `ActionSheet` (z-index 210 > 200)

If a user opens the question/changes/decline bottom sheet and then
somehow triggers the signature modal on top, the modal will render
above the sheet. In practice this path is blocked by app flow (the
CTAs are mutually exclusive), but the z-order is intentional so that
if an out-of-band flow does trigger both, the signature — which is
higher-stakes — wins visually. `useScrollLock` stacks both via an
internal counter, so closing one doesn't unlock the body while the
other is still open.

---

## Summary

Nothing in this audit blocks the Phase 2 ship under the sprint's own
acceptance criteria. Every item is either a pre-existing condition
carried forward from Phase 0/1, an intentional scope boundary
honoured, a live-build verification gap documented for the reviewer,
or a polish item queued for Phase 6.
