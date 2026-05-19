const DB_NAME = 'punchlist-offline';
const DB_VERSION = 1;
const QUOTES_STORE = 'quotes';
const SYNC_STORE = 'sync-queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
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

export async function cacheQuotes(quotes) {
  try {
    const db = await openDB();
    const tx = db.transaction(QUOTES_STORE, 'readwrite');
    const store = tx.objectStore(QUOTES_STORE);
    for (const q of quotes) store.put({ ...q, _cachedAt: Date.now() });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
  } catch (e) { console.warn('[PL] cache write failed:', e); }
}

export async function getCachedQuotes() {
  try {
    const db = await openDB();
    const tx = db.transaction(QUOTES_STORE, 'readonly');
    const store = tx.objectStore(QUOTES_STORE);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
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
