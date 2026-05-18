# Phase 3.5 Slice 11 — B4 Customer Picker UI

**Status:** Shipped.
**Plan ref:** PHASE3-5-PLAN.md §B4 + §2.5
**Files changed:**
- `src/pages/quote-builder-page.jsx` — customer picker refactor (hook, fuzzy search, last-chip, loading skeleton)
- `src/styles/index.css` — `.jd-cust-last-chip` CSS

---

## Summary

The customer picker now uses the `useCustomers` hook (shipped in Slice 1) instead of a manual `listCustomers` effect. Customers load from the module-level cache on re-entry (instant render). A fuzzy-matching `searchCustomers` function replaces the inline `.filter()`. A "last customer" quick-chip speeds up repeat jobs. A loading skeleton appears on the first cold load.

---

## Changes — `src/pages/quote-builder-page.jsx`

### Import additions

**Before:**
```js
import { requestAiScope, … listCustomers, … } from '../lib/api';
```

**After:**
```js
import { requestAiScope, … } from '../lib/api'; // listCustomers removed
import { useCustomers, searchCustomers, invalidateCustomers } from '../hooks/use-customers';
```

### State — replaced manual customers array

**Before:**
```js
const [customers, setCustomers] = useState([]);
// …
useEffect(() => {
  listCustomers(user.id).then(c => setCustomers(c || [])).catch(() => {});
}, [user, existingQuoteId]);
```

**After:**
```js
const { customers, loading: customersLoading } = useCustomers(user?.id);
const [localCustomers, setLocalCustomers] = useState([]);
// Merge hook customers with optimistic local additions
const allCustomers = useMemo(() => {
  if (!localCustomers.length) return customers;
  const ids = new Set(customers.map(c => c.id));
  return [...customers, ...localCustomers.filter(c => !ids.has(c.id))];
}, [customers, localCustomers]);
```

The `listCustomers` call in the load `useEffect` is removed entirely — the hook handles it. The `localCustomers` state handles optimistic additions from `handleQuickCreateCustomer` so the UI updates instantly without waiting for a cache re-fetch.

### `handleQuickCreateCustomer` — `invalidateCustomers` + `setLocalCustomers`

**Before:**
```js
if (existing) {
  if (!customers.some(c => c.id === existing.id)) setCustomers(p => [...p, existing]);
  ud('customer_id', existing.id);
  …
}
const c = await createCustomer(user.id, newCust);
setCustomers(p => [...p, c]);
ud('customer_id', c.id);
```

**After:**
```js
if (existing) {
  if (!allCustomers.some(c => c.id === existing.id)) setLocalCustomers(p => [...p, existing]);
  ud('customer_id', existing.id);
  …
}
const c = await createCustomer(user.id, newCust);
invalidateCustomers(); // bust cache so next hook render re-fetches
setLocalCustomers(p => [...p, c]); // optimistic local add for instant UI
ud('customer_id', c.id);
```

### Inline phone save handler (in JSX)

**Before:**
```js
const cust = customers.find(c => c.id === draft.customer_id);
await updateCustomer(cust.id, { phone: inlinePhone.trim() });
setCustomers(prev => prev.map(c => c.id === cust.id ? { ...c, phone: inlinePhone.trim() } : c));
```

**After:**
```js
const cust = allCustomers.find(c => c.id === draft.customer_id);
await updateCustomer(cust.id, { phone: inlinePhone.trim() });
setLocalCustomers(prev => prev.map(c => c.id === cust.id ? { ...c, phone: inlinePhone.trim() } : c));
invalidateCustomers();
```

### `selCustomer` — uses `allCustomers`

**Before:**
```js
const selCustomer = customers.find(c => c.id === draft.customer_id);
```

**After:**
```js
const selCustomer = allCustomers.find(c => c.id === draft.customer_id);
```

Same change applied in `handleSend` (text/email customer lookup) and the email send path.

### Customer search — `searchCustomers` replaces inline filter

