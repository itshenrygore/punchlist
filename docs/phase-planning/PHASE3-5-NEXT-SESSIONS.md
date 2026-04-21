# Phase 3.5 Part B — Remaining Work & Next-Session Prompts

This is a guide for finishing Part B across multiple chat sessions. Each
slice is a separate chat that starts with the **current zip + the relevant
prompt below**. Start a fresh chat for each slice — context from prior
slices lives in the changelogs, not in conversation memory.

## Ordering rationale

Ordered smallest-to-largest and lowest-to-highest risk. Each slice is
independently shippable, so you can stop at any point and have a working
app. The UI rewrite is last because it benefits from everything else
being in place, and because it's the one slice that really should be done
in a local dev environment, not a chat session.

| # | Slice | Size | Risk | Chat-doable? |
|---|-------|------|------|--------------|
| 3 | M7 dup-check | ~15 lines | Very low | Yes, easily |
| 4 | C5 helper + autosave retune | ~50 lines | Low | Yes |
| 5 | H4 client integration + sent_at surfacing | ~30 lines | Low | Yes |
| 6 | M8 keyboard-safe Send CSS | CSS only, ~20 lines | Very low | Yes |
| 7 | Send-path: optimistic + 3s undo + C3 sms: fallback | ~200 lines | Medium | Yes, carefully |
| 8 | B13 Telemetry | ~60 lines across 3 files | Low | Yes |
| 9 | B11 Coachmarks + B12 keyboard shortcuts | ~120 lines | Low | Yes |
| 10 | B5 Voice + parallel AI pre-warm | ~150 lines | Medium | Yes |
| 11 | B4 Customer picker UI consuming useCustomers | ~100 lines | Medium | Yes |
| 12 | B2/B3 Single-page layout rewrite | ~400 lines net | **High** | **Prefer local dev** |
| 13 | Timing validation (`PHASE3-5-TIMING.md`) | measurements only | — | **Cannot be done in chat** |

---

## Universal preamble for every next-session prompt

Every next-session chat should start with this attached:

