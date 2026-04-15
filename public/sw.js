// Punchlist Service Worker — PWA shell cache + push notifications
// NOTE: Bump CACHE_NAME on every deploy so clients purge stale assets
// (especially after fixing bad font URLs or hashed bundle filenames).
const CACHE_NAME = 'punchlist-v96';
const SHELL_ASSETS = [
  '/',
  '/app',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/manifest.json',
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch(() => {
        // Some assets may fail (e.g. /app returns index.html via SPA routing)
        // That's fine — we'll serve from network first anyway
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls, Supabase, Stripe, or Resend requests
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('stripe') ||
    url.hostname.includes('resend') ||
    event.request.method !== 'GET'
  ) {
    return; // Let the browser handle these normally
  }

  // For navigation requests (HTML pages), try network first, fall back to cached /
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // For static assets: cache-first, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful responses for static assets
        if (response.ok && url.pathname.match(/\.(js|css|svg|png|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Network failed and no cache — return offline fallback for navigations
        if (event.request.mode === 'navigate') return caches.match('/');
        return new Response('', { status: 408, statusText: 'Offline' });
      });
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

  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || 'punchlist-notification',
    data: { url: data.url || '/app' },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Punchlist', options));
});

// Notification click — open the app to the right page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
