# Quote Builder — Suggestion Engine Audit (offline + online)

Deep test of the quote builder's scope-suggestion engine across every trade,
validating coverage, relevance, and pricing honesty against real contractor
knowledge. Run the harnesses with:

```
node tests/quote-suggestion-audit.mjs           # 140 jobs, full per-job report
node tests/quote-suggestion-audit.mjs --fails    # only problem jobs
node tests/online-pipeline-audit.mjs             # 24 AI-path transform checks
```

140 realistic jobs span all 18 trades plus "Other" (trade must be inferred),
including US-region pricing paths and ambiguous / multi-object / low-signal
descriptions. Each job carries `expect` (a contractor-knowledge anchor — at
least one of these must appear) and `avoid` (items that must NOT appear, e.g.
a poly-B repipe must never suggest a urinal flush valve).

## Architecture (how online + offline fit together)

The builder is **offline-first**. `quote-builder-page.jsx` always runs the
deterministic offline engine (`getSmartSuggestions`) first — "instant,
deterministic, always works" — then fires the AI (`/api/ai-scope`) as a
**background, non-blocking enhancement**. If Claude is unconfigured, rate
limited, times out, or returns empty, it's a silent no-op: the contractor
already has a working scope. So the offline engine is the backbone for both
the pure-offline case and the online-but-AI-unavailable case. Hardening it
strengthens both.

Offline engine: `shared/jobContext.js` (object/trade/job-type extraction) →
`shared/smartCatalog.js` (scoring, tiering, pricing) → `shared/tradeBrain.js`
(regional + anchor pricing).

## Findings (before)

15 / 70 jobs produced **zero "core" suggestions**:

1. **10 secondary trades had no taxonomy.** Drywall, Flooring, Concrete,
   Fencing, Windows & Doors, Siding, Garage Doors, Appliance Install,
   Restoration, Handyman fell through to the low-confidence keyword tier, so
   even a direct name match ("Install dishwasher" for a dishwasher job) was
   demoted to a tentative "related to your description" item. A third of trades
   never got a confident suggestion offline.
2. **Per-unit items showed their unit rate as a line total.** A 1,000 sq ft sod
   job read as **$55**; vinyl siding as **$2–$4**; concrete curb as $10–$25.
   Credibility-killing.
3. **Whole-home jobs just missed the core threshold.** Poly-B repipe and
   knob-and-tube rewire detected the right object but their exact-match item
   landed in "related," and the simple-job price ceiling clamped their
   (correctly) $500+ line items down.

## Fixes

- **Taxonomy** (`jobContext.js`): added 9 secondary-trade objects (garage door,
  appliance install, concrete work, siding, window replacement, water damage,
  tv mount, tile work, bathroom reno) plus near-miss synonyms on existing
  objects (sod/lawn, repaint, house repaint, vent stack/boot, dishwasher).
  Added `repipe`/`rewire` to the "replace" job-type pattern.
- **Per-unit honesty** (`smartCatalog.js`): `detectUnit()` tags rate-priced
  items (per sq ft / linear ft / sheet / yard / day, plus a low-ceiling
  heuristic for unmarked area-trade items). The displayed name becomes
  self-explanatory — "Install sod lawn (per sq ft)", "Concrete curb (unit
  price — set qty)" — and a `unit` field + "set quantity" note ride along.
- **Scoring** (`smartCatalog.js`): (a) negative-object penalty now skips
  objects that overlap a chosen object by key (generic "pipe" no longer docks
  the exact poly-B match); (b) +35 bonus when an object synonym matches the
  item NAME (the item the contractor literally means → core); (c) registered
  the big-ticket objects in `MAJOR_OBJECTS`/`COMPLEX_OBJECTS` so the price
  ceiling doesn't demote them; (d) gave the job-level price clamp the full
  trade table so secondary trades no longer inherit Plumber's $300 ceiling
  (a $180–400 garage spring was being scaled to ~$85).

## Results (after, on the expanded 140-job set)

```
140 jobs
  avg core items/job : 2.76
  jobs with 0 core   : 0
  jobs with 0 items  : 0
  expected-miss      : 0      contractor-knowledge anchors all hit
  avoid-violations   : 0      no irrelevant cross-object items
  TOTAL PROBLEM JOBS : 0 / 140
```

## Online-pipeline audit (24 checks, all green)

The live model can't run without an API key, but the *code* that decides
how confident online results are IS testable: truncated-JSON repair, item
normalization, and category classification. The audit caught and fixed
three real online-path bugs:

- **`repairTruncatedJson` was failing on the most common Haiku failure mode**
  (items array complete, trailing gaps/assumptions cut off): a bracket-
  counting bug doubled the closing `]` and returned null. Rewritten to
  walk the array with string-aware depth tracking and cut at the last
  complete object. Truncated mid-object now also returns the salvageable
  items instead of nothing.
- **`normalizeItems` could produce a $1 mid on a $600 item** when the
  model returned `lo > hi` with no separate mid. Now reconciles the
  swap so mid stays inside the range.
- **`classifyItemServer` mislabeled** "Dispatch / diagnostic" as labour
  (the system prompt mandates it as a service) and "Supply & install …"
  as materials. Rewritten with anchored, word-boundary regexes and a
  services-first ordering so the prompt's contract is honoured.

Adversarial probes confirm no over-promotion: vague input ("need some work
done") returns nothing; trade inference is correct; trade-gating prevents
cross-trade pollution (a siding job that mentions "repaint" scores only siding
items).

## Known limitation

The biggest-ticket single line items (e.g. "Pour driveway", "Rebuild after
water damage") are anchor-compressed and can read on the conservative side of
market. This is intentional — the offline engine errs low and the contractor
edits up — and the online AI path returns sharper job-specific pricing when
available. Recalibrating the top-end anchors is a separate, broader pricing
exercise.

## Remaining gaps (caught by the 140-job audit, worth knowing about)

These didn't break confidence (every job hits its anchor and surfaces real
items) but they are honest limitations:

1. **Synonym matching is purely literal substring.** Natural word order
   misses ("remove old wallpaper" doesn't match "remove wallpaper",
   "tree removal" doesn't match "remove a tree", "frozen compressor" needs
   its own synonym separately from "compressor frozen"). I added synonyms
   for every miss the harness found; future ones will appear as
   `expected-miss` failures and need a synonym added too. A proper fix
   would be a token-bag matcher with stemming, but it's a much bigger
   refactor with its own false-positive risk — kept for a follow-up.
2. **The diagnostic fallback returns one item.** When a job has *no*
   detectable object or keyword ("Bathroom is leaking somewhere, not sure
   where") the engine now surfaces the trade's diagnostic/service-call as a
   confident starting point. It does NOT then suggest plausible companions
   without more signal, by design — guessing on no signal is how irrelevant
   items leak into quotes.
3. **Trade inference for `Other` jobs is alias-based.** Strong descriptions
   ("furnace ignitor not working") infer correctly; thin ones ("furnace
   ignitor replacement" while Plumber is selected) keep the contractor's
   selected trade and demote the wrong-trade items to related. That's
   safer than silently switching trade out from under the contractor,
   but it does mean a contractor who picked the wrong trade gets fewer
   core items.
4. **Per-unit items still need a sane default quantity.** The name now
   reads "Install sod lawn (per sq ft)" with a clear "set quantity to the
   job size" note, but the quote builder still defaults qty to 1. A
   follow-up could prompt for the area when a unit-tagged item is added.
