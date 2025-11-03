const CACHE_NAME = 'forex-app-v4';
const STATIC_CACHE = 'forex-static-v4';
const API_CACHE = 'forex-api-v4';
const IMAGE_CACHE = 'forex-images-v4';
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
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(urlsToCache).catch((err) => {
        console.warn('[SW] Cache addAll failed:', err);
        return Promise.resolve();
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  const cacheWhitelist = [STATIC_CACHE, API_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip browser extension requests
  if (url.protocol.startsWith('chrome-extension:') || url.protocol.startsWith('moz-extension:')) {
    return;
  }

  // --- THIS IS THE FIX ---
  // If it's not a GET request, just fetch it from the network.
  // Do not try to cache POST, PUT, DELETE, etc.
  if (request.method !== 'GET') {
      event.respondWith(fetch(request));
      return;
  }
  // --- END OF FIX ---


  // Network-first strategy for GET API calls
  if (url.pathname.includes('/api/') || url.pathname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET API responses
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(API_CACHE).then((cache) => {
              if (request.method === 'GET') {
                  cache.put(request, responseToCache);
                  cache.put(
                      new Request(request.url + '?timestamp'),
                      new Response(Date.now().toString())
                  );
              }
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback for GET API calls
          return caches.open(API_CACHE).then(async (cache) => {
            const timestampResponse = await cache.match(
              new Request(request.url + '?timestamp')
            );

            if (timestampResponse) {
              const timestamp = await timestampResponse.text();
              const age = Date.now() - parseInt(timestamp);

              if (age < CACHE_DURATION) {
                const cachedResponse = await cache.match(request);
                if (cachedResponse) {
                  console.log(`[SW] Serving from cache (API Fallback): ${request.url}`);
                  return cachedResponse;
                }
              } else {
                  console.log(`[SW] Stale cache data for (API Fallback): ${request.url}`);
                  // Optionally remove stale data here
              }
            }

            // If no valid cache, return offline error
            console.warn(`[SW] Offline and no valid cache for: ${request.url}`);
            return new Response(
              JSON.stringify({ error: 'Offline and no cached data available' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Cache-first strategy for static assets (already GET requests)
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        // Check timestamp for static assets too
         return caches.open(STATIC_CACHE).then(async (cache) => {
            const timestampResponse = await cache.match(new Request(request.url + '?timestamp'));
             let isStale = true; // Assume stale unless proven otherwise
             if (timestampResponse) {
                 const timestamp = await timestampResponse.text();
                 const age = Date.now() - parseInt(timestamp);
                 if (age < CACHE_DURATION) {
                    isStale = false;
                 }
             }

             if (!isStale) {
                 // console.log(`[SW] Serving from cache (Static): ${request.url}`);
                 return response; // Return fresh cached response
             } else {
                 // console.log(`[SW] Stale cache for (Static): ${request.url}. Fetching network version.`);
                 // Stale cache, try fetching from network
                 return fetch(request).then((networkResponse) => {
                     if (networkResponse.ok) {
                         // console.log(`[SW] Updating cache (Static): ${request.url}`);
                         const respToCache = networkResponse.clone();
                         cache.put(request, respToCache);
                         cache.put(new Request(request.url + '?timestamp'), new Response(Date.now().toString()));
                     }
                     return networkResponse;
                 }).catch(() => {
                      console.warn(`[SW] Network fetch failed for stale static asset. Serving stale cache: ${request.url}`);
                      return response; // Fallback to stale cache if network fails
                 });
             }
         });
      }

      // Not in cache, fetch from network
      return fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
          // Cache newly fetched static assets
          return caches.open(STATIC_CACHE).then((cache) => {
              // console.log(`[SW] Caching new asset (Static): ${request.url}`);
            const respToCache = networkResponse.clone();
            cache.put(request, respToCache);
            cache.put(new Request(request.url + '?timestamp'), new Response(Date.now().toString()));
            return networkResponse;
          });
        }
        return networkResponse; // Return non-ok responses directly
      }).catch(() => {
        // Offline fallback for static assets (e.g., return index.html for navigation requests)
        console.warn(`[SW] Failed to fetch static asset from network: ${request.url}`);
        if (request.mode === 'navigate' && request.destination === 'document') {
           console.log('[SW] Serving index.html as fallback for navigation.');
          return caches.match('/index.html');
        }
        // Optionally return a generic offline placeholder for other assets like images
         return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});

// Handle messages from clients (Keep as is)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Clearing cache on message');
    event.waitUntil(
      Promise.all([
        caches.delete(STATIC_CACHE),
        caches.delete(API_CACHE),
        caches.delete(IMAGE_CACHE)
      ]).then(() => {
        console.log('[SW] All caches deleted. Re-opening.');
        return Promise.all([
          caches.open(STATIC_CACHE),
          caches.open(API_CACHE),
          caches.open(IMAGE_CACHE)
        ]);
      })
    );
  }
});
