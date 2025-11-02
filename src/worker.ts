import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import type { Rate, RatesData } from './types/forex'; // Ensure Rate and RatesData types are imported

// --- SITEMAP IMPORTS (NEW) ---
import {
    generateSitemapIndex,
    generatePageSitemap,
    generatePostSitemap,
    generateArchiveSitemap,
    getArchiveSitemapCount
} from './sitemapGenerator'; // Make sure sitemapGenerator.ts is in the same directory

// --- D1 & KV Interfaces ---
interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    // Add exec if you use it, otherwise keep it minimal
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
    meta?: any; // D1 meta object can contain duration, rows_read, etc.
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

export interface Env { // Exported Env for sitemapGenerator
    FOREX_DB: D1Database;
    __STATIC_CONTENT: KVNamespace;
    // Add JWT_SECRET here if using environment variables
    // JWT_SECRET: string;
}

// --- CURRENCIES List ---
// This map includes units for correct normalization.
const CURRENCY_MAP: { [key: string]: { name: string, unit: number } } = {
    'INR': { name: 'Indian Rupee', unit: 100 },
    'USD': { name: 'U.S. Dollar', unit: 1 },
    'EUR': { name: 'European Euro', unit: 1 },
    'GBP': { name: 'UK Pound Sterling', unit: 1 },
    'CHF': { name: 'Swiss Franc', unit: 1 },
    'AUD': { name: 'Australian Dollar', unit: 1 },
    'CAD': { name: 'Canadian Dollar', unit: 1 },
    'SGD': { name: 'Singapore Dollar', unit: 1 },
    'JPY': { name: 'Japanese Yen', unit: 10 },
    'CNY': { name: 'Chinese Yuan', unit: 1 },
    'SAR': { name: 'Saudi Arabian Riyal', unit: 1 },
    'QAR': { name: 'Qatari Riyal', unit: 1 },
    'THB': { name: 'Thai Baht', unit: 1 },
    'AED': { name: 'U.A.E Dirham', unit: 1 },
    'MYR': { name: 'Malaysian Ringgit', unit: 1 },
    'KRW': { name: 'South Korean Won', unit: 100 },
    'SEK': { name: 'Swedish Kroner', unit: 1 },
    'DKK': { name: 'Danish Kroner', unit: 1 },
    'HKD': { name: 'Hong Kong Dollar', unit: 1 },
    'KWD': { name: 'Kuwaity Dinar', unit: 1 },
    'BHD': { name: 'Bahrain Dinar', unit: 1 },
    'OMR': { name: 'Omani Rial', unit: 1 }
};
const CURRENCIES = Object.keys(CURRENCY_MAP);


// --- JWT Secret (Use Environment Variable in Production) ---
const JWT_SECRET = 'forexnepal-jwt-secret-key-2025'; // Replace with env.JWT_SECRET in real deployment

