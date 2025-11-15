// public/sw.js

// --- FIX 1: Update all cache names to 'v5' to bust the old 'v4' cache ---
const STATIC_CACHE = 'forex-static-v5';
const API_CACHE = 'forex-api-v5';
const IMAGE_CACHE = 'forex-images-v5';
// --- END FIX ---

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// --- FIX 2: Minimal App Shell ---
// DO NOT cache hashed assets like .js or .css here.
// Vite's hashing already handles cache-busting for them.
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
];
// --- END FIX ---

// List of all caches to be managed by this service worker
const cacheWhitelist = [STATIC_CACHE, API_CACHE, IMAGE_CACHE];

// Install event: cache the minimal app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Install event (v5)');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(urlsToCache);
    }).then(() => {
      console.log('[SW] App shell cached. Skipping waiting.');
      return self.skipWaiting(); // Force activation
    })
  );
});

// Activate event: clean up old caches (e.g., all 'v4' caches)
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event (v5)');
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
    }).then(() => {
      console.log('[SW] Caches cleaned. Claiming clients.');
      return self.clients.claim(); // Take control of all open pages
    })
  );
});

// Fetch event: Apply different strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignore non-http and non-GET requests
  if (!url.protocol.startsWith('http') || request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // 2. API calls (Network-first, with cache fallback)
  // This logic is from your original file and is good.
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Good response? Cache it.
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log(`[SW] Serving from cache (API Fallback): ${request.url}`);
              return cachedResponse;
            }
            // No cache, return offline error
            console.warn(`[SW] Offline and no cache for: ${request.url}`);
            return new Response(
              JSON.stringify({ error: 'Offline and no cached data available' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 3. Image calls (Cache-first, network fallback & revalidate)
  // This logic is good.
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Fetch from network to update cache in the background (stale-while-revalidate)
          const networkFetch = fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
          // Return from cache if available, otherwise wait for network
          return cachedResponse || networkFetch;
        });
      })
    );
    return;
  }

  // --- FIX 3: New logic for App Shell vs. Static Assets ---

  // 4. Navigation requests (e.g., loading index.html)
  //    STRATEGY: Network-First
  //    This is the most important fix to prevent the "white page" error.
  //    We *must* get the new index.html to get the new JS/CSS file links.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Good response? Cache it (e.g., index.html)
          if (networkResponse.ok && urlsToCache.includes(url.pathname)) {
            const responseToCache = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed? Serve index.html from cache as fallback
          console.log('[SW] Network failed for navigation. Serving /index.html from cache.');
          return caches.match('/index.html');
        })
    );
    return;
  }
  
  // 5. Other static assets (JS, CSS, fonts, etc.)
  //    STRATEGY: Let the browser's HTTP cache handle them.
  //    We do *not* want the service worker to cache `vendor-....js`
  //    because it will become stale on the next build.
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
    // Just fetch from network. Do not cache.
    event.respondWith(fetch(request));
    return;
  }

  // 6. Any other request (e.g., manifest.json, icons from `urlsToCache`)
  //    STRATEGY: Cache-First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Not in cache, fetch and cache it (for app shell items)
      return fetch(request).then((networkResponse) => {
        if (networkResponse.ok && urlsToCache.includes(url.pathname)) {
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
  // --- END FIX ---
});

// Handle messages from clients (Simplified)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message.');
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Received CLEAR_CACHE message. Deleting all caches.');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
         console.log('[SW] All caches deleted. Re-caching app shell.');
         // Re-open/re-prime the static cache
         return caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(urlsToCache);
         });
      })
    );
  }
});
