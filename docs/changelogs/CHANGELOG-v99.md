# Punchlist v99 — Slice 12 draft + 4 concrete bug fixes

**Released:** April 14, 2026
**Contents:**
- Phase 3.5 Slice 12 Session 1 draft (visual layout refresh of quote builder)
- Four concrete bug fixes from screenshot audit
- Reorganized docs folder structure

**Status:** Slice 12 Session 2 browser-iteration still pending. v100 planning
doc (separate document) scopes the next major push.

---

## What's in v99

### Slice 12 draft (from prior session)
- Two-column review layout at ≥768px, stacks at ≤768px
- Describe phase gradient header strip
- Line item card left accent bar + hover state + drag handle visibility
- Stepper: outlined/filled dots, ✓ glyph on done, pulse ring on active, connector line
- Building phase shimmer skeletons + 15s progress bar
- Sent-screen confetti + staggered step entrance + brand-tinted push nudge
- All animations gated on `prefers-reduced-motion`

See `CHANGELOG-PHASE3-5-SLICE-12.md` at repo root for full before/after
snippets and `PHASE3-5-AUDIT-SLICE-12.md` for deviations & Session 2 items.

### v99 Fix 1: Contractor name fallback in SMS body

**Screenshot 3 issue:** Send Quote modal shows the literal text
`"Your contractor"` in the pre-filled SMS when the user hasn't set a
`company_name` on their profile.

**Root cause:** `src/pages/quote-builder-page.jsx:827` used only
`companyName || 'Your contractor'`, skipping the `profile.full_name`
fallback that other call sites (e.g. `additional-work-detail-page.jsx:70`,
`invoice-detail-page.jsx:112`) already use.

**Fix:** unified fallback chain.

```diff
-    setSmsBody(`Hi${firstName ? ' ' + firstName : ''}, your quote from ${companyName || 'Your contractor'} is ready:\n\n${title || draft.title || 'Your quote'} — ${currency(grandTotal, country)}\n\n[link will be added automatically]`);
+    // v99 fix: fall back to full_name before the generic "Your contractor" placeholder
+    const senderName = companyName || userProfile?.full_name || 'Your contractor';
+    setSmsBody(`Hi${firstName ? ' ' + firstName : ''}, your quote from ${senderName} is ready:\n\n${title || draft.title || 'Your quote'} — ${currency(grandTotal, country)}\n\n[link will be added automatically]`);
```

**Scope limit:** `userProfile` is loaded at component mount via `getProfile()`.
If the user has neither `company_name` nor `full_name` set, the generic
"Your contractor" still shows. That's expected — v100 should block send
entirely until profile is complete.

---

### v99 Fix 2: Quote detail page max-width cap

**Screenshot 2 / 6 issue:** On wide viewports the quote detail page's
main content floats too far left, leaving a large void on the opposite
side. The public quote preview exhibits the same void.

**Root cause:** `.qd-grid` at `src/styles/index.css:1120` had no
`max-width` and no horizontal centering, so it stretched to fill whatever
the AppShell content column provided. On wider-than-typical viewports the
1fr + 296px columns landed with most of the content at one edge.

**Fix:** cap at 1200px and center. Also added `min-width: 0` on both the
main and sidebar columns — a standard grid flex-item fix that prevents
long content (file names, URLs, unbroken item titles) from forcing the
column wider than the grid track.

```diff
-.qd-grid{display:grid;grid-template-columns:1fr 296px;gap:16px;align-items:start}
-.qd-main{display:grid;gap:14px}
-.qd-sidebar{display:grid;gap:10px;position:sticky;top:64px}
+.qd-grid{display:grid;grid-template-columns:1fr 296px;gap:16px;align-items:start;max-width:1200px;margin-left:auto;margin-right:auto;width:100%}
+.qd-main{display:grid;gap:14px;min-width:0}
+.qd-sidebar{display:grid;gap:10px;position:sticky;top:64px;min-width:0}
```

**Scope limit:** 1200px is a reasonable default; v100 dashboard rework
should pick a system-wide max-width token and apply it consistently
(quote detail, public quote, invoice detail, dashboard).

---

### v99 Fix 3: Duplicate "Saved" indicator on manual save

**Screenshot 4 issue:** After clicking "Save draft" the UI briefly shows
two concurrent "Saved" indicators — the footer button changes to
`✓ Saved` (intentional 2.5s pill) AND a toast appears top-right saying
`✓ Saved ×` (redundant).

**Root cause:** `save()` at `src/pages/quote-builder-page.jsx:624-626` sets
`saveState = 'saved'` (drives the footer pill) *and* fires
`toast('Saved', 'success')` on the same code path. The pill is enough
feedback on its own.

**Fix:** only toast for sends and errors. Saves now rely on the existing
footer pill.

