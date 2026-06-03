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

## Results (after final pass, on the 364-job stress set)

```
364 jobs   (140 original + 147 commercial/depth + 77 stress/customer-speak)
  avg core items/job : 2.56
  jobs with 0 core   : 2
  jobs with 0 items  : 0
  expected-miss      : 0      contractor-knowledge anchors all hit
  avoid-violations   : 0      no irrelevant cross-object items
  trade-mismatch     : 20     engine flagged wrong-trade selections
  TOTAL PROBLEM JOBS : 2 / 364   (0.55%)
```

The two remaining "problems" are niche Painter jobs (spray-painting a metal barn
roof; refinishing wood beams with stain) where the catalog has no perfectly-named
item — but the engine correctly surfaces 3 relevant Painter items in the related
tier so the contractor sees them and picks what fits. Engine behavior is correct;
filling the last two would mean catalog additions.

## What this final pass added

### Catalog (29 new items)
Cedar shake roof, snow guards, hurricane-rated roof system, radiant heat tile
system, epoxy floor coating, commercial vinyl tile, self-leveling underlayment,
Schluter waterproofing membrane, asbestos abatement (small + large), HVAC whip
and disconnect, pool pump electrical hookup, conduit + feeder for outdoor
equipment, VRF multi-zone indoor head, VRF base setup, zone damper system, RTU
economizer, return air duct, AC capacitor + hard start, commercial kitchen hood
balancing, wall oven install, cooktop install, restaurant build-out, commercial
bathroom partitions, basement development package, garage conversion to living
space, battery storage interconnect (Powerwall / ESS), linoleum sheet flooring.

### Cross-trade mismatch detection
When the contractor selects the wrong trade — e.g. Electrician + "Replace the
water heater" — the engine returns a `tradeMismatch` payload (`{ selected,
suggested, reason }`) instead of silently under-suggesting. The quote builder
surfaces this as a one-tap toast: "Looks like a Plumber job — switch?" → tap
Switch and the trade flips + suggestions refresh.

20 of the 364 test jobs are now correctly handled this way — including
deliberately adversarial cases like Roofing + "Replace bathroom faucet" and
Painter + "Furnace repair". Without this, those would have been silent failures.

### Hyphen normalisation
`hayMatch` + `wordMatch` both treat hyphens as spaces so "open-concept" matches
"open concept" and "low-voltage" matches "low voltage" (contractors hyphenate
inconsistently).

### Direct-object price-ceiling bypass
When an item directly names the chosen object, trust its catalog price even
if it exceeds the simple-job ceiling. A $950 "Install shower tile" no longer
gets demoted on a shower-waterproofing job.

### Single-item promotion
When no item hits the core threshold but exactly one related item directly
matches the object, promote it to core. Catches one-item-in-catalog cases
(TV mount, caulking, asbestos testing) that used to show as tentative.

### 70+ new taxonomy objects
Pot filler, hydro jet, RO water filter, smart switch, pool pump, HVAC whip,
LED retrofit (with fluorescent ballast synonyms), Tesla Powerwall, motion-sensor
switch, AC capacitor, blower motor, evaporator coil, heat exchanger, return air,
zone damper, rooftop unit, economizer, commercial hood, oil-to-gas conversion,
condensate pump, VRF/VRV/Daikin, ice shield (with snow-and-ice belt synonyms),
ridge vent, drip edge, flat TPO/EPDM roof, cedar shake (with hurricane-rated
synonyms), snow guard, standing seam metal, slate roof, roof leak (with
water-marks/ceiling-stain synonyms), roof inspection, hardwood floor (with
polyurethane finish synonyms), radiant heat tile, epoxy floor (with epoxy
quartz / commercial kitchen floor synonyms), VCT, self-leveling underlayment,
Schluter waterproofing, linoleum / sheet vinyl, kitchen reno, basement reno,
garage conversion, restaurant build-out (with yoga studio / fitness buildout
synonyms), commercial washroom, ensuite reno, full home reno, fire damage,
asbestos, door hardware, caulking, plumbing rough-in, electrical rough-in,
HVAC rough-in, electrical inspection.

The expanded set adds depth across every trade — pressure-reducing valves,
hydro-jet drain cleaning, AC capacitor swaps, RTU economizers, snow guards,
TPO membrane repairs, hardwood refinishing, restaurant build-outs, asbestos
abatement, US-region pricing paths, plus deliberately vague / adversarial
inputs ("I need help") that must return nothing.

All 14 remaining problem jobs are **catalog gaps** — specific items the
systemCatalog doesn't carry (cedar shake, snow guard, radiant heat mat,
epoxy floor coating, restaurant build-out, asbestos abatement, etc.). In
these cases the engine correctly identifies the trade and object but
surfaces the closest available trade items as related, which is the right
fallback. Filling these requires catalog work, not engine work.

### Round-two engine improvements (caught by the expansion)

The 287-job audit surfaced several real engine improvements beyond the
earlier 140-job pass:

- **Hyphen-normalisation** in both `hayMatch` and `wordMatch` — contractors
  hyphenate inconsistently and the literal substring used to miss real
  matches over one punctuation char ("open-concept" != "open concept",
  "low-voltage" != "low voltage").
- **Direct-object price-ceiling bypass** — when an item directly names the
  chosen object, trust its catalog price. Previously a $950 "Install shower
  tile" was demoted to related on a shower-waterproofing job because $950
  exceeded the simple-job ceiling. Now the contractor's explicit description
  of the work overrides the ceiling.
- **Single-item promotion** — when no item hits the core threshold but
  exactly one related item directly matches the object, promote it to
  core. Catches "Mount TV on wall", "Caulking — kitchen or bath", and
  similar one-item-in-catalog cases that used to read as tentative
  suggestions instead of confident scopes.
- **40+ new taxonomy objects** for items the original 70-job set missed:
  pot filler, hydro jet, RO water filter, smart switches, pool pump,
  HVAC whip, fluorescent→LED retrofit, AC capacitor, blower motor,
  evaporator coil, heat exchanger, return air, zone damper, rooftop
  unit, economizer, commercial hood, oil-to-gas conversion, ice shield,
  ridge vent, drip edge, flat TPO/EPDM roof, snow guard, hardwood
  floor refinish, radiant heat tile, epoxy floor, kitchen reno, basement
  reno, garage conversion, restaurant build-out, commercial washroom,
  fire damage, asbestos abatement, caulking — and more.

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

## Remaining honest gaps (after the 364-job pass)

1. **Synonym matching is still literal substring** (with hyphen normalisation).
   Natural word order misses are caught by harness `expected-miss` failures
   and need a synonym added. A token-bag matcher with stemming would replace
   this but with its own false-positive risk — kept for a future refactor.
2. **The diagnostic fallback returns one item, by design.** "Bathroom is
   leaking somewhere" surfaces the trade's diagnostic/service-call line as
   a confident starting point. Guessing companions on no signal is how
   irrelevant items leak into quotes.
3. **Trade-mismatch is now flagged via the `tradeMismatch` payload + a
   builder toast** (gap closed) — the contractor sees "Looks like a Plumber
   job — switch?" instead of getting baseboard heaters for a water heater
   replacement. Previously this was a silent failure.
4. **Per-unit items still default qty to 1.** The displayed name reads
   "Install sod lawn (per sq ft)" and the `when_needed` note says "set
   quantity to the job size", but a future improvement could prompt for
   the area when a unit-tagged item is added to the quote.
