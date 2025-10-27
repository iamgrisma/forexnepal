import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import type { Rate, RatesData } from './types/forex'; // Import Rate and RatesData types

// --- D1 & KV Interfaces (Keep as they are) ---
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
  results: T[];
  success: boolean;
  meta?: any;
}
interface KVNamespace {
  get(key: string, options?: any): Promise<any>;
  put(key: string, value: any, options?: any): Promise<void>;
}
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}
interface Env {
  FOREX_DB: D1Database;
  __STATIC_CONTENT: KVNamespace;
}

// --- CURRENCIES List (Keep as it is) ---
const CURRENCIES = [
  'INR', 'USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD', 'SGD',
  'JPY', 'CNY', 'SAR', 'QAR', 'THB', 'AED', 'MYR', 'KRW',
  'SEK', 'DKK', 'HKD', 'KWD', 'BHD', 'OMR'
];

// --- Default Export (Keep routing logic) ---
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle OPTIONS requests for CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // --- API Routing (Keep existing routes) ---
    if (url.pathname === '/api/check-data') {
      return handleCheckData(request, env);
    }
    if (url.pathname === '/api/fetch-and-store') {
      return handleFetchAndStore(request, env);
    }
    // Modify the /api/historical-rates route handler
    if (url.pathname === '/api/historical-rates') {
      return handleHistoricalRates(request, env); // <<< MODIFIED FUNCTION BELOW
    }
    if (url.pathname === '/api/admin/login') {
      return handleAdminLogin(request, env);
    }
    if (url.pathname === '/api/admin/check-attempts') {
      return handleCheckAttempts(request, env);
    }
    if (url.pathname === '/api/admin/change-password') {
       // Make sure handleChangePassword is defined or imported
      return handleChangePassword(request, env);
    }
    if (url.pathname === '/api/admin/posts') {
      return handlePosts(request, env);
    }
    if (url.pathname.startsWith('/api/admin/posts/')) {
      return handlePostById(request, env);
    }
    if (url.pathname === '/api/admin/forex-data') {
      return handleForexData(request, env);
    }
    if (url.pathname === '/api/admin/settings') {
      return handleSiteSettings(request, env);
    }
    if (url.pathname === '/api/posts') {
      return handlePublicPosts(request, env);
    }
    if (url.pathname.startsWith('/api/posts/')) {
      return handlePublicPostBySlug(request, env);
    }

    // --- Static Asset Serving (Keep as it is) ---
    try {
      return await getAssetFromKV(
        { request, waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise) },
        { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
      );
    } catch (e) {
      // Handle SPA routing: serve index.html for non-API routes
      try {
        const indexRequest = new Request(new URL('/', request.url), request);
        return await getAssetFromKV(
          { request: indexRequest, waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise) },
          { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
        );
      } catch (e) {
        return new Response('Not Found', { status: 404 });
      }
    }
  },

  // --- Scheduled Task (Keep as it is) ---
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(updateForexData(env));
  }
};

// --- CORS Headers and Handler (Keep as they are) ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Be more specific in production if possible
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function handleOptions(request: Request) {
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Handle CORS preflight requests.
    return new Response(null, { headers: corsHeaders });
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        Allow: 'GET, POST, PUT, DELETE, OPTIONS',
      },
    });
  }
}

