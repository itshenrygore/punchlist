# Phase 3.5 Slice 3 — M7 Duplicate Customer Check (+ UUID retry fix)

**Status:** Shipped.
**Plan ref:** PHASE3-5-PLAN.md §2.12
**Files changed:**
- `src/lib/api/customers.js` — new `findCustomerByContact` export
- `src/pages/quote-builder-page.jsx` — extracted inline quick-create handler, added dup-check
- `src/lib/api/quotes.js` — drive-by: fix non-deterministic UUIDs on `createQuote` line-items retry

---

## Change 1 — `findCustomerByContact` helper

Before creating a new customer via the inline quick-create form, check whether
one with the same phone (normalized via `\D` strip) or email (lowercased)
already exists for this user. If so, select it instead of creating a duplicate.

**Before:** no helper. Quick-create always inserted a new row.

**After (`src/lib/api/customers.js`):**

```js
export async function findCustomerByContact(userId, { phone, email } = {}) {
  const normPhone = phone ? String(phone).replace(/\D/g, '') : '';
  const normEmail = email ? String(email).trim().toLowerCase() : '';
  if (!normPhone && !normEmail) return null;

  const { data, error } = await supabase
    .from('customers')
    .select('id,name,email,phone')
    .eq('user_id', userId)
    .or('phone.not.is.null,email.not.is.null')
    .is('archived_at', null)
    .limit(500);
  if (error) return null;

  for (const c of data || []) {
    if (normPhone && c.phone) {
      const cp = String(c.phone).replace(/\D/g, '');
      if (cp && cp === normPhone) return c;
    }
    if (normEmail && c.email) {
      if (String(c.email).trim().toLowerCase() === normEmail) return c;
    }
  }
  return null;
}
```

**Why client-side matching rather than a server-side `.or()` predicate:**
PostgREST `.or('phone.eq.X,email.eq.Y')` only matches stored values verbatim
and cannot apply `\D`-stripping to the stored `phone` column. Users store
phones as `(403) 555-0100`, `403.555.0100`, `+14035550100` — none of which
would match a query for `4035550100`. We fetch the candidate set (scoped,
bounded) and normalize both sides client-side. The 500-row ceiling is
generous for the quick-create use case; paginating if any user exceeds it
is a future concern.

Name-only dedup is intentionally not supported — too many legitimate "John
Smith" repeats.

---

## Change 2 — Wire the helper into quick-create

**Before (`src/pages/quote-builder-page.jsx` L750, one inline giant):**

```jsx
<button className="btn btn-primary btn-sm" type="button" onClick={async () => {
  if (!newCust.name.trim()) return;
  if (!newCust.phone.trim()) return setError('Phone number is required');
  try {
    const c = await createCustomer(user.id, newCust);
    setCustomers(p => [...p, c]);
    ud('customer_id', c.id);
    setShowNewCust(false);
    setNewCust({ name: '', email: '', phone: '', address: '' });
    setCustomerSearch('');
    toast('Contact saved', 'success');
  } catch (e) { setError(friendly(e)); }
}}>Save</button>
```

**After:** handler extracted to a named function above the JSX with dup-check
inserted before `createCustomer`:

```jsx
async function handleQuickCreateCustomer() {
  if (!newCust.name.trim()) return;
  if (!newCust.phone.trim()) return setError('Phone number is required');
  try {
    // M7: dup-check by phone/email before creating
    const existing = await findCustomerByContact(user.id, { phone: newCust.phone, email: newCust.email });
    if (existing) {
      if (!customers.some(c => c.id === existing.id)) setCustomers(p => [...p, existing]);
      ud('customer_id', existing.id);
      setShowNewCust(false);
      setNewCust({ name: '', email: '', phone: '', address: '' });
      setCustomerSearch('');
      toast(`Using existing contact: ${existing.name}`, 'info');
      return;
    }
    const c = await createCustomer(user.id, newCust);
    setCustomers(p => [...p, c]);
    ud('customer_id', c.id);
    setShowNewCust(false);
    setNewCust({ name: '', email: '', phone: '', address: '' });
    setCustomerSearch('');
    toast('Contact saved', 'success');
  } catch (e) { setError(friendly(e)); }
}

// …in JSX:
<button className="btn btn-primary btn-sm" type="button" onClick={handleQuickCreateCustomer}>Save</button>
```

