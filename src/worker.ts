import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { Env, ExecutionContext } from '@cloudflare/workers-types'; // Use official types if available

// Interfaces for D1Database, D1PreparedStatement, D1Result, KVNamespace, ScheduledEvent
// remain the same as in your original file. Define them if not using @cloudflare/workers-types

// --- Your D1 Interfaces (Keep these if not using @cloudflare/workers-types) ---
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
}
interface D1Result<T = unknown> {
  results?: T[]; // results might be undefined for run()
  success: boolean;
  meta?: any;
}
interface KVNamespace {
    get(key: string, options?: any): Promise<any>;
    put(key: string, value: any, options?: any): Promise<void>;
    // Add list if needed
     list?(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
}
interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
}
// Extend Env to include __STATIC_CONTENT binding if not using official types
interface CustomEnv extends Env {
    FOREX_DB: D1Database;
    __STATIC_CONTENT: KVNamespace;
}
// --- End D1 Interfaces ---


const CURRENCIES = [
  'INR', 'USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD', 'SGD',
  'JPY', 'CNY', 'SAR', 'QAR', 'THB', 'AED', 'MYR', 'KRW',
  'SEK', 'DKK', 'HKD', 'KWD', 'BHD', 'OMR'
];

export default {
    async fetch(request: Request, env: CustomEnv, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // --- API Route Handling ---
        // Only handle requests starting with /api/
        if (url.pathname.startsWith('/api/')) {
            if (url.pathname === '/api/check-data') {
                return handleCheckData(request, env);
            }
            if (url.pathname === '/api/fetch-and-store') {
                return handleFetchAndStore(request, env);
            }
            if (url.pathname === '/api/historical-rates') {
                return handleHistoricalRates(request, env);
            }
            // Public posts
            if (url.pathname === '/api/posts') {
                return handlePublicPosts(request, env);
            }
            if (url.pathname.startsWith('/api/posts/')) {
                // Ensure this doesn't clash with admin posts by ID route structure
                // Assuming public slugs don't look like admin IDs (integers)
                 const slugPart = url.pathname.split('/').pop();
                 // Simple check: if the last part is NOT purely a number, assume it's a slug
                 if (slugPart && !/^\d+$/.test(slugPart)) {
                    return handlePublicPostBySlug(request, env);
                 }
                // If it might be an ID, let it fall through to admin routes below
            }

            // Admin routes
            if (url.pathname === '/api/admin/login') {
                return handleAdminLogin(request, env);
            }
            if (url.pathname === '/api/admin/check-attempts') {
                return handleCheckAttempts(request, env);
            }
            if (url.pathname === '/api/admin/change-password') {
                return handleChangePassword(request, env);
            }
            // Admin posts (check method for /api/admin/posts)
            if (url.pathname === '/api/admin/posts') {
                 if (request.method === 'GET' || request.method === 'POST' || request.method === 'OPTIONS') {
                     return handlePosts(request, env);
                 }
            }
             // Admin post by ID (specific path)
            if (url.pathname.startsWith('/api/admin/posts/')) {
                 const idPart = url.pathname.split('/').pop();
                 // Simple check: if the last part IS purely a number, assume it's an ID
                 if (idPart && /^\d+$/.test(idPart)) {
                    return handlePostById(request, env);
                 }
            }

            if (url.pathname === '/api/admin/forex-data') {
                return handleForexData(request, env);
            }
            if (url.pathname === '/api/admin/settings') {
                return handleSiteSettings(request, env);
            }

            // If it's an API route but doesn't match above, return 404
             return new Response('API route not found', { status: 404, headers: corsHeaders });
        }

        // --- Static Asset Handling (Let Cloudflare Pages handle it) ---
        // If it's not an API route, let the request pass through to Pages' static asset server.
        // Cloudflare Pages automatically maps requests to files in your output directory (`dist` by default)
        // and uses `_routes.json` for SPA fallbacks.
        // We achieve "passing through" by returning the result of env.ASSETS.fetch or similar if
        // using older Module Worker syntax, OR by simply NOT returning a response from the worker
        // for non-API routes when deployed via Wrangler with Pages integration.
        // Since wrangler handles the integration, we SHOULD NOT explicitly call getAssetFromKV here
        // for non-API routes. Just let the function end without returning a Response for these paths.
        // However, `fetch` handlers MUST return a Response. The standard way for Pages+Functions
        // is to check if `env.ASSETS` exists and call its fetch method.

        // Check if the ASSETS service binding exists (added by Pages)
        if (hasAssetsBinding(env)) {
             try {
                // Let Pages handle the static asset serving & SPA fallback
                return await env.ASSETS.fetch(request);
             } catch (e) {
                 console.error("Error fetching asset from Pages binding:", e);
                 // Fallback if ASSETS fetch fails unexpectedly
                 return new Response("Asset not found or internal error", { status: 404 });
             }
        }

        // Fallback if the ASSETS binding isn't available (e.g., local dev without Pages context)
        // or if you need manual control in specific worker-only deployments.
        // For standard Pages deployment, the above `env.ASSETS.fetch` is preferred.
        try {
            return await getAssetFromKV(
                {
                    request,
                    waitUntil(promise) {
                        return ctx.waitUntil(promise);
                    },
                },
                {
                    ASSET_NAMESPACE: env.__STATIC_CONTENT, // Use the binding from wrangler.jsonc
                    ASSET_MANIFEST: {}, // Manifest often generated by wrangler build
                    // Consider adding mapRequestToAsset for SPA behavior if not relying on Pages _routes.json
                    // mapRequestToAsset: handleSpaFallback, // Example custom handler
                }
            );
        } catch (e: any) {
             // If getAssetFromKV throws, and it's likely a Not Found error for an SPA route
             // Try fetching the root index.html as SPA fallback
             try {
                 let pathname = url.pathname;
                 // Basic check to avoid infinite loop for missing index.html itself
                 if (pathname !== '/' && pathname !== '/index.html') {
                     const notFoundResponse = await getAssetFromKV(
                         {
                             request: new Request(new URL('/', request.url), request), // Request root index.html
                              waitUntil(promise) {
                                 return ctx.waitUntil(promise);
                              },
                         },
                         {
                              ASSET_NAMESPACE: env.__STATIC_CONTENT,
                              ASSET_MANIFEST: {},
                         }
                     );
                     // Return index.html but keep 200 status for SPA routing
                     return new Response(notFoundResponse.body, { ...notFoundResponse, status: 200 });
                 }
             } catch (e2) {
                // If index.html is also missing
                console.error("Failed to get asset from KV, including index.html fallback:", e2);
                return new Response('Not Found', { status: 404 });
             }
              // If the first error was not just 'not found', rethrow or handle differently
              // For simplicity here, just return 404 if index.html fallback failed
               return new Response('Not Found', { status: 404 });
        }
    },

    async scheduled(event: ScheduledEvent, env: CustomEnv, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(updateForexData(env));
    }
};

