# Punchlist v100 — Release Notes

**Released:** April 14, 2026
**Version:** `1.0.0` (see "Version number" note below)
**Shipped as:** `punchlist-v100.zip`
**Predecessor:** `punchlist-v99.1.zip`
**Milestones consolidated:** M2 → M3 → M4 → M5 → M6 → M6.5 → M7

v100 is the first release where the quoting flow feels finished end-to-end:
you can send a quote, nudge a customer who's gone quiet, see the three things
that actually matter on your dashboard, and have a branded receipt hit your
customer's phone the second their deposit clears — without ever writing the
same text twice.

---

## The three biggest wins

### 1. Follow up on quotes without typing the same text every time

Every contractor we watched typed "hey just checking in on that quote" by
hand, over and over, with slight variations, often at 9pm on a Tuesday.
v100 ends that. You write your nudge wording once in **Settings → Messages**
(or keep the defaults — they were written with a behavioural-psych lens and
tested for response rate), and every send pulls from your saved templates.
The quote detail page now has a proper **Nudge** button that pre-fills the
right tier (nudge 1 / 2 / 3) based on how many you've already sent, shows
how many days since the last one, and tells you whether the customer has
looked at the quote since. Rate-limited so you can't accidentally blast the
same customer twice.

### 2. Dashboard rebuilt around the three questions you ask every morning

The old dashboard was 59KB of cards you never looked at. The new one is
built around one rule: **every card answers a question a real contractor
asks out loud**. "What needs attention today?" "What's scheduled this week?"
"What money came in?" Everything else is gone. On a 13" laptop, 10–20 open
quotes now fit on one screen without scrolling. Faster too — a single
`dashboard_bundle` RPC replaces 7 separate queries, p95 under 200ms even
with 100 quotes. If you miss the old one, "Classic view" is one click away
in the sidebar for 30 days.

### 3. Customers get a branded receipt the moment their deposit lands

The Stripe email that used to land in their inbox said *"Receipt from ACH
Processing"* with your customer's bank statement descriptor. Now, within
seconds of a deposit clearing, your customer gets an SMS from **you** —
using your saved `deposit_received_sms` template, rendered with their name
and the amount. Shipped via a Supabase database webhook so the Stripe
webhook handler itself stays untouched (zero risk to payments).

---

## Everything else, by workstream

### Workstream A — Follow-ups & messaging (M2 + M3)

- **Schema foundation (M2):** Three new columns on `quotes`
  (`last_followup_at`, `followup_count`, `views_since_followup`), a jsonb
  `followup_cadence_days` on `profiles` (defaults: 2 / 4 / 7 days), and a
  new `message_templates` table with RLS. Lazy-seeded — users start with
  zero rows and `listTemplates()` synthesizes defaults on read.
- **8 system default templates (M2):** `initial_sms`, `followup_1`,
  `followup_2`, `followup_3`, `deposit_received_sms`, `invoice_sent_sms`,
  `scheduled_reminder_sms`, `thank_you_sms`. Copy is load-bearing — see
  M2 changelog for the specific wording and the psych rationale.
- **Messages tab in Settings (M2):** Per-template editor with live preview
  against a sample customer, char counter (warns at 160, hard at 320),
  reset-to-default per template, Pro-gated customization with a free-plan
  lock overlay. Cadence editor at the top.
- **Quote builder consumes `initial_sms` (M3):** The hardcoded SMS literal
  in `proceedToSend()` is replaced by `renderTemplate()`. Template is
  fetched at mount; system default is used if the fetch fails.
- **Follow-up modal (M3):** `src/components/followup-modal.jsx`. Shows the
  last-nudge context with colour coding (green / amber / red by age),
  pre-fills the right tier, lets the contractor edit before sending.
  Framed as **"Nudge"** everywhere in the UI per the §9.2 copy decision.