The import was updated to include `findCustomerByContact`.

---

## Change 3 — Drive-by UUID fix on `createQuote` retry

**Problem:** `src/lib/api/quotes.js` `createQuote` called
`normalizeLineItems(draft.line_items, quote.id)` twice — once for the initial
insert, and again after `learnBadColumns` added a column to
`_lineItemsBadCols`. Because `normalizeLineItems` mints a fresh UUID via
`genLineItemId()` for any item without an incoming `id`, the retry produced
a different set of UUIDs than the first attempt. This violates the H1
stable-ID contract and makes retries non-deterministic (problematic for
debugging traces and any caller that captures the first attempt's IDs).

**Before (L202-L213):**

```js
const items = normalizeLineItems(draft.line_items, quote.id);
if (items.length) {
  let { error: ie } = await supabase.from('line_items').insert(items);
  if (ie && learnBadColumns(ie)) {
    const retryItems = normalizeLineItems(draft.line_items, quote.id);  // fresh UUIDs!
    const r2 = await supabase.from('line_items').insert(retryItems);
    ie = r2.error;
  }
  if (ie) { /* … */ }
}
```

**After:**

```js
let items = normalizeLineItems(draft.line_items, quote.id);
if (items.length) {
  let { error: ie } = await supabase.from('line_items').insert(items);
  if (ie && learnBadColumns(ie)) {
    // Strip newly-learned bad columns from the SAME normalized rows.
    // Do NOT renormalize from raw draft — genLineItemId() would mint
    // fresh UUIDs for items without incoming ids, breaking the H1
    // stable-ID contract and making retries non-deterministic.
    items = items.map(row => {
      const clean = { ...row };
      for (const col of _lineItemsBadCols) delete clean[col];
      return clean;
    });
    const r2 = await supabase.from('line_items').insert(items);
    ie = r2.error;
  }
  if (ie) { /* … */ }
}
```

This preserves the UUIDs minted on the first normalization across the retry
and keeps H1's contract intact.

---

## Testing

1. **Phone match, different formatting.** Create customer with phone
   `(403) 555-0100`. Open builder, quick-create another with phone
   `4035550100`. Expect toast "Using existing contact: {name}" and the
   existing customer selected.
2. **Email match, case-insensitive.** Existing email `Jane@Example.com`;
   quick-create with `jane@example.com`. Expect the existing to be picked.
3. **Formatting-insensitive phone.** Stored `+1 403-555-0100`, input
   `403 555 0100`. Expect match.
4. **No phone and no email.** Helper should return null; quick-create
   proceeds as a normal create. (Note: current UI forces phone to be
   required, but the helper must still guard this case.)
5. **Archived customer.** An archived customer with the same phone should
   NOT match (`is('archived_at', null)` filter).
6. **UUID fix regression check.** Force a bad-col condition on `line_items`
   (e.g. temporarily rename a column, or add a spurious `_lineItemsBadCols`
   entry in dev). Create a new quote with 2 items. Verify the retry
   succeeds and that the IDs in the DB match what the client's
   `normalizeLineItems` minted on the first pass (log `items[*].id` both
   times — they should be identical).

---

## Revert

```
git diff HEAD -- src/lib/api/customers.js src/pages/quote-builder-page.jsx src/lib/api/quotes.js
git checkout HEAD -- src/lib/api/customers.js src/pages/quote-builder-page.jsx src/lib/api/quotes.js
```

Or manually:
- Delete `findCustomerByContact` from `src/lib/api/customers.js`.
- Replace `handleQuickCreateCustomer` + the `onClick={handleQuickCreateCustomer}` with the original inline onClick block.
- Revert the `createQuote` retry to `normalizeLineItems(draft.line_items, quote.id)` on retry (but note: this reintroduces the UUID non-determinism).
- Remove `findCustomerByContact` and `isNetworkError` (slice 4) from the imports at the top of `quote-builder-page.jsx` as appropriate.
