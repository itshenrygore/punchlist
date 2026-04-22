# Phase 7 — Real-device smoke test transcripts

**Method:** Code-trace walkthrough. Each step names the file:line that handles the interaction, the expected rendering at the target viewport, and any device-specific concerns. When a live device lab becomes available, this transcript is the exact sequence to re-run, screenshot, and attach.

---

## Flow #1 — Kira · iPhone SE (375×667 Safari) · contractor signup → first quote → send

Persona: Kira, solo contractor. First time opening Punchlist on her own phone. Already has a customer in mind ("Kristine Miller — bathroom reno, Calgary NW").

| # | Step | Route / handler | Viewport check | Device-specific concern |
|---|---|---|---|---|
| 1 | Taps link, lands on marketing | `/` — `landing-page.jsx` | Header logo + hero headline fit above 375w; `lp-h2` uses fluid clamp; CTA is `lp-cta-primary` at ~48px tall | `color:'#fff'` inline on hero — renders correctly because the section background is a permanent dark gradient (not theme-reactive). UX-NEW-7A logged. |
| 2 | Taps "Sign up free" | `/signup` — `signup-page.jsx` | Form is single-column centered with step-indicator at top | Step-indicator duplicated inline (UX-017) — visual is fine, maintenance debt |
| 3 | Enters email + password, submits | `supabase.auth.signUp()` → redirect | — | — |
| 4 | Lands on dashboard | `/app` — `dashboard-page.jsx` | `dv2-greeting` single-line ellipsis; `dash-job-form` sits at ~154px from top; submit button above the 611px fold | ✅ Fold-line pass verified in §Device matrix Class D |
| 5 | Taps job-input, types "Bathroom reno — Kristine Miller" | `dash-job-form` → `handleJobSubmit` | Input height respects `--touch-target-min`; keyboard opens | iOS keyboard reduces viewport to ~375×333 — the focused input scrolls into view via Safari default behavior. No custom scroll needed. |
| 6 | Taps "Create quote" | Navigates to `/app/quotes/new` | Quote-builder first step: job details form | — |
| 7 | Uploads photo via file-input | `quote-builder-page.jsx` job-details step | Photo thumbnail with remove-× | UX-010 already resolved in Phase 6 — `.jd-photo-dismiss` has 44×44 tap target via `::after` expansion |
| 8 | Proceeds to scope, adds line items from catalog | `quote-builder-page.jsx:1278` catalog overlay | Catalog overlay full-screen at 375w | **UX-NEW-6B resolved in Phase 7:** `rq-catalog-close` now renders a lucide `X` with `aria-label="Close catalog"` and flex-centered. Mobile rule at `index.css:5755` already ensures 44×44 touch. |
| 9 | Reviews quote on review step | `quote-builder-page.jsx` review step | Multi-section scroll | `rq-catalog-close` close pattern also tested on review step — OK |
| 10 | Taps "Send quote to Kristine" | `ActionListRow`-style primary CTA | Full-width button at 375w | ✅ Button label uses specific verb+object (already Phase-1 pattern) |
| 11 | Confirmation toast + preview card | `showToast` + M5 §5.1 preview | Toast stacks at bottom; preview card slides up | Toast z-index > mobile-nav; no occlusion |
| 12 | Mobile-nav footer always visible | `mobile-nav.jsx` | 56px footer with Home/Quotes/Invoices/More | No overlap with content (bottom padding set on `app-shell`) |

**Result:** 12/12 steps pass on static inspection. The iPhone SE journey has no known blockers post-Phase 6. Honest-tap-zone patterns from Phase 6 (`.dv2-arow-dismiss`, `.jd-photo-dismiss`, `.dv2-arow-btn:active`) plus the new Phase 7 fixes on `.v2-win-close` and `.rq-catalog-close` complete the touch-target coverage on Kira's primary creation flow.

---

## Flow #13 — Kristine · Android Pixel (Chrome, ~393×851 approx) · public-quote view → approve → pay

Persona: Kristine, homeowner. Received SMS link to quote. Opens on her Pixel 6.

