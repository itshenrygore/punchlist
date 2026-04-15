export function makeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, 24);
}

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
