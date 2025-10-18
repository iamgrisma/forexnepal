// src/worker.ts

// --- Interfaces (Keep all your D1Database, D1Result, Env, etc. interfaces) ---
// Ensure the Env interface includes the optional ASSETS binding
interface Env {
    FOREX_DB: D1Database;
    ASSETS?: { fetch: typeof fetch }; // Service binding injected by Pages
    // __STATIC_CONTENT is NO LONGER NEEDED for Pages deployment
}
// Add other necessary interfaces like D1Database, D1PreparedStatement, etc.
interface D1Database { prepare(query: string): D1PreparedStatement; batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>; exec(query: string): Promise<D1ExecResult>; }
interface D1PreparedStatement { bind(...values: any[]): D1PreparedStatement; all<T = unknown>(): Promise<D1Result<T>>; run<T = unknown>(): Promise<D1Result<T>>; first<T = unknown>(colName?: string): Promise<T | null>; raw<T = unknown>(): Promise<T[]>;}
interface D1Result<T = unknown> { results?: T[]; success: boolean; meta?: any; error?: string; }
interface D1ExecResult { count: number | null; duration: number; }
interface ExecutionContext { waitUntil(promise: Promise<any>): void; passThroughOnException(): void; }
interface ScheduledEvent { scheduledTime: number; cron: string; }
interface ForexRateData { date: string; [key: string]: string | number | null; }
interface PostData { id?: number; title: string; slug?: string | null; excerpt?: string | null; content: string; featured_image_url?: string | null; author_name?: string | null; author_url?: string | null; status: 'draft' | 'published'; published_at?: string | null; meta_title?: string | null; meta_description?: string | null; meta_keywords?: string | null; }
// --- End Interfaces ---

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD', 'SGD', 'JPY', 'CNY', 'SAR', 'QAR', 'THB', 'AED', 'MYR', 'KRW', 'SEK', 'DKK', 'HKD', 'KWD', 'BHD', 'OMR'];
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', };

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        try {
            // --- STEP 1: Handle API Routes ---
            if (url.pathname.startsWith('/api/')) {
                if (request.method === 'OPTIONS') {
                    return new Response(null, { headers: corsHeaders });
                }
                // --- Specific API Route Logic ---
                // (Include all your API route handlers here as before)
                if (url.pathname === '/api/check-data') return handleCheckData(request, env);
                if (url.pathname === '/api/fetch-and-store') return handleFetchAndStore(request, env);
                if (url.pathname === '/api/historical-rates') return handleHistoricalRates(request, env);
                if (url.pathname === '/api/posts') return handlePublicPosts(request, env);
                if (url.pathname.startsWith('/api/posts/')) { const slugPart = url.pathname.split('/').pop(); if (slugPart && !/^\d+$/.test(slugPart)) return handlePublicPostBySlug(request, env); }
                if (url.pathname === '/api/admin/login') return handleAdminLogin(request, env);
                if (url.pathname === '/api/admin/check-attempts') return handleCheckAttempts(request, env);
                if (url.pathname === '/api/admin/change-password') return handleChangePassword(request, env);
                if (url.pathname === '/api/admin/posts') return handlePosts(request, env);
                if (url.pathname.startsWith('/api/admin/posts/')) { const idPart = url.pathname.split('/').pop(); if (idPart && /^\d+$/.test(idPart)) return handlePostById(request, env); }
                if (url.pathname === '/api/admin/forex-data') return handleForexData(request, env);
                if (url.pathname === '/api/admin/settings') return handleSiteSettings(request, env);
                // --- Fallback for unmatched API routes ---
                console.log(`Worker: Unmatched API route: ${url.pathname}`);
                return new Response(JSON.stringify({ error: 'API route not found.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
            }

            // --- STEP 2: Handle Non-API Requests (Delegate to Pages ASSETS) ---
            // If the ASSETS binding exists, Cloudflare Pages will handle static files and SPA routing.
            if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
                console.log(`Worker: Delegating to env.ASSETS for path: ${url.pathname}`);
                // Let Pages handle the request based on _routes.json and static files
                return await env.ASSETS.fetch(request);
            }

            // --- STEP 3: Handle Case Where ASSETS Binding is Missing ---
            // This should *not* happen in a standard Pages Functions deployment.
            // If it does, it indicates a configuration problem.
            console.error(`Worker: Critical Error - env.ASSETS binding is missing. Cannot serve static content for path: ${url.pathname}`);
            return new Response('Configuration error: ASSETS binding missing.', { status: 500 });

        } catch (error: any) {
            // --- Global Error Handler ---
            console.error(`Worker: Unhandled Error processing ${request.method} ${url.pathname}:`, error.message, error.stack);
            return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
        }
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`Worker: Triggering scheduled task: ${event.cron}`);
        ctx.waitUntil(updateForexData(env)); // Ensure updateForexData uses the Env type
    }
};


// --- API Handler Functions ---
// (Keep ALL your existing handler functions: handleCheckData, handleFetchAndStore,
// handleHistoricalRates (the corrected one), handlePublicPosts, handlePublicPostBySlug,
// handleAdminLogin, handleCheckAttempts, handleChangePassword, handlePosts,
// handlePostById, handleForexData, handleSiteSettings)
// Make sure they handle OPTIONS and return correct CORS headers.

// --- Utility Functions ---
// (Keep ALL your existing utility functions: formatDate, generateToken, verifyToken,
// simpleHash, simpleHashCompare, generateSlug)

// --- Scheduled Handler ---
// (Keep your existing updateForexData function, ensure it uses the Env type)

// --- Make sure ALL handlers used above are actually defined below
