// public/sw.js
const CACHE_NAME = 'forex-pwa-v3'; // Increment cache version to force update
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Add API endpoints that should be network-first but NOT cached if they are POST/PUT etc.
// Or just check the method directly as done below.

const urlsToCache = [
  '/', // Cache the root path served by index.html due to HashRouter
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  // Add other static assets if needed (JS/CSS chunks are usually handled automatically by build tools)
];

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(urlsToCache).catch((err) => {
        console.warn('[SW] Cache addAll failed:', err);
        // Don't fail install if some non-essential assets fail
        return Promise.resolve();
      });
    }).then(() => self.skipWaiting()) // Activate new SW immediately
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip browser extension requests
  if (url.protocol.startsWith('chrome-extension:') || url.protocol.startsWith('moz-extension:')) {
    return;
  }

  // Skip non-GET requests for API caching logic specifically
  if (request.method !== 'GET' && (url.pathname.includes('/api/') || url.pathname.includes('supabase'))) {
      // For non-GET API requests (like POST), just fetch from network, don't cache.
      event.respondWith(fetch(request));
      return;
  }


  // Network-first strategy for GET API calls
  if (request.method === 'GET' && (url.pathname.includes('/api/') || url.pathname.includes('supabase'))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET API responses
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // --- Only cache GET requests ---
              if (request.method === 'GET') {
                  cache.put(request, responseToCache);
                  // Store timestamp only for GET requests
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
          return caches.open(CACHE_NAME).then(async (cache) => {
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
         return caches.open(CACHE_NAME).then(async (cache) => {
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
          return caches.open(CACHE_NAME).then((cache) => {
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
      caches.delete(CACHE_NAME).then(() => {
          console.log('[SW] Cache deleted. Re-opening.');
        return caches.open(CACHE_NAME); // Re-open cache immediately if needed
      })
    );
  }
});
