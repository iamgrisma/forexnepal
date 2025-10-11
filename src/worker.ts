import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler';

// Cloudflare Workers types
declare const addEventListener: (type: string, handler: (event: any) => void) => void;

addEventListener('fetch', (event: any) => {
  event.respondWith(handleEvent(event));
});

async function handleEvent(event: any): Promise<Response> {
  const request = event.request
  const url = new URL(request.url)

  // Allow any API or special prefix to bypass asset handling (adjust as needed)
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/.netlify') ) {
    // Forward to origin or handle API here if your Worker does API logic
    return fetch(request)
  }

  try {
    // Map "clean" routes (no extension in last segment) to index.html, let other paths serve as normal assets
    return await getAssetFromKV(event, {
      mapRequestToAsset: (req: Request) => {
        const u = new URL(req.url)
        const last = u.pathname.split('/').pop() || ''
        // Treat requests with no dot in last segment as SPA routes -> index.html
        if (!last.includes('.')) {
          return new Request(`${u.origin}/index.html`, req)
        }
        // Otherwise use default behavior to serve the asset
        return mapRequestToAsset(req)
      }
    })
  } catch (err) {
    // Fallback: serve index.html on any failure so client-side router can route the path
    const indexReq = new Request(`${url.origin}/index.html`, request)
    try {
      return await getAssetFromKV({ request: indexReq, waitUntil: event.waitUntil })
    } catch (err2) {
      // If even index.html is missing, return a plain 500 or 404 to help debugging
      return new Response('Not found', { status: 404 })
    }
  }
}
