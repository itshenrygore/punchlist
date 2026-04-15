# CHANGELOG — v100 UX Phase 10.1
**Phase 4.5 Belated + Residual Token Fixes**
Date: 2026-04-14 · Low risk · No behavior changes

---

## UX-022 — Reformat minified JSX lines in quote-builder-page (resolved)

**File:** `src/pages/quote-builder-page.jsx`

The Send Quote modal (~3,086 chars on a single line) and the SMS-confirm card (~850 chars) were both reformatted into multi-line, readable JSX with proper indentation. Inline `style={{}}` objects extracted to named props where applicable. No logic changes — render output identical.

---

## UX-037 — Wire quote-detail error handlers through friendly() (resolved)

**File:** `src/pages/quote-detail-page.jsx`

All bare `catch` blocks that showed hardcoded toast strings were updated to bind the error variable and pass it through `friendly(e)`:
- `catch { showToast('Copy failed', 'error') }` → `catch(e) { showToast(friendly(e), 'error') }`
- `catch { showToast('Error', 'error') }` (photo delete) → `catch(e) { showToast(friendly(e), 'error') }`
- `catch { showToast('Upload failed', 'error') }` (photo upload) → `catch(e) { showToast(friendly(e), 'error') }`

`friendly()` was already imported from `../lib/format` — no new import needed.

---

## UX-039 — public-invoice payment CTAs shared class (resolved)

**File:** `src/pages/public-invoice-page.jsx`
**File:** `src/styles/index.css`

All three payment CTA links (Stripe, Square, PayPal) already carried `className="doc-cta-primary"`. The remaining fix was moving the hardcoded `#0070ba` PayPal brand color out of the inline style:
- Added `--paypal-blue: #0070ba` token to all three `:root` theme blocks in `index.css`
- Replaced `background: 'var(--paypal-blue, #0070ba)'` → `background: 'var(--paypal-blue)'` (no fallback needed since token is now defined)

---

## UX-045 — Extract shared UpdateCard from portal duplication (resolved)

**File created:** `src/components/update-card.jsx`
**File modified:** `src/pages/project-portal-page.jsx`

The ~196 lines of duplicated state/handler logic in `AmendmentCard` and `AdditionalWorkCard` were extracted into `src/components/update-card.jsx`. The new file exports:
- `UpdateCard` (default) — shared implementation handling items, totals, signature display, CTA modes (sign/decline/question), and result banners
- `AmendmentCard` (named) — thin wrapper passing amendment-specific props
- `AdditionalWorkCard` (named) — thin wrapper passing AW-specific props

`project-portal-page.jsx` now imports both from `../components/update-card` and the local function definitions (~151 lines) were removed. Approve/decline/question flows work identically for both types.

---

## UX-049 — Settings delete-account danger color (resolved)

**File:** `src/pages/settings-page.jsx`

The delete-account buttons used `var(--danger)` which was undefined (not declared in any `:root` block), causing a silent CSS fallback to unset. All `var(--danger)` references throughout `settings-page.jsx` replaced with `var(--red)`. Visual appearance unchanged — `--red` is the correct semantic token for destructive actions.

---

## UX-063 — payments-onboarding inline style density (resolved)

**File:** `src/pages/payments-onboarding-page.jsx`

Extracted the following shared `.po-*` CSS classes into the existing `<style>` block inside `FlowFrame`:

| Class | Covers |
|---|---|
| `.po-screen-icon` | State screen emoji containers (60×60, flex-center, margin auto) |
| `.po-screen-icon--lg` | Larger 64×64 variant for IntroScreen |
| `.po-screen-heading` | All screen h1/h2 headings (clamp font, fontWeight 800, letterSpacing) |
| `.po-screen-heading--lg` | Larger intro variant |
| `.po-screen-subtext` | Screen body paragraphs (text-sm, muted, lineHeight 1.6, max-width) |
| `.po-screen-subtext--base` | Base-size variant |
| `.po-feature-row` | Value-prop card rows (panel bg, border, borderRadius 12, flex) |
| `.po-feature-icon` | Feature icon span |
| `.po-feature-title` / `.po-feature-sub` | Feature card title/subtitle |
| `.po-timeline-row` | Step/timeline flex rows |
| `.po-timeline-num` | Step number badge (circular, brand colors) |
| `.po-timeline-title` / `.po-timeline-time` / `.po-timeline-desc` | Timeline text elements |
| `.po-screen-center` | Center-aligned screen wrapper with bottom margin |
| `.po-skip-link` | "Maybe later" / "I'll do this later" navigation links |
| `.po-trust-grid` | TrustBadge grid wrapper |
| `.po-footnote` | Small centered footnote paragraphs |
| `.po-panel-box` | Panel card containers |
| `.po-req-label` / `.po-req-item` / `.po-req-dot` | ActionRequired items list |
| `.po-actions-grid` | CTA/action button grid |
| `.po-spinner` | Spinning loader div (shared animation, border style) |
| `.po-screen-text-center` | Simple text-align:center wrapper |

