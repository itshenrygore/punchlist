# Punchlist — Documentation

This folder holds all product, design, and engineering docs for the
Punchlist codebase. The root `README.md` is intentionally short; the real
history lives here.

## Folders

### [`changelogs/`](./changelogs/)
One file per shipped phase or slice, written at the time of the release.
Each changelog captures what changed, why, and before/after code snippets
where relevant.

**Most recent:** `CHANGELOG-PHASE3-5-SLICE-12.md` — quote-builder visual
layout refresh. Also kept at repo root per the slice contract.

### [`audits/`](./audits/)
Deferred findings, known issues, and post-ship notes per phase. Items here
are explicitly *not* regressions — they are debts knowingly carried into a
future sprint, usually Phase 6 (consistency sweep).

**Most recent:** `PHASE3-5-AUDIT-SLICE-12.md`. Also kept at repo root.

### [`phase-planning/`](./phase-planning/)
Multi-session work plans that don't fit cleanly into a single changelog.
For Phase 3.5 Part B this includes:
- `PHASE3-5-PLAN.md` — the full plan document
- `PHASE3-5-PROGRESS.md` — live status of each slice
- `PHASE3-5-NEXT-SESSIONS.md` — the per-slice prompts used to drive each
  Claude chat session

### Flat files in `docs/`
- [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) — authoritative design tokens,
  primitives, and motion rules. When the code and this doc disagree, the
  code wins, but the divergence should be reconciled.
- [`RESEND-DELIVERABILITY.md`](./RESEND-DELIVERABILITY.md) — email
  deliverability runbook: SPF, DKIM, DMARC, Resend domain setup, bounce
  handling.
- [`README-v80.md`](./README-v80.md) — preserved notes from the v80
  release; useful historical context.

## How to find something

- **"What changed in <slice N>?"** → `changelogs/CHANGELOG-PHASE3-5-SLICE-<N>.md`
- **"What was deferred from <phase N>?"** → `audits/PHASE<N>-AUDIT.md`
- **"What's the plan for Phase 3.5?"** → `phase-planning/PHASE3-5-PLAN.md`
- **"What token is the brand color?"** → `DESIGN-SYSTEM.md` §1–3
- **"Why are emails landing in spam?"** → `RESEND-DELIVERABILITY.md`
