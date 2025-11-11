// src/worker.ts
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { Env, ExecutionContext, ScheduledEvent } from './worker-types';
import * as sitemap from './sitemapGenerator';
import * as api from './api-handlers';
import { handleScheduled } from './scheduled';
import { handleOptions } from './worker-utils';

export default {
    /**
     * Handles all incoming HTTP requests (API, Sitemaps, Static Assets).
     */
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // Handle CORS pre-flight requests
        if (request.method === 'OPTIONS') {
            return handleOptions(request);
        }

        try {
            // --- API ROUTING ---
            
            // Public API Endpoints
            if (pathname === '/api/settings') {
                return api.handlePublicSettings(request, env);
            }
            // --- NEW: Add /api/latest-rates route ---
            if (pathname === '/api/latest-rates') {
                return api.handleLatestRates(request, env);
            }
            if (pathname === '/api/historical-rates') {
                return api.handleHistoricalRates(request, env);
            }
            if (pathname === '/api/posts') {
                return api.handlePublicPosts(request, env);
            }
            if (pathname.startsWith('/api/posts/')) {
                return api.handlePublicPostBySlug(request, env);
            }
            if (pathname.startsWith('/api/rates/date/')) {
                return api.handleRatesByDate(request, env);
            }

            // Admin API Endpoints - Auth
            if (pathname === '/api/admin/check-user') {
                return api.handleCheckUser(request, env);
            }
            if (pathname === '/api/admin/login') {
                return api.handleAdminLogin(request, env);
            }
            if (pathname === '/api/admin/check-attempts') {
                return api.handleCheckAttempts(request, env);
            }
            if (pathname === '/api/admin/change-password') {
                return api.handleChangePassword(request, env);
            }
            if (pathname === '/api/admin/request-password-reset') {
                return api.handleRequestPasswordReset(request, env, ctx); // Pass ctx for waitUntil
            }
            if (pathname === '/api/admin/reset-password') {
                return api.handleResetPassword(request, env);
            }

            // Admin API Endpoints - Data Management (Token Required)
            if (pathname === '/api/fetch-and-store') {
                return api.handleFetchAndStore(request, env);
            }
            if (pathname === '/api/admin/settings') {
                return api.handleSiteSettings(request, env);
            }
            if (pathname === '/api/admin/forex-data') {
                return api.handleForexData(request, env);
            }
            if (pathname === '/api/admin/users') {
                return api.handleUsers(request, env);
            }
            if (pathname.startsWith('/api/admin/users/')) {
                return api.handleUserById(request, env);
            }
            if (pathname === '/api/admin/posts') {
                return api.handlePosts(request, env);
            }
            if (pathname.startsWith('/api/admin/posts/')) {
                return api.handlePostById(request, env);
            }

            // --- SITEMAP ROUTING ---
            const sitemapHeaders = {
                "content-type": "application/xml; charset=utf-8",
                "cache-control": "public, max-age=3600",
            };
            if (pathname === '/sitemap.xml') {
                const archiveSitemapCount = sitemap.getArchiveSitemapCount();
                const xml = sitemap.generateSitemapIndex(archiveSitemapCount);
                return new Response(xml, { headers: sitemapHeaders });
            }
            if (pathname === '/page-sitemap.xml') {
                const xml = sitemap.generatePageSitemap();
                return new Response(xml, { headers: sitemapHeaders });
            }
            if (pathname === '/post-sitemap.xml') {
                const xml = await sitemap.generatePostSitemap(env.FOREX_DB);
                return new Response(xml, { headers: sitemapHeaders });
            }
            const archiveMatch = pathname.match(/\/archive-sitemap(\d+)\.xml$/);
            if (archiveMatch && archiveMatch[1]) {
                const id = parseInt(archiveMatch[1]);
                const xml = sitemap.generateArchiveSitemap(id);
                if (!xml) {
                    return new Response('Sitemap not found', { status: 404 });
                }
                return new Response(xml, { headers: sitemapHeaders });
            }

            // --- Static Asset Serving (SPA Fallback) ---
            return await getAssetFromKV(
                { request, waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise) },
                { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
            );

        } catch (e: any) {
            // Handle 404s by serving index.html for SPA routing
            if (e instanceof Error && e.message.includes('404') || e.status === 404) {
                try {
                    const indexRequest = new Request(new URL('/', request.url).toString(), request);
                    return await getAssetFromKV(
                        { request: indexRequest, waitUntil: (p) => ctx.waitUntil(p) },
                        { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
                    );
                } catch (e2) {
                     return new Response('Not Found', { status: 404 });
                }
            } else {
                 console.error('Worker fetch error:', e.message, e.stack);
                 return new Response('Internal Server Error', { status: 500 });
            }
        }
    },

    /**
     * Handles scheduled cron jobs.
     */
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(handleScheduled(event, env));
    }
};
