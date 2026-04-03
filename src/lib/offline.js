// ═══════════════════════════════════════════
// PUNCHLIST — Offline Draft Storage (IndexedDB)
// Phase 7C: Save quote drafts when offline, sync when reconnected
//
// NOTE: saveOfflineDraft is not yet wired into the quote flow.
// The offline detection in AppShell works, but draft persistence
// is not connected. Wire this in when offline-first becomes a priority.
// ═══════════════════════════════════════════

const DB_NAME = 'punchlist-offline';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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

/** Sync all offline drafts to Supabase, then remove from IndexedDB */
export async function syncOfflineDrafts(userId, createQuoteFn) {
  const drafts = await getOfflineDrafts();
  if (!drafts.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const draft of drafts) {
    try {
      // Remove offline metadata before sending to API
      const { _offline, _savedAt, id: offlineId, ...quoteData } = draft;
      await createQuoteFn(userId, quoteData);
      await deleteOfflineDraft(offlineId);
      synced++;
    } catch (err) {
      console.warn('[offline] Failed to sync draft:', err?.message);
      failed++;
    }
  }

  return { synced, failed };
}

/** Check if we're currently online */
export function isOnline() {
  return navigator.onLine;
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
