# CHANGELOG — v100 UX Elevation, Phase 8

**Voice & copy pass.**
Canon: the 8 system-default SMS templates in `src/lib/api/templates.js:31-85`
+ `TEMPLATE_HINTS` at 76-85 (UX-043).

Reference: `docs/VOICE-GUIDE.md` (new, this phase).

---

## Summary

- 1 new file: `docs/VOICE-GUIDE.md` — the six principles, patterns, and a
  quick-reference card, built against the SMS template canon.
- 21 copy rewrites across 12 files. No behavior changes.
- 1 em-dash substitute (`--`) eliminated; repo is now clean on that.
- `friendly()` error helpers in `src/lib/api/shared.js` and `src/lib/format.js`
  voice-aligned at the source — every toast that routes through them inherits
  the fix.
- Random-sample audit run against the rewritten tree; 3 voice fractures caught
  in flight and fixed.

---

## Findings resolved

| ID      | Title                                                                     | Resolution |
|---------|---------------------------------------------------------------------------|------------|
| UX-016  | Settings toast copy inconsistent — voice fracture                         | 6 toasts rewritten; `friendly()` helper aligned at the source so downstream callers inherit the voice |
| UX-029  | ActionSheet placeholder filler — "the more detail the better…"            | Rewritten per plan: "A couple of lines is plenty — pricing, materials, scope, whatever's on your mind." |
| UX-030  | Dashboard "New quote" Row-1 button warmth                                 | Kept terse per the suggested_fix ("personality lives elsewhere"); no change, documented here for completeness |
| UX-041  | public-amendment raw error leak (Phase 1)                                 | Pattern extended to `public-invoice-page.jsx` (`data.error` leak + "Payment error — please try again" rewrite) and `public-quote-view.jsx` / `project-portal-page.jsx` payment errors |
| UX-048  | SMS cost disclosure (Phase 1)                                             | Verified the Phase-1 rewrite still matches the voice guide — no change needed |
| UX-052  | Double-hyphen `--` in Settings About panel                                | Fixed; final repo-wide sweep confirms zero `' -- '` occurrences |

Findings noted as strengths (UX-043, UX-051, UX-054) are preserved and used
as canon in `VOICE-GUIDE.md`.

---

## Before / after — every rewrite

### Voice guide

- **NEW:** `docs/VOICE-GUIDE.md` — six principles (active voice; specific
  nouns/numbers; calm authority; no SaaS jargon; psychology-aware phrasing;
  em-dash is `—`), patterns (reflective summaries, first-person warmth on
  sender-facing, errors friendly-over-technical, empty-state pattern),
  quick-reference card, and a "did one person write this" test procedure.

### `src/lib/api/shared.js` — `friendly()` helper

The central error-normalizer. Every `showToast(friendly(e), ...)` call in
the app now reads as one voice.

| Before                                                    | After                                                                 |
|-----------------------------------------------------------|-----------------------------------------------------------------------|
| Record not found. It may have been deleted.               | Couldn't find that record — it may have been deleted.                 |
| This record already exists.                               | That record already exists.                                           |
| A linked record is missing. Try refreshing.               | A linked record is missing. Refresh and try again.                    |
| Your session expired. Please sign in again.               | Your session expired — sign in again.                                 |
| Connection issue. Check your internet and try again.      | Couldn't reach the server. Check your connection and try again.       |
| Too many requests. Wait a moment and try again.           | Too many requests in a row. Wait a moment and try again.              |
| Database update needed. Contact hello@punchlist.ca.       | Database update needed. Email hello@punchlist.ca.                     |
| Something went wrong. Please try again.                   | Something broke on our end. Try again in a moment.                    |

### `src/lib/format.js` — `friendly()` fallback

| Before              | After                          |
|---------------------|--------------------------------|
| Something went wrong | Something broke on our end.   |

### `src/pages/settings-page.jsx` — UX-016 cluster + UX-052

