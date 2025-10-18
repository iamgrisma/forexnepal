import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
// Use official types for better compatibility if possible
// import { Env, ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';

// --- Re-declare Interfaces (if not using @cloudflare/workers-types) ---
interface D1Database { prepare(query: string): D1PreparedStatement; batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>; exec(query: string): Promise<D1ExecResult>; /* Add dump if needed */}
interface D1PreparedStatement { bind(...values: any[]): D1PreparedStatement; all<T = unknown>(): Promise<D1Result<T>>; run<T = unknown>(): Promise<D1Result<T>>; first<T = unknown>(colName?: string): Promise<T | null>; raw<T = unknown>(): Promise<T[]>;}
interface D1Result<T = unknown> { results?: T[]; success: boolean; meta?: any; error?: string; }
interface D1ExecResult { count: number | null; duration: number; } // count can be null
interface KVNamespace { get(key: string, options?: any): Promise<any>; put(key: string, value: any, options?: any): Promise<void>; delete(key: string): Promise<void>; list?(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>; }
interface ExecutionContext { waitUntil(promise: Promise<any>): void; passThroughOnException(): void; }
interface ScheduledEvent { scheduledTime: number; cron: string; }
// Ensure Env includes ASSETS if defined via Pages Functions deployment
interface Env {
    FOREX_DB: D1Database;
    __STATIC_CONTENT: KVNamespace; // Fallback KV binding
    ASSETS?: { fetch: typeof fetch }; // Service binding injected by Pages
}
interface ForexRateData { date: string; [key: string]: string | number | null; } // For ForexDataManagement
interface PostData { id?: number; title: string; slug?: string | null; excerpt?: string | null; content: string; featured_image_url?: string | null; author_name?: string | null; author_url?: string | null; status: 'draft' | 'published'; published_at?: string | null; meta_title?: string | null; meta_description?: string | null; meta_keywords?: string | null; /* Add updated_at if needed */ } // For Post Editor/API
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

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // --- Handle API Routes ---
        if (url.pathname.startsWith('/api/')) {
            // Add OPTIONS preflight handling globally for API routes
             if (request.method === 'OPTIONS') {
                return new Response(null, { headers: corsHeaders });
             }

            // --- Your Existing API Route Logic ---
             if (url.pathname === '/api/check-data') return handleCheckData(request, env);
             if (url.pathname === '/api/fetch-and-store') return handleFetchAndStore(request, env);
             if (url.pathname === '/api/historical-rates') return handleHistoricalRates(request, env);
             if (url.pathname === '/api/posts') return handlePublicPosts(request, env);
             if (url.pathname.startsWith('/api/posts/')) {
                 const slugPart = url.pathname.split('/').pop();
                 if (slugPart && !/^\d+$/.test(slugPart)) return handlePublicPostBySlug(request, env);
             }
             if (url.pathname === '/api/admin/login') return handleAdminLogin(request, env);
             if (url.pathname === '/api/admin/check-attempts') return handleCheckAttempts(request, env);
             if (url.pathname === '/api/admin/change-password') return handleChangePassword(request, env);
             if (url.pathname === '/api/admin/posts') return handlePosts(request, env); // Handles GET/POST
             if (url.pathname.startsWith('/api/admin/posts/')) {
                  const idPart = url.pathname.split('/').pop();
                  if (idPart && /^\d+$/.test(idPart)) return handlePostById(request, env); // Handles GET/PUT/DELETE by ID
             }
             if (url.pathname === '/api/admin/forex-data') return handleForexData(request, env);
             if (url.pathname === '/api/admin/settings') return handleSiteSettings(request, env);
            // --- End API Route Logic ---

            // Fallback for unmatched API routes
             console.log(`Worker: Unmatched API route: ${url.pathname}`);
            return new Response('API route not found.', { status: 404, headers: corsHeaders });
        }

