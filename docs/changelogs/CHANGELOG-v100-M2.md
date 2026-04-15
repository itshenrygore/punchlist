# v100 Milestone 2 — Workstream A Part 1 (Templates foundation)

**Released:** April 14, 2026
**Shipped as:** `punchlist-v100-m2.zip`
**Predecessor:** `punchlist-v99.1.zip` (Slice 12 iteration)
**Spec:** `PHASE4-V100-PLAN.md` §3.1, §3.2, §3.3, §9.1, §9.3
**Next:** M3 — builder template consumption + follow-up modal

Lays the foundation for the v100 follow-up system: schema for
follow-up event tracking, per-user SMS templates, a Messages tab in
Settings with a Pro-locked editor, and a client-side rendering helper
ready for M3 to consume. **No customer-facing behaviour changes yet** —
the builder still hardcodes its SMS body (that's M3). This session is
strictly the substrate.

---

## 1. Database migration — `supabase/migration_v100_followup.sql`

Forward-only, transaction-wrapped, all statements idempotent.

### 1.1 `quotes` table additions

```sql
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS last_followup_at     timestamptz,
  ADD COLUMN IF NOT EXISTS followup_count       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_since_followup integer DEFAULT 0;
```

Why three columns rather than one JSON blob: the dashboard's "Needs
follow-up" feed (M3 / M4) has to sort and filter on these values, and
JSON-path indexes in Postgres are heavier than plain integer indexes.
Also simpler to reason about in the RPC.

`last_followup_at` is deliberately distinct from the existing
`follow_up_at` column (which is a scheduled date, not an event
timestamp) — see comment in the migration file.

Filtered index for the follow-up dashboard feed:

```sql
CREATE INDEX IF NOT EXISTS idx_quotes_followup_feed
  ON public.quotes (user_id, status, last_followup_at)
  WHERE status IN ('sent', 'viewed');
```

### 1.2 `profiles.followup_cadence_days`

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS followup_cadence_days jsonb
    DEFAULT '{"nudge_1": 2, "nudge_2": 4, "nudge_3": 7}'::jsonb;
```

jsonb rather than three separate columns so future cadence shapes
(e.g. adding a fourth nudge, cooldown windows, do-not-nudge days)
don't need new migrations. Backfilled for existing rows because
`DEFAULT` only applies to new rows.

### 1.3 `public.message_templates`

```sql
CREATE TABLE IF NOT EXISTS public.message_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  locale       text NOT NULL DEFAULT 'en',
  body         text NOT NULL,
  is_custom    boolean NOT NULL DEFAULT false,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_key, locale)
);
```

RLS: `auth.uid() = user_id` on all operations. Seeding is lazy —
users have zero rows until they save a customization; `listTemplates`
synthesizes defaults on read so the UI always has content. This keeps
the table small and means adding a new template key in the future
doesn't require a seed migration.

### 1.4 `record_quote_view` RPC update

The M2 prompt referenced `rpc_register_quote_view`, but the actual
RPC in `schema.sql:935` is `record_quote_view`. Updated it in-place
via `CREATE OR REPLACE FUNCTION` to also bump `views_since_followup`
alongside `view_count`:

**Before:**
```sql
UPDATE public.quotes SET
  view_count      = coalesce(view_count, 0) + 1,
  first_viewed_at = coalesce(first_viewed_at, now()),
  last_viewed_at  = now(),
  status          = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
WHERE id = p_quote_id;
```

**After:**
```sql
UPDATE public.quotes SET
  view_count           = coalesce(view_count, 0) + 1,
  views_since_followup = coalesce(views_since_followup, 0) + 1,
  first_viewed_at      = coalesce(first_viewed_at, now()),
  last_viewed_at       = now(),
  status               = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
