// src/worker.ts
import { Env, ExecutionContext, ScheduledEvent } from './worker-types';
import { corsHeaders } from './constants';
import { handleScheduled } from './scheduled';
import { handleSitemap } from './sitemapGenerator';
import { verifyToken } as auth from './auth';
import { checkApiAccess } from './api-helpers'; // NEW: Import the access checker

// NEW: Import handlers from the new refactored files
import {
    handlePublicSettings,
    handleLatestRates,
    handleRatesByDate,
    handleHistoricalRates,
    handlePublicPosts,
    handlePublicPostBySlug,
    handleImageApi,
    handleArchiveListApi,
    handleArchiveDetailApi
} from './api-public';

import {
    handleFetchAndStore,
    handleSiteSettings,
    handleCheckUser,
    handleAdminLogin,
    handleCheckAttempts,
    handleChangePassword,
    handleRequestPasswordReset,
    handleResetPassword,
    handleUsers,
    handleUserById,
    handlePosts,
    handlePostById,
    handleForexData,
    handleGetApiSettings,
    handleUpdateApiSettings
} from './api-admin';

export default {
    /**
     * Handles scheduled events (CRON triggers).
     */
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(handleScheduled(event, env, ctx));
    },

    /**
     * Handles incoming HTTP requests.
     */
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const { pathname } = url;
        const method = request.method;

        // Handle OPTIONS preflight requests
        if (method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // --- API Routes ---
        if (pathname.startsWith('/api/')) {
            
            // --- NEW: API Access Check Middleware ---
            // This check runs for all public API endpoints.
            // Admin endpoints are checked individually *after* this.
            // We apply it here for public routes.
            
            let accessResponse: Response | null = null;
            
            // --- Public Endpoints (Apply checkApiAccess) ---
            const publicEndpoints = [
                '/api/settings', '/api/latest-rates', '/api/historical-rates',
                '/api/posts', '/api/posts/:slug', '/api/rates/date/:date',
                '/api/image/latest-rates', '/api/archive/list', '/api/archive/detail/:date'
            ];
            
            // Normalize path for dynamic routes
            let endpointToCheck = pathname;
            if (pathname.startsWith('/api/posts/')) endpointToCheck = '/api/posts/:slug';
            if (pathname.startsWith('/api/rates/date/')) endpointToCheck = '/api/rates/date/:date';
            if (pathname.startsWith('/api/archive/detail/')) endpointToCheck = '/api/archive/detail/:date';

            if (publicEndpoints.includes(endpointToCheck)) {
                accessResponse = await checkApiAccess(request, env, ctx, endpointToCheck);
                if (accessResponse) {
                    return accessResponse; // Access denied (disabled, quota, etc.)
                }
            }
            
            // --- Route Handlers ---
            
            // Public Routes
            if (pathname === '/api/settings' && method === 'GET') {
                return handlePublicSettings(request, env);
            }
            if (pathname === '/api/latest-rates' && method === 'GET') {
                return handleLatestRates(request, env);
            }
            if (pathname.startsWith('/api/rates/date/') && method === 'GET') {
                return handleRatesByDate(request, env);
            }
            if (pathname === '/api/historical-rates' && method === 'GET') {
                return handleHistoricalRates(request, env);
            }
            if (pathname === '/api/posts' && method === 'GET') {
                return handlePublicPosts(request, env);
            }
            if (pathname.startsWith('/api/posts/') && method === 'GET') {
                return handlePublicPostBySlug(request, env);
            }
            
            // NEW Public API Routes
            if (pathname === '/api/image/latest-rates' && method === 'GET') {
                return handleImageApi(request, env);
            }
            if (pathname === '/api/archive/list' && method === 'GET') {
                return handleArchiveListApi(request, env);
            }
            if (pathname.startsWith('/api/archive/detail/') && method === 'GET') {
                return handleArchiveDetailApi(request, env);
            }

            // --- Admin Auth Routes (No token required) ---
            if (pathname === '/api/admin/check-user' && method === 'POST') {
                return handleCheckUser(request, env);
            }
            if (pathname === '/api/admin/login' && method === 'POST') {
                return handleAdminLogin(request, env);
            }
            if (pathname === '/api/admin/check-attempts' && method === 'GET') {
                return handleCheckAttempts(request, env);
            }
            if (pathname === '/api/admin/request-password-reset' && method === 'POST') {
                return handleRequestPasswordReset(request, env, ctx);
            }
            if (pathname === '/api/admin/reset-password' && method === 'POST') {
                return handleResetPassword(request, env);
            }

            // --- Admin Protected Routes (Token required) ---
            // All other /api/admin/* routes
            if (pathname.startsWith('/api/admin/')) {
                const authHeader = request.headers.get('Authorization');
                const token = authHeader?.replace('Bearer ', '');
                
                if (!token || !(await auth.verifyToken(token))) {
                    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
                }

                // Token is valid, proceed to admin handlers
                if (pathname === '/api/admin/change-password' && method === 'POST') {
                    return handleChangePassword(request, env);
                }
                if (pathname === '/api/admin/fetch-nrb' && method === 'POST') {
                    return handleFetchAndStore(request, env);
                }
                if (pathname === '/api/admin/settings') {
                    return handleSiteSettings(request, env); // GET or POST
                }
                if (pathname === '/api/admin/users' && (method === 'GET' || method === 'POST')) {
                    return handleUsers(request, env);
                }
                if (pathname.startsWith('/api/admin/users/') && method === 'DELETE') {
                    return handleUserById(request, env);
                }
                if (pathname === '/api/admin/posts' && (method === 'GET' || method === 'POST')) {
                    return handlePosts(request, env);
                }
                if (pathname.startsWith('/api/admin/posts/') && (method === 'GET' || method === 'PUT' || method === 'DELETE')) {
                    return handlePostById(request, env);
                }
                if (pathname === '/api/admin/forex-data' && (method === 'GET' || method === 'POST')) {
                    return handleForexData(request, env);
                }
                
                // NEW Admin API Settings Routes
                if (pathname === '/api/admin/api-settings' && method === 'GET') {
                    return handleGetApiSettings(request, env);
                }
                if (pathname === '/api/admin/api-settings' && method === 'POST') {
                    return handleUpdateApiSettings(request, env);
                }
            }

            return new Response(JSON.stringify({ error: 'API route not found' }), { status: 404, headers: corsHeaders });
        }

        // --- Sitemap ---
        if (pathname === '/sitemap.xml' || pathname === '/sitemap_index.xml') {
            return handleSitemap(request, env);
        }

        // --- Serve Static Assets (from KV) ---
        try {
            // This relies on the Pages "catch-all" behavior configured in _routes.json
            // or the default behavior of serving assets.
            // For a pure worker, you'd use env.__STATIC_CONTENT.get(...)
            // But since this is a Pages project, we let it fall through.
            
            // This is a common pattern for SPA (Single Page App) routing
            // If the file isn't found, it should serve index.html
            
            // Let Pages function handle static assets
            // The `next()` function is typically available in Pages functions middleware
            // In a pure worker, this part is handled differently.
            // Assuming this is a Pages project, we just need to handle API routes.
            // The rest will be handled by the static asset server.
            
            // Fallback for SPA routing - if not an asset, serve index.html
            // This logic is often implicit in Pages, but explicit here for clarity.
            // We assume if it's not an API route, Pages will try to find it.
            // If it fails, it should serve the index.html for client-side routing.
            
            // This part is tricky without seeing the full Pages setup.
            // We'll assume that Pages handles non-API routes.
            // If you're using a worker *only*, you need to serve index.html:
            /*
            if (method === 'GET') {
                const asset = await env.__STATIC_CONTENT.get(pathname);
                if (asset) {
                    // ... serve asset
                }
                // Serve index.html as SPA fallback
                const indexHtml = await env.__STATIC_CONTENT.get('index.html');
                return new Response(indexHtml, { headers: { 'Content-Type': 'text/html' }});
            }
            */
            // Since you have a complex setup, we'll let non-API routes fall through
            // to the default Pages behavior.
        } catch (e) {
            // Fallback: Serve index.html for SPA routing
            try {
                const indexHtml = await env.__STATIC_CONTENT.get('index.html');
                return new Response(indexHtml, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } });
            } catch (err) {
                return new Response('Not found', { status: 404, headers: corsHeaders });
            }
        }
        
        // This return is crucial for Pages to serve static files
        // We're returning the original request to be handled by the static asset server
        return env.__STATIC_CONTENT.fetch(request);
    },
};
