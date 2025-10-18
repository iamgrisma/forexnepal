// src/worker.ts
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

// --- Interfaces (Keep all your D1Database, D1Result, Env, etc. interfaces) ---
interface D1Database { prepare(query: string): D1PreparedStatement; batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>; exec(query: string): Promise<D1ExecResult>; /* Add dump if needed */}
interface D1PreparedStatement { bind(...values: any[]): D1PreparedStatement; all<T = unknown>(): Promise<D1Result<T>>; run<T = unknown>(): Promise<D1Result<T>>; first<T = unknown>(colName?: string): Promise<T | null>; raw<T = unknown>(): Promise<T[]>;}
interface D1Result<T = unknown> { results?: T[]; success: boolean; meta?: any; error?: string; }
interface D1ExecResult { count: number | null; duration: number; } // count can be null
interface KVNamespace { get(key: string, options?: any): Promise<any>; put(key: string, value: any, options?: any): Promise<void>; delete(key: string): Promise<void>; list?(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>; }
interface ExecutionContext { waitUntil(promise: Promise<any>): void; passThroughOnException(): void; }
interface ScheduledEvent { scheduledTime: number; cron: string; }
interface Env {
    FOREX_DB: D1Database;
    __STATIC_CONTENT: KVNamespace; // Fallback KV binding
    ASSETS?: { fetch: typeof fetch }; // Service binding injected by Pages
}
interface ForexRateData { date: string; [key: string]: string | number | null; }
interface PostData { id?: number; title: string; slug?: string | null; excerpt?: string | null; content: string; featured_image_url?: string | null; author_name?: string | null; author_url?: string | null; status: 'draft' | 'published'; published_at?: string | null; meta_title?: string | null; meta_description?: string | null; meta_keywords?: string | null; }
// --- End Interfaces ---


const CURRENCIES = [
  'INR', 'USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD', 'SGD',
  'JPY', 'CNY', 'SAR', 'QAR', 'THB', 'AED', 'MYR', 'KRW',
  'SEK', 'DKK', 'HKD', 'KWD', 'BHD', 'OMR'
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust in production
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// --- Type guard for ASSETS binding ---
function hasAssetsBinding(env: any): env is Env & { ASSETS: { fetch: typeof fetch } } {
    return env && typeof env.ASSETS === 'object' && typeof env.ASSETS.fetch === 'function';
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        try {
            // --- STEP 1: Handle API Routes ---
            if (url.pathname.startsWith('/api/')) {
                // Global OPTIONS handler for API routes
                if (request.method === 'OPTIONS') {
                    return new Response(null, { headers: corsHeaders });
                }

                // --- Specific API Route Logic ---
                if (url.pathname === '/api/check-data') return handleCheckData(request, env);
                if (url.pathname === '/api/fetch-and-store') return handleFetchAndStore(request, env);
                if (url.pathname === '/api/historical-rates') return handleHistoricalRates(request, env); // Use the corrected version from previous step
                if (url.pathname === '/api/posts') return handlePublicPosts(request, env);
                if (url.pathname.startsWith('/api/posts/')) {
                    const slugPart = url.pathname.split('/').pop();
                    if (slugPart && !/^\d+$/.test(slugPart)) return handlePublicPostBySlug(request, env);
                }
                if (url.pathname === '/api/admin/login') return handleAdminLogin(request, env);
                if (url.pathname === '/api/admin/check-attempts') return handleCheckAttempts(request, env);
                if (url.pathname === '/api/admin/change-password') return handleChangePassword(request, env);
                if (url.pathname === '/api/admin/posts') return handlePosts(request, env);
                if (url.pathname.startsWith('/api/admin/posts/')) {
                    const idPart = url.pathname.split('/').pop();
                    if (idPart && /^\d+$/.test(idPart)) return handlePostById(request, env);
                }
                if (url.pathname === '/api/admin/forex-data') return handleForexData(request, env);
                if (url.pathname === '/api/admin/settings') return handleSiteSettings(request, env);

                // --- Fallback for unmatched API routes ---
                console.log(`Worker: Unmatched API route: ${url.pathname}`);
                return new Response(JSON.stringify({ error: 'API route not found.' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // --- STEP 2: Handle Non-API Requests (Delegate to Pages ASSETS) ---
            // If the ASSETS binding exists (standard Pages + Functions setup), use it.
            // This lets Cloudflare Pages handle static files and SPA routing via _routes.json.
            if (hasAssetsBinding(env)) {
                console.log(`Worker: Delegating to env.ASSETS for path: ${url.pathname}`);
                return await env.ASSETS.fetch(request);
            }

            // --- STEP 3: Fallback using getAssetFromKV (If ASSETS binding is absent) ---
            // This is less common for Pages+Functions but useful for `wrangler dev` or worker-only mode.
            console.warn(`Worker: env.ASSETS binding not found. Falling back to getAssetFromKV for ${url.pathname}.`);
            try {
                // Try to fetch the asset directly from KV
                return await getAssetFromKV(
                    { request, waitUntil: ctx.waitUntil },
                    { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
                );
            } catch (e: any) {
                // If asset not found (likely an SPA route), serve index.html
                if (e.constructor.name === 'NotFoundError' || e.status === 404) {
                    console.log(`Worker: Asset not found via getAssetFromKV for ${url.pathname}. Serving index.html (SPA fallback).`);
                    const spaRequest = new Request(new URL('/', request.url), request);
                    const indexResponse = await getAssetFromKV(
                        { request: spaRequest, waitUntil: ctx.waitUntil },
                        { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
                    );
                    return new Response(indexResponse.body, { ...indexResponse, status: 200 }); // Serve index.html with 200 OK
                } else {
                    // Re-throw other errors (like permission issues)
                    throw e;
                }
            }

        } catch (error: any) {
            // --- Global Error Handler ---
            console.error(`Worker: Unhandled error processing request for ${url.pathname}:`, error);
            // Provide a generic 500 response
            return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
        }
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`Worker: Triggering scheduled task: ${event.cron}`);
        ctx.waitUntil(updateForexData(env));
    }
};


// --- API Handler Functions (handleCheckData, handleFetchAndStore, etc.) ---
// Make sure you have the CORRECTED handleHistoricalRates from the previous step.
// All other handlers remain the same.
// Example stubs:
async function handleCheckData(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    // ... your implementation ...
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    if (!fromDate || !toDate) return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     try {
         const results = await env.FOREX_DB.prepare(
           `SELECT DISTINCT date FROM forex_rates WHERE date >= ? AND date <= ? ORDER BY date ASC`
         ).bind(fromDate, toDate).all<{ date: string }>();

         const existingDates = new Set(results.results?.map(r => r.date) || []);
         const missingDates: string[] = [];
         const start = new Date(fromDate);
         const end = new Date(toDate);

         for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
             const dateStr = formatDate(new Date(d)); // Use your formatDate utility
             if (!existingDates.has(dateStr)) {
                 missingDates.push(dateStr);
             }
         }

         return new Response(JSON.stringify({
           exists: missingDates.length === 0,
           missingDates,
         }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       } catch (error: any) {
         console.error('Database error in checkData:', error);
         return new Response(JSON.stringify({ error: 'Database error: ' + error.message, exists: false, missingDates: [] }), {
           status: 500,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }
}
async function handleFetchAndStore(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    // ... your implementation ...
      const url = new URL(request.url);
      const fromDate = url.searchParams.get('from');
      const toDate = url.searchParams.get('to');

      if (!fromDate || !toDate) {
        return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

       try {
           const nrbUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDate}&to=${toDate}`;
           console.log(`Fetching from NRB: ${nrbUrl}`);
           const response = await fetch(nrbUrl);

         if (!response.ok) {
            console.error(`NRB API error: ${response.status} ${response.statusText}`);
           const errorBody = await response.text();
           console.error("NRB Error Body:", errorBody);
           throw new Error(`NRB API error: ${response.status}`);
         }

         const data = await response.json();
          console.log(`Received ${data?.data?.payload?.length || 0} days of data from NRB.`);

         if (!data?.data?.payload || data.data.payload.length === 0) {
           return new Response(JSON.stringify({
             success: true, message: 'No data available from NRB API for this range.', stored: 0, fromDate, toDate, data: []
           }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         }

         let storedCount = 0;
         const statements: D1PreparedStatement[] = [];

         for (const dayData of data.data.payload) {
           const dateStr = dayData.date;
           if (!dateStr || !dayData.rates) continue; // Skip if date or rates are missing

           const columns: string[] = ['date', 'updated_at'];
           const placeholders: string[] = ['?', "datetime('now')"];
           const values: (string | number | null)[] = [dateStr];
           const rateMap = new Map(dayData.rates.map((r: any) => [r.currency.iso3, r]));

           for (const currencyCode of CURRENCIES) {
                 const rate = rateMap.get(currencyCode);
                 const buyRate = rate && rate.buy != null ? parseFloat(rate.buy) : null;
                 const sellRate = rate && rate.sell != null ? parseFloat(rate.sell) : null;

                 columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`);
                 placeholders.push('?', '?');
                 values.push(isNaN(buyRate!) ? null : buyRate, isNaN(sellRate!) ? null : sellRate);
           }

           if (columns.length > 2) {
               const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
               statements.push(env.FOREX_DB.prepare(query).bind(...values));
           } else {
              console.warn(`No valid currency data to insert for date: ${dateStr}`);
           }
         }

         if (statements.length > 0) {
             console.log(`Executing batch insert/replace for ${statements.length} dates.`);
              const batchResult = await env.FOREX_DB.batch(statements);
              let successfulStatements = 0;
              batchResult.forEach((res, index) => {
                  if (res.success) {
                     successfulStatements++;
                  } else {
                       console.error(`Error in batch statement ${index}:`, res.error || res.meta);
                  }
              });
              storedCount = successfulStatements;
              console.log(`Batch finished. Success: ${successfulStatements}, Failures: ${statements.length - successfulStatements}`);
         }

         return new Response(JSON.stringify({
           success: true, stored: storedCount, totalFetched: data.data.payload.length, fromDate, toDate
         }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       } catch (error: any) {
         console.error('Error fetching and storing data:', error);
         return new Response(JSON.stringify({
           success: false, error: `Failed to fetch and store data: ${error.message}`
         }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
}
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
                if (typeof buyRate === 'number' && typeof sellRate === 'number') {
                    return { date: row.date, buy_rate: buyRate, sell_rate: sellRate };
                } return null;
            }).filter(item => item !== null);

        return new Response(JSON.stringify({ success: true, data: formattedData, currency: currencyCode, count: formattedData.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error: any) {
        console.error(`Error in handleHistoricalRates for ${currencyCode}:`, error);
        return new Response(JSON.stringify({ success: false, error: 'Server error: ' + error.message, data: [] }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}
async function handlePublicPosts(request: Request, env: Env): Promise<Response> { if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders }); try { const result = await env.FOREX_DB.prepare(`SELECT id, title, slug, excerpt, featured_image_url, author_name, author_url, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 50`).all(); return new Response(JSON.stringify({ success: true, posts: result.results || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } catch (error: any) { console.error("Error fetching public posts:", error); return new Response(JSON.stringify({ success: false, error: 'DB error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } }
async function handlePublicPostBySlug(request: Request, env: Env): Promise<Response> { if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders }); const url = new URL(request.url); const slug = url.pathname.split('/').pop(); if (!slug) return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); try { const post = await env.FOREX_DB.prepare(`SELECT * FROM posts WHERE slug = ?1 AND status = 'published'`).bind(slug).first(); if (!post) return new Response(JSON.stringify({ success: false, error: 'Post not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); return new Response(JSON.stringify({ success: true, post }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } catch (error: any) { console.error(`Error fetching post by slug ${slug}:`, error); return new Response(JSON.stringify({ success: false, error: 'DB error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } }
async function handleAdminLogin(request: Request, env: Env): Promise<Response> { if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders }); if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); try { const { username, password, ipAddress, sessionId } = await request.json() as { username?: string, password?: string, ipAddress?: string, sessionId?: string }; if (!username || !password || !ipAddress || !sessionId) return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); const attemptsResult = await env.FOREX_DB.prepare( `SELECT COUNT(*) as count FROM login_attempts WHERE (ip_address = ?1 OR session_id = ?2) AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`).bind(ipAddress, sessionId).first<{ count: number }>(); const failedAttempts = attemptsResult?.count ?? 0; if (failedAttempts >= 7) return new Response(JSON.stringify({ success: false, error: 'Too many failed attempts.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); const user = await env.FOREX_DB.prepare(`SELECT * FROM users WHERE username = ?1`).bind(username).first<{ id: number, username: string, password_hash: string }>(); if (!user) { await env.FOREX_DB.prepare(`INSERT INTO login_attempts (ip_address, session_id, username, success) VALUES (?1, ?2, ?3, 0)`).bind(ipAddress, sessionId, username).run(); return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } const recoveryDataCountResult = await env.FOREX_DB.prepare(`SELECT COUNT(*) as count FROM user_recovery`).first<{ count: number }>(); const useHashedPassword = (recoveryDataCountResult?.count ?? 0) > 0; let isValid = useHashedPassword ? await simpleHashCompare(password, user.password_hash) : (password === 'Administrator'); await env.FOREX_DB.prepare(`INSERT INTO login_attempts (ip_address, session_id, username, success) VALUES (?1, ?2, ?3, ?4)`).bind(ipAddress, sessionId, username, isValid ? 1 : 0).run(); if (!isValid) return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); const token = generateToken(); return new Response(JSON.stringify({ success: true, token, username: user.username }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } catch (error: any) { console.error('Login Handler Error:', error); return new Response(JSON.stringify({ success: false, error: 'Server error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } }
async function handleCheckAttempts(request: Request, env: Env): Promise<Response> { if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders }); const url = new URL(request.url); const ipAddress = url.searchParams.get('ip'); const sessionId = url.searchParams.get('session'); if (!ipAddress || !sessionId) return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); try { const result = await env.FOREX_DB.prepare(`SELECT COUNT(*) as count FROM login_attempts WHERE (ip_address = ?1 OR session_id = ?2) AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`).bind(ipAddress, sessionId).first<{ count: number }>(); const failedAttempts = result?.count ?? 0; const maxAttempts = 7; return new Response(JSON.stringify({ attempts: failedAttempts, remaining: Math.max(0, maxAttempts - failedAttempts) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } catch (error: any) { console.error("Error checking attempts:", error); return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } }
async function handleChangePassword(request: Request, env: Env): Promise<Response> { if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders }); if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); try { const { username, newPassword, token } = await request.json() as { username?: string, newPassword?: string, token?: string }; if (!username || !newPassword || !token) return new Response(JSON.stringify({ success: false, error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); if (newPassword.length < 8) return new Response(JSON.stringify({ success: false, error: 'Password too short' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); if (!verifyToken(token)) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); const newPasswordHash = await simpleHash(newPassword); await env.FOREX_DB.prepare(`UPDATE users SET password_hash = ?1, updated_at = datetime('now') WHERE username = ?2`).bind(newPasswordHash, username).run(); await env.FOREX_DB.prepare(`INSERT OR REPLACE INTO user_recovery (id, recovery_token, created_at) VALUES (1, ?, datetime('now'))`).bind(`changed_${Date.now()}`).run(); return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } catch (error: any) { console.error('Password Change Error:', error); return new Response(JSON.stringify({ success: false, error: 'Server error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } }
async function handlePosts(request: Request, env: Env): Promise<Response> { if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders }); const authHeader = request.headers.get('Authorization'); if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); if (request.method === 'GET') { try { const result = await env.FOREX_DB.prepare(`SELECT * FROM posts ORDER BY created_at DESC LIMIT 100`).all(); return new Response(JSON.stringify({ success: true, posts: result.results || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } catch (error: any) { console.error("Error fetching admin posts:", error); return new Response(JSON.stringify({ success: false, error: 'DB error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } } if (request.method === 'POST') { try { const post = await request.json() as PostData; if (!post.title || !post.content) return new Response(JSON.stringify({ success: false, error: 'Title/content required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); const slug = post.slug || generateSlug(post.title); const status = post.status === 'published' ? 'published' : 'draft'; const publishedAt = status === 'published' ? new Date().toISOString() : null; const keywordsString = typeof post.meta_keywords === 'string' ? post.meta_keywords : null; const result = await env.FOREX_DB.prepare(`INSERT INTO posts (title, slug, excerpt, content, featured_image_url, author_name, author_url, status, published_at, meta_title, meta_description, meta_keywords, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, datetime('now'), datetime('now')) RETURNING id`).bind( post.title, slug, post.excerpt || null, post.content, post.featured_image_url || null, post.author_name || 'Grisma', post.author_url || 'https://grisma.com.np/about', status, publishedAt, post.meta_title || post.title, post.meta_description || post.excerpt || null, keywordsString).first<{id: number}>(); if (result?.id) return new Response(JSON.stringify({ success: true, id: result.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); else throw new Error("Insert failed."); } catch(error: any) { console.error('Post creation error:', error); return new Response(JSON.stringify({ success: false, error: `Create error: ${error.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } } return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
async function handlePostById(request: Request, env: Env): Promise<Response> { if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders }); const authHeader = request.headers.get('Authorization'); if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); const url = new URL(request.url); const idStr = url.pathname.split('/').pop(); const id = idStr ? parseInt(idStr, 10) : NaN; if (isNaN(id)) return new Response(JSON.stringify({ error: 'Invalid post ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); if (request.method === 'GET') { try { const post = await env.FOREX_DB.prepare(`SELECT * FROM posts WHERE id = ?1`).bind(id).first(); if (!post) return new Response(JSON.stringify({ success: false, error: 'Post not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); return new Response(JSON.stringify({ success: true, post }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } catch (error: any) { console.error(`Error fetching post ${id}:`, error); return new Response(JSON.stringify({ success: false, error: 'DB error: '+ error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } } if (request.method === 'PUT') { try { const post = await request.json() as PostData; if (!post.title || !post.content) return new Response(JSON.stringify({ success: false, error: 'Title/content required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); const status = post.status === 'published' ? 'published' : 'draft'; const currentPost = await env.FOREX_DB.prepare(`SELECT status, published_at FROM posts WHERE id = ?1`).bind(id).first<{status: string, published_at: string | null}>(); let publishedAt = currentPost?.published_at; if (status === 'published' && currentPost?.status !== 'published') publishedAt = new Date().toISOString(); const keywordsString = typeof post.meta_keywords === 'string' ? post.meta_keywords : null; const result = await env.FOREX_DB.prepare(`UPDATE posts SET title=?1, slug=?2, excerpt=?3, content=?4, featured_image_url=?5, author_name=?6, author_url=?7, status=?8, published_at=?9, meta_title=?10, meta_description=?11, meta_keywords=?12, updated_at=datetime('now') WHERE id=?13`).bind( post.title, post.slug || generateSlug(post.title), post.excerpt || null, post.content, post.featured_image_url || null, post.author_name || 'Grisma', post.author_url || 'https://grisma.com.np/about', status, publishedAt, post.meta_title || post.title, post.meta_description || post.excerpt || null, keywordsString, id).run(); if (result.meta?.changes === 1) return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); else throw new Error("Post not found or update failed."); } catch(error: any) { console.error(`Error updating post ${id}:`, error); return new Response(JSON.stringify({ success: false, error: `Update error: ${error.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } } if (request.method === 'DELETE') { try { const result = await env.FOREX_DB.prepare(`DELETE FROM posts WHERE id = ?1`).bind(id).run(); return new Response(JSON.stringify({ success: true, changes: result.meta?.changes ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } catch(error: any) { console.error(`Error deleting post ${id}:`, error); return new Response(JSON.stringify({ success: false, error: 'Delete error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } } return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
async function handleForexData(request: Request, env: Env): Promise<Response> { if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders }); const authHeader = request.headers.get('Authorization'); if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); if (request.method === 'GET') { const url = new URL(request.url); const date = url.searchParams.get('date'); try { if (date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response(JSON.stringify({ success: false, error: 'Invalid date format.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); const result = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?1`).bind(date).first(); return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } else { const result = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates ORDER BY date DESC LIMIT 30`).all(); return new Response(JSON.stringify({ success: true, data: result.results || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } } catch(error: any) { console.error("Error fetching forex data:", error); return new Response(JSON.stringify({ success: false, error: 'DB error: '+ error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } } if (request.method === 'POST') { try { const data = await request.json() as ForexRateData; if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return new Response(JSON.stringify({ success: false, error: 'Invalid date.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); const columns: string[] = ['date', 'updated_at']; const placeholders: string[] = ['?1', "datetime('now')"]; const values: (string | number | null)[] = [data.date]; let paramIndex = 2; for (const currency of CURRENCIES) { const buyKey = `${currency}_buy`; const sellKey = `${currency}_sell`; const buyNum = (data[buyKey] === '' || data[buyKey] == null) ? null : Number(data[buyKey]); const sellNum = (data[sellKey] === '' || data[sellKey] == null) ? null : Number(data[sellKey]); const finalBuy = (buyNum === null || isNaN(buyNum)) ? null : buyNum; const finalSell = (sellNum === null || isNaN(sellNum)) ? null : sellNum; columns.push(buyKey, sellKey); placeholders.push(`?${paramIndex++}`, `?${paramIndex++}`); values.push(finalBuy, finalSell); } const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`; const result = await env.FOREX_DB.prepare(query).bind(...values).run(); if (result.success) return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); else throw new Error("DB operation failed."); } catch (error: any) { console.error("Error saving forex data:", error); return new Response(JSON.stringify({ success: false, error: `Save error: ${error.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } } return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
async function handleSiteSettings(request: Request, env: Env): Promise<Response> { if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders }); const authHeader = request.headers.get('Authorization'); if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); const SETTING_KEY = 'header_tags'; if (request.method === 'GET') { try { const result = await env.FOREX_DB.prepare(`SELECT setting_value FROM site_settings WHERE setting_key = ?1`).bind(SETTING_KEY).first<{ setting_value: string }>(); return new Response(JSON.stringify({ success: true, header_tags: result?.setting_value || '' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } catch (error: any) { console.error("Error fetching settings:", error); return new Response(JSON.stringify({ success: false, error: 'DB error: '+ error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } } if (request.method === 'POST') { try { const { header_tags } = await request.json() as { header_tags?: string }; const valueToSave = typeof header_tags === 'string' ? header_tags : ''; const result = await env.FOREX_DB.prepare(`INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES (?1, ?2, datetime('now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`).bind(SETTING_KEY, valueToSave).run(); if (result.success) return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); else throw new Error("DB operation failed."); } catch (error: any) { console.error("Error saving settings:", error); return new Response(JSON.stringify({ success: false, error: `Save error: ${error.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); } } return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

// --- Utility Functions ---
function formatDate(date: Date): string { if (!(date instanceof Date) || isNaN(date.getTime())) date = new Date(); return date.toISOString().split('T')[0]; }
function generateToken(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join(''); }
function verifyToken(token: string): boolean { return typeof token === 'string' && token.length > 40; } // Basic check
async function simpleHash(password: string): Promise<string> { if (typeof password !== 'string' || password.length === 0) throw new Error("Password cannot be empty"); const data = new TextEncoder().encode(password); const hash = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function simpleHashCompare(password: string, hash: string): Promise<boolean> { if (typeof password !== 'string' || typeof hash !== 'string' || hash.length === 0) return false; try { const passwordHash = await simpleHash(password); return passwordHash.length === hash.length && passwordHash === hash; } catch (error) { console.error("Error during hash comparison:", error); return false; } }
function generateSlug(title: string): string { if (typeof title !== 'string') return ''; return title.toLowerCase().replace(/['`‘’"“”]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 75); }

// --- Scheduled Handler ---
async function updateForexData(env: Env): Promise<void> { console.log("Running scheduled task: updateForexData"); try { const endDate = new Date(); const startDate = new Date(); startDate.setDate(startDate.getDate() - 7); const fromDateStr = formatDate(startDate); const toDateStr = formatDate(endDate); console.log(`Scheduled fetch range: ${fromDateStr} to ${toDateStr}`); const nrbUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDateStr}&to=${toDateStr}`; const response = await fetch(nrbUrl); if (!response.ok) { console.error(`Scheduled NRB API error: ${response.status} ${response.statusText}`); const errorBody = await response.text(); console.error("Scheduled NRB Error Body:", errorBody); throw new Error(`Scheduled NRB API error: ${response.status}`); } const data = await response.json(); console.log(`Scheduled fetch received ${data?.data?.payload?.length || 0} days of data.`); if (data?.data?.payload && data.data.payload.length > 0) { let statements: D1PreparedStatement[] = []; for (const dayData of data.data.payload) { const dateStr = dayData.date; if(!dateStr || !dayData.rates) continue; const columns: string[] = ['date', 'updated_at']; const placeholders: string[] = ['?', "datetime('now')"]; const values: (string | number | null)[] = [dateStr]; const rateMap = new Map(dayData.rates.map((r: any) => [r.currency.iso3, r])); for (const currencyCode of CURRENCIES) { const rate = rateMap.get(currencyCode); const buyRate = rate && rate.buy != null ? parseFloat(rate.buy) : null; const sellRate = rate && rate.sell != null ? parseFloat(rate.sell) : null; columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`); placeholders.push('?', '?'); values.push(isNaN(buyRate!) ? null : buyRate, isNaN(sellRate!) ? null : sellRate); } if (columns.length > 2) { const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`; statements.push(env.FOREX_DB.prepare(query).bind(...values)); } } if (statements.length > 0) { console.log(`Executing scheduled batch for ${statements.length} dates.`); const batchResult = await env.FOREX_DB.batch(statements); let failures = 0; batchResult.forEach((res, index) => { if (!res.success) { console.error(`Error in scheduled batch statement ${index}:`, res.error || res.meta); failures++; } }); console.log(`Scheduled batch finished. Success: ${statements.length - failures}, Failures: ${failures}`); } } } catch (error) { console.error('Error in scheduled updateForexData:', error); } console.log("Scheduled task finished."); }