        // --- Handle Non-API Requests (Static Assets and SPA Fallback) ---
        // **This is the crucial part for BrowserRouter**
        // We delegate to the ASSETS service binding provided by Cloudflare Pages.
        // This binding respects _routes.json and serves static files correctly.
        if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
            try {
                // Let Cloudflare Pages handle the request
                 console.log(`Worker: Delegating to env.ASSETS for path: ${url.pathname}`);
                return await env.ASSETS.fetch(request);
            } catch (e: any) {
                 console.error(`Worker: Error fetching from env.ASSETS for ${url.pathname}:`, e);
                // If ASSETS fetch fails (should be rare), return a generic error
                return new Response('Error serving content.', { status: 500 });
            }
        }

        // --- Fallback: getAssetFromKV (if ASSETS binding is missing) ---
        // This might be used during `wrangler dev` if not fully simulating Pages,
        // or in a Worker-only deployment scenario (not Pages).
         console.warn(`Worker: env.ASSETS binding not found. Falling back to getAssetFromKV for ${url.pathname}. SPA routing might require manual handling.`);
        try {
            // Attempt to serve the static asset directly using KV binding
            return await getAssetFromKV(
                { request, waitUntil: ctx.waitUntil },
                { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
            );
        } catch (e: any) {
            // If asset not found, assume it's an SPA route and serve index.html
            if (e.constructor.name === 'NotFoundError') { // Check specific error type if possible
                 console.log(`Worker: Asset not found via getAssetFromKV for ${url.pathname}. Attempting SPA fallback.`);
                try {
                    const spaRequest = new Request(new URL('/', request.url), request);
                    const indexResponse = await getAssetFromKV(
                        { request: spaRequest, waitUntil: ctx.waitUntil },
                        { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
                    );
                    // Return index.html with 200 status for SPA routing
                    return new Response(indexResponse.body, { ...indexResponse, status: 200 });
                } catch (e2) {
                     console.error(`Worker: SPA fallback failed (could not find index.html via getAssetFromKV):`, e2);
                    return new Response('Not Found (SPA Fallback Failed)', { status: 404 });
                }
            } else {
                 console.error(`Worker: Error during getAssetFromKV (not NotFoundError):`, e);
                return new Response('Internal Server Error', { status: 500 });
            }
        }
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`Worker: Triggering scheduled task: ${event.cron}`);
        ctx.waitUntil(updateForexData(env));
    }
};

// --- API Handler Functions ---
// (Keep all your existing handler functions: handleCheckData, handleFetchAndStore,
// handleHistoricalRates, handlePublicPosts, handlePublicPostBySlug, handleAdminLogin,
// handleCheckAttempts, handleChangePassword, handlePosts, handlePostById,
// handleForexData, handleSiteSettings)
// Ensure they handle OPTIONS and return correct CORS headers.

// --- Utility Functions ---
// (Keep all your existing utility functions: formatDate, generateToken, verifyToken,
// simpleHash, simpleHashCompare, generateSlug)