- **`/api/send-followup` (M3):** Validates ownership, renders server-side,
  sends via Twilio or Resend, and wraps counter bumps in a new
  `rpc_record_followup_send` RPC so retries don't double-count. Rate-limited
  to 5 per customer per rolling week.

### Workstream B — Dashboard (M4 + M6.5)

- **`dashboard_bundle` RPC (M4):** Single server round-trip returns
  `today_actions`, `pipeline_counts`, `week_scheduled`, revenue rollups,
  `headline_metric`, and `insights`. p95 < 200ms at 100 quotes with the
  new filtered indexes.
- **Five-row layout (M4):** Greeting + headline stat → Today action list →
  Collapsed pipeline bar → Scheduled/Revenue pair → Conditional insights.
- **Persistent dismiss (M4):** `dismissed_dashboard_items` table replaces
  the old localStorage dismiss, so the dashboard behaves the same across
  devices.
- **Classic view escape hatch (M4):** `profiles.dashboard_version` column;
  sidebar link flips it back to v1 and fires `telemetry.track('dashboard_downgrade')`.
  v1 file preserved as `dashboard-page-v1.jsx`. 30-day escape window.
- **Craft pass (M6.5):** Three components extracted
  (`action-list-row`, `headline-stat`, `empty-state`), typography &
  numeric hierarchy tightened, CSS rewritten (751 → 973 lines of
  scoped tokens — no bleed into `index.css`), density rhythm and
  motion tuned. Zero structural change — M6.5 is a feel pass.

### Workstream C — Flow closures (M5)

Seven closures, lowest-risk first:

1. **Lifecycle progress strip** on quote detail: Sent → Viewed → Approved
   → Scheduled → Complete → Paid, current state glows.
2. **Auto-send invoice on complete** — new `auto_send_invoice_on_complete`
   preference, default `true`. Toggle in Settings → Preferences.
3. **Approval → schedule gap closure** — Schedule promoted to primary CTA
   in the phase banner; booking modal pre-fills customer preferred day/time
   from approval.
4. **Quote send completion feedback** — after SMS send, contractor sees a
   preview card of what went out (body + phone + timestamp).
5. **Decline / question contextual actions** — `declined` quotes show
   inline "Offer revised quote / Archive" actions; `question_asked` focuses
   the reply textarea with an AI-drafted response if the key is configured.
6. **Message read receipts** — new public endpoint `api/mark-messages-read.js`
   (token-auth, not session). Contractor bubbles show "Read 5m ago".
7. **Deposit receipt SMS** — shipped via Supabase DB webhook on the
   `quotes.deposit_status → 'paid'` transition. **Zero edits to
   `api/stripe-webhook.js`**. See M5 changelog for the path decision.

### Workstream D — Quoting & review flow (M6)

- **Undo last item add** — 5-second undo toast after AI scope populates the
  builder. Restores the exact pre-AI line-item snapshot.
- **Autosave timestamp** — "Saved Ns ago" next to Save, updates every 30s.
- **@dnd-kit evaluation** — deferred to v101 per the comparison in the M6
  changelog. HTML5 drag stays for now.
- **Public quote mobile polish** — sticky Approve bar at the bottom;
  financing tile moved above the fold on mobile.
- **One-tap "Request changes"** — structured `amendment_request` submission
  from the public page (new additive branch in `public-quote-action.js`;
  existing branches untouched).
- **Amendment flow merged into the main timeline** — new
  `src/components/amendment-diff.jsx` renders original + amendment as one
  document with added lines in green and removed lines struck through in red.
  `public-amendment-page.jsx` rewritten to use it.

### QA harness (M7)

- **Playwright visual regression:** 140-snapshot sweep across 5 viewports
  (375, 393, 768, 1280, 2560) × light/dark on 28 routes. Specs under
  `tests/v100-visual.spec.ts`.
- **Performance benchmark:** `tests/v100-perf.spec.ts` fails if the
  `dashboard_bundle` RPC p95 exceeds 200ms.
