# Phase 3.5 Part B — Smart-defaults wiring

Tiny follow-on to the backend slice. Wires `getQuotingDefaults` into
the existing builder load effect so the deposit / expiry settings
already reflect the user's habits when they open a fresh quote — no UI
restructure, no new components, no behavior changes outside the
specific code path described below.

## Summary

| File | Change | Lines |
|------|--------|-------|
| `src/pages/quote-builder-page.jsx` | Import `getQuotingDefaults`; call once in load effect; layer onto draft state in two places (new-quote inline draft + edit-mode untouched-draft block). | +37 |

No other files touched. The backend helper itself (`getQuotingDefaults`,
shipped in the prior backend slice) is unchanged.

## Behavior change

For a contractor who has sent ≥ 3 of their last 5 quotes with the
same deposit percentage / expiry days, those values now appear as the
**initial state** of the deposit and expiry fields when they open the
quote builder.

Precedence chain (high → low):
1. **Smart defaults** (mode of last 5 non-draft quotes) — new
2. `profile.default_*` (existing profile defaults)
3. Hardcoded fallbacks — 14 days expiry, 20% deposit, deposit not required (existing)

The chain is **only** applied when the contractor hasn't started
editing a draft — same condition the existing code path already uses
(`q.status === 'draft' && !q.deposit_required && !q.internal_notes`
in edit mode; `dirty.current === false` in new-quote mode).

For a fresh user with no quote history, `getQuotingDefaults` returns
null and the existing precedence chain runs unchanged. Zero behavior
change for the no-history case.

## Why the change is small and safe

The plan (PHASE3-5-PLAN.md §2.4) says to layer smart defaults *above*
profile defaults at L.234. That's exactly what this change does. No
adjacent logic moved, no rendering changed, no state shape changed.

The only structural edit is dropping the `p &&` guard on the existing
edit-mode precedence block. Both subsequent uses of `p` already use
optional chaining (`p?.default_expiry_days`, `p?.default_deposit_mode`),
so a null `p` was already safe inside the block — the outer guard was
redundant. Dropping it lets the smart-defaults layer still apply when
profile fetch fails. (Profile fetch is wrapped in `.catch(() => null)`
in the `Promise.all`, so this is the failure mode we're handling.)

## What this change does NOT do

- No UI for displaying which defaults came from where ("· Change" pills are part of B7 UI work)
- No inline default editors (B7 UI work)
- No collapse of the phase machine (B2)
- No customer picker rewrite (B4 — needs `useCustomers` hook + M7)
- No telemetry on smart-default usage (B13)
- Does not affect the inline default state at L.145 (the hardcoded initial values still flash for ~50–200ms before the load effect resolves; visually fine since the deposit/expiry section is collapsed by default at L.720 inside `<details className="rq-meta-collapse">`)

## Testing

Static:
- Brace balance vs original file: identical deltas (-1 `{`, -2 `(`, 0 `[`), the deltas are JSX-strip artifacts present in the original. Zero new structural deviation.
- `node --check` does not support JSX; relied on hand-review + brace-balance comparison.

Live (required before merge):

1. **Fresh user, new quote:** Sign in to a brand-new account, open the
   builder, expand "Quote details". Verify deposit unchecked, expiry
   14 days. Identical to current behavior.
2. **Fresh user, profile defaults set:** In Settings, set default
   expiry to 30 days and default deposit to 25% percent. Open builder.
   Expand "Quote details". Verify expiry shows 30, deposit checked at
   25%. (Existing behavior — confirms profile fallback still works.)
3. **Returning user, no deposit habit:** Send 5 quotes with deposit
   unchecked. Open new builder. Verify deposit unchecked. (Smart
   defaults returns `depositRequired: false`.)
4. **Returning user, deposit habit:** Send 4 of last 5 quotes at 30%
   deposit, 21-day expiry. Open new builder. Verify deposit checked at
   30%, expiry 21. (Smart defaults override profile.)
5. **Returning user, has habit + has profile defaults:** Set profile
   to 14d/20%, but actually sent 4/5 at 30%/21d. Open new builder.
   Verify smart defaults win — 30%/21d. (Precedence test.)
6. **Edit existing untouched draft:** Create a quote (no deposit, no
   internal notes) yesterday. Open it today after sending several
   quotes at a different rate. Verify the open shows the smart-default
   values (since `q.status === 'draft' && !q.deposit_required && !q.internal_notes` matches).
7. **Edit existing customized draft:** Create a quote, manually set
   deposit to 35%, save. Re-open. Verify deposit stays at 35% — the
   `!q.deposit_required` guard blocks any layering.
8. **Dirty-state guard:** Open new builder, immediately tap into the
   description and type. Verify defaults still apply if they resolve
   *before* the typing (race), but if you started typing first and
   defaults arrive late, the `dirty.current` check prevents clobber.
   The race window is small (single async quote query) but the guard
   exists for it.

## Edge cases worth knowing

- **Defaults arrive after user starts editing:** Guarded. `dirty.current` is set by `markDirty()` which `ud()` calls on every field write. If the user has typed anything, smart defaults are skipped.
- **Profile fetch fails, defaults succeed:** `Promise.all([profileP.catch(() => null), defaultsP])` — `p` is null, smart defaults still apply.
- **Both fail:** Both null, draft keeps initial hardcoded state. Same as today's failure mode.
- **defaults.depositRequired is true but depositPercent is 0:** Can't happen — `getQuotingDefaults` filters `pcts` for `p > 0` before computing mode. If somehow it does happen, the `if (defaults.depositRequired) next.deposit_percent = …` line still runs and sets it to whatever mode returned (could be null). Defensive: would render as empty input, contractor would notice. Not adding extra defensive code — the helper already filters.

## Revert

Single file, two contiguous edits:
- Remove `getQuotingDefaults` from the import on L.6.
- Revert the load effect: remove `defaultsP`, remove the `if (!existingQuoteId)` block, restore the original `p &&` guard and remove the `defaults` plumbing in the edit-mode block.

`git diff src/pages/quote-builder-page.jsx` shows ~40 lines of churn, all in one effect.
