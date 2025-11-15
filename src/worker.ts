// iamgrisma/forexnepal/forexnepal-892e763f1401a81eb2bc3250b64698c85e1f23bd/src/worker.ts
import { Env, ExecutionContext, ScheduledEvent } from './worker-types';
import { corsHeaders } from './constants';
import { handleScheduled } from './scheduled';
import { handleSitemap } from './sitemapGenerator';
import * as auth from './auth'; // Correct import
import { checkApiAccess } from './api-helpers';

// Import handlers from the new refactored files
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
    handleUpdateApiSettings,
    handleGoogleLoginCallback,
    // --- IMPORT NEW HANDLER ---
    handleLoginWithResetToken
    // --- REMOVED OLD HANDLERS (handleOneTimeLogin, handleGenerateOneTimeLoginCode) ---
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
            
            let accessResponse: Response | null = null;
            
            // --- Public Endpoints (Apply checkApiAccess) ---
            const publicEndpoints = [
                '/api/settings', '/api/latest-rates', '/api/historical-rates',
                '/api/posts', '/api/posts/:slug', '/api/rates/date/:date',
                '/api/image/latest-rates', '/api/archive/list', '/api/archive/detail/:date'
            ];
            
            let endpointToCheck = pathname;
            if (pathname.startsWith('/api/posts/')) endpointToCheck = '/api/posts/:slug';
            if (pathname.startsWith('/api/rates/date/')) endpointToCheck = '/api/rates/date/:date';
            if (pathname.startsWith('/api/archive/detail/')) endpointToCheck = '/api/archive/detail/:date';

            if (publicEndpoints.includes(endpointToCheck)) {
                accessResponse = await checkApiAccess(request, env, ctx, endpointToCheck);
                if (accessResponse) {
                    return accessResponse; 
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
                return handleAdminLogin(request, env); // env contains JWT_SECRET
            }
            // --- REMOVED OLD ROUTE ---
            // if (pathname === '/api/admin/login-one-time' && method === 'POST')
            
            // --- ADD NEW GOOGLE CALLBACK ROUTE ---
            if (pathname === '/api/admin/auth/google/callback' && method === 'POST') {
                return handleGoogleLoginCallback(request, env); // env contains GOOGLE secrets
            }
            // --- END NEW ROUTE ---
            if (pathname === '/api/admin/check-attempts' && method === 'GET') {
                return handleCheckAttempts(request, env);
            }
            if (pathname === '/api/admin/request-password-reset' && method === 'POST') {
                return handleRequestPasswordReset(request, env, ctx); // env contains BREVO_API_KEY
            }
            if (pathname === '/api/admin/reset-password' && method === 'POST') {
                return handleResetPassword(request, env);
            }
            // --- ADD NEW LOGIN-WITH-TOKEN ROUTE ---
            if (pathname === '/api/admin/login-with-token' && method === 'POST') {
                return handleLoginWithResetToken(request, env); // env contains JWT_SECRET
            }
            // --- END NEW ROUTE ---


            // --- Admin Protected Routes (Token required) ---
            if (pathname.startsWith('/api/admin/')) {
                const authHeader = request.headers.get('Authorization');
                const token = authHeader?.replace('Bearer ', '');
                
                // Pass the secret from env to verifyToken
                if (!token || !(await auth.verifyToken(token, env.JWT_SECRET))) {
                    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
                }

                // Token is valid, proceed to admin handlers
                if (pathname === '/api/admin/change-password' && method === 'POST') {
                    return handleChangePassword(request, env); // env contains JWT_SECRET
                }
                if (pathname === '/api/admin/fetch-nrb' && method === 'POST') {
                    return handleFetchAndStore(request, env); // env contains JWT_SECRET
                }
                if (pathname === '/api/admin/settings') {
                    return handleSiteSettings(request, env); // env contains JWT_SECRET
                }
                if (pathname === '/api/admin/users' && (method === 'GET' || method === 'POST')) {
                    return handleUsers(request, env); // env contains JWT_SECRET
                }
                if (pathname.startsWith('/api/admin/users/') && method === 'DELETE') {
                    return handleUserById(request, env); // env contains JWT_SECRET
                }
                if (pathname === '/api/admin/posts' && (method === 'GET' || method === 'POST')) {
                    return handlePosts(request, env); // env contains JWT_SECRET
                }
                if (pathname.startsWith('/api/admin/posts/') && (method === 'GET' || method === 'PUT' || method === 'DELETE')) {
                    return handlePostById(request, env); // env contains JWT_SECRET
                }
                if (pathname === '/api/admin/forex-data' && (method === 'GET' || method === 'POST')) {
                    return handleForexData(request, env); // env contains JWT_SECRET
                }
                if (pathname === '/api/admin/api-settings' && method === 'GET') {
                    return handleGetApiSettings(request, env); // env contains JWT_SECRET
                }
                if (pathname === '/api/admin/api-settings' && method === 'POST') {
                    return handleUpdateApiSettings(request, env); // env contains JWT_SECRET
                }
                // --- REMOVED OLD ROUTE ---
                // if (pathname === '/api/admin/generate-login-code' && method === 'POST')
            }

            // --- THIS IS THE LINE I FIXED (added colon) ---
            return new Response(JSON.stringify({ error: 'API route not found' }), { status: 404, headers: corsHeaders });
        }

        // --- START: MODIFIED OAuth Callback Fix ---
        // This intercepts the non-hash URL from the OAuth provider
        // and redirects to the correct hash-based URL for the React app.
        if (pathname === '/admin/auth/google/callback') {
            const newUrl = new URL(request.url);
            
            // Get the query string (e.g., ?code=...&scope=...)
            const searchParams = url.search;
            
            // Set the path to the root, where index.html is served
            newUrl.pathname = '/';
            
            // Set the hash to point to the React route AND pass the params
            newUrl.hash = `/admin/auth/google/callback${searchParams}`;
            
            // *** THIS IS THE FIX ***
            // Clear the search params from the main URL to prevent duplication
            newUrl.search = '';

            // Issue the redirect
            return Response.redirect(newUrl.toString(), 302);
        }
        // --- END: MODIFIED OAuth Callback Fix ---


        // --- Sitemap ---
        if (pathname === '/sitemap.xml' || pathname === '/sitemap_index.xml') {
            return handleSitemap(request, env);
        }

        // --- Serve Static Assets (from KV) ---
        try {
            const assetKey = pathname === '/' ? 'index.html' : pathname.slice(1);
            const asset = await env.__STATIC_CONTENT.get(assetKey, 'arrayBuffer');
            
            if (asset) {
                const contentType = getContentType(pathname);
                return new Response(asset, {
                    headers: {
                        'Content-Type': contentType,
                        ...corsHeaders
                    }
                });
            }
            
            // If asset not found, fall through to index.html
            const indexHtml = await env.__STATIC_CONTENT.get('index.html', 'text');
            return new Response(indexHtml, { 
                headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
            });
        } catch (e) {
            return new Response('Not found', { status: 404, headers: corsHeaders });
        }
    },
};

// Helper function to determine content type
function getContentType(pathname: string): string {
    const ext = pathname.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
        'html': 'text/html',
        'js': 'application/javascript',
        'css': 'text/css',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
        'xml': 'application/xml',
        'txt': 'text/plain',
    };
    return types[ext || ''] || 'application/octet-stream';
}
