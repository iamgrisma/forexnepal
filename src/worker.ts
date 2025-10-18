// src/worker.ts

// --- Interfaces (Keep all your D1Database, D1Result, Env, etc. interfaces) ---
// Ensure the Env interface includes the optional ASSETS binding
interface Env {
    FOREX_DB: D1Database;
    ASSETS?: { fetch: typeof fetch }; // Service binding injected by Pages
    // __STATIC_CONTENT KV binding is NOT needed and should NOT be used here
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
                // (Paste ALL your specific API handlers like handleCheckData, handleAdminLogin, etc. here)
                if (url.pathname === '/api/check-data') return handleCheckData(request, env);
                if (url.pathname === '/api/fetch-and-store') return handleFetchAndStore(request, env);
                if (url.pathname === '/api/historical-rates') return handleHistoricalRates(request, env); // Use the corrected version
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
            // This is the ONLY part that should handle non-API requests in a Pages Function.
            if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
                // Let Cloudflare Pages handle the request based on _routes.json and static files
                return await env.ASSETS.fetch(request);
            } else {
                // If the ASSETS binding is missing, something is wrong with the deployment configuration.
                console.error(`Worker: Critical Error - env.ASSETS binding is missing. Cannot serve static content.`);
                return new Response('Configuration error: Site assets cannot be served.', { status: 500 });
            }

        } catch (error: any) {
            // --- Global Error Handler ---
            console.error(`Worker: Unhandled Error processing ${request.method} ${url.pathname}:`, error.message, error.stack);
            // Return a generic 500 response
            // Avoid leaking detailed error messages in production if possible
            return new Response('Internal Server Error', { status: 500 });
        }
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`Worker: Triggering scheduled task: ${event.cron}`);
        ctx.waitUntil(updateForexData(env));
    }
};

// --- API Handler Functions ---
// *** IMPORTANT: Paste ALL your API handler functions (handleCheckData, handleAdminLogin, handlePosts, handleHistoricalRates (corrected), etc.) AND utility functions (formatDate, simpleHash, etc.) below here. ***

// Example (ensure you have the full, corrected function):
async function handleHistoricalRates(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    const currencyCode = url.searchParams.get('currency')?.toUpperCase();
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    if (!currencyCode || !fromDate || !toDate) return new Response(JSON.stringify({ success: false, error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!CURRENCIES.includes(currencyCode)) return new Response(JSON.stringify({ success: false, error: 'Invalid currency code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        const query = `SELECT * FROM forex_rates WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC`;
        const results = await env.FOREX_DB.prepare(query).bind(fromDate, toDate).all<ForexRateData>();
        if (!results.success || !results.results) throw new Error("Database query failed.");

        const buyKey = `${currencyCode}_buy`;
        const sellKey = `${currencyCode}_sell`;
        const formattedData = results.results
            .map(row => {
                const buyRate = row[buyKey]; const sellRate = row[sellKey];
                if (typeof buyRate === 'number' && typeof sellRate === 'number') { return { date: row.date, buy_rate: buyRate, sell_rate: sellRate }; } return null;
            }).filter(item => item !== null);

        return new Response(JSON.stringify({ success: true, data: formattedData, currency: currencyCode, count: formattedData.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error: any) {
        console.error(`Error in handleHistoricalRates for ${currencyCode}:`, error);
        return new Response(JSON.stringify({ success: false, error: 'Server error: ' + error.message, data: [] }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}

// ... PASTE ALL OTHER HANDLERS AND UTILITIES HERE ...
// Make sure updateForexData is also included
async function updateForexData(env: Env): Promise<void> { /* ... Your full scheduled logic ... */ }
function formatDate(date: Date): string { if (!(date instanceof Date) || isNaN(date.getTime())) date = new Date(); return date.toISOString().split('T')[0]; }
function generateToken(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join(''); }
function verifyToken(token: string): boolean { return typeof token === 'string' && token.length > 40; } // Basic check
async function simpleHash(password: string): Promise<string> { if (typeof password !== 'string' || password.length === 0) throw new Error("Password cannot be empty"); const data = new TextEncoder().encode(password); const hash = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function simpleHashCompare(password: string, hash: string): Promise<boolean> { if (typeof password !== 'string' || typeof hash !== 'string' || hash.length === 0) return false; try { const passwordHash = await simpleHash(password); return passwordHash.length === hash.length && passwordHash === hash; } catch (error) { console.error("Error during hash comparison:", error); return false; } }
function generateSlug(title: string): string { if (typeof title !== 'string') return ''; return title.toLowerCase().replace(/['`‘’"“”]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 75); }
// Add ALL other handlers: handleCheckData, handleFetchAndStore, handlePublicPosts, handlePublicPostBySlug, handleAdminLogin, handleCheckAttempts, handleChangePassword, handlePosts, handlePostById, handleForexData, handleSiteSettings
