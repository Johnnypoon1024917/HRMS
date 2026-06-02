/* HRMS service worker — installable PWA shell.
 * Strategy:
 *   - static shell  : cache-first
 *   - /api/*         : network-only (never persist PII / payroll offline)
 *   - other GET      : network-first, fall back to cache
 */
const CACHE = 'hrms-shell-v1';
const SHELL = ['/', '/login', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;

  // Security: API responses (people, payroll, PII) are never cached offline.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('/'))),
  );
});

// Push notifications (Bring-Up / approvals). VAPID keys are env config.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'HRMS', {
      body: data.body || '',
      icon: '/brand/default/icon-192.png',
      data: data.url || '/',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data || '/'));
});