// --- handleCheckData & handleFetchAndStore (Keep as they are) ---
async function handleCheckData(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const fromDate = url.searchParams.get('from');
  const toDate = url.searchParams.get('to');

  if (!fromDate || !toDate) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  // ... (rest of the function remains the same)
   try {
    const results = await env.FOREX_DB.prepare(
      `SELECT date FROM forex_rates WHERE date >= ? AND date <= ? ORDER BY date ASC`
    ).bind(fromDate, toDate).all();

    const existingDates = new Set(results.results.map((r: any) => r.date));
    const start = new Date(fromDate + 'T00:00:00Z'); // Ensure UTC parsing
    const end = new Date(toDate + 'T00:00:00Z');   // Ensure UTC parsing
    const expectedDates: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Check for invalid date objects just in case
        if (isNaN(d.getTime())) continue;
        expectedDates.push(formatDate(d)); // Ensure formatDate handles Date object
    }

    const missingDates = expectedDates.filter(date => !existingDates.has(date));

    return new Response(JSON.stringify({
      exists: missingDates.length === 0,
      missingDates,
      existingCount: existingDates.size,
      expectedCount: expectedDates.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database error in handleCheckData:', error);
    return new Response(JSON.stringify({ error: 'Database error', exists: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleFetchAndStore(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    if (!fromDate || !toDate) {
        return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    // ... (rest of the function remains the same)
     try {
        const response = await fetch(
        `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDate}&to=${toDate}`
        );
        if (!response.ok) throw new Error(`NRB API error: ${response.status}`);
        const data = await response.json();
        if (!data?.data?.payload || data.data.payload.length === 0) {
            return new Response(JSON.stringify({ success: false, message: 'No data available from API', data: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        let storedCount = 0;
        const statements: D1PreparedStatement[] = [];

        for (const dayData of data.data.payload) {
            const dateStr = dayData.date;
            const columns: string[] = ['date', 'updated_at'];
            const placeholders: string[] = ['?', "datetime('now')"];
            const values: any[] = [dateStr];

            for (const rate of dayData.rates) {
                const currencyCode = rate.currency.iso3;
                if (CURRENCIES.includes(currencyCode)) {
                    columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`);
                    placeholders.push('?', '?');
                    // Ensure values are numbers or null
                    const buyVal = parseFloat(rate.buy);
                    const sellVal = parseFloat(rate.sell);
                    values.push(isNaN(buyVal) ? null : buyVal, isNaN(sellVal) ? null : sellVal);
                }
            }

            const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            statements.push(env.FOREX_DB.prepare(query).bind(...values));
        }

        // Batch insert/replace
        if (statements.length > 0) {
            await env.FOREX_DB.batch(statements);
            storedCount = statements.length;
        }


        return new Response(JSON.stringify({ success: true, stored: storedCount, fromDate, toDate }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Error fetching and storing data:', error);
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch and store data' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}


// --- MODIFIED handleHistoricalRates FUNCTION ---
async function handleHistoricalRates(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const currencyCode = url.searchParams.get('currency'); // Might be null
  const fromDate = url.searchParams.get('from');
  const toDate = url.searchParams.get('to');

  if (!fromDate || !toDate) { // Currency code is optional
    return new Response(JSON.stringify({ error: 'Missing date parameters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    let query: D1PreparedStatement;
    let responsePayload: any; // Can be RatesData | null or { success: true, data: ChartDataPoint[], currency: string }

    if (currencyCode) {
      // --- Logic for SPECIFIC currency (for charts) ---
      query = env.FOREX_DB.prepare(
        // Use COALESCE to return 0 or null if rate doesn't exist, adjust as needed
        `SELECT date,
                COALESCE(${currencyCode}_buy, NULL) as buy_rate,
                COALESCE(${currencyCode}_sell, NULL) as sell_rate
         FROM forex_rates
         WHERE date >= ? AND date <= ?
         ORDER BY date ASC`
      ).bind(fromDate, toDate);

      const results = await query.all();

      // Filter out dates where both rates are null if necessary, or let frontend handle it
      const chartData = results.results
          .filter((item: any) => item.buy_rate !== null || item.sell_rate !== null) // Only include if at least one rate exists
          .map((item: any) => ({
              date: item.date,
              buy: item.buy_rate,
              sell: item.sell_rate
          }));

      responsePayload = {
          success: true,
          data: chartData,
          currency: currencyCode
      };
      // For specific currency requests, wrap in success object
      return new Response(JSON.stringify(responsePayload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      // --- Logic for ALL currencies (for converter) ---
      query = env.FOREX_DB.prepare(
        `SELECT * FROM forex_rates WHERE date >= ? AND date <= ? ORDER BY date ASC LIMIT 1` // Fetch only one row for the single date
      ).bind(fromDate, toDate); // Use the same date for from/to

      const result = await query.first<any>(); // Fetch the single row for the date

      if (result) {
        const rates: Rate[] = [];
        CURRENCIES.forEach(code => {
          const buyRate = result[`${code}_buy`];
          const sellRate = result[`${code}_sell`];
          // Basic check for existence, might need better validation
          if (buyRate !== null && sellRate !== null && buyRate !== undefined && sellRate !== undefined) {
            rates.push({
              currency: { iso3: code, name: code, unit: 1 }, // Placeholder name/unit. Fetch actual name/unit if needed.
              buy: buyRate,
              sell: sellRate,
            });
          }
        });

        // Format as RatesData for the converter
        responsePayload = {
          date: result.date,
          // Use 'updated_at' for published/modified, or adjust if you add those columns
          published_on: result.updated_at || result.date,
          modified_on: result.updated_at || result.date,
          rates: rates,
        };
      } else {
        // No data found for this date in D1
        responsePayload = null;
      }

       // For the converter request (no currency code), return RatesData object directly or null
       return new Response(JSON.stringify(responsePayload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

  } catch (error) {
    console.error('Database error in handleHistoricalRates:', error);
    // Return null in case of error for converter, or specific error object for charts
    const errorPayload = currencyCode ? { success: false, error: 'Database error', data: [] } : null;
    return new Response(JSON.stringify(errorPayload), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}


// --- Admin Auth, Posts, Settings Handlers (Keep as they are) ---
// handleAdminLogin, handleCheckAttempts, handleChangePassword,
// handlePosts, handlePostById, handleForexData, handleSiteSettings
// handlePublicPosts, handlePublicPostBySlug
// generateToken, verifyToken, simpleHash, simpleHashCompare, generateSlug

// --- Utility Functions (Keep as they are) ---
function formatDate(date: Date): string {
    // Ensure date is valid before formatting
    if (!date || isNaN(date.getTime())) {
        console.error("Invalid date passed to formatDate:", date);
        // Return today's date as a fallback or throw an error
        return new Date().toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
}


// --- Scheduled Update Function (Keep as it is, consider error handling) ---
async function updateForexData(env: Env): Promise<void> {
  console.log("Starting scheduled forex data update...");
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7); // Fetch last 7 days

    const fromDateStr = formatDate(startDate);
    const toDateStr = formatDate(endDate);

    console.log(`Fetching NRB data from ${fromDateStr} to ${toDateStr}`);

    const response = await fetch(
      `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDateStr}&to=${toDateStr}`
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`NRB API error: ${response.status} - ${errorText}`);
        // Consider retrying or logging specific non-OK statuses differently
        if (response.status === 404) {
            console.log("No data found in the range for scheduled update.");
            return; // Exit gracefully if no data
        }
      throw new Error(`NRB API error: ${response.status}`);
    }

    const data = await response.json();

    if (data?.data?.payload && data.data.payload.length > 0) {
        let updatedCount = 0;
        const statements: D1PreparedStatement[] = [];

        for (const dayData of data.data.payload) {
            const dateStr = dayData.date;
            if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                console.warn(`Skipping invalid date format from API: ${dateStr}`);
                continue;
            }

            const columns: string[] = ['date', 'updated_at'];
            const placeholders: string[] = ['?', "datetime('now', 'localtime')"]; // Use localtime if D1 supports it, else 'now'
            const values: (string | number | null)[] = [dateStr];

            let hasRatesForDate = false;
            for (const rate of dayData.rates) {
                const currencyCode = rate?.currency?.iso3;
                if (currencyCode && CURRENCIES.includes(currencyCode)) {
                    columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`);
                    placeholders.push('?', '?');
                    const buyVal = parseFloat(rate.buy);
                    const sellVal = parseFloat(rate.sell);
                    values.push(isNaN(buyVal) ? null : buyVal, isNaN(sellVal) ? null : sellVal);
                    hasRatesForDate = true; // Mark that we found valid rates
                } else {
                    // console.warn(`Skipping invalid rate data for date ${dateStr}:`, rate);
                }
            }

            // Only prepare statement if we actually have rates for this date
            if (hasRatesForDate) {
                const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
                statements.push(env.FOREX_DB.prepare(query).bind(...values));
            } else {
                console.log(`No valid currency rates found for ${dateStr} in API payload.`);
            }
        }

        // Batch insert/replace if there are statements
        if (statements.length > 0) {
            console.log(`Preparing to batch update/insert ${statements.length} date records...`);
            const results = await env.FOREX_DB.batch(statements);
            // Optional: Check results for errors
            results.forEach((result, index) => {
                if (!result.success) {
                    console.error(`Error executing statement ${index}:`, result.meta?.error);
                } else {
                   updatedCount++;
                }
            });
            console.log(`Successfully updated/inserted ${updatedCount} days of forex rates.`);
        } else {
            console.log("No valid statements generated for batch update.");
        }

    } else {
        console.log("No payload data found in NRB API response for the scheduled update range.");
    }
  } catch (error) {
    console.error('FATAL Error during scheduled forex data update:', error);
    // Consider adding alerting here (e.g., call a monitoring service)
  }
}


// --- Admin Authentication, Posts, Settings (Keep Original implementations) ---
// ... (handleAdminLogin, handleCheckAttempts, handleChangePassword, handlePosts, handlePostById, handleForexData, handleSiteSettings, handlePublicPosts, handlePublicPostBySlug, generateToken, verifyToken, simpleHash, simpleHashCompare, generateSlug) ...
// Make sure these functions exist and are correct as per your previous setup.

async function simpleHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function simpleHashCompare(password: string, hash: string): Promise<boolean> {
  // If hash is empty or null (e.g., initial state), use default password
  if (!hash) {
      return password === 'Administrator';
  }
  // Otherwise, compare hashed password
  const passwordHash = await simpleHash(password);
  return passwordHash === hash;
}

// Ensure generateToken and verifyToken are robust
// Use a strong, environment-variable-based secret in production
const JWT_SECRET = 'forexnepal-jwt-secret-key-2025'; // Replace with env variable in real deployment

async function generateToken(username: string): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        username,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours validity
    };

    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));

    // Convert ArrayBuffer to Base64URL string
    let base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
    base64Signature = base64Signature.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    return `${signatureInput}.${base64Signature}`;
}

async function verifyToken(token: string): Promise<boolean> {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    try {
        const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            console.log("Token expired");
            return false; // Token expired
        }

        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        );

        // Convert Base64URL signature to Uint8Array
        let base64 = signature.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        const signatureBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

        const isValid = await crypto.subtle.verify(
            'HMAC', key, signatureBytes, encoder.encode(signatureInput)
        );

        return isValid;

    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}
// Placeholder for handleChangePassword if not fully defined elsewhere
async function handleChangePassword(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });

     const authHeader = request.headers.get('Authorization');
     const token = authHeader?.replace('Bearer ', '');
     if (!token || !(await verifyToken(token))) {
         return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
     }

    try {
        const { username, currentPassword, newPassword } = await request.json();

        // 1. Fetch user by username (should match token ideally, but using username from request for now)
        const user = await env.FOREX_DB.prepare(
            `SELECT password_hash FROM users WHERE username = ?`
        ).bind(username).first<{ password_hash: string | null }>();

        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        // 2. Verify current password
        const isCurrentPasswordValid = await simpleHashCompare(currentPassword, user.password_hash || '');
         // If password_hash is null/empty, check against the default password
         if (!user.password_hash) {
             const recoveryCheck = await env.FOREX_DB.prepare(`SELECT COUNT(*) as count FROM user_recovery`).first<{ count: number }>();
             if (recoveryCheck?.count === 0 && currentPassword === 'Administrator') {
                // Allow change if current password is the default and no recovery token exists
             } else if (!isCurrentPasswordValid) {
                  return new Response(JSON.stringify({ success: false, error: 'Incorrect current password' }), { status: 403, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
             }
         }
         else if (!isCurrentPasswordValid) {
             return new Response(JSON.stringify({ success: false, error: 'Incorrect current password' }), { status: 403, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
         }


        // 3. Hash the new password
        const newPasswordHash = await simpleHash(newPassword);

        // 4. Update the user's password hash in the database
        await env.FOREX_DB.prepare(
            `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE username = ?`
        ).bind(newPasswordHash, username).run();

        // 5. Update recovery status to indicate password has been changed from default
        // Use INSERT OR IGNORE to avoid errors if a row already exists
        await env.FOREX_DB.prepare(
            `INSERT OR IGNORE INTO user_recovery (id, recovery_token) VALUES (1, 'password_set')`
        ).run();
        // Ensure subsequent changes don't fail by updating if exists
         await env.FOREX_DB.prepare(
            `UPDATE user_recovery SET recovery_token = 'password_set' WHERE id = 1`
         ).run();


        return new Response(JSON.stringify({ success: true, message: "Password updated successfully" }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error) {
        console.error('Password change error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Server error during password change' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}
// Placeholder for generateSlug if not defined elsewhere
function generateSlug(title: string): string {
  if (!title) return `post-${Date.now()}`;
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove invalid chars
    .trim()
    .replace(/\s+/g, '-') // Collapse whitespace and replace by -
    .replace(/-+/g, '-'); // Collapse dashes
}
// Ensure all other required functions (handlePosts, etc.) are present and correct.
