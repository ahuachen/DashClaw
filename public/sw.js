/*
 * DashClaw service worker — minimal PWA shell cache.
 *
 * Purpose:
 *  1. Make /approve installable on iOS (requires a service worker for Add to Home Screen).
 *  2. Fast-load the app shell on repeat visits.
 *  3. Show a friendly "offline" page instead of the browser default when the network is gone.
 *
 * It is intentionally NOT an offline approval queue. Approvals are governance-critical;
 * queuing decisions while offline would be dangerous. API requests always go to network,
 * never to cache.
 */

const CACHE_NAME = 'dashclaw-approve-v1';
const SHELL_URLS = [
  '/approve',
  '/favicon.svg',
  '/favicons/android-chrome-192x192.png',
  '/favicons/android-chrome-512x512.png',
  '/config/site.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => {
        // Ignore individual failures (e.g. in dev the /approve HTML may not be pre-rendered).
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET — everything else (POST approvals, etc.) must hit the network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  // API requests: always network, never cached. Approval data must be fresh.
  if (isApiRequest(url)) return;

  // Navigation requests: network-first, fall back to cached /approve shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a copy of navigation HTML so repeat visits are instant offline.
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match('/approve');
          if (shell) return shell;
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>DashClaw — Offline</title>' +
              '<style>html,body{background:#0a0a0a;color:#fff;font:15px/1.5 system-ui,-apple-system,sans-serif;margin:0;padding:32px;min-height:100vh;box-sizing:border-box;display:flex;align-items:center;justify-content:center}div{max-width:320px;text-align:center}h1{font-size:16px;margin:0 0 8px}p{color:#a1a1aa;margin:0}</style>' +
              '<div><h1>You&rsquo;re offline</h1><p>Connect to approve actions.</p></div>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
          );
        })
    );
    return;
  }

  // Static shell assets (JS/CSS/icons): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
