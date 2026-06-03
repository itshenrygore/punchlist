const DB_NAME = 'punchlist-offline';
// Kept in lockstep with src/lib/offline.js. The upgrade handler must
// create every store the app uses, regardless of which module opens
// the DB first.
const DB_VERSION = 2;
const QUOTES_STORE = 'quotes';
const SYNC_STORE = 'sync-queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(QUOTES_STORE)) {
        db.createObjectStore(QUOTES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheQuotes(quotes, ownerUserId = null) {
  try {
    const db = await openDB();
    const tx = db.transaction(QUOTES_STORE, 'readwrite');
    const store = tx.objectStore(QUOTES_STORE);
    // Purge stale rows that belong to this user but aren't in the fresh
    // payload — otherwise a deleted quote lingers in the cache and
    // reappears on the next fallback read. Previously store.put() only
    // added or updated, so deletes were never reflected.
    if (ownerUserId) {
      const existing = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      const freshIds = new Set(quotes.map(q => q.id));
      for (const row of existing) {
        if (row.user_id === ownerUserId && !freshIds.has(row.id)) {
          store.delete(row.id);
        }
      }
    }
    for (const q of quotes) store.put({ ...q, _cachedAt: Date.now() });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
  } catch (e) { console.warn('[PL] cache write failed:', e); }
}

/** Remove a single quote from the cache (after a successful delete). */
export async function removeCachedQuote(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(QUOTES_STORE, 'readwrite');
    tx.objectStore(QUOTES_STORE).delete(id);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
  } catch (e) { console.warn('[PL] cache delete failed:', e); }
}

export async function getCachedQuotes(userId) {
  // userId is now required to prevent the cross-user leak: on a logout +
  // login flow, the second user could see the first user's cached
  // quotes because the store is shared across accounts in one browser.
  // Existing callers that pass nothing get the empty list (safe).
  try {
    const db = await openDB();
    const tx = db.transaction(QUOTES_STORE, 'readonly');
    const store = tx.objectStore(QUOTES_STORE);
    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (!userId) return [];
    return all.filter(q => q.user_id === userId);
  } catch (e) { console.warn('[PL] cache read failed:', e); return []; }
}

export async function getCachedQuote(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(QUOTES_STORE, 'readonly');
    const store = tx.objectStore(QUOTES_STORE);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return null; }
}

export async function queueSyncAction(action) {
  try {
    const db = await openDB();
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    tx.objectStore(SYNC_STORE).add({ ...action, queuedAt: Date.now() });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
  } catch (e) { console.warn('[PL] sync queue failed:', e); }
}

export async function drainSyncQueue(processor) {
  try {
    const db = await openDB();
    const tx = db.transaction(SYNC_STORE, 'readonly');
    const items = await new Promise((resolve, reject) => {
      const req = tx.objectStore(SYNC_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (!items.length) return 0;

    let processed = 0;
    for (const item of items) {
      try {
        await processor(item);
        const delTx = db.transaction(SYNC_STORE, 'readwrite');
        delTx.objectStore(SYNC_STORE).delete(item.id);
        await new Promise((resolve) => { delTx.oncomplete = resolve; });
        processed++;
      } catch (e) { console.warn('[PL] sync item failed:', e); }
    }
    return processed;
  } catch (e) { console.warn('[PL] drain failed:', e); return 0; }
}

export function onOnline(callback) {
  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
}
