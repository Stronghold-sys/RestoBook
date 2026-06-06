// Minimal service worker for PWA installability with safe error handling
const CACHE_NAME = 'restobook-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests, bypass all API mutations or non-GET requests (e.g. POST payments)
  if (event.request.method !== 'GET') {
    return;
  }

  // Bypass for chrome-extension or other non-http(s) schemes
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async (error) => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      // Propagate the network error so the browser handles it naturally (e.g. shows offline page)
      // rather than returning undefined which causes service worker crash
      throw error;
    })
  );
});