// Type guard to check for the ASSETS binding added by Cloudflare Pages
function hasAssetsBinding(env: any): env is Env & { ASSETS: { fetch: typeof fetch } } {
    return env && typeof env.ASSETS === 'object' && typeof env.ASSETS.fetch === 'function';
}


// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Be more specific in production if needed
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// --- API Handler Functions (handleCheckData, handleFetchAndStore, etc.) ---
// Keep all your existing API handler functions (handleCheckData, handleFetchAndStore,
// handleHistoricalRates, handleAdminLogin, handleCheckAttempts, handleChangePassword,
// handlePosts, handlePostById, handleForexData, handleSiteSettings, handlePublicPosts,
// handlePublicPostBySlug) exactly as they were. Make sure they always include
// `headers: { ...corsHeaders, 'Content-Type': 'application/json' }` in JSON responses
// and handle OPTIONS requests correctly like this at the start of each handler:
/*
async function handleSomeApiRoute(request: Request, env: CustomEnv): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // ... rest of handler logic
}
*/

// --- Utility Functions (formatDate, generateToken, etc.) ---
// Keep all your existing utility functions exactly as they were.


// --- Ensure all handlers are defined ---
// Example stubs if you removed them accidentally:

async function handleCheckData(request: Request, env: CustomEnv): Promise<Response> {
   if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
   // ... your existing logic ...
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
          // You might want to add counts back if needed for UI
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Database error in checkData:', error);
        return new Response(JSON.stringify({ error: 'Database error', exists: false, missingDates: [] }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
}

async function handleFetchAndStore(request: Request, env: CustomEnv): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
   // ... your existing logic ...
     const url = new URL(request.url);
     const fromDate = url.searchParams.get('from');
     const toDate = url.searchParams.get('to');

     if (!fromDate || !toDate) {
       return new Response(JSON.stringify({ error: 'Missing parameters' }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
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
            success: true, // Still success, just no data to store
            message: 'No data available from NRB API for this range.',
            stored: 0,
            fromDate,
            toDate,
            data: []
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let storedCount = 0;
        const statements: D1PreparedStatement[] = [];

        for (const dayData of data.data.payload) {
          const dateStr = dayData.date;

          const columns: string[] = ['date', 'updated_at'];
          const placeholders: string[] = ['?', "datetime('now')"];
          const values: (string | number | null)[] = [dateStr]; // Use explicit type

          // Prepare values for all possible currencies, defaulting to null
           const rateMap = new Map(dayData.rates.map((r: any) => [r.currency.iso3, r]));

          for (const currencyCode of CURRENCIES) {
                const rate = rateMap.get(currencyCode);
                const buyRate = rate ? parseFloat(rate.buy) : null;
                const sellRate = rate ? parseFloat(rate.sell) : null;

                // Only add columns if rate is valid
                if (rate && !isNaN(buyRate!) && !isNaN(sellRate!)) {
                  columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`);
                  placeholders.push('?', '?');
                  values.push(buyRate, sellRate);
                } else {
                   // Ensure columns exist even if null, match table structure
                  columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`);
                  placeholders.push('?', '?');
                  values.push(null, null); // Insert NULL if rate is missing or invalid
                }

          }


          if (columns.length > 2) { // Only insert if we have currency data
              const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
              statements.push(env.FOREX_DB.prepare(query).bind(...values));
          } else {
             console.warn(`No valid currency data to insert for date: ${dateStr}`);
          }
        }

        if (statements.length > 0) {
            console.log(`Executing batch insert/replace for ${statements.length} dates.`);
            // Use batch for efficiency
            // Note: Batch might fail entirely if one statement fails. Consider individual inserts if needed.
             const batchResult = await env.FOREX_DB.batch(statements);
             // Count successes in batchResult if needed, otherwise assume length is stored count
            storedCount = statements.length; // Approximate count
             console.log("Batch execution finished.");

             // Optional: Check batchResult for errors
             batchResult.forEach((res, index) => {
                 if (!res.success) {
                     console.error(`Error in batch statement ${index}:`, res.meta);
                     // Decrement storedCount or handle error appropriately
                     storedCount--;
                 }
             });

        }


        return new Response(JSON.stringify({
          success: true,
          stored: storedCount,
          totalFetched: data.data.payload.length,
          fromDate,
          toDate
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error fetching and storing data:', error);
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to fetch and store data: ${error instanceof Error ? error.message : String(error)}`
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
}

// Ensure all other handlers (handleHistoricalRates, handleAdminLogin, etc.) are defined below...
// ... (Your existing handler functions) ...

// --- ADD Placeholder for other Handlers if missing ---
async function handleHistoricalRates(request: Request, env: CustomEnv): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    // ... your implementation ...
     const url = new URL(request.url);
     const currencyCode = url.searchParams.get('currency');
     const fromDate = url.searchParams.get('from');
     const toDate = url.searchParams.get('to');

     if (!currencyCode || !fromDate || !toDate) {
       return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
     if (!CURRENCIES.includes(currencyCode)) {
       return new Response(JSON.stringify({ error: 'Invalid currency code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }


    try {
        // Construct column names safely
        const buyCol = `${currencyCode}_buy`;
        const sellCol = `${currencyCode}_sell`;

        // Ensure columns exist (basic check) - a more robust check might involve querying schema if needed
        if (!buyCol.match(/^[A-Z]{3}_buy$/) || !sellCol.match(/^[A-Z]{3}_sell$/)) {
             throw new Error('Invalid column name derived from currency code.');
        }


        const query = `
          SELECT date, ${buyCol} as buy_rate, ${sellCol} as sell_rate
          FROM forex_rates
          WHERE date >= ?1 AND date <= ?2 AND ${buyCol} IS NOT NULL AND ${sellCol} IS NOT NULL
          ORDER BY date ASC
        `;
        const results = await env.FOREX_DB.prepare(query).bind(fromDate, toDate).all();


      return new Response(JSON.stringify({
        success: true,
        data: results.results || [], // Ensure data is always an array
        currency: currencyCode,
        count: results.results?.length || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error(`Database error fetching historical rates for ${currencyCode}:`, error);
      return new Response(JSON.stringify({ success: false, error: 'Database error', data: [] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
}
async function handlePublicPosts(request: Request, env: CustomEnv): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    // ... your implementation ...
     try {
         const result = await env.FOREX_DB.prepare(
           `SELECT id, title, slug, excerpt, featured_image_url, author_name, author_url, published_at
            FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 50` // Added LIMIT
         ).all();

         return new Response(JSON.stringify({ success: true, posts: result.results || [] }), { // Ensure array
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       } catch (error) {
         console.error("Error fetching public posts:", error);
         return new Response(JSON.stringify({ success: false, error: 'Failed to fetch posts' }), {
           status: 500,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }
}
async function handlePublicPostBySlug(request: Request, env: CustomEnv): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    // ... your implementation ...
     const url = new URL(request.url);
     const slug = url.pathname.split('/').pop();

     if (!slug) {
         return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     try {
       const post = await env.FOREX_DB.prepare(
         `SELECT * FROM posts WHERE slug = ?1 AND status = 'published'`
       ).bind(slug).first();

       if (!post) {
         return new Response(JSON.stringify({ success: false, error: 'Post not found or not published' }), {
           status: 404,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }

       return new Response(JSON.stringify({ success: true, post }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     } catch (error) {
       console.error(`Error fetching post by slug ${slug}:`, error);
       return new Response(JSON.stringify({ success: false, error: 'Failed to fetch post' }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     }
}
async function handleAdminLogin(request: Request, env: CustomEnv): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

     try {
         const { username, password, ipAddress, sessionId } = await request.json() as { username?: string, password?: string, ipAddress?: string, sessionId?: string };

         if (!username || !password || !ipAddress || !sessionId) {
              return new Response(JSON.stringify({ success: false, error: 'Missing required fields (username, password, ipAddress, sessionId)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         }

        // Rate Limiting Check
        const attemptsResult = await env.FOREX_DB.prepare(
          `SELECT COUNT(*) as count FROM login_attempts
           WHERE (ip_address = ?1 OR session_id = ?2) -- Check both IP and Session
           AND success = 0
           AND datetime(attempt_time) > datetime('now', '-1 hour')`
        ).bind(ipAddress, sessionId).first<{ count: number }>();

        const failedAttempts = attemptsResult?.count ?? 0;

        if (failedAttempts >= 7) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Too many failed login attempts. Please try again later.'
          }), {
            status: 429, // Too Many Requests
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Fetch User
        const user = await env.FOREX_DB.prepare(
          `SELECT * FROM users WHERE username = ?1`
        ).bind(username).first<{ id: number, username: string, password_hash: string }>(); // Adjust type as needed

        if (!user) {
          // Log failed attempt even if user doesn't exist
          await env.FOREX_DB.prepare(
            `INSERT INTO login_attempts (ip_address, session_id, username, success) VALUES (?1, ?2, ?3, 0)`
          ).bind(ipAddress, sessionId, username).run();
          return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Check Password Logic (Default vs Hashed)
        const recoveryDataCountResult = await env.FOREX_DB.prepare(
          // Check if ANY row exists, content doesn't matter per the logic described
          `SELECT COUNT(*) as count FROM user_recovery`
        ).first<{ count: number }>();

        const useHashedPassword = (recoveryDataCountResult?.count ?? 0) > 0;
        let isValid = false;

        if (useHashedPassword) {
            // Compare with the stored hash (assuming simpleHashCompare is defined and works)
            isValid = await simpleHashCompare(password, user.password_hash);
        } else {
            // Compare with the default password
            isValid = (password === 'Administrator');
             // Optionally, hash the default password and compare if the stored hash is always the bcrypt one
             // isValid = await simpleHashCompare(password, user.password_hash); // Use this if the initial hash is stored bcrypt
        }

        // Log the attempt result
        await env.FOREX_DB.prepare(
          `INSERT INTO login_attempts (ip_address, session_id, username, success) VALUES (?1, ?2, ?3, ?4)`
        ).bind(ipAddress, sessionId, username, isValid ? 1 : 0).run();

        if (!isValid) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Success - Generate Token (assuming generateToken is defined)
        const token = generateToken(); // You need to implement this

        // Optional: Clear successful login attempts for this session/IP? Might not be necessary.
        // await env.FOREX_DB.prepare(
        //   `DELETE FROM login_attempts WHERE ip_address = ?1 AND session_id = ?2 AND success = 1`
        // ).bind(ipAddress, sessionId).run();


        return new Response(JSON.stringify({
          success: true,
          token,
          username: user.username
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Login Handler Error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Server error during login' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
}
async function handleCheckAttempts(request: Request, env: CustomEnv): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    // ... your implementation ...
     const url = new URL(request.url);
     const ipAddress = url.searchParams.get('ip');
     const sessionId = url.searchParams.get('session');

     if (!ipAddress || !sessionId) {
       return new Response(JSON.stringify({ error: 'Missing IP or session parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     try {
       const result = await env.FOREX_DB.prepare(
         `SELECT COUNT(*) as count FROM login_attempts
          WHERE (ip_address = ?1 OR session_id = ?2) -- Check both
          AND success = 0
          AND datetime(attempt_time) > datetime('now', '-1 hour')`
       ).bind(ipAddress, sessionId).first<{ count: number }>();

       const failedAttempts = result?.count ?? 0;
       const maxAttempts = 7;

       return new Response(JSON.stringify({
         attempts: failedAttempts,
         remaining: Math.max(0, maxAttempts - failedAttempts)
       }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     } catch (error) {
       console.error("Error checking login attempts:", error);
       return new Response(JSON.stringify({ error: 'Server error while checking attempts' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }
}
async function handleChangePassword(request: Request, env: CustomEnv): Promise<Response> {
     if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

     try {
         const { username, /* currentPassword, - Not verified by backend */ newPassword, token } = await request.json() as { username?: string, currentPassword?: string, newPassword?: string, token?: string };

         // Validate input
         if (!username || !newPassword || !token) {
             return new Response(JSON.stringify({ success: false, error: 'Missing required fields (username, newPassword, token)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         }
         if (newPassword.length < 8) { // Basic length check
             return new Response(JSON.stringify({ success: false, error: 'New password must be at least 8 characters long.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         }

        // Verify token (simple check, replace with proper JWT validation if using JWT)
        if (!verifyToken(token)) { // Assuming verifyToken is defined
            return new Response(JSON.stringify({ success: false, error: 'Unauthorized or invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Hash the new password (assuming simpleHash is defined and returns a hash string)
        const newPasswordHash = await simpleHash(newPassword);

        // Update the user's password hash in the database
        const updateResult = await env.FOREX_DB.prepare(
          `UPDATE users SET password_hash = ?1, updated_at = datetime('now') WHERE username = ?2`
        ).bind(newPasswordHash, username).run();

        // Check if the user was actually found and updated
         if (updateResult.meta?.changes !== 1) {
            console.warn(`Attempted password change for non-existent user: ${username}`);
             // Don't reveal user existence, return a generic error or potentially success anyway?
             // For now, let's treat it as success from the user's perspective if token was valid
             // return new Response(JSON.stringify({ success: false, error: 'User not found or update failed.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         }


        // Mark password as changed by adding an entry to user_recovery
        // Use a consistent value or timestamp to indicate change
         await env.FOREX_DB.prepare(
           `INSERT INTO user_recovery (recovery_token, created_at) VALUES (?1, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET recovery_token = excluded.recovery_token, created_at = excluded.created_at;` // Use a placeholder ID or unique constraint if needed
         ).bind(`changed_${Date.now()}`).run(); // Example value


        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Password Change Error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Server error during password change' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
}
async function handlePosts(request: Request, env: CustomEnv): Promise<Response> {
     if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

     const authHeader = request.headers.get('Authorization');
     if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) { // Assuming verifyToken is defined
       return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     if (request.method === 'GET') {
       try {
         const result = await env.FOREX_DB.prepare(
           `SELECT * FROM posts ORDER BY created_at DESC LIMIT 100` // Added LIMIT
         ).all();
         return new Response(JSON.stringify({ success: true, posts: result.results || [] }), { // Ensure array
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       } catch (error) {
          console.error("Error fetching admin posts:", error);
          return new Response(JSON.stringify({ success: false, error: 'Failed to fetch posts' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
     }

     if (request.method === 'POST') {
       try {
         const post = await request.json() as Partial<PostData>; // Use PostData interface

         if (!post.title || !post.content) {
             return new Response(JSON.stringify({ success: false, error: 'Title and content are required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         }

         const slug = post.slug || generateSlug(post.title); // Assuming generateSlug is defined
         const status = post.status === 'published' ? 'published' : 'draft';
         const publishedAt = status === 'published' ? new Date().toISOString() : null;
         // Ensure keywords are stored correctly (backend expects string, but form might send array/string)
          let keywordsString: string | null = null;
          if (Array.isArray(post.meta_keywords)) {
              keywordsString = post.meta_keywords.join(', ');
          } else if (typeof post.meta_keywords === 'string') {
              keywordsString = post.meta_keywords;
          }


         const result = await env.FOREX_DB.prepare(
           `INSERT INTO posts (
              title, slug, excerpt, content, featured_image_url,
              author_name, author_url, status, published_at,
              meta_title, meta_description, meta_keywords,
              created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, datetime('now'), datetime('now'))`
         ).bind(
           post.title,
           slug,
           post.excerpt || null,
           post.content,
           post.featured_image_url || null,
           post.author_name || 'Grisma',
           post.author_url || 'https://grisma.com.np/about',
           status,
           publishedAt,
           post.meta_title || post.title, // Default meta title to title
           post.meta_description || post.excerpt || null, // Default meta desc to excerpt
           keywordsString, // Store as string
         ).run();

         // D1 run() returns meta.last_row_id only on success
          const lastId = result.meta?.last_row_id;

          if (lastId) {
             return new Response(JSON.stringify({ success: true, id: lastId }), {
               headers: { ...corsHeaders, 'Content-Type': 'application/json' }
             });
          } else {
             console.error("Post creation failed, D1 meta:", result.meta);
             throw new Error("Failed to get inserted post ID from database.");
          }


       } catch (error) {
         console.error('Post creation error:', error);
         return new Response(JSON.stringify({ success: false, error: `Failed to create post: ${error instanceof Error ? error.message : String(error)}` }), {
           status: 500,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }
     }

     // Fallback for unsupported methods
     return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
async function handlePostById(request: Request, env: CustomEnv): Promise<Response> {
     if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

     const authHeader = request.headers.get('Authorization');
     if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) { // Assuming verifyToken is defined
       return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     const url = new URL(request.url);
     const idStr = url.pathname.split('/').pop();
     const id = idStr ? parseInt(idStr, 10) : NaN; // D1 uses integer ID

     if (isNaN(id)) {
         return new Response(JSON.stringify({ error: 'Invalid post ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     if (request.method === 'GET') {
       try {
           const post = await env.FOREX_DB.prepare(
             `SELECT * FROM posts WHERE id = ?1`
           ).bind(id).first();

           if (!post) {
             return new Response(JSON.stringify({ success: false, error: 'Post not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           }
            // Convert comma-separated keywords back to array for frontend consistency if needed
            // However, the frontend PostEditor expects string now, so keep it as string
            // if (typeof post.meta_keywords === 'string') {
            //     post.meta_keywords = post.meta_keywords.split(',').map(k => k.trim()).filter(Boolean);
            // }

           return new Response(JSON.stringify({ success: true, post }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       } catch (error) {
           console.error(`Error fetching post ${id}:`, error);
           return new Response(JSON.stringify({ success: false, error: 'Failed to fetch post' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
     }

     if (request.method === 'PUT') {
       try {
         const post = await request.json() as Partial<PostData>;

          if (!post.title || !post.content) {
             return new Response(JSON.stringify({ success: false, error: 'Title and content are required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         }

          const status = post.status === 'published' ? 'published' : 'draft';
         // Determine if published_at needs setting (only if transitioning TO published)
          const currentPost = await env.FOREX_DB.prepare(`SELECT status, published_at FROM posts WHERE id = ?1`).bind(id).first<{status: string, published_at: string | null}>();
          let publishedAt = currentPost?.published_at; // Keep existing publish date by default
          if (status === 'published' && currentPost?.status !== 'published') {
              publishedAt = new Date().toISOString(); // Set publish date on transition
          } else if (status === 'draft') {
              publishedAt = null; // Unpublishing resets it (optional behavior)
          }

           // Ensure keywords are stored correctly (backend expects string)
           let keywordsString: string | null = null;
           if (Array.isArray(post.meta_keywords)) {
               keywordsString = post.meta_keywords.join(', ');
           } else if (typeof post.meta_keywords === 'string') {
               keywordsString = post.meta_keywords;
           }


         const result = await env.FOREX_DB.prepare(
           `UPDATE posts SET
              title = ?1, slug = ?2, excerpt = ?3, content = ?4, featured_image_url = ?5,
              author_name = ?6, author_url = ?7, status = ?8, published_at = ?9,
              meta_title = ?10, meta_description = ?11, meta_keywords = ?12,
              updated_at = datetime('now')
            WHERE id = ?13`
         ).bind(
           post.title,
           post.slug || generateSlug(post.title), // Ensure slug exists
           post.excerpt || null,
           post.content,
           post.featured_image_url || null,
           post.author_name || 'Grisma',
           post.author_url || 'https://grisma.com.np/about',
           status,
           publishedAt,
           post.meta_title || post.title,
           post.meta_description || post.excerpt || null,
           keywordsString,
           id
         ).run();

         if (result.meta?.changes === 1) {
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         } else {
             console.warn(`Post update failed or post ${id} not found. Meta:`, result.meta);
             throw new Error("Post not found or update failed.");
         }

       } catch (error) {
          console.error(`Error updating post ${id}:`, error);
         return new Response(JSON.stringify({ success: false, error: `Failed to update post: ${error instanceof Error ? error.message : String(error)}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
     }

     if (request.method === 'DELETE') {
        try {
            const result = await env.FOREX_DB.prepare(
             `DELETE FROM posts WHERE id = ?1`
            ).bind(id).run();

             if (result.meta?.changes === 1) {
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
             } else {
                 console.warn(`Post delete failed or post ${id} not found. Meta:`, result.meta);
                 // Still return success? Or 404? Let's return success for idempotency.
                 return new Response(JSON.stringify({ success: true, message: "Post not found or already deleted." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                 // throw new Error("Post not found or delete failed.");
             }
        } catch(error) {
             console.error(`Error deleting post ${id}:`, error);
            return new Response(JSON.stringify({ success: false, error: 'Failed to delete post' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
     }

     // Fallback for unsupported methods
     return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
async function handleForexData(request: Request, env: CustomEnv): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     const authHeader = request.headers.get('Authorization');
     if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) {
       return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     if (request.method === 'GET') {
       const url = new URL(request.url);
       const date = url.searchParams.get('date');

       try {
           if (date) {
             // Validate date format slightly
             if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                 return new Response(JSON.stringify({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
             }
             const result = await env.FOREX_DB.prepare(
               `SELECT * FROM forex_rates WHERE date = ?1`
             ).bind(date).first();

             return new Response(JSON.stringify({ success: true, data: result }), { // data will be null if not found
               headers: { ...corsHeaders, 'Content-Type': 'application/json' }
             });
           } else {
             // Fetch recent (e.g., last 30) if no date specified
             const result = await env.FOREX_DB.prepare(
               `SELECT * FROM forex_rates ORDER BY date DESC LIMIT 30`
             ).all();

             return new Response(JSON.stringify({ success: true, data: result.results || [] }), {
               headers: { ...corsHeaders, 'Content-Type': 'application/json' }
             });
           }
       } catch (error) {
           console.error("Error fetching forex data:", error);
           return new Response(JSON.stringify({ success: false, error: 'Database error fetching forex data' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
     }

     if (request.method === 'POST') { // Handles both create and update via INSERT OR REPLACE
       try {
         const data = await request.json() as ForexRateData; // Use interface

          if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
             return new Response(JSON.stringify({ success: false, error: 'Invalid or missing date. Use YYYY-MM-DD.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

         const columns: string[] = ['date', 'updated_at'];
         const placeholders: string[] = ['?1', "datetime('now')"];
         const values: (string | number | null)[] = [data.date]; // Use explicit type

         let paramIndex = 2; // Start bind parameters at ?2

         for (const currency of CURRENCIES) {
           const buyKey = `${currency}_buy`;
           const sellKey = `${currency}_sell`;

           const buyVal = data[buyKey];
           const sellVal = data[sellKey];

           // Only include if defined (even if null or empty string, let DB handle type/null)
            // But ensure they are numbers or null before binding
           const buyNum = (buyVal === '' || buyVal === null || buyVal === undefined) ? null : Number(buyVal);
           const sellNum = (sellVal === '' || sellVal === null || sellVal === undefined) ? null : Number(sellVal);


           // Check if conversion resulted in NaN, treat as null
           const finalBuy = (buyNum === null || isNaN(buyNum)) ? null : buyNum;
           const finalSell = (sellNum === null || isNaN(sellNum)) ? null : sellNum;


           columns.push(buyKey, sellKey);
           placeholders.push(`?${paramIndex++}`, `?${paramIndex++}`);
           values.push(finalBuy, finalSell);

         }

         const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
         const result = await env.FOREX_DB.prepare(query).bind(...values).run();

          if (result.success) {
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          } else {
             console.error("D1 Error saving forex data:", result.meta);
             throw new Error("Database operation failed.");
          }


       } catch (error) {
         console.error("Error saving forex data:", error);
         return new Response(JSON.stringify({ success: false, error: `Failed to save forex data: ${error instanceof Error ? error.message : String(error)}` }), {
           status: 500,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }
     }

     return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
async function handleSiteSettings(request: Request, env: CustomEnv): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
     const authHeader = request.headers.get('Authorization');
     if (!authHeader || !verifyToken(authHeader.replace('Bearer ', ''))) {
       return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
     }

     const SETTING_KEY = 'header_tags';

     if (request.method === 'GET') {
         try {
             const result = await env.FOREX_DB.prepare(
               `SELECT setting_value FROM site_settings WHERE setting_key = ?1`
             ).bind(SETTING_KEY).first<{ setting_value: string }>();

             return new Response(JSON.stringify({
               success: true,
               header_tags: result?.setting_value || '' // Return empty string if null/not found
             }), {
               headers: { ...corsHeaders, 'Content-Type': 'application/json' }
             });
         } catch (error) {
             console.error("Error fetching site settings:", error);
            return new Response(JSON.stringify({ success: false, error: 'Database error fetching settings' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         }
     }

     if (request.method === 'POST') {
       try {
         const { header_tags } = await request.json() as { header_tags?: string };

         // Ensure header_tags is a string, default to empty if null/undefined
         const valueToSave = typeof header_tags === 'string' ? header_tags : '';


         const result = await env.FOREX_DB.prepare(
           `INSERT INTO site_settings (setting_key, setting_value, updated_at)
            VALUES (?1, ?2, datetime('now'))
            ON CONFLICT(setting_key) DO UPDATE SET
              setting_value = excluded.setting_value,
              updated_at = excluded.updated_at`
         ).bind(SETTING_KEY, valueToSave).run();

          if (result.success) {
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          } else {
             console.error("D1 Error saving site settings:", result.meta);
             throw new Error("Database operation failed.");
          }

       } catch (error) {
          console.error("Error saving site settings:", error);
         return new Response(JSON.stringify({ success: false, error: `Failed to save settings: ${error instanceof Error ? error.message : String(error)}` }), {
           status: 500,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }
     }

     return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// --- Scheduled Handler ---
async function updateForexData(env: CustomEnv): Promise<void> {
    console.log("Running scheduled task: updateForexData");
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Fetch last 7 days

      const fromDateStr = formatDate(startDate);
      const toDateStr = formatDate(endDate);

      console.log(`Scheduled fetch range: ${fromDateStr} to ${toDateStr}`);

       // Use the same logic as handleFetchAndStore (could be refactored)
      const nrbUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDateStr}&to=${toDateStr}`;
      const response = await fetch(nrbUrl);


      if (!response.ok) {
           console.error(`Scheduled NRB API error: ${response.status} ${response.statusText}`);
          const errorBody = await response.text();
          console.error("Scheduled NRB Error Body:", errorBody);
          throw new Error(`Scheduled NRB API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Scheduled fetch received ${data?.data?.payload?.length || 0} days of data.`);

      if (data?.data?.payload && data.data.payload.length > 0) {
        let storedCount = 0;
        const statements: D1PreparedStatement[] = [];

        for (const dayData of data.data.payload) {
             const dateStr = dayData.date;
             const columns: string[] = ['date', 'updated_at'];
             const placeholders: string[] = ['?', "datetime('now')"];
             const values: (string | number | null)[] = [dateStr];
              const rateMap = new Map(dayData.rates.map((r: any) => [r.currency.iso3, r]));

              for (const currencyCode of CURRENCIES) {
                 const rate = rateMap.get(currencyCode);
                 const buyRate = rate ? parseFloat(rate.buy) : null;
                 const sellRate = rate ? parseFloat(rate.sell) : null;
                  if (rate && !isNaN(buyRate!) && !isNaN(sellRate!)) {
                    columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`);
                    placeholders.push('?', '?');
                    values.push(buyRate, sellRate);
                  } else {
                     columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`);
                     placeholders.push('?', '?');
                     values.push(null, null);
                  }
              }

              if (columns.length > 2) {
                 const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
                 statements.push(env.FOREX_DB.prepare(query).bind(...values));
              }
        }

         if (statements.length > 0) {
            console.log(`Executing scheduled batch insert/replace for ${statements.length} dates.`);
            const batchResult = await env.FOREX_DB.batch(statements);
            storedCount = statements.length; // Assuming success unless checked below

            // Optional: Check batchResult for errors
            let failures = 0;
             batchResult.forEach((res, index) => {
                 if (!res.success) {
                      console.error(`Error in scheduled batch statement ${index}:`, res.meta);
                      failures++;
                 }
             });
             console.log(`Scheduled batch finished. Success: ${storedCount - failures}, Failures: ${failures}`);

         } else {
             console.log("Scheduled task: No valid data found in NRB response to store.");
         }

      } else {
          console.log("Scheduled task: No payload data received from NRB.");
      }
    } catch (error) {
      console.error('Error in scheduled updateForexData:', error);
    }
     console.log("Scheduled task finished.");
}


// --- Utilities ---
function formatDate(date: Date): string {
  // Ensure date is valid
   if (!(date instanceof Date) || isNaN(date.getTime())) {
       console.error("Invalid date passed to formatDate:", date);
       // Return today's date as a fallback or throw error
       date = new Date();
   }
  return date.toISOString().split('T')[0];
}

function generateToken(): string {
   // Simple non-secure token for demo purposes. Use JWT in production.
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function verifyToken(token: string): boolean {
   // Extremely basic validation. Replace with actual JWT verification.
  return typeof token === 'string' && token.length > 40; // Example length check
}

async function simpleHash(password: string): Promise<string> {
   // Basic SHA-256 Hashing. NOT suitable for production passwords (use bcrypt/argon2).
   // Kept simple to match worker logic, assuming it's for this specific setup.
  if (typeof password !== 'string' || password.length === 0) {
      throw new Error("Password cannot be empty");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function simpleHashCompare(password: string, hash: string): Promise<boolean> {
  if (typeof password !== 'string' || typeof hash !== 'string' || hash.length === 0) {
     return false;
  }
  try {
      const passwordHash = await simpleHash(password);
      // Basic timing-attack resistance (length check first)
      if (passwordHash.length !== hash.length) {
          return false;
      }
      // Compare hashes
      return passwordHash === hash;
  } catch (error) {
     console.error("Error during hash comparison:", error);
     return false;
  }
}

function generateSlug(title: string): string {
   if (typeof title !== 'string') return '';
  return title
    .toLowerCase()
    // Remove apostrophes and quotes first
    .replace(/['`‘’"“”]/g, '')
    // Replace non-alphanumeric chars (excluding hyphens already present) with a hyphen
    .replace(/[^a-z0-9-]+/g, '-')
    // Replace multiple hyphens with a single hyphen
    .replace(/-+/g, '-')
    // Trim leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length (optional)
    .slice(0, 75); // Example limit
}
