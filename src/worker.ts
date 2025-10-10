import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler'

addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleEvent(event))
})

async function handleEvent(event: FetchEvent): Promise<Response> {
  try {
    // Try to serve the requested static asset first.
    // For "clean" routes (no dot/extension) map to index.html so the SPA router can handle it.
    return await getAssetFromKV(event, {
      mapRequestToAsset: (request: Request) => {
        const url = new URL(request.url)
        // If the path doesn't look like a file (no '.' in last segment), serve index.html
        const lastSegment = url.pathname.split('/').pop() || ''
        if (!lastSegment.includes('.')) {
          return new Request(`${url.origin}/index.html`, request)
        }
        // Otherwise, use default mapping (serves the requested asset)
        return mapRequestToAsset(request)
      }
    })
  } catch (err) {
    // If getAssetFromKV throws (asset not found or other issues),
    // explicitly serve index.html as a fallback so the SPA router receives the path.
    const url = new URL(event.request.url)
    const indexRequest = new Request(`${url.origin}/index.html`, event.request)
    return await getAssetFromKV({ request: indexRequest, waitUntil: event.waitUntil })
  }
}