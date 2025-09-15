addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // List of asset file extensions that should NOT be rewritten
  const assetExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.txt', '.json', '.webmanifest', '.woff', '.woff2', '.ttf', '.map'
  ];

  // If the request is for a static asset, serve it directly
  if (assetExtensions.some(ext => url.pathname.endsWith(ext))) {
    return fetch(request);
  }

  // If the request is for the root or index.html, serve as normal
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return fetch(request);
  }

  // Otherwise, rewrite to serve index.html for SPA client routing
  // Replace with your bucket/origin as needed (or leave as below if assets are in the same place)
  const indexUrl = new URL(request.url);
  indexUrl.pathname = '/index.html';
  return fetch(indexUrl.toString(), request);
}