Inline `style={{}}` count reduced from 94 → 51. Remaining 51 include: 4 irreducible shared-component internals (`FlowFrame`, `PrimaryBtn`, `SecondaryBtn`, `TrustBadge`), the `BackBtn` position:fixed overlay, the `AcknowledgeScreen` checkbox with dynamic `accepted`-state-dependent colors, SVG inline icon, link `textUnderlineOffset`, hidden input `position:absolute`, and spinner sizing overrides. All 5 screen components render identically.

---

## Residual fontSize literals (resolved)

**Files:** `src/app/protected-route.jsx`, `src/components/command-palette/keyboard-shortcuts.jsx`

- `protected-route.jsx:23` — `fontSize: 14` → `fontSize: 'var(--text-sm)'`
- `keyboard-shortcuts.jsx:37` — `fontSize: 14` → `fontSize: 'var(--text-sm)'`

`grep -rn 'fontSize:\s*[0-9]' src/` now returns 0 results.

---

## UX-099 — Non-intentional hex color violations (resolved)

**Files:** `src/styles/index.css`, `src/pages/settings-page.jsx`, `src/pages/project-portal-page.jsx`, `src/components/signature-pad.jsx`, `src/pages/public-invoice-page.jsx`

New tokens added to all three `:root` theme blocks in `index.css`:
- `--amber-text: #92400e` — warm amber text for warning surfaces
- `--paypal-blue: #0070ba` — PayPal brand color

Hex violations fixed:
| File | Line | Change |
|---|---|---|
| `settings-page.jsx` | 683 | `#f0fdf4` → `var(--green-bg)` (Stripe Active badge) |
| `settings-page.jsx` | 1142 | `#92400e` → `var(--amber-text)` (SMS warning text) |
| `project-portal-page.jsx` | 400 | `#92400e` → `var(--amber-text)` (deposit badge text) |
| `signature-pad.jsx` | 124 | `#fff` → `var(--surface)` (name input background) |
| `signature-pad.jsx` | 144 | `#bbb` → `var(--muted)` (placeholder text color) |
| `signature-pad.jsx` | 154 | `#fff` → `var(--surface)` (type input background) |
| `signature-pad.jsx` | 167 | `#92400e` → `var(--amber-text)` (terms warning text) |
| `public-invoice-page.jsx` | 349 | `var(--paypal-blue, #0070ba)` → `var(--paypal-blue)` |

Intentional exceptions left unchanged:
- `signature-pad.jsx:41,61` — canvas `strokeStyle`/`fillStyle` (canvas API requires string literals)
- `logo.jsx:11-12` — SVG fallbacks
- `theme-context.jsx:18` — `meta[name=theme-color]` (browser API)

---

## Acceptance checklist

- [x] UX-022 resolved — Send modal and SMS-confirm card reformatted, no single line > 120 chars in targeted section
- [x] UX-037 resolved — all catch blocks with error binding use `friendly(e)`
- [x] UX-039 resolved — all payment CTAs use `.doc-cta-primary`, `--paypal-blue` token defined
- [x] UX-045 resolved — `src/components/update-card.jsx` exists, portal UpdatesTab reduced ~151 lines
- [x] UX-049 resolved — no `var(--danger)` or red hex on delete-account button
- [x] UX-063 resolved — `.po-*` classes extracted, inline style blocks reduced 94 → 51
- [x] fontSize grep returns 0 results
- [x] Hex violations fixed, intentional exceptions untouched
