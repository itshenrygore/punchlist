export function makeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, 24);
}

// RFC4122 v4 UUID — safe for Postgres uuid columns.
// Used for line_items.id and anywhere a DB-compatible unique ID is needed.
export function genLineItemId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const buf = new Uint8Array(16);
  (typeof crypto !== 'undefined' ? crypto : globalThis.msCrypto).getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const h = Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUUID(s) { return typeof s === 'string' && _UUID_RE.test(s); }

export async function safeWriteClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers / non-HTTPS contexts
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

/** 7D: Native Share Sheet — uses Web Share API on mobile, falls back to clipboard copy */
export async function nativeShare({ title, text, url }, fallbackToast) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err) {
      // User cancelled share — not an error
      if (err.name === 'AbortError') return false;
    }
  }
  // Fallback: copy link to clipboard
  await safeWriteClipboard(url);
  if (fallbackToast) fallbackToast('Link copied to clipboard', 'success');
  return false;
}