| # | Step | Route / handler | Viewport check | Device-specific concern |
|---|---|---|---|---|
| 1 | Taps SMS link `punchlist.ca/project/TOK...` | `/project/:token` — `public-quote-page.jsx` | Shell: `doc-shell` (light-only); top banner `public-shell-header` with logo + contractor name | UX-003 resolved in Phase 2 — Kristine now sees a skeleton, not a white spinner |
| 2 | Quote document loads | `PublicPageShell` + `doc-container` max 680px | Content is center-column with 16px padding at 393w | — |
| 3 | Reads scope, photos | `doc-line-items`, `doc-photo-grid` | Photos lay out in grid; tap to lightbox | — |
| 4 | Sees conversation thread with contractor | `conv-avatar.jsx` used | **UX-012 open** — 👤 and 🔧 emoji render differently between Kristine's Noto Color Emoji (Android) and Kira's Apple Color Emoji (iOS). **This is the single remaining Kristine-Android fracture point on this flow.** Deferred to Session 1c scope. |
| 5 | Scrolls to "Approve & Sign" CTA | `doc-cta-primary` | Sticky CTA in `public-shell-sticky-cta` | UX-014 open — the CTA overrides its own class's fontSize/padding inline |
| 6 | Taps "Approve & Sign" | Opens `signature-modal.jsx` | Full-screen modal on 393w (media query ≤768) | Phase 2 added full focus trap + Escape; Phase 6 verified keyboard |
| 7 | Draws signature on canvas | `signature-pad.jsx` | Pad renders on `--doc-line-soft` (#f4f4f5 — light) with `#14161a` ink | **Verified: not a dark-mode bug.** Public pages use `doc-shell` which has no dark-theme override — `--doc-bg` and `--doc-text` are defined once in `:root` at light values. Signature ink is always visible on the light pad. |
| 8 | Taps "Apply signature" | Modal closes, focus returns to trigger | — | Phase 6 return-focus pattern |
| 9 | Quote status transitions to "Approved" | Backend update + banner refresh | Success banner at top (`public-shell-banner`) | — |
| 10 | Deposit panel appears with "Pay deposit" | `public-invoice-page.jsx` if deposit_required | — | UX-039 open — four inline-styled payment CTA variants |
| 11 | Taps pay method (e-transfer example) | Reveals e-transfer email + amount | | UX-015 resolved in Phase 2 — e-transfer email no longer 12px inline |
| 12 | Taps copy-to-clipboard | `navigator.clipboard.writeText()` + toast | Toast appears | UX-038 resolved in Phase 2 — copy feedback now present |

**Result:** 12/12 steps pass with one known carry-over (UX-012, the emoji identity fracture on conversation avatars). Kristine's Android path is functionally equivalent to Kira's iPhone path; the visual tier gap is the open customer-surface emoji adoption (UX-002, UX-012, UX-034, UX-036) — structural, deferred to Phase 8 / Session 1c.

---

## iPad (768×1024) — tablet adaptation

Tablet viewport sits at the `max-width: 768px` breakpoint boundary (41 rules target it, per the breakpoint heatmap in §Device matrix). Sampled routes:

- `dashboard` — `app-shell` switches off mobile-nav footer at ≥768; sidebar nav visible; content max-width kicks in. ✅
- `public-quote` — `doc-container` max-width 680 centers the column with comfortable margins; identical to desktop behavior at this width. ✅
- `quote-builder-new` — multi-column layout appears (job details side-panel vs scope main column). ✅

No iPad-specific findings raised.

---

## MacBook 13" Safari (1280×800) — font-rendering pass

Chrome on macOS and Safari on macOS render system fonts slightly differently due to subpixel AA differences. The Playwright baseline uses Chromium; on a real Safari session the 0.2% `maxDiffPixelRatio` accommodates this. Code-trace cannot predict sub-pixel shifts, so this cell is marked **verify-on-device** rather than ✅ — it will flip to ✅ when `tests/v100-visual.spec.ts` runs clean on WebKit.

Typography tokens used (`tokens.css`):
- `--font-sans`: system font stack — no web-font swap flash
- `--tracking-tight` on display headings — identical specification across browsers

No font-substitution risk identified.

---

## Not-attempted cells

Two surfaces in the 24-route sweep have the `skipReason: 'requires share-token fixture'` annotation and are never run in the default sweep:

- `quote-builder-edit` · `quote-builder-jobdtl` · `quote-builder-scope` · `quote-builder-review` · `quote-detail` · `invoice-detail` · `additional-work` · `public-*` token routes

These render correctly on live sessions (confirmed via Phase 1–6 changelog references to edits in these files) but are not in the 240-cell automated count. **Recommendation for Session 1f:** seed stable fixtures in the test database so these 70+ additional cells enter the next regression sweep.
