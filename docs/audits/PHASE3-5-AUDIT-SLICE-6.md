# Phase 3.5 Slice 6 — Audit

## Plan deviation: wrong file named in PHASE3-5-PLAN.md

**PHASE3-5-PLAN.md §2.13** and the slice prompt in
**PHASE3-5-NEXT-SESSIONS.md §"Slice 6"** both specify
`src/styles/phase1-builder.css` as the target file for the M8 CSS edit.

That file does exist in the repo, but it does **not** contain the
`.rq-footer` rule. A full-repo grep for `position: sticky` and
`position:sticky` across `src/styles/` shows no hits in
`phase1-builder.css`. The Send button footer is actually a
`position: fixed` element with class `.rq-footer`, defined in
`src/styles/index.css` around line 3005, along with its mobile media
query override.

## Decision

Edited `src/styles/index.css` at the actual location of the rule rather
than the file named in the plan. The semantic intent of the plan (add
`env(keyboard-inset-height)` to the Send button's footer padding) is
preserved. The changelog (`CHANGELOG-PHASE3-5-SLICE-6.md`) documents the
actual file edited.

## Secondary note: footer is `position: fixed`, not `position: sticky`

The plan's proposed CSS block:

```css
.qb-sticky-send {
  position: sticky;
  bottom: 0;
  padding-bottom: calc(var(--space-4) + env(keyboard-inset-height, 0px) + env(safe-area-inset-bottom, 0px));
}
```

assumes a sticky footer with class `.qb-sticky-send`. The actual footer
uses class `.rq-footer` with `position: fixed`. The keyboard-safe fix
still works because `env(keyboard-inset-height)` is relative to the
layout viewport regardless of positioning mode — both sticky and fixed
elements benefit from padding that includes the keyboard height.

No code change needed beyond the padding adjustments. If a future
refactor moves the footer to `position: sticky` with a different class,
this edit should be revisited.

## Recommendation for future plan documents

Before citing file paths in a plan, grep the actual repo to verify the
named selector lives where the plan says it does. The discrepancy here
was low-impact, but in a larger edit it could have caused either a
misapplied fix or a longer research cycle.