| Line  | Before                                                                        | After                                                                       |
|-------|-------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| 401   | Payment setup isn't finished yet. Go to Settings to complete it.              | Stripe setup isn't finished. Pick it back up below.                         |
| 421   | Could not start Stripe setup. Please try again or contact support.            | Couldn't start Stripe setup. Try again in a moment.                         |
| 422   | Connection error                                                              | Couldn't reach Stripe. Try again in a moment.                               |
| 436   | Could not open Stripe Dashboard. Your account may still be setting up.        | Couldn't open the Stripe dashboard. Your account may still be setting up.   |
| 437   | Could not connect to Stripe. Please try again.                                | Couldn't reach Stripe. Try again in a moment.                               |
| 443   | Your name is required                                                         | Your name can't be blank                                                    |
| 454   | 8+ characters required                                                        | Password needs 8+ characters                                                |
| 494   | No invoices to export                                                         | Nothing to export yet — send an invoice first.                              |
| 1282  | Built for speed, clarity, and customer trust `--` not to replace your accounting software. | Built for speed, clarity, and customer trust `—` not to replace your accounting software. |

### `src/components/public-quote-view.jsx` — UX-029 + UX-041 + tooltip cleanup

| Line  | Before                                                                       | After                                                                             |
|-------|------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| 91    | Describe what you'd like changed — the more detail the better…              | A couple of lines is plenty — pricing, materials, scope, whatever's on your mind. |
| 212   | (fallback) Could not start payment                                           | Couldn't start payment. Try again, or contact your contractor.                    |
| 213   | Payment error — please try again                                             | Couldn't reach the payment processor. Try again in a moment.                      |
| 651   | Please accept the terms & conditions first                                   | Tick the terms box to continue                                                    |
| 865   | Please accept the terms & conditions first                                   | Tick the terms box to continue                                                    |

### `src/pages/public-invoice-page.jsx` — UX-041 extension

| Line | Before                                          | After                                                              |
|------|-------------------------------------------------|--------------------------------------------------------------------|
| 34   | `data.error` \|\| 'Could not start payment'     | Couldn't start payment. Try again, or contact your contractor.     |
| 35   | Payment error — please try again                | Couldn't reach the payment processor. Try again in a moment.       |

Removes the raw `data.error` passthrough from server responses — same
protection Phase 1 added for public-amendment.

### `src/pages/project-portal-page.jsx` — UX-043 port + payment error

| Line   | Before                                                          | After                                                             |
|--------|------------------------------------------------------------------|-------------------------------------------------------------------|
| 152    | No updates yet                                                   | Nothing's changed — yet                                           |
| 153    | Amendments and additional work requests will appear here.        | Scope changes and extra work show up here when they come in.     |
| 381    | `data.error` \|\| 'Could not start payment'                      | Couldn't start payment. Try again, or contact your contractor.    |
| 382    | Payment error — please try again                                 | Couldn't reach the payment processor. Try again in a moment.      |

### `src/pages/signup-page.jsx`

| Line | Before                                            | After                                                        |
|------|---------------------------------------------------|--------------------------------------------------------------|
| 30   | Your name is required                             | Your name can't be blank                                     |
| 89   | Something went wrong. Please try again.           | Couldn't create your account. Try again in a moment.         |

### `src/pages/contacts-page.jsx`

| Line | Before                                                          | After                                                             |
|------|-----------------------------------------------------------------|-------------------------------------------------------------------|
| 153  | Name is required                                                | Name can't be blank                                               |
| 154  | Phone number is required — quotes are sent via text             | Add a phone number — that's how quotes get sent.                  |

### `src/pages/quote-builder-page.jsx`

| Line | Before                    | After                                                      |
|------|---------------------------|------------------------------------------------------------|
| 846  | Phone number is required  | Add a phone number — that's how the quote gets sent.       |

### `src/pages/quote-detail-page.jsx`

| Line     | Before              | After                                                               |
|----------|---------------------|---------------------------------------------------------------------|
| 157, 201 | No share link       | This quote doesn't have a share link yet — save it first.           |
| 159      | No phone on file    | No phone on file for this customer.                                 |

### `src/pages/login-page.jsx`

| Line | Before                                                                                                     | After                                                                                                       |
|------|------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| 38   | Please confirm your email first — check your inbox for the confirmation link, or contact support if you never received it. | Confirm your email first — check your inbox for the link, or email hello@punchlist.ca if you never got one. |

### `src/pages/payments-onboarding-page.jsx`