// --- Default Export (Router) ---
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // Handle OPTIONS requests for CORS preflight
        if (request.method === 'OPTIONS') {
            return handleOptions(request);
        }

        // --- API Routing ---
        const pathname = url.pathname;

        if (pathname === '/api/check-data') {
            return handleCheckData(request, env);
        }
        if (pathname === '/api/fetch-and-store') {
            return handleFetchAndStore(request, env);
        }
        if (pathname === '/api/historical-rates') {
            return handleHistoricalRates(request, env); // <<< THIS IS THE MODIFIED FUNCTION
        }
        if (pathname === '/api/admin/login') {
            return handleAdminLogin(request, env);
        }
        if (pathname === '/api/admin/check-attempts') {
            return handleCheckAttempts(request, env);
        }
        if (pathname === '/api/admin/change-password') {
            return handleChangePassword(request, env);
        }
        if (pathname === '/api/admin/posts') {
            return handlePosts(request, env);
        }
        if (pathname.startsWith('/api/admin/posts/')) {
            return handlePostById(request, env);
        }
        if (pathname === '/api/admin/forex-data') {
            return handleForexData(request, env);
        }
        if (pathname === '/api/admin/settings') {
            return handleSiteSettings(request, env);
        }
        if (pathname === '/api/posts') {
            return handlePublicPosts(request, env);
        }
        if (pathname.startsWith('/api/posts/')) {
            return handlePublicPostBySlug(request, env);
        }

        // --- SITEMAP ROUTING (NEW & UPDATED) ---
        // Placed *before* the static asset fallback
        
        // UPDATED: Changed content-type to text/html
        const htmlCache = {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=3600", // Cache for 1 hour
        };

        if (pathname === '/sitemap.xml') {
          const archiveSitemapCount = getArchiveSitemapCount();
          const html = generateSitemapIndex(archiveSitemapCount);
          return new Response(html, { headers: htmlCache }); // UPDATED
        }

        if (pathname === '/page-sitemap.xml') {
          const html = generatePageSitemap();
          return new Response(html, { headers: htmlCache }); // UPDATED
        }

        if (pathname === '/post-sitemap.xml') {
          const html = await generatePostSitemap(env.FOREX_DB);
          return new Response(html, { headers: htmlCache }); // UPDATED
        }
        
        // Regex to match /archive-sitemap1.xml, /archive-sitemap2.xml, etc.
        const archiveMatch = pathname.match(/\/archive-sitemap(\d+)\.xml$/);
        if (archiveMatch && archiveMatch[1]) {
          const id = parseInt(archiveMatch[1]);
          const html = generateArchiveSitemap(id); // This now returns HTML
          if (!html) {
            return new Response('Sitemap not found', { status: 404 });
          }
          return new Response(html, { headers: htmlCache }); // UPDATED
        }
        // --- END SITEMAP ROUTING ---


        // --- Static Asset Serving (SPA Fallback) ---
        try {
            // Attempt to serve the static asset directly
            return await getAssetFromKV(
                { request, waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise) },
                { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
            );
        } catch (e: any) {
            // If asset not found (e.g., is a route), serve index.html
            // Check if the error indicates "Not Found" specifically
            // Note: Cloudflare Workers might not expose standard error codes easily,
            // relying on the KV behavior might be necessary.
            if (e instanceof Error && e.message.includes('404') || e.status === 404) { // Heuristic check
                try {
                    const indexRequest = new Request(new URL('/', request.url).toString(), request);
                    return await getAssetFromKV(
                        { request: indexRequest, waitUntil: (p) => ctx.waitUntil(p) },
                        { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
                    );
                } catch (e2) {
                    // If index.html also fails, return a real 404
                     console.error("Failed to serve index.html fallback:", e2);
                     return new Response('Not Found', { status: 404 });
                }
            } else {
                 // For other errors (e.g., permissions, KV issues), return 500
                 console.error("Error serving static asset:", e);
                 return new Response('Internal Server Error', { status: 500 });
            }
        }
    },

    // --- Scheduled Task ---
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`[cron ${event.cron}] Triggered at ${new Date(event.scheduledTime).toISOString()} (Nepal Time: ${new Date(event.scheduledTime + (5.75 * 60 * 60 * 1000)).toISOString()})`);
        ctx.waitUntil(updateForexData(env));
    }
};

// --- CORS Headers and Handler ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // More restrictive in production: e.g., 'https://yourdomain.com'
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Ensure Authorization is allowed
};

function handleOptions(request: Request) {
    if (
        request.headers.get('Origin') !== null &&
        request.headers.get('Access-Control-Request-Method') !== null &&
        request.headers.get('Access-Control-Request-Headers') !== null
    ) {
        // Handle CORS preflight requests
        return new Response(null, { headers: corsHeaders });
    } else {
        // Handle standard OPTIONS request
        return new Response(null, { headers: { Allow: 'GET, POST, PUT, DELETE, OPTIONS' } });
    }
}

// --- Helper Functions ---