- The latest project zip (start with `punchlist-phase3_5-through-slice2.zip`; each completed slice produces a new zip that's the starting point for the next)
- `PHASE3-5-PLAN.md`
- `PHASE3-5-PROGRESS.md`
- All `CHANGELOG-PHASE3-5-SLICE-*.md` files
- All `PHASE3-5-AUDIT-*.md` files

And the prompt should open with:

> You are continuing Phase 3.5 Part B for Punchlist. Two slices are
> already shipped (see PHASE3-5-PROGRESS.md for the summary,
> CHANGELOG-PHASE3-5-SLICE-*.md for details). Do not touch the
> functions Part A modified in `api/stripe-webhook.js` and
> `api/public-quote-action.js`. Do not regress the two shipped slices.
>
> Read in order before writing code:
> 1. PHASE3-5-PROGRESS.md
> 2. PHASE3-5-PLAN.md — the authoritative blueprint
> 3. All shipped changelogs
> 4. The specific files named in the slice prompt below
>
> Each slice must produce:
> - Modified source files
> - `CHANGELOG-PHASE3-5-SLICE-<name>.md` at repo root, with
>   before/after snippets, testing guidance, and revert instructions
> - `PHASE3-5-AUDIT-SLICE-<name>.md` if any deviations from the plan
>   or deferred risks were identified
>
> When done, stop. Do not start the next slice. Do not produce a full
> project zip unless explicitly asked.

---

## Slice 3 — M7 duplicate customer check

**Goal:** Before creating a new customer via the inline quick-create
form, check if a customer with the same phone or email already exists.
Show a "Looks like {name} already exists" inline option instead of
creating a duplicate.

**Files:**
- `src/lib/api/customers.js` — add `findCustomerByContact(userId, {phone, email})` helper (rough shape: normalize the phone via `\D`-strip, lowercase email, `.or('phone.eq.NORM,email.eq.EMAIL').limit(1)`)
- `src/pages/quote-builder-page.jsx` — at L.713 (the current inline quick-create Save handler), call the new helper before `createCustomer`. If a match is found, toast "Using existing contact: {name}" and set that customer_id instead. Otherwise proceed.

**Testing:**
1. Create a customer with phone "(403) 555-0100". Open builder, start to quick-create another with phone "4035550100". Verify the existing customer is found and selected.
2. Case-insensitive email match.
3. Formatting-insensitive phone match (strip non-digits both sides).
4. No phone AND no email supplied → skip the check (can't dedup on name alone, too noisy).

**Prompt body:**

> Slice 3 — M7 duplicate customer check. Scope: `src/lib/api/customers.js`
> (new helper) + `src/pages/quote-builder-page.jsx` (call the helper
> before `createCustomer` in the inline quick-create form around L.713).
> Plan ref: PHASE3-5-PLAN.md §2.12. Keep the scope tight — do not touch
> the surrounding customer picker rendering. Produce the two files + a
> changelog.

---

## Slice 4 — C5 `isNetworkError` helper + autosave retune

**Goal:** A single shared helper for detecting network-shaped errors
(covers offline, DNS fail, Supabase 503, fetch timeout, AbortError).
Rewire autosave from the current 30s interval to an 800ms debounce
flush-on-visibility-change.

**Files:**
- `src/lib/offline.js` — add `isNetworkError(err)` export. Catches TypeError from fetch, "Failed to fetch", "NetworkError", "ERR_INTERNET", 503, 502, 504 status codes if present on `err.status`.
- `src/pages/quote-builder-page.jsx` — replace the autosave `setInterval` (roughly L.499–533) with a debounced save hook. On every save-catch, test `isNetworkError(err)` → fall through to `saveOfflineDraft` from `offline.js`. Flush on `visibilitychange` / `pagehide`.

**Testing:**
1. Supabase returns 503 → toast "Saved offline — will sync when online", quote appears in IndexedDB.
2. DevTools offline mode → same behavior.
3. Back online → existing `syncOfflineDrafts` logic in `offline.js` should kick in (call it from app-shell or similar on reconnect; check if already wired, don't double-wire).
4. Typing stops for 800ms → save fires. Typing continues → save does not fire until 800ms of silence.
5. `visibilitychange`/`pagehide` → save fires even without debounce settle.

**Prompt body:**

> Slice 4 — C5 isNetworkError helper + autosave retune. Scope:
> `src/lib/offline.js` (new export) + `src/pages/quote-builder-page.jsx`
> (replace setInterval autosave with debounced). Plan ref:
> PHASE3-5-PLAN.md §2.9 + B9. Do not touch the offline draft restore
> path that already runs on mount — just the save side. Produce the
> two files + a changelog. Flag in audit if `syncOfflineDrafts` is
> not currently called anywhere (it would need a wire-up in app-shell,
> which should be a separate slice if so).

---

## Slice 5 — H4 client integration

**Goal:** Consume the new `{status, sent_at}` response from the
`/api/send-quote-email` main branch. Update the client-side draft
state to reflect the server's authoritative status instead of
optimistically flipping locally.

**Files:**
- `src/lib/api/quotes.js` — `sendQuoteEmail(quoteId, to)` currently returns the whole JSON. No change needed here, already flexible.
- `src/pages/quote-builder-page.jsx` — in `confirmSend` / `handleSend`, after the email path succeeds, read `response.status` and `response.sent_at` and merge into local state instead of hardcoding `status: 'sent'`.

Alternative path to consider: **leave the client alone, just rely on the server being authoritative on next load.** The client still flashes `status='sent'` via the pre-call `updateQuote`, and if the server disagrees (because the quote was already approved, say), the next page load reconciles. Simpler. Flag this in audit either way.

**Testing:**
1. Send a draft via email → status flips to 'sent', sent_at present.
2. Manually set status to 'approved' in Supabase. Re-send → server holds status at 'approved'. Client should reflect that.
3. Verify the orphaned main branch is now reachable (currently no caller — a UI path that posts to this endpoint needs to exist first. Check dashboard "Quote a job" entry and the builder send flow).

**Prompt body:**

> Slice 5 — H4 client integration. The server now returns
> `{status, sent_at}` after a successful email send (see
> CHANGELOG-PHASE3-5-SLICE-BACKEND.md). This slice wires the UI to
> consume those fields. Scope: `src/pages/quote-builder-page.jsx`
> send path. Plan ref: PHASE3-5-PLAN.md §2.11 client-side portion.
> Also verify whether the main-branch email path is actually reachable
> from any current UI — if not, flag in audit (slice 11 or 7 may be
> the one that adds the email delivery method UI).

---

## Slice 6 — M8 keyboard-safe Send CSS

**Goal:** Stop the mobile keyboard from covering the sticky Send
button on iOS Safari + Chrome Android.

**Files:**
- `src/styles/phase1-builder.css` — add `env(keyboard-inset-height)` to the sticky footer's padding-bottom.
- Optionally a `visualViewport.resize` listener that scrolls focused inputs into view.

**Testing:**
Needs real phone or emulator. Mark in PHASE3-5-TIMING.md as verified.

**Prompt body:**

> Slice 6 — M8 keyboard-safe Send CSS. Pure CSS change to
> `src/styles/phase1-builder.css`. Plan ref: PHASE3-5-PLAN.md §2.13.
> ~20 lines. Produce the CSS diff + a changelog. Note that this can
> only be verified on real mobile — document that in the changelog's
> testing section.

---

## Slice 7 — Send-path rewrite: optimistic + 3s undo + C3 sms: fallback

**Goal:** The big UX win. On Send tap, show a 3-second undo toast. If
not undone, fire the actual send. For `sms:` delivery, after the
native SMS app opens, present a "Did you send it? [Yes, sent] [No, cancel]"
card — only Yes commits `sent_at`.

**Files:**
- `src/components/toast.jsx` — extend to support "undo" toast variant with a cancel button.
- `src/pages/quote-builder-page.jsx` — rewrite `handleSend`/`confirmSend` as optimistic + timer. Add C3 fallback card as a modal after sms: link opens.
- Possibly `src/lib/sms.js` — already has the sms: link open; add a helper that returns a promise that resolves on the confirmation.

**This is the slice where Part A's A3 race condition becomes most exposed.**
The changelog for this slice must re-verify A3 end-to-end:
- Double-tap Send in two tabs → one notification, one SMS, one email. The client-side atomic UPDATE still holds. Verify by hand.
- Do NOT remove any server-side A3 guards.

**Testing:**
1. Tap Send → 3s undo toast appears. Undo in 2s → toast dismisses, quote stays draft.
2. Tap Send → 3s passes → send fires, status flips to 'sent'.
3. sms: path → native SMS opens, confirmation card appears. Tap "Yes, sent" → sent_at commits. Tap "No, cancel" → sent_at does not commit, quote stays where it was.
4. A3 regression: open two tabs, tap Send in both within 500ms → exactly one set of notifications (server-side guard).

**Prompt body:**

> Slice 7 — Send-path rewrite: optimistic + 3s undo + C3 sms: fallback.
> Scope: `src/components/toast.jsx` (undo variant), `src/pages/quote-builder-page.jsx`
> (handleSend/confirmSend rewrite), maybe `src/lib/sms.js`. Plan ref:
> PHASE3-5-PLAN.md §B8 + §2.7 + §2.8. **Critical:** Part A's A3 race
> guard is server-side and must stay in place. Do not add any client-side
> optimistic writes that would bypass the server's `.in(ACTIONABLE_STATUSES)`
> predicate — the Send path writes to 'sent', which doesn't intersect
> with approve/decline/revision actions, so they don't conflict. Produce
> the modified files + a changelog that explicitly re-verifies A3 has not
> been regressed.

---

## Slice 8 — B13 Telemetry

**Goal:** Six events with a shared `session_id` per quote-creation attempt.

**Files:**
- `src/lib/analytics.js` — add the six event helpers.
- `src/pages/quote-builder-page.jsx` — fire them at the right lifecycle points.
- `src/pages/dashboard-page.jsx` — fire `quote_flow_started` on the "Quote a job" click.

**Events:** `quote_flow_started`, `quote_flow_customer_selected`, `quote_flow_description_committed`, `quote_flow_scope_ready`, `quote_flow_sent`, `quote_flow_abandoned` (fired on `pagehide` without send).

**Prompt body:**

> Slice 8 — B13 Telemetry. Scope: `src/lib/analytics.js` (new helpers),
> `src/pages/quote-builder-page.jsx` (fire events at lifecycle points),
> `src/pages/dashboard-page.jsx` (fire `quote_flow_started`). Plan ref:
> PHASE3-5-PLAN.md §B13 + §5.4. All six events must share a `session_id`
> generated on flow start. `quote_flow_abandoned` fires in a `pagehide`
> listener — use `navigator.sendBeacon` if available, fetch keepalive fallback.

---

## Slice 9 — B11 Coachmarks + B12 keyboard shortcuts

Combined because they're both small and both only affect new behavior.

**Files:**
- `src/components/qb-coachmarks.jsx` (new) — three dismissible spotlights, gated on `localStorage.pl_has_sent_quote` flag.
- `src/pages/quote-builder-page.jsx` — mount coachmarks, wire ⌘K / ⌘↵ / Enter-on-last-item / `?` overlay.

**Prompt body:**

> Slice 9 — B11 Coachmarks + B12 keyboard shortcuts. Combined slice.
> New component `src/components/qb-coachmarks.jsx`, wire into
> `src/pages/quote-builder-page.jsx`. Plan ref: PHASE3-5-PLAN.md §B11 + §B12.
> Coachmarks respect `prefers-reduced-motion`. Keyboard shortcuts disabled
> on mobile (no keyboard). Produce both files + a changelog.

---

## Slice 10 — B5 Voice + parallel AI pre-warm

**Goal:** Mic button on the description field using Web Speech API.
AI scope generation pre-warms 600ms after typing stops, held in a ref,
aborts+re-fires on description change.

**Files:**
- `src/pages/quote-builder-page.jsx` — replace existing voice handling (L.363–376ish) with a proper Web Speech wrapper. Add the pre-warm debounce.
- `src/lib/api.js` — verify `requestAiScope` accepts `AbortSignal`; add if missing.
- `api/ai-scope.js` — verify the server handles client abort cleanly.

**Graceful hide:** If `window.SpeechRecognition || window.webkitSpeechRecognition` is falsy, the mic button simply doesn't render. No error toast.

**Prompt body:**

> Slice 10 — B5 Voice + parallel AI pre-warm. Scope:
> `src/pages/quote-builder-page.jsx` (mic button + pre-warm debounce),
> `src/lib/api.js` (AbortSignal plumbing if missing),
> `api/ai-scope.js` (verify clean abort handling). Plan ref:
> PHASE3-5-PLAN.md §B5 + §2.3. The mic button must be ≥64×64 px on
> mobile per the sprint's universal rules. Gracefully hide — not error —
> on unsupported browsers.

---

## Slice 11 — B4 Customer picker UI consuming useCustomers

**Goal:** Rebuild the customer picker rendering (the subtree around
L.700–717 of `quote-builder-page.jsx`) to consume `useCustomers` + `searchCustomers`,
show a last-customer chip first, and make the quick-create inline instead of a ternary mess.

**Files:**
- `src/pages/quote-builder-page.jsx` — replace `customerSearch` filter ternary (L.709–714) with a call to `searchCustomers`. Add last-customer chip as first option. Use `invalidateCustomers()` after createCustomer to keep cache fresh.

**Testing:** Matches the sprint's "≤5 taps from Dashboard for last customer" target.

**Prompt body:**

> Slice 11 — B4 Customer picker UI. Scope: `src/pages/quote-builder-page.jsx`
> customer picker subtree only. Consume `useCustomers` hook +
> `searchCustomers` (already in `src/hooks/use-customers.js`, shipped).
> Add last-customer chip. Call `invalidateCustomers()` after
> `createCustomer` succeeds. Plan ref: PHASE3-5-PLAN.md §B4 + §2.5.
> Do NOT touch the non-customer parts of the page — those belong to
> slice 12. Produce the modified file + a changelog.

---

## Slice 12 — B2/B3 Single-page layout rewrite (the big one)

**Goal:** Collapse the phase machine. Replace
`describe → building → review → sending → sent` with four always-mounted
`<Card>` sections: Customer, Job, Scope, Total. No phase transitions.
Section checkmarks when complete.

**Files:**
- `src/pages/quote-builder-page.jsx` — ~400 net line change.
- Extract into `src/components/qb/customer-section.jsx`, `job-section.jsx`, `scope-section.jsx`, `total-section.jsx`. Orchestrator stays in `quote-builder-page.jsx`.
- `src/styles/phase1-builder.css` — simplify for always-mounted sections.

**This is the slice I recommend doing in local dev, not in a chat.**
A chat session can produce the draft, but without `npm run build` and
without clicking through the actual flow on your Supabase, the risk of
shipping a broken centerpiece is real.

**If you do it in chat anyway:** budget two slices' worth of context
(read every file top-to-bottom once before writing anything), expect
the first pass to have 1–2 subtle bugs, treat the output as a first
draft for local iteration.

**Prompt body:**

> Slice 12 — Single-page layout rewrite. Scope:
> `src/pages/quote-builder-page.jsx` + new files under `src/components/qb/`
> + `src/styles/phase1-builder.css`. Plan ref: PHASE3-5-PLAN.md §B2 + §B3.
> This is the centerpiece rewrite. Before writing code, read the entire
> current `quote-builder-page.jsx` and the relevant portions of the plan.
> Extract four sections into `src/components/qb/{customer,job,scope,total}-section.jsx`.
> Keep the orchestrator in `quote-builder-page.jsx`. Preserve all
> existing behaviors: autosave, send flow, scope generation, offline
> restore, lifecycle transitions. The acceptance bar is that every one
> of this slice's validation items from the sprint prompt passes
> manually + no Phase 2/3 regression. This slice is expected to need
> iteration in a local environment after the draft lands — flag any
> known risks up front in the audit.

---

## Slice 13 — Timing validation

**Cannot be done in a chat session.** Requires:
- A real browser (or emulator) on the machine running the app
- Chrome DevTools device emulation (iPhone SE at 375×667)
- Slow 4G throttle
- 4x CPU throttle
- Clean localStorage (incognito or manually cleared)
- Someone to actually use the UI

**Deliverable:** `PHASE3-5-TIMING.md` with:
- 5 runs, 5 different scenarios (HVAC, plumbing, bathroom reno, emergency callout, revision-as-new)
- Median ≤ 90 seconds per the sprint's definition of done
- Video evidence per the sprint prompt's Deliverable #4

Do this yourself after slice 12 lands. If the median is > 90s, log where
contractors stall in `PHASE3-5-AUDIT.md` and iterate before calling the
sprint done.

---

## End-of-sprint cleanup

After slice 13 passes:
1. Merge all `CHANGELOG-PHASE3-5-SLICE-*.md` into a single `CHANGELOG-PHASE3-5.md` at repo root.
2. Merge all `PHASE3-5-AUDIT-SLICE-*.md` entries into a single `PHASE3-5-AUDIT.md`.
3. Update `README.md` with "Phase 3.5 complete — median quote send time: Ns".
4. Delete the slice-specific changelogs/audits and `PHASE3-5-PROGRESS.md`.

This cleanup is a 10-minute task; don't spend a chat on it.
