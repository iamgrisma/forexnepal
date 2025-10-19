const CACHE_NAME = 'forex-pwa-v2';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch((err) => {
        console.warn('Cache addAll failed:', err);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Network-first strategy for API calls
  if (url.pathname.includes('/api/') || url.pathname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses with timestamp
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
              // Store timestamp
              cache.put(
                new Request(request.url + '?timestamp'),
                new Response(Date.now().toString())
              );
            });
          }
          return response;
        })
        .catch(() => {
          // Check if cached data is still valid (within 24 hours)
          return caches.open(CACHE_NAME).then(async (cache) => {
            const timestampResponse = await cache.match(
              new Request(request.url + '?timestamp')
            );

            if (timestampResponse) {
              const timestamp = await timestampResponse.text();
              const age = Date.now() - parseInt(timestamp);

              // Return cached data if it's less than 24 hours old
              if (age < CACHE_DURATION) {
                const cachedResponse = await cache.match(request);
                if (cachedResponse) {
                  return cachedResponse;
                }
              }
            }

            // If no valid cache, return offline page or error
            return new Response(
              JSON.stringify({ error: 'Offline and no cached data available' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        // Check if cached asset is still valid
        return caches.open(CACHE_NAME).then(async (cache) => {
          const timestampResponse = await cache.match(
            new Request(request.url + '?timestamp')
          );

          if (timestampResponse) {
            const timestamp = await timestampResponse.text();
            const age = Date.now() - parseInt(timestamp);

            if (age < CACHE_DURATION) {
              return response;
            }
          }

          // Try to fetch fresh version
          return fetch(request)
            .then((networkResponse) => {
              cache.put(request, networkResponse.clone());
              cache.put(
                new Request(request.url + '?timestamp'),
                new Response(Date.now().toString())
              );
              return networkResponse;
            })
            .catch(() => response);
        });
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
              cache.put(
                new Request(request.url + '?timestamp'),
                new Response(Date.now().toString())
              );
              return networkResponse;
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Return offline fallback
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        return caches.open(CACHE_NAME);
      })
    );
  }
});
