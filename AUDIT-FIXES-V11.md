# v100 UX Phase 11 — Visual audit fixes + text/nudge hardening

Follow-up to the screenshot you flagged ("Edit pill in the title", "two New
quote buttons", "chat bubble overlapping content"). This pass goes after the
*pattern* behind those bugs across every page, not just the screens you saw.

## Fixes applied

### 1. Empty contact buttons — Additional Work detail
**File:** `src/pages/additional-work-detail-page.jsx` lines 1–3, 190–193
Phone and email links rendered as bare `<a></a>` tags with no icon and no
visible text — small empty boxes in the contact row. Added `Phone` and `Mail`
icons, proper aria-labels, and tooltips.

### 2. Email button now pre-populates with template — Quote detail
**File:** `src/pages/quote-detail-page.jsx` lines 218–280, 426–427
The small mail-icon button in the contact row was a bare `mailto:` with no
subject or body. Same with the SMS-icon button (bare `sms:`). Both now
share the SAME template logic as the primary "Text Kristine" button, via two
new helpers:
- `buildTemplatedSmsBody()` — single source of truth for SMS body
- `buildTemplatedEmail()` — builds subject + body for mailto:
- `handleOpenSmsApp()` — opens native SMS app pre-filled
- `handleOpenEmailApp()` — opens native mail client pre-filled

`handleSendText()` was refactored to use `buildTemplatedSmsBody()` so all
three send paths (primary button, sticky bottom bar, contact icon) now
produce identical message bodies. No more "the icon opens an empty email."

### 3. Duplicate "Copy link" — Invoice detail
**File:** `src/pages/invoice-detail-page.jsx` lines 497–516
"Copy link" appeared twice in the Actions panel — once as a small icon next
to "Text invoice", then again as a full-width row right below. Removed the
redundant full-width row. When the customer has no phone (no Text button),
the icon button expands and shows a "Copy link" label so the action is still
discoverable.

### 4. Redundant "New quote" CTA on mobile — Quotes list
**File:** `src/pages/quotes-list-page.jsx` line 275
The PageHeader "New quote" button duplicated the bottom-nav "+" on mobile
(both go to /app/quotes/new). Tagged with `pl-hide-mobile` so it only shows
on desktop, where there's no bottom nav.

### 5. Settings save indicator now visible on mobile
**File:** `src/styles/index.css` (Phase 11 block)
The blanket rule `.topbar-page-actions{display:none}` at ≤640px silently
swallowed the "✓ Saved" / "Saving" pill on Settings. Mobile users edited
fields with no feedback they had saved. Added a `:has()` override that lets
`.settings-save-pill` (and any pill we explicitly tag with
`.pl-allow-mobile`) bleed through.

### 6. Foreman FAB no longer collides with sticky send bars
**File:** `src/styles/index.css` (Phase 11 block)
The default `bottom:136px` cleared the bottom nav (62px) but not a stacked
sticky send-bar (~60px). On quote-detail screens with a send bar, the FAB
sat almost flush against it. Added `:has()` overrides:
- `.app-shell:has(.qd-mobile-send-bar) .fm-trigger { bottom: 200px }`
- `.app-shell:has(.doc-sticky-cta) .fm-trigger { bottom: 200px }`

On phones <380px, the FAB is also shrunk slightly so it doesn't clip
right-aligned section "All →" links.

## Known issues NOT addressed in this pass

- **Two orange floating circles on /app and /app/quotes** (Foreman FAB +
  bottom-nav "+"). Both visible at once — competing for attention. Needs a
  product call: hide Foreman when bottom nav is visible? Recolor it? Move
  it to bottom-left? Out of scope for a pure-fix pass.
- **Outstanding/Overdue/Collected summary on Invoices list** wraps awkwardly
  on narrow phones (<380px). Cosmetic, not breaking.

## Text / nudge error — root cause + fix

You reported hitting an error when texting or nudging a quote. After tracing
every send path I found the most likely cause and three real bugs that turned
a Twilio config issue into a confusing user-facing error.

### Bug 1 — Counter bumped before send was attempted
**File:** `api/send-followup.js` lines 224–263

The endpoint ran `rpc_record_followup_send` (which increments
`followup_count`) BEFORE attempting the actual Twilio/Resend send. If Twilio
was misconfigured or the customer's phone was invalid, every retry burned
another nudge slot toward the per-customer rate limit. After 5 failed sends,
the user couldn't nudge that customer for a week — even though no message
ever went out.

**Fix:** added a pre-flight check (step 3b) that returns 503 / 400 BEFORE
the counter bumps when:
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` env vars
  are missing
- The customer's phone doesn't normalize to `+1XXXXXXXXXX`
- `RESEND_API_KEY` is missing for email path

### Bug 2 — Generic error message buried the real reason
**File:** `src/components/followup-modal.jsx` lines 110–164

The modal showed `setError(data?.error || 'Send failed. Try again.')` for
every non-2xx response. So whether Twilio was misconfigured (502 with
`sendReason: 'not_configured'`), the phone was invalid (502 with
`'invalid_phone'`), or the user's session expired (401), they all produced
the same opaque "Send failed" message.

**Fix:** explicit handling for status codes 401, 429, 502, and now 503 —
each with a specific, actionable message. The 502 path also reconciles
the bumped counter on the client so the UI doesn't fall out of sync.

### Bug 3 — `handleSendText` swallowed errors silently
**File:** `src/pages/quote-detail-page.jsx` lines 174–230

When the API said `{ok: false, reason: 'invalid_phone'}`, the code blindly
opened `sms:` scheme to the bad number anyway, with a misleading
"Opening messages…" toast. The user never saw "your phone number is invalid"
— they just saw a broken native-app handoff.

**Fix:** explicit reason → user-message mapping. For `invalid_phone` the
`sms:` fallback is skipped entirely and the user gets a clear instruction to
fix the number. For `not_configured` / `twilio_error` / `network_error`, the
fallback still runs but the toast tells the truth about what happened.

### What this DOESN'T fix

The actual underlying environment issue — i.e. if Twilio creds aren't set
in your Vercel / production env, you'll now get a clean 503 with
"Text sending is not set up yet" instead of a confusing 502/silent failure.
**Verify these env vars exist in your deployment:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` (E.164, e.g. `+16475551234`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` (for email follow-ups)
- `EMAIL_FROM` (optional, defaults to `notifications@punchlist.ca`)

If you still hit an error after deploying this patch, the new error message
will tell you exactly which env var is missing or which customer's phone is
invalid — much easier to triage.