function formatDate(date: Date): string {
    if (!date || isNaN(date.getTime())) {
        console.warn("Invalid date passed to formatDate, using current date.");
        date = new Date();
    }
    // Ensure formatting to YYYY-MM-DD
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function simpleHash(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + JWT_SECRET); // Add salt/secret for basic hashing improvement
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function simpleHashCompare(password: string, storedHash: string | null): Promise<boolean> {
    if (!storedHash) {
        return false;
    }
    const inputHash = await simpleHash(password);
    return inputHash === storedHash;
}


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
    const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
    let base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${signatureInput}.${base64Signature}`;
}

async function verifyToken(token: string): Promise<boolean> {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    try {
        const decodedPayload = atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(decodedPayload);
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            console.log("Token expired");
            return false;
        }
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        let base64 = signature.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) { base64 += '='; }
        const signatureBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(signatureInput));
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

function generateSlug(title: string): string {
    if (!title) return `post-${Date.now()}`;
    return title.toLowerCase()
        .replace(/&/g, '-and-').replace(/[^\w\s-]/g, '').trim()
        .replace(/\s+/g, '-').replace(/-+/g, '-');
}

// --- API Route Handlers ---

async function handleCheckData(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!fromDate || !toDate || !dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
        return new Response(JSON.stringify({ error: 'Missing or invalid date parameters (YYYY-MM-DD)' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
     if (new Date(fromDate) > new Date(toDate)) {
         return new Response(JSON.stringify({ error: 'Invalid date range: fromDate cannot be after toDate' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
     }

    try {
        const { results } = await env.FOREX_DB.prepare(
            `SELECT DISTINCT date FROM forex_rates WHERE date >= ? AND date <= ? ORDER BY date ASC`
        ).bind(fromDate, toDate).all<{ date: string }>();

        const existingDates = new Set(results.map(r => r.date));
        // Use UTC to avoid timezone issues when iterating days
        const start = new Date(fromDate + 'T00:00:00Z');
        const end = new Date(toDate + 'T00:00:00Z');
        const expectedDates: string[] = [];
        let expectedCount = 0;

        // Check if date objects are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
             return new Response(JSON.stringify({ error: 'Invalid date values provided' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Iterate through dates correctly
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
            if (isNaN(d.getTime())) { // Safety check within loop
                 console.warn("Skipping invalid date during iteration:", d);
                 continue;
            }
            expectedDates.push(formatDate(d)); // formatDate should handle Date object
            expectedCount++;
        }

        const missingDates = expectedDates.filter(date => !existingDates.has(date));

        return new Response(JSON.stringify({
            exists: missingDates.length === 0 && expectedCount > 0,
            missingDates,
            existingCount: existingDates.size,
            expectedCount: expectedCount
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('Database error in handleCheckData:', error.message, error.cause);
        return new Response(JSON.stringify({ error: 'Database query failed', details: error.message, exists: false }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleFetchAndStore(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!fromDate || !toDate || !dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
         return new Response(JSON.stringify({ error: 'Missing or invalid date parameters (YYYY-MM-DD)' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
     if (new Date(fromDate) > new Date(toDate)) {
         return new Response(JSON.stringify({ error: 'Invalid date range: fromDate cannot be after toDate' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
     }

    try {
        const apiUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDate}&to=${toDate}`;
        console.log(`Fetching from NRB: ${apiUrl}`);
        const response = await fetch(apiUrl);

        if (!response.ok) {
            if (response.status === 404) {
                 console.log(`NRB API returned 404 for ${fromDate}-${toDate}. No data available.`);
                 return new Response(JSON.stringify({ success: true, stored: 0, message: 'No data available from NRB for this range.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            const errorText = await response.text();
            console.error(`NRB API error: ${response.status} - ${errorText}`);
            throw new Error(`NRB API error: ${response.status}`);
        }

        const data = await response.json();
        if (!data?.data?.payload || data.data.payload.length === 0) {
            console.log(`No payload data from NRB for ${fromDate}-${toDate}.`);
            return new Response(JSON.stringify({ success: true, stored: 0, message: 'No data payload received from NRB.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const statements: D1PreparedStatement[] = [];
        let processedDates = 0;

        for (const dayData of data.data.payload) {
            const dateStr = dayData.date;
            if (!dateStr || !dateRegex.test(dateStr)) {
                console.warn(`Skipping invalid date format from NRB API: ${dateStr}`);
                continue;
            }

            const columns: string[] = ['date', 'updated_at'];
            // D1 uses TEXT for datetime, 'now' uses UTC by default. 'localtime' might depend on region.
            const placeholders: string[] = ['?', "datetime('now')"];
            const values: (string | number | null)[] = [dateStr];
            let hasRatesForDate = false;

            for (const rate of dayData.rates) {
                const currencyCode = rate?.currency?.iso3;
                if (currencyCode && CURRENCIES.includes(currencyCode)) {
                    // Use quotes for safety, especially if currency codes could clash with keywords
                    columns.push(`"${currencyCode}_buy"`, `"${currencyCode}_sell"`);
                    placeholders.push('?', '?');
                    const buyVal = parseFloat(rate.buy);
                    const sellVal = parseFloat(rate.sell);
                    values.push(isNaN(buyVal) ? null : buyVal, isNaN(sellVal) ? null : sellVal);
                    hasRatesForDate = true;
                }
            }

            if (hasRatesForDate) {
                const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
                statements.push(env.FOREX_DB.prepare(query).bind(...values));
                processedDates++;
            }
        }

        if (statements.length > 0) {
            console.log(`Batching ${statements.length} statements for D1.`);
             try {
                const batchResult = await env.FOREX_DB.batch(statements);
                // Check batchResult for errors if needed
                console.log(`D1 Batch finished for ${fromDate}-${toDate}. ${processedDates} dates processed.`);
             } catch (batchError: any) {
                 console.error(`D1 Batch Error for ${fromDate}-${toDate}:`, batchError.message, batchError.cause);
                 // Decide how to handle batch failures - maybe return partial success?
                 throw batchError; // Re-throw to indicate failure
             }
        } else {
            console.log(`No valid statements generated for ${fromDate}-${toDate}.`);
        }

        return new Response(JSON.stringify({ success: true, stored: processedDates, fromDate, toDate }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('Error in handleFetchAndStore:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch and store data', details: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// --- MODIFIED handleHistoricalRates FUNCTION ---
async function handleHistoricalRates(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const currencyCode = url.searchParams.get('currency'); // Might be null
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!fromDate || !toDate || !dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
        return new Response(JSON.stringify({ error: 'Missing or invalid date parameters (YYYY-MM-DD)' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    if (new Date(fromDate) > new Date(toDate)) {
        return new Response(JSON.stringify({ error: 'Invalid date range: fromDate cannot be after toDate' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        let query: D1PreparedStatement;
        let responsePayload: any;

        if (currencyCode) {
            // --- Logic for SPECIFIC currency (for charts) ---
            const upperCaseCurrencyCode = currencyCode.toUpperCase();
            if (!CURRENCIES.includes(upperCaseCurrencyCode)) {
                return new Response(JSON.stringify({ success: false, error: 'Invalid currency code specified.', data: [] }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const buyCol = `"${upperCaseCurrencyCode}_buy"`;
            const sellCol = `"${upperCaseCurrencyCode}_sell"`;

            query = env.FOREX_DB.prepare(
                `SELECT date, ${buyCol} as buy_rate, ${sellCol} as sell_rate
                 FROM forex_rates
                 WHERE date >= ? AND date <= ?
                 ORDER BY date ASC`
            ).bind(fromDate, toDate);

            const queryResult = await query.all();

            if (!queryResult.success) {
                 console.error(`D1 Query Error fetching ${currencyCode}`);
                 throw new Error('Database query failed for specific currency');
            }
            
            const { results } = queryResult;

            const chartData = results.map((item: any) => ({
                date: item.date,
                buy: item.buy_rate, // Will be null if column doesn't exist or value is NULL
                sell: item.sell_rate
            }));

            responsePayload = {
                success: true,
                data: chartData,
                currency: currencyCode
            };
            return new Response(JSON.stringify(responsePayload), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } else if (fromDate === toDate) {
             // --- Logic for ALL currencies, SINGLE date (for converter) ---
            query = env.FOREX_DB.prepare(
                `SELECT * FROM forex_rates WHERE date = ? LIMIT 1`
            ).bind(fromDate);

            const result = await query.first<any>();
            let ratesDataPayload: RatesData | null = null;

            if (result) {
                const rates: Rate[] = [];
                let hasValidData = false;
                CURRENCIES.forEach(code => {
                    const buyRate = result[`${code}_buy`];
                    const sellRate = result[`${code}_sell`];
                    const currencyInfo = CURRENCY_MAP[code];

                    if (typeof buyRate === 'number' && typeof sellRate === 'number' && buyRate >= 0 && sellRate >= 0) {
                        rates.push({
                            currency: { iso3: code, name: currencyInfo.name, unit: currencyInfo.unit },
                            buy: buyRate,
                            sell: sellRate,
                        });
                        hasValidData = true;
                    }
                });

                if (hasValidData) {
                    ratesDataPayload = {
                        date: result.date,
                        published_on: result.updated_at || result.date,
                        modified_on: result.updated_at || result.date,
                        rates: rates,
                    };
                } else {
                    console.log(`D1 row found for ${fromDate}, but no valid currency rates found.`);
                }
            } else {
                console.log(`No D1 record found for date ${fromDate}.`);
            }
            // Return RatesData object directly or null
            return new Response(JSON.stringify(ratesDataPayload), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } else {
            // --- NEW: Logic for ALL currencies, DATE RANGE (for ArchiveDetail) ---
            query = env.FOREX_DB.prepare(
                `SELECT * FROM forex_rates WHERE date >= ? AND date <= ? ORDER BY date ASC`
            ).bind(fromDate, toDate);

            const queryResult = await query.all<any>();

            if (!queryResult.success || !queryResult.results) {
                 console.error(`D1 Query Error fetching all rates for range ${fromDate}-${toDate}`);
                 throw new Error('Database query failed for date range');
            }
            
            const { results } = queryResult;
            
            // De-normalize the flat D1 rows back into the `RatesData[]` structure.
            const payloads: RatesData[] = results.map(row => {
                const rates: Rate[] = [];
                CURRENCIES.forEach(code => {
                    const buyRate = row[`${code}_buy`];
                    const sellRate = row[`${code}_sell`];
                    const currencyInfo = CURRENCY_MAP[code];

                    // Only include if data exists
                    if (typeof buyRate === 'number' && typeof sellRate === 'number') {
                         rates.push({
                            currency: { iso3: code, name: currencyInfo.name, unit: currencyInfo.unit },
                            buy: buyRate,
                            sell: sellRate
                        });
                    }
                });
                return {
                    date: row.date,
                    published_on: row.updated_at || row.date,
                    modified_on: row.updated_at || row.date,
                    rates: rates
                };
            }).filter(p => p.rates.length > 0); // Filter out days that might have been stored with no rates

            // Return in the { success: true, payload: ... } structure
            responsePayload = {
                success: true,
                payload: payloads
            };
             return new Response(JSON.stringify(responsePayload), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

    } catch (error: any) {
        console.error(`Database error in handleHistoricalRates (currency: ${currencyCode}, range: ${fromDate}-${toDate}):`, error.message, error.cause);
        const errorPayload = currencyCode ? { success: false, error: 'Database query failed', data: [] } : { success: false, error: 'Database query failed', payload: [] };
        return new Response(JSON.stringify(errorPayload), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}


// --- Admin Login ---
async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        const { username, password, ipAddress, sessionId } = await request.json();
        if (!username || !password || !ipAddress || !sessionId) {
             return new Response(JSON.stringify({ success: false, error: 'Missing credentials/identifiers' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const { results: attemptsResults } = await env.FOREX_DB.prepare(
            `SELECT COUNT(*) as count FROM login_attempts WHERE ip_address = ? AND session_id = ? AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`
        ).bind(ipAddress, sessionId).all<{ count: number }>();
        const failedAttempts = attemptsResults[0]?.count || 0;

        if (failedAttempts >= 7) {
            return new Response(JSON.stringify({ success: false, error: 'Too many failed attempts.' }), { status: 429, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const user = await env.FOREX_DB.prepare(
            `SELECT username, plaintext_password, password_hash FROM users WHERE username = ?`
        ).bind(username).first<{ username: string; plaintext_password: string | null; password_hash: string | null }>();

        let isValid = false;
        let mustChangePassword = false;

        if (user) {
            if (user.plaintext_password && user.password_hash) {
                if (password === user.plaintext_password || await simpleHashCompare(password, user.password_hash)) {
                    isValid = true;
                    mustChangePassword = true;
                }
            } else if (user.plaintext_password && !user.password_hash) {
                if (password === user.plaintext_password) {
                    isValid = true;
                    mustChangePassword = true;
                }
            } else if (!user.plaintext_password && user.password_hash) {
                isValid = await simpleHashCompare(password, user.password_hash);
                mustChangePassword = false;
            }
        }

        await env.FOREX_DB.prepare(
            `INSERT INTO login_attempts (ip_address, session_id, username, success) VALUES (?, ?, ?, ?)`
        ).bind(ipAddress, sessionId, username, isValid ? 1 : 0).run();

        if (!isValid) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const token = await generateToken(username);
        return new Response(JSON.stringify({
            success: true,
            token,
            username,
            mustChangePassword
        }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Login error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error during login' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Check Login Attempts ---
async function handleCheckAttempts(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ipAddress = url.searchParams.get('ip');
    const sessionId = url.searchParams.get('session');
    if (!ipAddress || !sessionId) {
        return new Response(JSON.stringify({ error: 'Missing IP or session' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        const result = await env.FOREX_DB.prepare(
            `SELECT COUNT(*) as count FROM login_attempts WHERE ip_address = ? AND session_id = ? AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`
        ).bind(ipAddress, sessionId).first<{ count: number }>();
        const attempts = result?.count || 0;
        return new Response(JSON.stringify({ attempts: attempts, remaining: Math.max(0, 7 - attempts) }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error("Check attempts error:", error.message, error.cause);
        return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Change Password ---
async function handleChangePassword(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        const { username, newPassword, keepSamePassword } = await request.json();
        if (!username) {
             return new Response(JSON.stringify({ success: false, error: 'Username is required.' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }
        if (!keepSamePassword && (!newPassword || newPassword.length < 8)) {
             return new Response(JSON.stringify({ success: false, error: 'New password must be >= 8 chars.' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const user = await env.FOREX_DB.prepare(
            `SELECT username, plaintext_password, password_hash FROM users WHERE username = ?`
        ).bind(username).first<{ username: string; plaintext_password: string | null; password_hash: string | null }>();
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        let newPasswordHash: string | null = null;
        if (keepSamePassword) {
            if (user.password_hash) {
                newPasswordHash = user.password_hash;
            } else if (user.plaintext_password) {
                newPasswordHash = await simpleHash(user.plaintext_password);
            } else {
                 return new Response(JSON.stringify({ success: false, error: 'Cannot keep password, no hash or plaintext found.' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            }
        } else {
            newPasswordHash = await simpleHash(newPassword);
        }

        await env.FOREX_DB.prepare(
            `UPDATE users SET password_hash = ?, plaintext_password = NULL, updated_at = datetime('now') WHERE username = ?`
        ).bind(newPasswordHash, username).run();
        
        // Also log recovery
        await env.FOREX_DB.prepare(`INSERT OR REPLACE INTO user_recovery (recovery_data, created_at) VALUES (?, datetime('now'))`).bind(username).run();


        return new Response(JSON.stringify({ success: true, message: "Password updated." }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error('Password change error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Admin Posts CRUD ---
async function handlePosts(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        if (request.method === 'GET') {
            const { results } = await env.FOREX_DB.prepare(`SELECT id, title, slug, status, published_at, created_at, updated_at FROM posts ORDER BY created_at DESC`).all();
            return new Response(JSON.stringify({ success: true, posts: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (request.method === 'POST') {
            const post = await request.json();
            const slug = post.slug || generateSlug(post.title);
            const nowISO = new Date().toISOString(); // Use ISO format
            const status = ['draft', 'published'].includes(post.status) ? post.status : 'draft';
            const published_at = status === 'published' ? (post.published_at || nowISO) : null;
            const { meta } = await env.FOREX_DB.prepare(
                `INSERT INTO posts (title, slug, excerpt, content, featured_image_url, author_name, author_url, status, published_at, meta_title, meta_description, meta_keywords, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
            ).bind(
                post.title || 'Untitled', slug, post.excerpt || null, post.content || '', post.featured_image_url || null,
                post.author_name || 'Grisma', post.author_url || 'https://grisma.com.np/about', status, published_at,
                post.meta_title || post.title || 'Untitled', post.meta_description || post.excerpt || null, post.meta_keywords || null
            ).run();
            return new Response(JSON.stringify({ success: true, id: meta?.lastRowId /* D1 v3+ */ || null }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handlePosts (${request.method}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

async function handlePostById(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    const postId = parseInt(id || '', 10);
    if (isNaN(postId)) {
        return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        if (request.method === 'GET') {
            const post = await env.FOREX_DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(postId).first();
            return post
                ? new Response(JSON.stringify({ success: true, post }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                : new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }
        if (request.method === 'PUT') {
            const post = await request.json();
            const slug = post.slug || generateSlug(post.title);
            const status = ['draft', 'published'].includes(post.status) ? post.status : 'draft';
            let published_at = post.published_at;
            if (status === 'published' && !published_at) published_at = new Date().toISOString();
            else if (status === 'draft') published_at = null;
            await env.FOREX_DB.prepare(
                `UPDATE posts SET title=?, slug=?, excerpt=?, content=?, featured_image_url=?, author_name=?, author_url=?, status=?, published_at=?, meta_title=?, meta_description=?, meta_keywords=?, updated_at=datetime('now') WHERE id=?`
            ).bind(
                post.title || 'Untitled', slug, post.excerpt || null, post.content || '', post.featured_image_url || null,
                post.author_name || 'Grisma', post.author_url || 'https://grisma.com.np/about', status, published_at,
                post.meta_title || post.title || 'Untitled', post.meta_description || post.excerpt || null, post.meta_keywords || null,
                postId
            ).run();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (request.method === 'DELETE') {
            await env.FOREX_DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(postId).run();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handlePostById (${request.method}, ID: ${postId}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Admin Forex Data ---
async function handleForexData(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const date = url.searchParams.get('date');
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (date) {
                if (!dateRegex.test(date)) return new Response(JSON.stringify({ error: 'Invalid date format' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
                const result = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(date).first();
                return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } else {
                const { results } = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates ORDER BY date DESC LIMIT 30`).all();
                return new Response(JSON.stringify({ success: true, data: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }
        if (request.method === 'POST') {
            const data = await request.json();
            const date = data.date;
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!date || !dateRegex.test(date)) return new Response(JSON.stringify({ success: false, error: 'Invalid date' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            const columns: string[] = ['date', 'updated_at'];
            const placeholders: string[] = ['?', "datetime('now')"];
            const values: (string | number | null)[] = [date];
            let validRatesFound = false;
            for (const currency of CURRENCIES) {
                const buyKey = `${currency}_buy`, sellKey = `${currency}_sell`;
                columns.push(`"${buyKey}"`, `"${sellKey}"`); // Quote column names
                placeholders.push('?', '?');
                const parsedBuy = (data[buyKey] === '' || data[buyKey] == null) ? null : parseFloat(data[buyKey]);
                const parsedSell = (data[sellKey] === '' || data[sellKey] == null) ? null : parseFloat(data[sellKey]);
                values.push(isNaN(parsedBuy) ? null : parsedBuy);
                values.push(isNaN(parsedSell) ? null : parsedSell);
                if (typeof parsedBuy === 'number' || typeof parsedSell === 'number') validRatesFound = true;
            }
            if (!validRatesFound && Object.keys(data).length <= 1) return new Response(JSON.stringify({ success: false, error: 'No rates provided' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            await env.FOREX_DB.prepare(query).bind(...values).run();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handleForexData (${request.method}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Admin Site Settings ---
async function handleSiteSettings(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        if (request.method === 'GET') {
            const result = await env.FOREX_DB.prepare(`SELECT setting_value FROM site_settings WHERE setting_key = ?`).bind('header_tags').first<{ setting_value: string | null }>();
            return new Response(JSON.stringify({ success: true, header_tags: result?.setting_value || '' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (request.method === 'POST') {
            const { header_tags } = await request.json();
            if (typeof header_tags !== 'string') return new Response(JSON.stringify({ success: false, error: 'Invalid format' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            await env.FOREX_DB.prepare(`INSERT OR REPLACE INTO site_settings (setting_key, setting_value, updated_at) VALUES (?, ?, datetime('now'))`).bind('header_tags', header_tags).run();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handleSiteSettings (${request.method}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Public Posts List ---
async function handlePublicPosts(request: Request, env: Env): Promise<Response> {
    try {
        const query = env.FOREX_DB.prepare(
            `SELECT id, title, slug, excerpt, featured_image_url, author_name, author_url, published_at
             FROM posts WHERE status = 'published' AND published_at IS NOT NULL ORDER BY published_at DESC`
        );
        const queryResult = await query.all();
        if (!queryResult.success) {
            console.error('D1 Error fetching public posts');
            throw new Error('Database query failed');
        }
        const { results } = queryResult;
        return new Response(JSON.stringify({ success: true, posts: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error: any) {
        console.error('Error fetching public posts:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error fetching posts.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Public Post Detail ---
async function handlePublicPostBySlug(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const slug = url.pathname.split('/').pop();
    if (!slug) {
        return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        const post = await env.FOREX_DB.prepare(
            `SELECT * FROM posts WHERE slug = ? AND status = 'published' AND published_at IS NOT NULL`
        ).bind(slug).first();
        if (!post) {
            return new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }
        return new Response(JSON.stringify({ success: true, post }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error: any) {
        console.error(`Error fetching post by slug (${slug}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Scheduled NRB Data Update ---
async function updateForexData(env: Env): Promise<void> {
    console.log("Starting scheduled forex data update...");
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7); // Fetch last 7 days to catch up
        const fromDateStr = formatDate(startDate);
        const toDateStr = formatDate(endDate);
        console.log(`Scheduled fetch: NRB data from ${fromDateStr} to ${toDateStr}`);
        const apiUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDateStr}&to=${toDateStr}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
            if (response.status === 404) {
                 console.log("Scheduled fetch: NRB 404."); return;
            }
            const errorText = await response.text();
            console.error(`Scheduled fetch: NRB API error: ${response.status} - ${errorText}`);
            throw new Error(`NRB API error: ${response.status}`);
        }
        const data = await response.json();
        if (data?.data?.payload?.length > 0) {
            const statements: D1PreparedStatement[] = [];
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            for (const dayData of data.data.payload) {
                const dateStr = dayData.date;
                if (!dateStr || !dateRegex.test(dateStr)) continue;
                const columns: string[] = ['date', 'updated_at'];
                const placeholders: string[] = ['?', "datetime('now')"];
                const values: (string | number | null)[] = [dateStr];
                let hasRatesForDate = false;
                for (const rate of dayData.rates) {
                    const currencyCode = rate?.currency?.iso3;
                    if (currencyCode && CURRENCIES.includes(currencyCode)) {
                        columns.push(`"${currencyCode}_buy"`, `"${currencyCode}_sell"`);
                        placeholders.push('?', '?');
                        const buyVal = parseFloat(rate.buy); const sellVal = parseFloat(rate.sell);
                        values.push(isNaN(buyVal) ? null : buyVal, isNaN(sellVal) ? null : sellVal);
                        hasRatesForDate = true;
                    }
                }
                if (hasRatesForDate) {
                    const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
                    statements.push(env.FOREX_DB.prepare(query).bind(...values));
                }
            }
            if (statements.length > 0) {
                console.log(`Scheduled fetch: Batching ${statements.length} D1 statements.`);
                const results = await env.FOREX_DB.batch(statements);
                const successfulUpdates = results.filter(r => r.success).length;
                console.log(`Scheduled fetch: Success ${successfulUpdates}/${statements.length} records.`);
                if (successfulUpdates < statements.length) console.error("Scheduled fetch: Some batch ops failed.");
            } else console.log("Scheduled fetch: No valid statements generated.");
        } else console.log("Scheduled fetch: No payload data from NRB.");
    } catch (error: any) {
        console.error('FATAL Error during scheduled update:', error.message, error.cause);
    }
}
