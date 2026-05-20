# Punchlist click-through audit

- **Target:** https://punchlist.ca (resolves to https://www.punchlist.ca)
- **User:** test@test.ca (Test Electrical workspace)
- **Viewport:** 1280×800, Chromium headless
- **Routes visited:** 24 (7 public + 14 authenticated + 3 legacy/404)
- **Run dir:** `tests/audit-runs/20260519-235731/`
- **Harness:** `tests/clickthrough-audit.mjs`

## TL;DR — what works
- Login with `test@test.ca / testing1` → lands on `/app` dashboard. Sidebar renders, greeting and quote counters populate.
- All authenticated routes return HTTP 200, render React content, no `pageerror` thrown.
- Legacy redirects work: `/app/contacts` → `/app/customers`, `/app/bookings` → `/app`, `/public/aw/*` → `/`.
- `*` and `/app/no-such` both render the in-app **Page not found** screen with a "Back to home" link.
- Apex `punchlist.ca` 301s to `www.punchlist.ca` cleanly on every route.

## Findings (priority order)

### H1 — `/app/payments/setup` is stuck on the spinner
Page text never moves past **"Checking your payment status…"** (body length 29 chars after 1.5 s settle). Cause: `POST /api/connect-onboarding` returns **401**, and the warning surfaced is just `[payments-onboarding] status 401`. There is no error UI, no retry, no fallback link back to billing — the user sits on a perpetual loader.

Suggested check: `src/pages/payments-onboarding-page.jsx` — when the status fetch comes back 401, surface a "Session expired, log in again" or "Connect Stripe" CTA instead of leaving the spinner up.

Screenshot: `21_payments-setup.png`

### H2 — `/api/activation-email` returns 429 (and is then aborted)
On every authenticated page load we see one `POST https://www.punchlist.ca/api/activation-email` come back **429** and a second one fail with `net::ERR_ABORTED`. That suggests either (a) the client fires it on every navigation/route mount instead of once, or (b) Vercel's rate limit is already hit for this user and we never back off. Either way the console error is visible to anyone with devtools open. Worth gating the call behind a "needs-activation" flag.

### M1 — Landing page has large empty vertical bands
Hero and footer render correctly, but `01_landing.png` shows three big gaps between them (white → black → light grey). Lazy-loaded images / sections never resolved in the audit run; on a slow network the page will look broken for several seconds. Either inline LCP placeholders or render the section background colour with min-height so an unloaded image doesn't leave a blank slab.

Screenshot: `01_landing.png`

### M2 — Customers page summary contradicts itself
Header reads **"0 customers · $422 revenue tracked"** while the body shows the **"No customers yet — Add your first customer"** empty state. Either the revenue number is sourced from invoices whose customer record was deleted, or the count is wrong. Decide which is canonical and reconcile (probably swap the header to `0 customers` only, or show "1 archived customer" if that's the source).

Screenshot: `15_customers.png`

### L1 — Service-worker registration warning
`SW registration failed: SecurityError … An SSL certificate error occurred when fetching the script.` This appeared inside the audit's `ignoreHTTPSErrors` browser context and is **not** a real user-facing bug — it's a sandbox-only artefact. Noted so future audits don't re-flag it.

## Routes checked

| Label | Path | HTTP | Final URL | Notes |
|---|---|---|---|---|
| 01_landing | `/` | 200 | `/` | blank-band issue (M1) |
| 02_login | `/login` | 200 | `/login` | fields & submit work |
| 03_signup | `/signup` | 200 | `/signup` | renders |
| 04_pricing | `/pricing` | 200 | `/pricing` | renders |
| 05_terms | `/terms` | 200 | `/terms` | renders |
| 06_privacy | `/privacy` | 200 | `/privacy` | renders |
| 07_unknown-route | `/this-page-does-not-exist` | 200 | same | NotFound screen ✓ |
| 10_app-dashboard | `/app` | 200 | `/app` | renders, populated |
| 11_quotes-list | `/app/quotes` | 200 | `/app/quotes` | renders |
| 12_quotes-new | `/app/quotes/new` | 200 | same | stepper visible (JOB/BUILD/SCOPE/TERMS) |
| 13_invoices-list | `/app/invoices` | 200 | same | shows 1 invoice |
| 14_invoices-new | `/app/invoices/new` | 200 | same | form renders |
| 15_customers | `/app/customers` | 200 | same | header/body mismatch (M2) |
| 16_schedule | `/app/schedule` | 200 | same | week view with all-empty days |
| 17_analytics | `/app/analytics` | 200 | same | $422 / 50% / 3 quotes |
| 18_templates | `/app/templates` | 200 | same | renders |
| 19_settings | `/app/settings` | 200 | same | profile tab default |
| 20_billing | `/app/billing` | 200 | same | renders |
| 21_payments-setup | `/app/payments/setup` | 200 | same | **stuck spinner (H1)** |
| 22_legacy-contacts | `/app/contacts` | 200 | `/app/customers` | redirect ✓ |
| 23_legacy-bookings | `/app/bookings` | 200 | `/app` | redirect ✓ |
| 24_app-not-found | `/app/no-such` | 200 | same | NotFound screen ✓ |

## Interaction flows

- **Login:** load `/login` → fill email/password → submit → URL becomes `/app`. ✓
- **Dashboard nav clicks:** sidebar links for Quotes, Schedule, Customers, Invoices, Settings all clickable; header **New quote** button navigates to `/app/quotes/new`. ✓
- **Quote builder new:** loads, shows JOB step with "What's the job?" textarea, trade selector (Landscaping default), province (AB default). ✓
- **Settings tabs:** Profile, Payments, Notifications tabs all clickable and swap content. ✓

## Reproduce

```
npm install
npx playwright install chromium
node tests/clickthrough-audit.mjs
```
Optional env: `PL_BASE_URL`, `PL_EMAIL`, `PL_PASSWORD`, `STAMP`.
