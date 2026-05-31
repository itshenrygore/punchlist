# Quote Builder — Suggestion Engine Audit (offline + online)

Deep test of the quote builder's scope-suggestion engine across every trade,
validating coverage, relevance, and pricing honesty against real contractor
knowledge. Run the harness with:

```
node tests/quote-suggestion-audit.mjs          # full per-job report
node tests/quote-suggestion-audit.mjs --fails   # only problem jobs
```

70 realistic jobs span all 18 trades plus "Other" (trade must be inferred).
Each job carries `expect` (a contractor-knowledge anchor — at least one of
these must appear) and `avoid` (items that must NOT appear, e.g. a poly-B
repipe must never suggest a urinal flush valve).

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

## Results (after)

```
70 jobs
  avg core items/job : 2.74   (was 2.19)
  jobs with 0 core   : 0      (was 15)
  jobs with 0 items  : 0
  expected-miss      : 0      contractor-knowledge anchors all hit
  avoid-violations   : 0      no irrelevant cross-object items
  TOTAL PROBLEM JOBS : 0 / 70 (was 15)
```

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
