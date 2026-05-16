# Phase 3.5 Slice 4 — `isNetworkError` Helper + Autosave Retune

**Status:** Shipped.
**Plan ref:** PHASE3-5-PLAN.md §2.9 + §2.14 (B9)
**Files changed:**
- `src/lib/offline.js` — new `isNetworkError` export
- `src/pages/quote-builder-page.jsx` — consume helper in save catch; replace 30s `setInterval` with 800ms debounce + flush-on-hide

---

## Change 1 — `isNetworkError` helper

A single shared test for "this error is network-shaped, fall through to
offline persistence" that's more robust than the prior narrow
`e instanceof TypeError && /fetch|network|failed/i.test(e.message)`.

**Added to `src/lib/offline.js`:**

```js
export function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  if (err instanceof TypeError) return true;
  if (err.name === 'AbortError') return true;
  const status = err.status || err.statusCode || err?.cause?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  const msg = String(err.message || err).toLowerCase();
  return /network|failed to fetch|fetch|timeout|abort|connection|offline|err_internet|err_network/.test(msg);
}
```

Covers:
- Browser explicitly reports offline.
- `TypeError` — the canonical `fetch` failure on DNS, CORS, TLS, refused connection.
- `AbortError` — request was aborted (timeout via AbortController, navigation).
- HTTP 502/503/504 — gateway/upstream transient errors, including Supabase edge.
- Message text catchall for variants that don't fit the above (WebKit, Firefox, Chromium emit slightly different error shapes).

---

## Change 2 — Builder save path uses the helper

**Before (`src/pages/quote-builder-page.jsx`, inside `save`'s catch):**

```js
} catch (e) {
  if (e instanceof TypeError && /fetch|network|failed/i.test(e.message) && quoteId) {
    try {
      await saveOfflineDraft({ ... });
      setOfflineDraft(true); setSaveState('');
      if (!silent) toast("Saved offline", 'info');
      return null;
    } catch (e) { console.warn("[PL]", e); }
  }
  setError(friendly(e)); setSaveState('');
  if (!silent) toast(friendly(e), 'error');
  return null;
}
```

**After:**

```js
} catch (e) {
  if (isNetworkError(e) && quoteId) {
    try {
      await saveOfflineDraft({ ... });
      setOfflineDraft(true); setSaveState('');
      if (!silent) toast("Saved offline — will sync when online", 'info');
      return null;
    } catch (e) { console.warn("[PL]", e); }
  }
  setError(friendly(e)); setSaveState('');
  if (!silent) toast(friendly(e), 'error');
  return null;
}
```

Toast copy upgraded to set expectation that a sync will happen automatically.

---

## Change 3 — Replace 30s `setInterval` with 800ms debounce + flush

**Before (L563-571):**

```js
useEffect(() => {
  if (!quoteId) return;
  const interval = setInterval(async () => {
    if (offlineDraft && navigator.onLine && quoteId) {
      const synced = await save(null, true);
      if (synced) toast('Back online — quote synced', 'success');
      return;
    }
    if (dirty.current && !saving && !isLocked && initialLoadComplete.current && lineItems.length > 0)
      save(null, true);
  }, 30000);
  return () => clearInterval(interval);
}, [user, lineItems, saving, quoteId, isLocked, offlineDraft]);
```

Users could lose up to 30 seconds of edits on a connection drop or tab close.

**After:**

```js
// B9 / C5: debounced save (800ms) + flush on hide.
useEffect(() => {
  if (!quoteId) return;
  if (!isDirty) {
    // No pending edits. Still handle the "came back online with an
    // offline draft pending" case with a one-shot sync attempt.
    if (offlineDraft && navigator.onLine) {
      save(null, true).then(synced => {
        if (synced) toast('Back online — quote synced', 'success');
      });
    }
    return;
  }
  if (saving || isLocked || !initialLoadComplete.current) return;
  if (lineItems.length === 0) return;
  const t = setTimeout(() => { save(null, true); }, 800);
  return () => clearTimeout(t);
}, [isDirty, draft, lineItems, title, description, quoteId, saving, isLocked, offlineDraft]);

// Flush on tab hide / pagehide — catches app-switch and tab-close mid-edit.
useEffect(() => {
  if (!quoteId) return;
  const flush = () => {
    if (dirty.current && !saving && !isLocked && initialLoadComplete.current && lineItems.length > 0) {
      save(null, true);
    }
  };
  window.addEventListener('visibilitychange', flush);
  window.addEventListener('pagehide', flush);
  return () => {
    window.removeEventListener('visibilitychange', flush);
    window.removeEventListener('pagehide', flush);
  };
}, [quoteId, saving, isLocked, lineItems.length]);
```

Rationale:
- **800ms debounce.** Small enough that stop-typing → saved is imperceptible-to-natural; long enough that per-keystroke updates don't each fire a network request.
- **Flush on `visibilitychange`/`pagehide`.** The debounce would otherwise drop a pending save when the user backgrounds the tab. These events cover iOS app-switch, tab-close, and browser-shutdown.
- **The "back online with offline pending" path** is preserved, triggered whenever the effect re-runs with `!isDirty && offlineDraft && navigator.onLine`.

---

## `syncOfflineDrafts` wiring — already in place

PHASE3-5-NEXT-SESSIONS.md asked us to flag whether `syncOfflineDrafts` was
wired anywhere. **It is already wired** in `src/components/app-shell.jsx`
line 51, inside the `onConnectivityChange` handler:

```js
if (isOnline() && user?.id) {
  syncOfflineDrafts(user.id, createQuote).then(({ synced }) => {
    // …
  });
}
```

No additional wiring needed from this slice.

---

## Testing

1. **Supabase 503.** Stub `supabase.from(...).update` to throw `{ status: 503 }`. Expect toast "Saved offline — will sync when online" and the draft in IndexedDB.
2. **DevTools offline.** Same behavior. `navigator.onLine === false` short-circuits `isNetworkError` to true.
3. **Back online.** With an offline draft pending, go back online. `app-shell.jsx` fires `syncOfflineDrafts`; the debounce effect's `!isDirty` branch re-attempts. Expect sync and "Back online — quote synced" toast.
4. **Debounce timing.** Type continuously for 2s. No save fires during typing. Stop. ~800ms later, one save fires. ✅ if exactly one network request appears in DevTools.
5. **Flush on hide.** Type a change, immediately switch apps (or press Cmd-Tab on desktop while keeping the tab). Expect a save to fire before backgrounding completes.
6. **Flush on close.** Type a change, close the tab. Expect one save to have fired during `pagehide`.
7. **No-op guardrails.** Empty draft (0 items) — no save fires. Locked quote — no save fires. Pre-initial-load — no save fires.

Note: `pagehide` has no guarantee of completing a network request. For critical last-second writes, `navigator.sendBeacon` would be better, but that's out of scope for this slice — the current `save` path is what slice 7 or slice 8 telemetry can upgrade.

---

## Revert

```
git checkout HEAD -- src/lib/offline.js src/pages/quote-builder-page.jsx
```

Or manually:
- Remove the `isNetworkError` export from `src/lib/offline.js`.
- In `quote-builder-page.jsx`:
  - Remove `isNetworkError` from the offline import.
  - Restore `if (e instanceof TypeError && /fetch|network|failed/i.test(e.message) && quoteId)` in the save catch.
  - Restore the 30s `setInterval` autosave effect.
  - Delete the two new `useEffect` blocks.