WHERE id = p_quote_id;
```

M3's `rpc_record_followup_send` will reset `views_since_followup` to
0 when the contractor fires a nudge, so the value always reads "views
since your last touch" which is the signal the dashboard needs.

---

## 2. Templates API — `src/lib/api/templates.js` (new)

One self-contained module. Exports listed at the top of the file.

### 2.1 Default bodies

All eight defaults from `PHASE4-V100-PLAN.md` §3.2, verbatim. `Object.freeze`
so nothing mutates the singleton. Copy is load-bearing (marketing
psychology review) — do not reword without re-reviewing.

### 2.2 Pro gating

`upsertTemplate` loads the profile's `subscription_plan`, passes it
through `isPro(profile)`, and throws a typed error if false:

```js
function proRequiredError(templateKey) {
  const err = new Error('Customizing templates is a Pro feature.');
  err.code = PRO_REQUIRED_CODE;           // 'PRO_REQUIRED'
  err.templateKey = templateKey;
  return err;
}
```

The Settings UI catches `err.code === PRO_REQUIRED_CODE` and surfaces
the inline upsell anchored to the template the user tried to save.
Non-Pro errors (network, RLS, etc.) still flow through `friendly()`
to the toast channel.

`resetTemplate` is free for everyone (§9.1 — no trap on downgrade).
Implemented as a DELETE rather than a body-overwrite so
`listTemplates` cleanly returns the synthesized default on next read.

### 2.3 `renderTemplate(body, tokens)`

Simple `/\{(\w+)\}/g` substitution. Missing tokens resolve to `''`
(not the literal `{tokenName}`) so a customer never sees a broken
placeholder. Shared by the Settings preview and by M3's builder + modal.

### 2.4 `getFollowupKeyByCount(n)`

Spec-driven tier picker for M3:
- 0 → `initial_sms`
- 1 → `followup_1_sms`
- 2 → `followup_2_sms`
- 3+ → `followup_3_sms`

### 2.5 `t()` i18n wrapper (§9.3)

Pass-through today — `t('initial_sms') === 'initial_sms'`. Keeps the
signature in place so a future FR migration is data, not a refactor.

### 2.6 Barrel export

`src/lib/api/index.js` gets one new line:

```js
export * from './templates.js';
```

All existing `import { ... } from '../lib/api'` paths continue working;
M3 can import `listTemplates`, `renderTemplate`, etc. from the barrel.

---

## 3. `TemplateEditor` component — `src/components/template-editor.jsx` (new)

Stateless-ish editor for one template. Responsibilities per §3.3:

- Textarea bound to `body`, `readOnly` when user is not Pro
- Lock-icon overlay button (top-right) for free users — clicking opens
  the inline upsell (§9.1 — visible but locked, Zeigarnik/endowment)
- Char counter with three tiers: neutral, warning (>160, reads as
  "will send as 2 segments"), danger (>320, "may split into 3+")
- Live preview card below with token substitution using
  `previewTokens` from the parent
- "Reset to default" button — always enabled except when already at
  default (disabled only for visual cleanliness, not to block)
- Per-template inline upsell card that appears after a free user
  clicks the lock — copy is the exact string from the spec:
  *"Customize the wording to sound like you — Pro"*

State kept inside the component: just `showUpsell` (local toggle).
All real state (body, isCustom, busy) is lifted to the Settings page
so multiple editors share one source of truth and the per-key save
debounce in the parent works cleanly.

---

## 4. Settings page — `src/pages/settings-page.jsx`

Four edits, walked through below.

### 4.1 Imports

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
// ...
import { PRICING, isPro } from '../lib/billing';
import {
  listTemplates,
  upsertTemplate,
  resetTemplate,
  TEMPLATE_KEYS,
  PRO_REQUIRED_CODE,
} from '../lib/api/templates';
import TemplateEditor from '../components/template-editor';
```

### 4.2 New state block

Raw profile (needed for `subscription_plan` + `followup_cadence_days`),
the template list, the cadence object, plus per-key UI state:

```jsx
const [profile, setProfile] = useState(null);
const [templates, setTemplates] = useState([]);
const [templatesLoaded, setTemplatesLoaded] = useState(false);
const [cadence, setCadence] = useState({ nudge_1: 2, nudge_2: 4, nudge_3: 7 });
const [cadenceDirty, setCadenceDirty] = useState(false);
const [templateBusyKey, setTemplateBusyKey] = useState(null);
const [templateUpsellKey, setTemplateUpsellKey] = useState(null);
const templateSaveTimers = useRef({});
```

### 4.3 Profile-load effect — additive

Inside the existing `getProfile(user.id).then(p => { ... })`, two new
setters before the existing `loaded = {...}` block:

```jsx
setProfile(p);
const cd = (p.followup_cadence_days && typeof p.followup_cadence_days === 'object')
  ? p.followup_cadence_days
  : { nudge_1: 2, nudge_2: 4, nudge_3: 7 };
setCadence({
  nudge_1: Number(cd.nudge_1 ?? 2),
  nudge_2: Number(cd.nudge_2 ?? 4),
  nudge_3: Number(cd.nudge_3 ?? 7),
});
```

### 4.4 Lazy template load

Templates only fetch when the Messages tab is opened — keeps the
Profile tab's initial paint unchanged:

```jsx
useEffect(() => {
  if (!user) return;
  if (settingsTab !== 'messages') return;
  if (templatesLoaded) return;
  // ...listTemplates, setTemplates, setTemplatesLoaded
}, [user, settingsTab, templatesLoaded]);
```

### 4.5 Handlers

`handleTemplateChange` is the interesting one: it does an optimistic
local update so the preview stays live while the user types, then
debounces the save per-key (800ms) so rapid typing doesn't hammer
the DB. On `PRO_REQUIRED` it opens the inline upsell without throwing
to the toast (since read-only textarea should prevent this path — the
catch is belt-and-suspenders for stale plan state).

`handleTemplateReset` fires the DELETE and re-pulls from the server
so the synthesized default row comes back with `_isDefault: true`.

`saveCadence` writes through `updateProfile({ followup_cadence_days })`
and relies on the existing `updateProfile` retry logic. Free users
get the `__cadence__` upsell card.

