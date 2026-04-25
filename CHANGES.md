# Punchlist v101 → v102 Changes

**Date:** April 25, 2026  
**Files modified:** 7

---

## Critical Fix

### `src/components/public-quote-view.jsx`
**BUG-001 FIX:** Line 217 was corrupted — ~30 lines of JavaScript had been collapsed into a single line with literal `\n` characters instead of actual newlines. This caused `ReferenceError: topRef is not defined` on every public quote page load, completely blocking customer access.

**What was restored:**
- `useScrollLock(Boolean(activeSheet))` call
- Five `useRef` declarations: `topRef`, `signRef`, `threadRef`, `termsRef`, `readFiredRef`
- `IntersectionObserver` effect for marking messages as read when conversation thread scrolls into view

**No other code was changed in this file.**

---

## Mobile UX Fixes

### `src/components/foreman.jsx`
1. **Vertical drag unlocked:** Changed bottom clamp from `Math.max(136, ...)` to `Math.max(72, ...)` — FAB can now be dragged anywhere from just above mobile nav to near the top of the screen
2. **Default position lowered:** Initial `bottom` from 136 → 80 (closer to thumb reach)
3. **Icon changed:** Replaced sparkle/star SVG with wrench icon (trades-appropriate)
4. **Semi-transparent:** Added `opacity: 0.7` so it doesn't fully obscure content beneath

### `src/pages/quotes-list-page.jsx`
- **"Hide completed" on mobile:** Added `.ql-mobile-filters` bar below search input with sort dropdown and "Hide completed" toggle, visible only at ≤768px

### `src/pages/quote-detail-page.jsx`
- **Mobile tabs:** Added two-tab layout ("Details" / "Messages") visible only at ≤768px
  - "Details" tab shows: hero, scope & pricing, send/share (Zone 1 + Zone 3)
  - "Messages" tab shows: conversation thread + activity feed (Zone 2)
  - Badge shows message count on Messages tab
  - Desktop layout is unchanged (all zones visible)
- **Lifecycle stepper hidden on mobile** (≤768px) — redundant with the phase banner

### `src/styles/index.css`
- Added `.ql-mobile-filters` base styles and media query rules
- Added `.qd-mobile-tabs`, `.qd-mobile-tab`, `.qd-mobile-tab--active`, `.qd-mobile-tab-badge` styles
- Added mobile-only rules: `.qd-zone-messages` / `.qd-zone-details` hide via `display:none!important` at ≤768px
- Added `.ql-strip{display:none}` at ≤768px to hide lifecycle stepper on mobile

---

## Payments & Routing

### `src/app/router.jsx`
- **`/app/payments-setup` now renders the real onboarding flow** (`PaymentsOnboardingPage`) instead of the static FAQ page (`PaymentsSetupPage`). Both routes now point to the same Stripe Connect setup experience.

### `src/pages/payments-setup-page.jsx`
- **Fixed text-as-icon bug:** Replaced string literals (`'dollar'`, `'mobile'`, `'✅'`, `'lock'`) with proper lucide-react components (`DollarSign`, `Smartphone`, `CheckCircle`, `Lock`)
- **Updated CTA:** "Go to Settings →" changed to "Start Stripe Setup →" linking directly to `/app/payments/setup`

---

## What was NOT changed
- No backend/API files modified
- No Supabase schema changes
- No new dependencies added
- No changes to `package.json`
- Desktop layout is preserved across all pages
- All existing component imports remain valid
