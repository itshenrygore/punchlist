# Punchlist

Operator-facing app for trade contractors: quote builder, customer-facing
public quote, dashboard, quotes list, invoices, amendments, payments
onboarding (Stripe Connect).

**Current release:** **v99** — Phase 3.5 Slice 12 draft + 3 concrete bug
fixes (contractor-name SMS fallback, quote-detail layout max-width,
duplicate Saved-indicator). See `CHANGELOG-v99.md` at root.

**Next up:** **v100** — planning doc at `PHASE4-V100-PLAN.md`. Major
workstreams scoped: follow-up & customer messaging system, dashboard
revamp, contractor↔customer flow closures, quoting & review polish.
Awaiting §9 answers before coding starts.

## Quick start

```bash
npm install
npm run dev        # local dev on http://localhost:5173
npm run build      # production build (Vercel output)
npm run test:e2e   # Playwright suite (if configured)
```

Deploy target: **Vercel**. Config is in `vercel.json`.

## Documentation

All product, design, and engineering docs live in `docs/`:

| Path | Contents |
|------|----------|
| [`docs/DESIGN-SYSTEM.md`](./docs/DESIGN-SYSTEM.md) | Authoritative design tokens, primitives, motion rules |
| [`docs/RESEND-DELIVERABILITY.md`](./docs/RESEND-DELIVERABILITY.md) | Email deliverability runbook |
| [`docs/README-v80.md`](./docs/README-v80.md) | Preserved prior-release notes |
| [`docs/changelogs/`](./docs/changelogs/) | Every phase + slice changelog (Phase 0 → Phase 3.5 Slice 12) |
| [`docs/audits/`](./docs/audits/) | Deferrals, known issues, per-phase audit reports |
| [`docs/phase-planning/`](./docs/phase-planning/) | Plan, progress tracker, next-session prompts for Phase 3.5 |

### Root-level docs (most recent release + planning)

- [`CHANGELOG-v99.md`](./CHANGELOG-v99.md) — this release (Slice 12 draft + 3 fixes)
- [`CHANGELOG-PHASE3-5-SLICE-12.md`](./CHANGELOG-PHASE3-5-SLICE-12.md) — Slice 12 draft details
- [`PHASE3-5-AUDIT-SLICE-12.md`](./PHASE3-5-AUDIT-SLICE-12.md) — Slice 12 deferrals & Session 2 items
- [`PHASE4-V100-PLAN.md`](./PHASE4-V100-PLAN.md) — next major push: follow-up system, dashboard revamp, flow closures

All four are duplicated/linked from `docs/` as well for historical grouping.

## Phase roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Foundation — tokens, fonts, motion, primitives | ✅ Shipped |
| 1 | Quote Builder | ✅ Shipped |
| 2 | Public Quote / Customer View | ✅ Shipped |
| 3 | Dashboard + Quotes List | ✅ Shipped |
| 3.5 Part A | Correctness patches (webhook, idempotency, atomic status) | ✅ Shipped |
| 3.5 Part B | Quote builder UX rewrite (Slices 1–12) | 🟡 Slice 12 draft — Session 2 browser iteration pending |
| 4 | Quote Detail + Invoice Detail + Amendment | Pending |
| 5 | Settings + Contacts + Bookings + Analytics + Payments Onboarding | Pending |
| 6 | Consistency sweep + device-matrix QA + audit fixes | Pending |

## Repo layout

```
.
├── api/                     Vercel serverless functions
│                            (Stripe, Resend, Twilio, Supabase webhooks)
├── deploy-scripts/          Pre-deploy checks and smoke tests
├── docs/                    Design system, audits, changelogs, phase plans
│   ├── audits/
│   ├── changelogs/
│   └── phase-planning/
├── public/                  Static assets (favicon, manifest, service worker)
├── shared/                  Shared business logic
│                            (catalog, trade brain, scope detection)
├── src/
│   ├── app/                 App shell routing
│   ├── components/          UI components (primitives in ./ui/)
│   ├── contexts/            React context providers
│   ├── hooks/               Custom hooks
│   ├── lib/                 API clients, formatters, pricing, offline cache
│   ├── pages/               Route components
│   └── styles/              Global CSS (tokens, index, landing, phase-specific)
├── supabase/                SQL migrations and schema
├── CHANGELOG-PHASE3-5-SLICE-12.md   ← most recent changelog (Slice 12)
├── PHASE3-5-AUDIT-SLICE-12.md       ← most recent audit
├── README.md
├── package.json
├── vercel.json
└── vite.config.js
```

## Deployment to Vercel

1. Push the repo to Git (GitHub / GitLab / Bitbucket).
2. Import the project on Vercel. It will auto-detect Vite from
   `vite.config.js` and `package.json`.
3. Required environment variables (set in Vercel → Project → Settings →
   Environment Variables — see `api/` source for the full list used
   server-side):
   - Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
     `VITE_STRIPE_PUBLISHABLE_KEY`
   - Resend: `RESEND_API_KEY`
   - Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
     `TWILIO_MESSAGING_SERVICE_SID`
   - Push: `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   - AI: `OPENAI_API_KEY` (or equivalent provider key used in
     `api/ai-assist.js` / `api/ai-scope.js`)
4. After the first successful deploy, run the SQL migrations in
   `supabase/` in order (start from `schema.sql`, then the timestamped
   `migration_*.sql` files and the `lifecycle_migration_*.sql` set).
5. Configure the Stripe webhook endpoint to point at
   `https://<your-vercel-domain>/api/stripe-webhook` and paste the
   signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Run the smoke test suite in `deploy-scripts/smoke-test.sh` against the
   deployed URL before announcing the release.