```diff
-        if (!silent) toast(nextStatus === 'sent' ? 'Quote sent' : 'Saved', 'success');
+        if (!silent) {
+          // v99 fix: suppress redundant "Saved" toast — the footer button already
+          // shows a 2.5s "✓ Saved" pill for manual saves. Still toast for sends
+          // and errors since those warrant a more visible confirmation.
+          if (nextStatus === 'sent') toast('Quote sent', 'success');
+        }
```

The `silent=true` autosave path was already toast-free; this fix only
affects manual `save()` calls.

**Scope limit:** the offline-save branch (line 630) still toasts
"Saved offline — will sync when online" because that's a distinct state
the pill cannot communicate.

---

### v99 Fix 4: "Job: <title>" line clipping in describe phase

**Screenshot 7 issue:** The informational "Job: 200a Service Upgrade"
line between the textarea/helpers and the trade/province details was
visibly clipped — the descender of 'g' in "Upgrade" got cut off, making
the text look broken.

**Root cause:** `src/pages/quote-builder-page.jsx:1006` set
`padding: '4px 0'` with no explicit `line-height`. The inherited
line-height combined with 4px vertical padding left insufficient room
for descenders. Long titles also had no wrap behaviour, so they could
push the column wider than intended on narrow viewports.

**Fix:** bumped padding to 6px, added `lineHeight: 1.5`, plus safe
`wordBreak`/`overflowWrap` for long unbroken titles.

```diff
-{title && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>Job: <strong style={{ color: 'var(--text)' }}>{title}</strong></div>}
+{title && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 0', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>Job: <strong style={{ color: 'var(--text)' }}>{title}</strong></div>}
```

**Scope limit:** the describe-phase Card has a `min-height` reservation
via `.pl-describe-stable` to prevent layout shift during skeleton loads.
If titles ever exceed ~2 lines the overall card height grows; acceptable.

---

## Docs reorganization (from prior session)

All documentation except `README.md` and the two Slice 12 deliverables is
now under `docs/`:

```
docs/
├── README.md                 # docs index
├── DESIGN-SYSTEM.md
├── RESEND-DELIVERABILITY.md
├── README-v80.md
├── changelogs/               # every phase + slice changelog
├── audits/                   # deferrals and known-issue reports
└── phase-planning/           # PLAN, PROGRESS, NEXT-SESSIONS
```

---

## Issues NOT fixed in v99 (tracked for v100)

These came up in the screenshot audit but are out of scope for a
bug-fix drop. All are scoped in the v100 planning doc.

1. **Follow-up text template system** (user's primary feature request) —
   contractors need to edit the default follow-up SMS, see when the last
   follow-up was sent, and see whether the customer has opened the quote
   since then. This is a DB migration + new Settings tab + quote-detail
   page wiring. See `PHASE4-V100-PLAN.md` §3.

2. **Scroll "trapping" on desktop** — user reports wheel events not
   propagating in parts of the page. Investigated: most likely culprit
   is `.app-main` combining `-webkit-overflow-scrolling: touch` with
   `overscroll-behavior-y: contain` at `index.css:681`. Removing either
   could regress mobile touch scroll UX, so this needs browser
   profiling before changing. Tracked for v100 M7 QA pass.

3. **Full visual audit every page** — 24 route components; cannot be
   done statically. v100 plan includes a Playwright visual regression
   pass on a device matrix.

4. **"80% Commonly missed items" affordance** (screenshot 5) — the
   `▸` arrow suggests expandable content that shows only one missed
   item in the example. Works as designed (expands `<details>` on
   click), but the visual affordance is weak. Tracked for v100
   Workstream D review-flow polish.

---

## Non-regression evidence for Slices 1–11

No files from Slices 1–11 were touched in v99's four fixes:
- Fix 1, 3, 4 edit `quote-builder-page.jsx` but only change three specific
  lines (`setSmsBody` call at 833, `toast` call at 626, `Job:` line at
  1006). No state, hooks, handlers, or API calls changed.
- Fix 2 edits `index.css` but only widens `.qd-grid` — does not affect
  `.rq-builder-layout` (Slice 12), `.rq-footer` (Slice 6), `.toast-undo*`
  (Slice 7), `.qb-kbd-overlay*` (Slice 9), or any voice/mic rules (Slice 10).

`api/stripe-webhook.js` and `api/public-quote-action.js` untouched
(byte-identical to prior package: 20920 and 36228 bytes respectively).

---

## File changes summary

| File | Change | Lines |
|------|--------|-------|
| `src/pages/quote-builder-page.jsx` | 3 line edits (Fix 1, 3, 4) | ±7 net |
| `src/styles/index.css` | 3 rule edits (Fix 2) + full Slice 12 block | +430 net |
| `CHANGELOG-v99.md` | New | new |
| `PHASE4-V100-PLAN.md` | New planning doc | new |
| `CHANGELOG-PHASE3-5-SLICE-12.md` | New (Slice 12 draft) | new |
| `PHASE3-5-AUDIT-SLICE-12.md` | New (Slice 12 audit) | new |
| `docs/` (reorg) | Moved 33 MD files from root | structural |
| `README.md` | Rewritten | replaced |