**Before:**
```js
const matches = customers.filter(c =>
  [c.name, c.email, c.phone].some(v =>
    String(v || '').toLowerCase().includes(customerSearch.toLowerCase())
  )
).slice(0, 5);
```

**After:**
```js
const matches = searchCustomers(allCustomers, customerSearch, 6);
```

`searchCustomers` (from `use-customers.js`) scores by contains-match position and subsequence match, so "smih" finds "Mike Smith". Limit increased from 5 → 6 to match plan spec.

### Last-customer quick-chip (new JSX)

Rendered above the search input when no customer is selected and the search field is empty:

```jsx
{(() => {
  const lastCustomer = allCustomers.length ? allCustomers[0] : null;
  return lastCustomer && !customerSearch ? (
    <button
      type="button"
      className="jd-cust-last-chip"
      onClick={() => {
        ud('customer_id', lastCustomer.id);
        trackQuoteFlowCustomerSelected(lastCustomer.id);
      }}
    >
      ↩ {lastCustomer.name}
    </button>
  ) : null;
})()}
```

The "last customer" approximation uses `allCustomers[0]` (first in list as returned by `listCustomers`, which orders by `created_at DESC`). This is the plan's recommended fallback until quote history is available as a join.

### Loading skeleton (new JSX)

```jsx
{customersLoading && !allCustomers.length && (
  <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
    Loading contacts…
  </div>
)}
```

Shown only on first cold load (cache empty). On subsequent visits the hook returns cached data synchronously and `customersLoading` is `false` from the start.

---

## Changes — `src/styles/index.css`

New rule appended:

```css
.jd-cust-last-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--brand);
  background: var(--brand-bg);
  color: var(--brand);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 8px;
  font-family: inherit;
  transition: background var(--fast, .15s), color var(--fast, .15s);
}
.jd-cust-last-chip:hover {
  background: var(--brand);
  color: #fff;
}
```

---

## Testing guidance

1. **Cache hit:** Visit the builder, add a customer, navigate to the dashboard, return to builder. Customer list renders instantly (no loading flash) — hook served from cache.
2. **Fuzzy search:** Type "smih" in the customer search field → "Mike Smith" (or similar) appears in results.
3. **searchCustomers limit:** Confirm at most 6 results appear (previously 5).
4. **Last-customer chip:** With no customer selected and no search text, confirm the chip appears above the search input showing the most recently created customer's name. Tap it → customer is selected, `trackQuoteFlowCustomerSelected` fires (check DevTools Network → `events` table).
5. **New customer → cache invalidated:** Create a new customer via the quick-create form. Navigate away and back. Confirm the new customer appears in the list (cache was invalidated by `invalidateCustomers()`).
6. **Loading skeleton:** Clear the module cache (e.g. hard-refresh) and open the builder. On the first render before customers load, "Loading contacts…" is briefly visible.
7. **No regression — selected customer display:** Select a customer; confirm the avatar, name, email, and Change button all still render correctly.
8. **No regression — new-customer form:** Open the new-customer form; confirm Name, Phone, Email fields and Save/Cancel buttons still work.
9. **No regression — existing sends:** Send a quote via text and email; confirm the customer lookup in both paths resolves correctly.

---

## Revert instructions

```bash
git checkout HEAD -- src/pages/quote-builder-page.jsx \
                     src/styles/index.css
```

Surgical revert of page:
- Restore `import { …, listCustomers, … }` in the api import
- Remove `import { useCustomers, searchCustomers, invalidateCustomers }` line
- Replace `useCustomers` + `localCustomers` + `allCustomers` with `const [customers, setCustomers] = useState([])`
- Restore `listCustomers(user.id).then(c => setCustomers(c || [])).catch(() => {})` in load effect
- Replace `searchCustomers(allCustomers, …)` with the inline `.filter()` expression
- Restore `setCustomers` in `handleQuickCreateCustomer` and inline phone handler
- Remove `invalidateCustomers()` calls
- Remove last-customer chip JSX block
- Remove loading skeleton JSX block
- Restore `customers.find` → `selCustomer`
