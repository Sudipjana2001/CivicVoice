const MEDIA_CACHE = 'civic-media-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name !== MEDIA_CACHE)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

function isCacheableMediaRequest(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  return (
    url.pathname.includes('/storage/v1/object/sign/evidence/') ||
    url.pathname.includes('/storage/v1/object/public/evidence/')
  );
}

self.addEventListener('fetch', (event) => {
  if (!isCacheableMediaRequest(event.request)) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(MEDIA_CACHE);
    const cached = await cache.match(event.request);

    const networkPromise = fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      })
      .catch(() => cached);

    return cached || networkPromise;
  })());
});
