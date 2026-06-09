/**
 * Vault Hub — Minimal Service Worker
 *
 * Strategy:
 * - Static assets (JS, CSS, images, fonts): Cache-first, 24h stale
 * - Navigation (HTML pages): Network-first, cache fallback
 * - API calls: Network-only (always fresh)
 *
 * This is intentionally minimal — Bubblewrap handles the Android-side
 * service worker injection for TWA Chrome updates.
 */

const CACHE_NAME = 'vault-hub-v1';
const STATIC_CACHE = 'vault-hub-static-v1';

/* Assets to pre-cache during install */
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/vault-logo.png',
];

/* ── Install: pre-cache shell assets ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch: routing ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET and cross-origin */
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  /* API routes: network only */
  if (url.pathname.startsWith('/api/')) return;

  /* Static assets (JS, CSS, images, fonts, etc.): cache-first */
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  /* Navigation (HTML): network-first, cache fallback */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }
});

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(pathname);
}