// --- Make sure ALL handlers used above are actually defined below ---
// Example definitions (replace with your full implementations)
async function handleCheckData(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
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
                // Ensure NaN becomes null
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
                      console.error(`Error in batch statement ${index} for date ${statements[index].toString()}:`, res.error || res.meta); // D1 might put error in meta or error
                 }
             });
             storedCount = successfulStatements;
             console.log(`Scheduled batch finished. Success: ${successfulStatements}, Failures: ${statements.length - successfulStatements}`);
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
     const currencyCode = url.searchParams.get('currency');
     const fromDate = url.searchParams.get('from');
     const toDate = url.searchParams.get('to');

     if (!currencyCode || !fromDate || !toDate) return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     if (!CURRENCIES.includes(currencyCode)) return new Response(JSON.stringify({ error: 'Invalid currency code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        const buyCol = `${currencyCode}_buy`;
        const sellCol = `${currencyCode}_sell`;
        // Basic validation of column names
        if (!/^[A-Z]{3}_(buy|sell)$/.test(buyCol) || !/^[A-Z]{3}_(buy|sell)$/.test(sellCol)) {
             throw new Error('Invalid column name generated.');
        }

        const query = `SELECT date, ${buyCol} as buy_rate, ${sellCol} as sell_rate FROM forex_rates WHERE date >= ?1 AND date <= ?2 AND ${buyCol} IS NOT NULL AND ${sellCol} IS NOT NULL ORDER BY date ASC`;
        const results = await env.FOREX_DB.prepare(query).bind(fromDate, toDate).all();

      return new Response(JSON.stringify({
        success: true, data: results.results || [], currency: currencyCode, count: results.results?.length || 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error: any) {
      console.error(`DB error fetching historical rates for ${currencyCode}:`, error);
      return new Response(JSON.stringify({ success: false, error: 'Database error: '+ error.message, data: [] }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}
async function handlePublicPosts(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     try {
         const result = await env.FOREX_DB.prepare(
           `SELECT id, title, slug, excerpt, featured_image_url, author_name, author_url, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 50`
         ).all();
         return new Response(JSON.stringify({ success: true, posts: result.results || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       } catch (error: any) {
         console.error("Error fetching public posts:", error);
         return new Response(JSON.stringify({ success: false, error: 'Failed to fetch posts: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
}
async function handlePublicPostBySlug(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     const url = new URL(request.url);
     const slug = url.pathname.split('/').pop();
     if (!slug) return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

     try {
       const post = await env.FOREX_DB.prepare(`SELECT * FROM posts WHERE slug = ?1 AND status = 'published'`).bind(slug).first();
       if (!post) return new Response(JSON.stringify({ success: false, error: 'Post not found or not published' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       return new Response(JSON.stringify({ success: true, post }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     } catch (error: any) {
       console.error(`Error fetching post by slug ${slug}:`, error);
       return new Response(JSON.stringify({ success: false, error: 'Failed to fetch post: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
}
async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     try {
         const { username, password, ipAddress, sessionId } = await request.json() as { username?: string, password?: string, ipAddress?: string, sessionId?: string };
         if (!username || !password || !ipAddress || !sessionId) return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const attemptsResult = await env.FOREX_DB.prepare( `SELECT COUNT(*) as count FROM login_attempts WHERE (ip_address = ?1 OR session_id = ?2) AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`).bind(ipAddress, sessionId).first<{ count: number }>();
        const failedAttempts = attemptsResult?.count ?? 0;
        if (failedAttempts >= 7) return new Response(JSON.stringify({ success: false, error: 'Too many failed login attempts.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const user = await env.FOREX_DB.prepare(`SELECT * FROM users WHERE username = ?1`).bind(username).first<{ id: number, username: string, password_hash: string }>();

        if (!user) {
          await env.FOREX_DB.prepare(`INSERT INTO login_attempts (ip_address, session_id, username, success) VALUES (?1, ?2, ?3, 0)`).bind(ipAddress, sessionId, username).run();
          return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const recoveryDataCountResult = await env.FOREX_DB.prepare(`SELECT COUNT(*) as count FROM user_recovery`).first<{ count: number }>();
        const useHashedPassword = (recoveryDataCountResult?.count ?? 0) > 0;
        let isValid = useHashedPassword ? await simpleHashCompare(password, user.password_hash) : (password === 'Administrator');

        await env.FOREX_DB.prepare(`INSERT INTO login_attempts (ip_address, session_id, username, success) VALUES (?1, ?2, ?3, ?4)`).bind(ipAddress, sessionId, username, isValid ? 1 : 0).run();

        if (!isValid) return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const token = generateToken();
        return new Response(JSON.stringify({ success: true, token, username: user.username }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error: any) {
        console.error('Login Handler Error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Server error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
}
async function handleCheckAttempts(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     const url = new URL(request.url);
     const ipAddress = url.searchParams.get('ip');
     const sessionId = url.searchParams.get('session');
     if (!ipAddress || !sessionId) return new Response(JSON.stringify({ error: 'Missing IP or session parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

     try {
       const result = await env.FOREX_DB.prepare(`SELECT COUNT(*) as count FROM login_attempts WHERE (ip_address = ?1 OR session_id = ?2) AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`).bind(ipAddress, sessionId).first<{ count: number }>();
       const failedAttempts = result?.count ?? 0; const maxAttempts = 7;
       return new Response(JSON.stringify({ attempts: failedAttempts, remaining: Math.max(0, maxAttempts - failedAttempts) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     } catch (error: any) {
       console.error("Error checking login attempts:", error);
       return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
}
async function handleChangePassword(request: Request, env: Env): Promise<Response> {
     if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     try {
         const { username, newPassword, token } = await request.json() as { username?: string, newPassword?: string, token?: string };
         if (!username || !newPassword || !token) return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         if (newPassword.length < 8) return new Response(JSON.stringify({ success: false, error: 'New password must be at least 8 characters.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         if (!verifyToken(token)) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const newPasswordHash = await simpleHash(newPassword);
        const updateResult = await env.FOREX_DB.prepare(`UPDATE users SET password_hash = ?1, updated_at = datetime('now') WHERE username = ?2`).bind(newPasswordHash, username).run();

        // Add dummy entry to user_recovery to indicate password change
        await env.FOREX_DB.prepare(`INSERT OR REPLACE INTO user_recovery (id, recovery_token, created_at) VALUES (1, ?, datetime('now'))`).bind(`changed_${Date.now()}`).run(); // Using fixed ID 1

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error: any) {
        console.error('Password Change Error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Server error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
}
async function handlePosts(request: Request, env: Env): Promise<Response> {
     if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     const authHeader = request.headers.get('Authorization');
     if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

     if (request.method === 'GET') {
       try {
         const result = await env.FOREX_DB.prepare(`SELECT * FROM posts ORDER BY created_at DESC LIMIT 100`).all();
         return new Response(JSON.stringify({ success: true, posts: result.results || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       } catch (error: any) {
          console.error("Error fetching admin posts:", error);
          return new Response(JSON.stringify({ success: false, error: 'DB error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
     }
     if (request.method === 'POST') { /* ... Your existing POST logic ... */
        try {
            const post = await request.json() as PostData; // Use PostData interface
            if (!post.title || !post.content) return new Response(JSON.stringify({ success: false, error: 'Title and content required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            const slug = post.slug || generateSlug(post.title);
            const status = post.status === 'published' ? 'published' : 'draft';
            const publishedAt = status === 'published' ? new Date().toISOString() : null;
            const keywordsString = typeof post.meta_keywords === 'string' ? post.meta_keywords : null;

            const result = await env.FOREX_DB.prepare(
              `INSERT INTO posts (title, slug, excerpt, content, featured_image_url, author_name, author_url, status, published_at, meta_title, meta_description, meta_keywords, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, datetime('now'), datetime('now')) RETURNING id` // Use RETURNING id
            ).bind(
              post.title, slug, post.excerpt || null, post.content, post.featured_image_url || null,
              post.author_name || 'Grisma', post.author_url || 'https://grisma.com.np/about', status, publishedAt,
              post.meta_title || post.title, post.meta_description || post.excerpt || null, keywordsString
            ).first<{id: number}>(); // Get the inserted ID

             if (result?.id) {
               return new Response(JSON.stringify({ success: true, id: result.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } else {
               console.error("Post creation failed, D1 result:", result);
               throw new Error("Failed to get inserted post ID.");
            }
        } catch(error: any) {
            console.error('Post creation error:', error);
            return new Response(JSON.stringify({ success: false, error: `Failed to create post: ${error.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
     }
     return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
async function handlePostById(request: Request, env: Env): Promise<Response> {
     if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     const authHeader = request.headers.get('Authorization');
     if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     const url = new URL(request.url);
     const idStr = url.pathname.split('/').pop(); const id = idStr ? parseInt(idStr, 10) : NaN;
     if (isNaN(id)) return new Response(JSON.stringify({ error: 'Invalid post ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

     if (request.method === 'GET') { /* ... Your existing GET logic ... */
        try {
           const post = await env.FOREX_DB.prepare(`SELECT * FROM posts WHERE id = ?1`).bind(id).first();
           if (!post) return new Response(JSON.stringify({ success: false, error: 'Post not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           return new Response(JSON.stringify({ success: true, post }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       } catch (error: any) {
           console.error(`Error fetching post ${id}:`, error);
           return new Response(JSON.stringify({ success: false, error: 'DB error: '+ error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
     }
     if (request.method === 'PUT') { /* ... Your existing PUT logic ... */
        try {
            const post = await request.json() as PostData;
            if (!post.title || !post.content) return new Response(JSON.stringify({ success: false, error: 'Title and content required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            const status = post.status === 'published' ? 'published' : 'draft';
            const currentPost = await env.FOREX_DB.prepare(`SELECT status, published_at FROM posts WHERE id = ?1`).bind(id).first<{status: string, published_at: string | null}>();
            let publishedAt = currentPost?.published_at;
            if (status === 'published' && currentPost?.status !== 'published') publishedAt = new Date().toISOString();
            // else if (status === 'draft') publishedAt = null; // Decide if unpublishing clears date
            const keywordsString = typeof post.meta_keywords === 'string' ? post.meta_keywords : null;

            const result = await env.FOREX_DB.prepare(
              `UPDATE posts SET title=?1, slug=?2, excerpt=?3, content=?4, featured_image_url=?5, author_name=?6, author_url=?7, status=?8, published_at=?9, meta_title=?10, meta_description=?11, meta_keywords=?12, updated_at=datetime('now') WHERE id=?13`
            ).bind(
              post.title, post.slug || generateSlug(post.title), post.excerpt || null, post.content, post.featured_image_url || null,
              post.author_name || 'Grisma', post.author_url || 'https://grisma.com.np/about', status, publishedAt,
              post.meta_title || post.title, post.meta_description || post.excerpt || null, keywordsString, id
            ).run();
            if (result.meta?.changes === 1) return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            else throw new Error("Post not found or update failed.");
        } catch(error: any) {
             console.error(`Error updating post ${id}:`, error);
            return new Response(JSON.stringify({ success: false, error: `Update error: ${error.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
     }
     if (request.method === 'DELETE') { /* ... Your existing DELETE logic ... */
        try {
            const result = await env.FOREX_DB.prepare(`DELETE FROM posts WHERE id = ?1`).bind(id).run();
            // Return success even if post didn't exist (idempotent)
            return new Response(JSON.stringify({ success: true, changes: result.meta?.changes ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch(error: any) {
             console.error(`Error deleting post ${id}:`, error);
            return new Response(JSON.stringify({ success: false, error: 'Delete error: ' + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
     }
     return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
async function handleForexData(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     const authHeader = request.headers.get('Authorization');
     if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

     if (request.method === 'GET') { /* ... Your existing GET logic ... */
        const url = new URL(request.url); const date = url.searchParams.get('date');
        try {
           if (date) {
             if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response(JSON.stringify({ success: false, error: 'Invalid date format.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
             const result = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?1`).bind(date).first();
             return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           } else {
             const result = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates ORDER BY date DESC LIMIT 30`).all();
             return new Response(JSON.stringify({ success: true, data: result.results || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           }
        } catch(error: any) { console.error("Error fetching forex data:", error); return new Response(JSON.stringify({ success: false, error: 'DB error: '+ error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
     }
     if (request.method === 'POST') { /* ... Your existing POST logic ... */
        try {
            const data = await request.json() as ForexRateData;
            if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return new Response(JSON.stringify({ success: false, error: 'Invalid or missing date.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            const columns: string[] = ['date', 'updated_at']; const placeholders: string[] = ['?1', "datetime('now')"]; const values: (string | number | null)[] = [data.date]; let paramIndex = 2;
            for (const currency of CURRENCIES) {
                const buyKey = `${currency}_buy`; const sellKey = `${currency}_sell`;
                const buyNum = (data[buyKey] === '' || data[buyKey] == null) ? null : Number(data[buyKey]);
                const sellNum = (data[sellKey] === '' || data[sellKey] == null) ? null : Number(data[sellKey]);
                const finalBuy = (buyNum === null || isNaN(buyNum)) ? null : buyNum;
                const finalSell = (sellNum === null || isNaN(sellNum)) ? null : sellNum;
                columns.push(buyKey, sellKey); placeholders.push(`?${paramIndex++}`, `?${paramIndex++}`); values.push(finalBuy, finalSell);
            }
            const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            const result = await env.FOREX_DB.prepare(query).bind(...values).run();
            if (result.success) return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            else throw new Error("Database operation failed.");
        } catch (error: any) { console.error("Error saving forex data:", error); return new Response(JSON.stringify({ success: false, error: `Save error: ${error.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
     }
     return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
async function handleSiteSettings(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     const authHeader = request.headers.get('Authorization');
     if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     const SETTING_KEY = 'header_tags';

     if (request.method === 'GET') { /* ... Your existing GET logic ... */
         try {
             const result = await env.FOREX_DB.prepare(`SELECT setting_value FROM site_settings WHERE setting_key = ?1`).bind(SETTING_KEY).first<{ setting_value: string }>();
             return new Response(JSON.stringify({ success: true, header_tags: result?.setting_value || '' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         } catch (error: any) { console.error("Error fetching site settings:", error); return new Response(JSON.stringify({ success: false, error: 'DB error: '+ error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
     }
     if (request.method === 'POST') { /* ... Your existing POST logic ... */
        try {
            const { header_tags } = await request.json() as { header_tags?: string };
            const valueToSave = typeof header_tags === 'string' ? header_tags : '';
            const result = await env.FOREX_DB.prepare(
              `INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES (?1, ?2, datetime('now'))
               ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`
            ).bind(SETTING_KEY, valueToSave).run();
            if (result.success) return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            else throw new Error("Database operation failed.");
        } catch (error: any) { console.error("Error saving site settings:", error); return new Response(JSON.stringify({ success: false, error: `Save error: ${error.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
     }
     return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}


// --- Utility Functions ---
// (Keep formatDate, generateToken, verifyToken, simpleHash, simpleHashCompare, generateSlug)
function formatDate(date: Date): string { if (!(date instanceof Date) || isNaN(date.getTime())) date = new Date(); return date.toISOString().split('T')[0]; }
function generateToken(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join(''); }
function verifyToken(token: string): boolean { return typeof token === 'string' && token.length > 40; } // Basic check
async function simpleHash(password: string): Promise<string> { if (typeof password !== 'string' || password.length === 0) throw new Error("Password cannot be empty"); const data = new TextEncoder().encode(password); const hash = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function simpleHashCompare(password: string, hash: string): Promise<boolean> { if (typeof password !== 'string' || typeof hash !== 'string' || hash.length === 0) return false; try { const passwordHash = await simpleHash(password); return passwordHash.length === hash.length && passwordHash === hash; } catch (error) { console.error("Error during hash comparison:", error); return false; } }
function generateSlug(title: string): string { if (typeof title !== 'string') return ''; return title.toLowerCase().replace(/['`‘’"“”]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 75); }

// --- Scheduled Handler (ensure it's using the correct Env type) ---
async function updateForexData(env: Env): Promise<void> { /* ... Your existing scheduled logic ... */
     console.log("Running scheduled task: updateForexData"); try { const endDate = new Date(); const startDate = new Date(); startDate.setDate(startDate.getDate() - 7); const fromDateStr = formatDate(startDate); const toDateStr = formatDate(endDate); console.log(`Scheduled fetch range: ${fromDateStr} to ${toDateStr}`); const nrbUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDateStr}&to=${toDateStr}`; const response = await fetch(nrbUrl); if (!response.ok) { console.error(`Scheduled NRB API error: ${response.status} ${response.statusText}`); const errorBody = await response.text(); console.error("Scheduled NRB Error Body:", errorBody); throw new Error(`Scheduled NRB API error: ${response.status}`); } const data = await response.json(); console.log(`Scheduled fetch received ${data?.data?.payload?.length || 0} days of data.`); if (data?.data?.payload && data.data.payload.length > 0) { let storedCount = 0; const statements: D1PreparedStatement[] = []; for (const dayData of data.data.payload) { const dateStr = dayData.date; if(!dateStr || !dayData.rates) continue; const columns: string[] = ['date', 'updated_at']; const placeholders: string[] = ['?', "datetime('now')"]; const values: (string | number | null)[] = [dateStr]; const rateMap = new Map(dayData.rates.map((r: any) => [r.currency.iso3, r])); for (const currencyCode of CURRENCIES) { const rate = rateMap.get(currencyCode); const buyRate = rate && rate.buy != null ? parseFloat(rate.buy) : null; const sellRate = rate && rate.sell != null ? parseFloat(rate.sell) : null; columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`); placeholders.push('?', '?'); values.push(isNaN(buyRate!) ? null : buyRate, isNaN(sellRate!) ? null : sellRate); } if (columns.length > 2) { const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`; statements.push(env.FOREX_DB.prepare(query).bind(...values)); } } if (statements.length > 0) { console.log(`Executing scheduled batch insert/replace for ${statements.length} dates.`); const batchResult = await env.FOREX_DB.batch(statements); let failures = 0; batchResult.forEach((res, index) => { if (!res.success) { console.error(`Error in scheduled batch statement ${index}:`, res.error || res.meta); failures++; } }); console.log(`Scheduled batch finished. Success: ${statements.length - failures}, Failures: ${failures}`); } else { console.log("Scheduled task: No valid data found in NRB response to store."); } } else { console.log("Scheduled task: No payload data received from NRB."); } } catch (error) { console.error('Error in scheduled updateForexData:', error); } console.log("Scheduled task finished."); }
