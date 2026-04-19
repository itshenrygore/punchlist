# Phase 3.5 Slice 10 — Audit

**Slice:** B5 Voice Input Improvements + AI Pre-warm
**Status:** Shipped with one deviation and two deferred risks noted below.

---

## Deviations from plan

### D1 — Pre-warm skips the `wonContext` / `labourRate` enrichment

**Plan implied:** The pre-warm call should mirror the full `handleBuildScope` request, including `wonQuotes` (won-quote context) and `labourRate` (from user profile).

**Shipped:** The pre-warm fires with `{ description, trade, province, country, estimatorRoute: 'balanced' }` only — it omits `wonQuotes` and `labourRate` to avoid the extra `getWonQuoteContext` + `getProfile` round-trips that would negate the latency benefit of pre-warming.

**Impact:** When the pre-warm result is consumed in `handleBuildScope`, the AI had less context than it would have had from a fresh, enriched request. In practice this matters only when the user has meaningful won-quote history or a non-zero default labour rate. The fallback is that `handleBuildScope` detects the description match but issues a fresh request if the description changed (which would include full context). The pre-warm is a best-effort optimisation, not a correctness requirement.

**Mitigation:** If won-context significantly improves scope quality for a given user, `handleBuildScope` continues to issue the enriched request whenever the pre-warm is not available or the description changes.

---

## Deferred risks

### R1 — Pre-warm tokens wasted on aborted requests

When the user edits their description mid-pre-warm, the client-side `AbortController` cancels the fetch. However, Vercel serverless functions do not propagate client disconnects to the AI API call inside `api/ai-scope.js`. The Anthropic API call continues running on the server until completion (typically 10–20s), consuming tokens for a response that is discarded.

**Frequency:** This occurs once per description-edit cycle where the user types ≥ 15 characters, pauses > 600ms, then edits again. In typical usage this is 1–3 times per quote session at most.

**Mitigation options (deferred):**
- Cache the AI response server-side keyed by a hash of `(description, trade, province)` with a short TTL — already discussed in the plan as a future optimisation.
- Accept the token waste for now — the UX improvement (near-zero perceived latency on "Build Quote →") justifies the cost at current usage volumes.

**Action required:** Monitor Anthropic API token usage after deploy. If cost increases unexpectedly, revisit server-side caching.

### R2 — Pre-warm result is stale if `photo` is added after pre-warm fires

The pre-warm call does not include a photo (no `photo: photoBase64`). If the user adds a photo after the pre-warm has already resolved, `handleBuildScope` will consume the photo-less pre-warm result and the photo will not influence the AI scope.

**Detection:** `handleBuildScope` checks `aiPreWarmRef.current.forDescription === description` only — it does not check whether a photo was present at pre-warm time.

**Mitigation (current):** The photo is uploaded to Supabase and referenced in the quote record regardless; the visual enrichment just doesn't influence this particular AI scope call. The user can always tap "Retry AI scope" from the review phase.

**Longer-term fix:** Include a `hasPhoto: !!photo` flag in the pre-warm ref and invalidate the pre-warm when photo state changes. Deferred to a follow-up slice.

---

## Files NOT touched (regression guard)

| File | Status |
|---|---|
| `api/stripe-webhook.js` | Unchanged — diff clean |
| `api/public-quote-action.js` | Unchanged — diff clean |
| `api/ai-scope.js` | Read-only verification — no changes made |
| All prior slice files (1–9) | Not opened |