| Line | Before                                          | After                                                         |
|------|-------------------------------------------------|---------------------------------------------------------------|
| 880  | Something went wrong. Try again.                | Something broke on our end. Try again in a moment.            |

### `src/lib/api/quotes.js`

| Line | Before                                                          | After                                                                |
|------|-----------------------------------------------------------------|----------------------------------------------------------------------|
| 220  | Quote saved but items failed to save. Please try saving again.  | Quote saved, but the line items didn't. Save again to sync them.     |

### `src/lib/api/additional-work.js`

| Line | Before                                                       | After                                                                 |
|------|--------------------------------------------------------------|-----------------------------------------------------------------------|
| 143  | Request saved but items may be duplicated. Please refresh.   | Request saved, but some items may have duplicated. Refresh to check.  |

---

## Intentionally left alone

- **`src/components/error-boundary.jsx:46-52`** — the "Something went wrong"
  headline paired with "Punchlist hit an unexpected error. Your data is safe."
  is exactly the calm-authority + concrete-reassurance pattern the voice guide
  calls for. The word "Sorry" is absent, the data-safety promise is specific.
  Kept.
- **`src/components/public-quote-view.jsx:469, 482`** — "A deposit of X is
  required to get started" is customer-facing informational, not a validation
  error. Passive voice is load-bearing here — the requirement isn't the
  customer's fault, and rewriting as active voice ("You need a deposit to
  get started") would subtly shift blame. Kept.
- **Dashboard Row-1 "New quote" button** (UX-030) — per the finding's
  suggested_fix, this stays terse; the warmth lives in downstream copy like
  the empty state and the send flow. No change.

---

## Random-sample audit — the "did one person write this" test

Method: pulled all string-literal user-facing strings from `src/pages/*.jsx`
(excluding placeholders that are just field labels like "Email" or "City"),
shuffled with a fixed seed (`random.seed(20260414)`), took the first 10
unique strings after de-dup.

Results below are AFTER the rewrite pass, so this is a regression check as
much as an audit.

```
 1. [quote-detail-page.jsx]  Job marked complete
 2. [quote-detail-page.jsx]  Deposit marked paid
 3. [contacts-page.jsx]      Phone number is required — quotes are sent via text          ← VIOLATION caught
 4. [quote-detail-page.jsx]  No share link                                                 ← VIOLATION caught
 5. [login-page.jsx]         Enter your email first, then click Forgot password
 6. [quote-detail-page.jsx]  Invoice created
 7. [contacts-page.jsx]      Contact created
 8. [quote-builder-page.jsx] Describe the job first
 9. [settings-page.jsx]      Password needs 8+ characters
10. [signup-page.jsx]        Your name is required                                         ← VIOLATION caught
```

**Verdict: 7 pass / 3 fail.** The 3 failures were all variants of the same
bureaucratic pattern ("X is required" / cryptic-stub) that survived my first
pass. All 3 are fixed above.

Re-reading the 10 in order after fix:

1. Job marked complete
2. Deposit marked paid
3. Add a phone number — that's how quotes get sent.
4. This quote doesn't have a share link yet — save it first.
5. Enter your email first, then click Forgot password
6. Invoice created
7. Contact created
8. Describe the job first
9. Password needs 8+ characters
10. Your name can't be blank

Reads as one voice: calm, direct, specific, active. Occasional em-dashes do
work. No "Please." No apologies. Success-state toasts are terse because they
don't need to be longer; error/validation toasts name the object. ✅

---

## New findings logged for future phases

None. The copy sweep surfaced no new systemic issues beyond what the original
audit already catalogued. Minor follow-ups (e.g. whether public-quote-view's
informational "deposit is required" should shift voice in a later deposit-UX
pass) are design calls, not copy violations, and belong to whichever phase
revisits the payment flow.

---

## Acceptance checklist

- [x] `docs/VOICE-GUIDE.md` committed
- [x] Every Phase 8 finding resolved (or explicitly deferred with rationale)
- [x] No `' -- '` em-dash substitutes remain (verified by grep)
- [x] 10-string random-sample audit run and documented (3 violations caught + fixed)
- [x] `friendly()` error helper aligned at the source so downstream surfaces inherit
- [x] No new copy findings logged (none found)
- [x] No behavior changes — copy-only pass
