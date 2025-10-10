// Cloudflare Pages middleware for SPA routing
// This serves index.html for all non-asset routes

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // List of static file extensions and paths to serve directly
  const staticPaths = ['/ads.txt', '/favicon.ico', '/og-image.png', '/placeholder.svg'];
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf'];

  // Check if it's a static file
  const isStaticFile = staticPaths.includes(pathname) || 
                       staticExtensions.some(ext => pathname.endsWith(ext)) ||
                       pathname.startsWith('/assets/');

  // If it's a static file, serve it directly
  if (isStaticFile) {
    return context.next();
  }

  // For all other routes, serve index.html (SPA routing)
  try {
    const response = await context.env.ASSETS.fetch(new URL('/index.html', context.request.url));
    return new Response(response.body, {
      ...response,
      headers: {
        ...Object.fromEntries(response.headers),
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    // Fallback: try to serve the original request
    return context.next();
  }
}