### 4.6 Tab bar + new tab body

One new entry in the tabs array:

```jsx
{ id: 'messages', label: 'Messages' },
```

The Messages tab body renders:

1. **Intro panel** — orientation copy; free users also get a small
   "you can preview and reset" reassurance box.
2. **Nudge schedule** — three number inputs for `nudge_1/2/3`,
   read-only on free, with a "Save schedule" button for Pro and a
   🔒 Pro button for free (opens a cadence-specific upsell card).
3. **Token legend** — the full token list as pill chips plus a
   one-line explanation of how empty tokens disappear.
4. **Per-template editors** — map over `TEMPLATE_KEYS` rendering
   `<TemplateEditor />` with the current row, plan state, preview
   tokens, and handlers.

Preview tokens use the sample data spec'd in the M2 prompt:

```jsx
{
  firstName: 'Kristine',
  senderName: profile.company_name || profile.full_name || 'Your Business',
  quoteTitle: '10 Pot Lights on Main Floor',
  total: '$1,596',
  link: 'https://punchlist.ca/q/sample',
  monthlyEstimate: '$133',
  depositAmount: '$200',
  nextStep: 'See you Thursday.',
  scheduledDate: 'Thursday Apr 18',
}
```

---

## 5. Hard-constraint audit

| Constraint | Status |
|------------|--------|
| No changes to `api/stripe-webhook.js` | ✅ untouched |
| No changes to `api/public-quote-action.js` | ✅ untouched |
| No changes to `src/pages/quote-builder-page.jsx` (that's M3) | ✅ untouched |
| No changes to `src/pages/quote-detail-page.jsx` (that's M3) | ✅ untouched |
| No new npm deps | ✅ `package.json` unchanged |
| `prefers-reduced-motion` honoured | ✅ no new motion added |

---

## 6. Known deferrals / caveats

- **Plan column name.** The spec said "check `profiles.plan`" but the
  actual column is `profiles.subscription_plan`, used via the existing
  `isPro()` helper in `src/lib/billing.js`. No new source of plan truth.
- **Template seeding is lazy, not eager.** Zero DB writes happen on
  signup — rows only appear when a Pro user saves a custom body.
  `listTemplates` synthesizes defaults for everyone else. Simpler,
  and means adding a new template key later doesn't need a seed
  migration.
- **`updateProfile` and stale schemas.** If the DB migration hasn't
  been run and a free user flips their cadence, `updateProfile` will
  hit its `_profileBadCols` bail-out path and silently drop
  `followup_cadence_days`. Mitigation: run the migration first (see
  §8 below). Long-term, M3 will log a warning when this path trips.
- **Copy lock.** All eight default bodies are the exact §3.2 strings.
  Any future wording change goes through a psychology review per §3.2.

---

## 7. File changes summary

| File | Change | Notes |
|------|--------|-------|
| `supabase/migration_v100_followup.sql` | New | Forward migration, tx-wrapped |
| `src/lib/api/templates.js` | New | ~220 lines, no deps beyond shared.js + billing.js |
| `src/lib/api/index.js` | +1 line | Barrel re-export |
| `src/components/template-editor.jsx` | New | ~250 lines, stateless except local upsell toggle |
| `src/pages/settings-page.jsx` | +~220 lines | Messages tab body, state, handlers, imports |
| `CHANGELOG-v100-M2.md` | New | This file |

Everything Slice-12-or-earlier (builder, detail page, public pages,
Stripe webhook, existing API modules) is byte-identical to v99.1.

---

## 8. How to run the migration

**Staging first** (per §8 risk table):

```sh
psql "$STAGING_DATABASE_URL" -f supabase/migration_v100_followup.sql
```

Verify:

```sql
\d public.quotes              -- expect new 3 columns
\d public.profiles            -- expect followup_cadence_days
\d public.message_templates   -- expect the new table
SELECT pg_get_functiondef('public.record_quote_view(uuid,text,text)'::regprocedure);
-- expect views_since_followup in the UPDATE list
```

Smoke: visit a public quote page on staging, confirm `view_count`
and `views_since_followup` both increment on the quote row. Confirm
RLS: a second user cannot `SELECT * FROM message_templates WHERE
user_id = 'other-user-id'`.

**Production:**

```sh
psql "$PRODUCTION_DATABASE_URL" -f supabase/migration_v100_followup.sql
```

Migration runs inside a single transaction (`BEGIN ... COMMIT`). If
anything fails the database returns to its prior state.

---

## 9. What M3 picks up

- `listTemplates`, `renderTemplate`, `getFollowupKeyByCount` already
  exported — builder consumes `initial_sms`, follow-up modal consumes
  the tier-picked template.
- `last_followup_at`, `followup_count`, `views_since_followup` columns
  already populated — modal's "Last nudge 3d ago · 2 views since"
  header just reads them.
- New RPC `rpc_record_followup_send` will ship in M3's own migration
  (`migration_v100_followup_rpc.sql`) — it's the write-side of the
  read-side that landed here.
