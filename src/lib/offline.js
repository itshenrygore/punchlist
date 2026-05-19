// ═══════════════════════════════════════════
// PUNCHLIST — Offline Draft Storage (IndexedDB)
// Phase 7C: Save quote drafts when offline, sync when reconnected
//
// Offline draft persistence is wired into the quote builder:
// - Initial create falls back to IndexedDB when offline
// - Autosave catches network errors and persists to IndexedDB
// - AppShell syncs offline drafts on reconnect via syncOfflineDrafts
// ═══════════════════════════════════════════

const DB_NAME = 'punchlist-offline';
// IMPORTANT: kept in lockstep with src/lib/offline-cache.js. Both
// modules open the same IndexedDB by name; if their versions differ,
// whichever loads second hits VersionError and every offline write
// silently fails. The upgrade handler creates every store this
// codebase uses, so either file can drive the upgrade safely.
const DB_VERSION = 2;
const STORE_NAME = 'drafts';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('quotes')) {
        db.createObjectStore('quotes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a draft to IndexedDB */
export async function saveOfflineDraft(draft) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      ...draft,
      id: draft.id || `offline-${Date.now()}`,
      _offline: true,
      _savedAt: new Date().toISOString(),
    };
    store.put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

/** Get all offline drafts */
export async function getOfflineDrafts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** Get a single offline draft by id */
export async function getOfflineDraft(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Delete an offline draft */
export async function deleteOfflineDraft(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Sync all offline drafts to Supabase, then remove from IndexedDB.
 *
 * Guards against the multi-tab race: if the user has two tabs open
 * and Wi-Fi flickers, both tabs would otherwise fire this in parallel,
 * read the same draft list, and both create the row before either
 * deletes its local copy — every draft ends up duplicated. We wrap
 * the body in a `navigator.locks` request so only one tab runs at a
 * time. Browsers without Web Locks fall through to the unguarded
 * path (we accept the residual risk on older Safari).
 *
 * Also: drafts that fail repeatedly (e.g. RLS rejection on a stale
 * customer_id) get a per-draft `_failedAttempts` counter. After three
 * failures we stop retrying on reconnect so we don't hammer the API
 * with the same broken draft forever.
 */
export async function syncOfflineDrafts(userId, createQuoteFn) {
  const run = async () => {
    const drafts = await getOfflineDrafts();
    if (!drafts.length) return { synced: 0, failed: 0, skipped: 0 };

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const draft of drafts) {
      const attempts = Number(draft._failedAttempts || 0);
      if (attempts >= 3) { skipped++; continue; }
      try {
        const { _offline, _savedAt, _failedAttempts, id: offlineId, ...quoteData } = draft;
        await createQuoteFn(userId, quoteData);
        await deleteOfflineDraft(offlineId);
        synced++;
      } catch (err) {
        console.warn('[offline] Failed to sync draft:', err?.message);
        failed++;
        // Bump the attempt counter so a permanently-broken draft
        // stops retrying. We update the same record in place.
        try {
          await saveOfflineDraft({ ...draft, _failedAttempts: attempts + 1 });
        } catch (e) { console.warn('[offline] retry counter update failed', e?.message); }
      }
    }
    return { synced, failed, skipped };
  };

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('punchlist-offline-sync', { ifAvailable: true }, async (lock) => {
      if (!lock) return { synced: 0, failed: 0, skipped: 0, lockedByOtherTab: true };
      return run();
    });
  }
  return run();
}

/** Check if we're currently online */
export function isOnline() {
  return navigator.onLine;
}

/**
 * C5: Broad detection for network-shaped errors. Covers:
 * - navigator.onLine === false
 * - TypeError from fetch (most common fetch failure)
 * - AbortError (timeouts, aborted requests)
 * - Messages containing network/fetch/timeout/abort/failed/connection/offline
 * - HTTP 502/503/504 on err.status (Supabase/edge transient)
 */
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

/** Subscribe to online/offline events. Returns cleanup function. */
export function onConnectivityChange(callback) {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
