# Punchlist v80 — QA Tightened

Production-quality pass over the entire codebase. No new features — every fix
targets friction, race conditions, dead code, and UX gaps found during a
line-by-line audit of 33k+ lines across 80+ files.

## What changed (23 fixes)

### Critical bugs
- **Expired quote resend bug**: Resending an expired quote preserved the old
  (expired) `expires_at` date instead of computing a fresh one. Customers saw
  an already-expired quote. Now refreshes expiry on every send/resend.
- **Overdue invoices linked to wrong page**: Dashboard "overdue" attention card
  linked to `/app/quotes` instead of `/app/invoices`. Fixed.
- **First-run guide never disappeared**: `pl_has_sent_quote` flag wasn't set in
  `confirmSend`, so the "Almost there" banner persisted after the first send.
- **Login indentation merge artifact**: `handleSubmit` had misaligned braces
  from a prior merge.

### Performance / network
- **Duplicate Supabase fetches eliminated**: `createBooking` fetched the
  contractor profile twice (once for email, once for SMS). Consolidated to one.
- **Invoice receipt double customer fetch**: `sendPaymentReceiptEmail` queried
  the customer table twice (once for email, once for phone). Now fetches
  `name,email,phone` in a single call.
- **Signup step 2 redundant `getUser()`**: Called `supabase.auth.getUser()` when
  `userId` was already captured from step 1. Eliminated the extra round-trip.

### Error handling / resilience
- **Chunk load error recovery**: Lazy-loaded routes that fail to load (spotty
  network) now show a clear "Connection issue" screen with reload button instead
  of a generic crash screen.
- **Protected route race condition**: Added `user === undefined` guard to prevent
  a flash redirect to `/login` before the auth session finishes loading.
- **Dashboard reminder dependency array**: Fixed `useEffect` dependency using
  optional chaining on potentially-null `userProfile`, which could cause stale
  closures.

### Dead code / imports removed
- `findCustomerMatches`, `extractContactName`, `createCustomer` removed from
  job-details-page (customer selection lives on review page now).
- `customerSearch`, `showNewCust`, `newCust`, `selCustomer`, `custMatches` state
  variables removed from job-details-page.
- `searchCatalog` unused import removed from both review-quote-page and
  build-scope-page.
- `addCustInline` function removed from job-details-page.

### UX polish
- **SMS delivery for text-channel sends**: When a contractor sends via the "Text"
  delivery method, the Twilio `quote_ready` SMS is now also fired as a backup
  (the native SMS app opens but may not actually send if the user cancels).
- **Voice recording cleanup**: Speech recognition timeout now properly clears
  when the user manually stops recording. Prevents phantom 15s timeout firing.
- **Service worker cache bumped**: v68 → v80. Ensures all users get fresh assets
  on next deploy instead of serving stale cached JS/CSS.
- **NavLink active state**: Added proper `className` callback for sidebar
  `NavLink` components for consistent active styling.

### Billing accuracy
- **`countSentThisMonth` edge case**: Quotes created last month but sent this
  month now correctly count against this month's free-tier limit.

## Stack (unchanged)
React 18 · Vite 5 · Supabase · Vercel Pro · Stripe Connect · Resend · Twilio