- **Accessibility sweep:** `tests/v100-a11y.spec.ts` — axe WCAG 2.1 AA
  across the route manifest.
- **Smoke test refresh:** `deploy-scripts/smoke-test.sh` §13/§14/§15 added
  for `/api/send-followup`, `/api/mark-messages-read`, and dashboard bundle.
- **Scroll-trap fix:** `index.css:681` cleaned up — the combination of
  `-webkit-overflow-scrolling: touch` + `overscroll-behavior-y: contain`
  was confirmed as the desktop trap source. Mobile behaviour preserved
  with a `@media (hover: none)` scope.
- **QA report:** `V100-QA-REPORT.md` at repo root.

---

## Database migrations shipped

Run in order; all forward-only, all idempotent:

1. `supabase/migration_v100_followup.sql` (M2) — quotes/profiles columns,
   `message_templates` table, filtered feed index.
2. `supabase/migration_v100_followup_rpc.sql` (M3) —
   `rpc_record_followup_send`, `rpc_register_quote_view` update.
3. `supabase/migration_v100_dashboard.sql` (M4) — `dashboard_version`
   column, `dismissed_dashboard_items` table.
4. `supabase/function_dashboard_bundle.sql` (M4) — the bundle RPC.
5. `supabase/migration_v100_deposit_receipt_webhook.sql` (M5) — DB
   webhook registration for the deposit receipt SMS path.

---

## Version number

`package.json` is bumped from `3.0.0` to **`1.0.0`**. This is deliberate,
per the M8 plan and the §9 decision record: v100 is the first release
where the app is end-to-end complete in the sense we'd want a new user to
experience, so it gets the 1.0.0 marker. The `v99/v100/v101` milestone
numbering stays as the internal shipping cadence; semver restarts at 1.0.0
to reflect external positioning.

(If you ship tooling that enforces monotonic semver, add a `.npmrc`
override or a post-install note. The repo's consumers so far are all
internal so this doesn't break anyone.)

---

## Constraints honoured across all seven milestones

- `api/stripe-webhook.js` — **untouched** (deposit receipt via DB webhook).
- `api/public-quote-action.js` — **append-only**; existing status
  transition branches are byte-identical to v99.
- No new npm runtime dependencies. Only devDep added: `axe-core` (M7).
- `prefers-reduced-motion` honoured on every new animation (lifecycle
  strip glow, undo toast, confetti, dashboard motion).
- Existing class names, state shapes, and handler signatures preserved.

---

## Post-release watch list

1. **Dashboard opt-out rate** (§9.4 threshold): monitor the
   `dashboard_downgrade` telemetry event. If sustained daily opt-out rate
   exceeds 15% across a 7-day rolling window, revisit v2 defaults.
2. **Dashboard `dashboard_bundle` p95** — alert if it drifts above 200ms.
3. **First-week follow-up send rate** — expect a lift vs the v99 baseline
   (contractors who never sent a manual follow-up now have a one-click
   path). Baseline the week of April 7–14 against the week of April 21–28.
4. **Deposit receipt SMS delivery rate** — Twilio delivery confirmations on
   the new DB-webhook path. First bad bounce investigate immediately.

---

## Per-milestone changelogs

The seven per-milestone changelogs are archived in `docs/changelogs/` for depth:

- `docs/changelogs/CHANGELOG-v100-M2.md` — Templates foundation
- `docs/changelogs/CHANGELOG-v100-M3.md` — Template consumption + follow-up modal
- `docs/changelogs/CHANGELOG-v100-M4.md` — Dashboard revamp
- `docs/changelogs/CHANGELOG-v100-M5.md` — Flow closures (×7)
- `docs/changelogs/CHANGELOG-v100-M6.md` — Quoting & review flow
- `docs/changelogs/CHANGELOG-v100-M6.5.md` — Dashboard craft pass
- `docs/changelogs/CHANGELOG-v100-M7.md` — QA harness

For the v99 baseline see `docs/changelogs/CHANGELOG-v99.md`.
