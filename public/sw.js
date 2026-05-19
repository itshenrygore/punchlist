// Punchlist Service Worker — PWA shell cache + push notifications
// NOTE: Bump CACHE_NAME on every deploy so clients purge stale assets
// (especially after fixing bad font URLs or hashed bundle filenames).
const CACHE_NAME = 'punchlist-v99';
const SHELL_ASSETS = [
  '/',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/manifest.json',
];

// Hosts we MUST NOT cache responses from. Match by exact equality or
// known suffixes — the previous `hostname.includes('supabase')` check
// also matched attacker-controlled lookalike domains like
// `evil-supabase.example.com`.
const NEVER_CACHE_SUFFIXES = [
  '.supabase.co',
  '.supabase.in',
  '.stripe.com',
  '.resend.com',
];
function isThirdParty(hostname) {
  const h = hostname.toLowerCase();
  return NEVER_CACHE_SUFFIXES.some((sfx) => h === sfx.slice(1) || h.endsWith(sfx));
}

// Install: pre-cache app shell. Do NOT swallow install errors — if the
// shell can't be cached we want activation to fail so the previous SW
// stays in charge instead of activating an empty cache.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for navigations, cache-first for hashed assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass: API calls, third-party hosts, non-GETs.
  if (
    url.pathname.startsWith('/api/') ||
    isThirdParty(url.hostname) ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Navigation requests: network-first, refresh the cached shell on
  // success, fall back to cached "/" ONLY when offline. The previous
  // version fell back on ANY fetch failure (5xx, slow network), which
  // could serve stale HTML pointing at hashed bundles that no longer
  // exist post-deploy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            const cached = await caches.match('/');
            if (cached) return cached;
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // Static assets: only cache hashed/static-shaped paths so we never
  // accidentally retain a customized HTML or JSON response.
  const isCacheableAsset =
    /\.(js|css|svg|png|webp|woff2?)$/.test(url.pathname) &&
    ['style', 'script', 'image', 'font'].includes(event.request.destination);
  if (!isCacheableAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      }).catch(() => new Response('', { status: 408, statusText: 'Offline' }));
    })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'Punchlist', body: 'You have a new notification.' };
  try {
    if (event.data) data = event.data.json();
  } catch {
    if (event.data) data.body = event.data.text();
  }

  const actions = [];
  if (data.type === 'quote_viewed' || data.type === 'customer_question') {
    actions.push({ action: 'followup', title: 'Send follow-up' });
  }
  actions.push({ action: 'open', title: 'Open' });

  // Per-event tag so a "viewed" then "approved" don't collapse into
  // one notification (default tag would dedupe).
  const tag = data.tag || `punchlist-${data.type || 'event'}-${data.quoteId || Date.now()}`;

  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag,
    data: { url: data.url || '/app', type: data.type, quoteId: data.quoteId },
    vibrate: [100, 50, 100],
    actions,
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Punchlist', options));
});

// Notification click — open the app to the right page. ONLY navigate
// to same-origin relative paths so a malformed push payload can't
// redirect the contractor's tab off-domain.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = data.url || '/app';

  if (event.action === 'followup' && data.quoteId) {
    url = `/app/quotes/${data.quoteId}?action=nudge`;
  }
  // Reject anything that isn't a known in-app relative path.
  if (!/^\/(app|q|i|public)(\/|$|\?)/.test(url)) url = '/app';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
