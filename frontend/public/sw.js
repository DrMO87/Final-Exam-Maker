const CACHE_NAME = 'final-exam-maker-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always bypass API calls and HTML navigation requests from cache to avoid stale index.html traps
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.mode === 'navigate') {
    return;
  }
});
