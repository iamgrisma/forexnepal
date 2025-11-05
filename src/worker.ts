// src/worker.ts
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import type { Rate, RatesData } from './types/forex';

// --- SITEMAP IMPORTS ---
import {
    generateSitemapIndex,
    generatePageSitemap,
    generatePostSitemap,
    generateArchiveSitemap,
    getArchiveSitemapCount
} from './sitemapGenerator';

// --- D1 & KV Interfaces ---
interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
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

export interface Env {
    FOREX_DB: D1Database;
    __STATIC_CONTENT: KVNamespace;
}

// --- CURRENCIES List ---
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


// --- JWT Secret ---
const JWT_SECRET = 'forexnepal-jwt-secret-key-2025'; 

// --- Default Export (Router) ---
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return handleOptions(request);
        }

        const pathname = url.pathname;

        // --- API ROUTING ---
        if (pathname === '/api/check-data') {
            return handleCheckData(request, env);
        }
        if (pathname === '/api/fetch-and-store') {
            return handleFetchAndStore(request, env);
        }
        if (pathname === '/api/historical-rates') {
            // UPDATED: Now queries the new 'forex_rates_historical' table
            return handleHistoricalRates(request, env); 
        }
        if (pathname === '/api/historical-stats') {
            // UPDATED: Now queries the new 'forex_rates_historical' table
            return handleHistoricalStats(request, env);
        }
        
        // --- ADMIN & POSTS (Unchanged) ---
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

        // --- SITEMAP ROUTING ---
        const sitemapHeaders = {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=3600",
        };
        if (pathname === '/sitemap.xml') {
          const archiveSitemapCount = getArchiveSitemapCount();
          const xml = generateSitemapIndex(archiveSitemapCount);
          return new Response(xml, { headers: sitemapHeaders });
        }
        if (pathname === '/page-sitemap.xml') {
          const xml = generatePageSitemap();
          return new Response(xml, { headers: sitemapHeaders });
        }
        if (pathname === '/post-sitemap.xml') {
          const xml = await generatePostSitemap(env.FOREX_DB);
          return new Response(xml, { headers: sitemapHeaders });
        }
        const archiveMatch = pathname.match(/\/archive-sitemap(\d+)\.xml$/);
        if (archiveMatch && archiveMatch[1]) {
          const id = parseInt(archiveMatch[1]);
          const xml = generateArchiveSitemap(id);
          if (!xml) {
            return new Response('Sitemap not found', { status: 404 });
          }
          return new Response(xml, { headers: sitemapHeaders });
        }
        
        // --- Static Asset Serving (SPA Fallback) ---
        try {
            return await getAssetFromKV(
                { request, waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise) },
                { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: {} }
            );
        } catch (e: any) {
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
                 return new Response('Internal Server Error', { status: 500 });
            }
        }
    },

    // --- Scheduled Task ---
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`[cron ${event.cron}] Triggered...`);
        // UPDATED: This function now populates both tables
        ctx.waitUntil(updateForexData(env));
    }
};

// --- CORS ---
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', 
};
function handleOptions(request: Request) {
    return new Response(null, { headers: corsHeaders });
}

// --- Helpers ---
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- *** NEW DATA INGESTION LOGIC *** ---
// This function now populates BOTH the wide and long tables in a single batch.
async function processAndStoreApiData(data: any, env: Env): Promise<number> {
    if (!data?.data?.payload || data.data.payload.length === 0) {
        console.log(`No payload data from NRB.`);
        return 0;
    }

    const statements: D1PreparedStatement[] = [];
    let processedDates = 0;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (const dayData of data.data.payload) {
        const dateStr = dayData.date;
        if (!dateStr || !dateRegex.test(dateStr)) {
            console.warn(`Skipping invalid date format from NRB API: ${dateStr}`);
            continue;
        }

        // --- 1. Prepare "WIDE" table insert (for daily page) ---
        const wideColumns: string[] = ['date', 'updated_at'];
        const widePlaceholders: string[] = ['?', "datetime('now')"];
        const wideValues: (string | number | null)[] = [dateStr];
        let hasRatesForDate = false;
        
        for (const rate of dayData.rates) {
            const currencyCode = rate?.currency?.iso3;
            if (currencyCode && CURRENCIES.includes(currencyCode)) {
                const buyVal = parseFloat(rate.buy);
                const sellVal = parseFloat(rate.sell);
                const buyRate = isNaN(buyVal) ? null : buyVal;
                const sellRate = isNaN(sellVal) ? null : sellVal;

                // Add to WIDE insert
                wideColumns.push(`"${currencyCode}_buy"`, `"${currencyCode}_sell"`);
                widePlaceholders.push('?', '?');
                wideValues.push(buyRate, sellRate);
                
                if (buyRate !== null || sellRate !== null) {
                    hasRatesForDate = true;

                    // --- 2. Prepare "LONG" table insert (for stats) ---
                    const currencyInfo = CURRENCY_MAP[currencyCode];
                    const unit = currencyInfo.unit || 1;
                    const perUnitBuy = buyRate !== null ? buyRate / unit : null;
                    const perUnitSell = sellRate !== null ? sellRate / unit : null;
                    
                    if (perUnitBuy !== null || perUnitSell !== null) {
                        statements.push(
                            env.FOREX_DB.prepare(
                                `INSERT OR REPLACE INTO forex_rates_historical (date, currency_code, buy_rate, sell_rate) VALUES (?, ?, ?, ?)`
                            ).bind(dateStr, currencyCode, perUnitBuy, perUnitSell)
                        );
                    }
                }
            }
        }

        if (hasRatesForDate) {
            const wideQuery = `INSERT OR REPLACE INTO forex_rates (${wideColumns.join(', ')}) VALUES (${widePlaceholders.join(', ')})`;
            statements.push(env.FOREX_DB.prepare(wideQuery).bind(...wideValues));
            processedDates++;
        }
    }

    if (statements.length > 0) {
        console.log(`Batching ${statements.length} statements for D1 (wide + long tables).`);
        try {
            await env.FOREX_DB.batch(statements);
            console.log(`D1 Batch finished. ${processedDates} dates processed.`);
        } catch (batchError: any) {
            console.error(`D1 Batch Error:`, batchError.message, batchError.cause);
            throw batchError; 
        }
    } else {
        console.log(`No valid statements generated.`);
    }
    
    return processedDates;
}

// --- Cron Job ---
async function updateForexData(env: Env): Promise<void> {
    console.log("Starting scheduled forex data update...");
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7); 
        const fromDateStr = formatDate(startDate);
        const toDateStr = formatDate(endDate);
        
        const apiUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDateStr}&to=${toDateStr}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            if (response.status === 404) {
                 console.log("Scheduled fetch: NRB 404."); return;
            }
            throw new Error(`NRB API error: ${response.status}`);
        }
        
        const data = await response.json();
        await processAndStoreApiData(data, env);
        
    } catch (error: any) {
        console.error('FATAL Error during scheduled update:', error.message, error.cause);
    }
}


// --- API Handlers (Updated) ---

async function handleCheckData(request: Request, env: Env): Promise<Response> {
    // This function now queries the new, faster table
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!fromDate || !toDate || !dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
        return new Response(JSON.stringify({ error: 'Invalid date parameters' }), { status: 400, headers: corsHeaders });
    }

    try {
        const { results } = await env.FOREX_DB.prepare(
            `SELECT DISTINCT date FROM forex_rates_historical WHERE date >= ? AND date <= ? ORDER BY date ASC`
        ).bind(fromDate, toDate).all<{ date: string }>();

        const existingDates = new Set(results.map(r => r.date));
        const start = new Date(fromDate + 'T00:00:00Z');
        const end = new Date(toDate + 'T00:00:00Z');
        const expectedDates: string[] = [];
        let expectedCount = 0;

        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
            expectedDates.push(formatDate(d));
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
        return new Response(JSON.stringify({ error: 'Database query failed', details: error.message, exists: false }), { status: 500, headers: corsHeaders });
    }
}

async function handleFetchAndStore(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    // ... (validation as before) ...
    if (!fromDate || !toDate) {
         return new Response(JSON.stringify({ error: 'Missing date parameters' }), { status: 400, headers: corsHeaders });
    }

    try {
        const apiUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDate}&to=${toDate}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            if (response.status === 404) {
                 return new Response(JSON.stringify({ success: true, stored: 0, message: 'No data available from NRB.' }), { headers: corsHeaders });
            }
            throw new Error(`NRB API error: ${response.status}`);
        }

        const data = await response.json();
        const processedDates = await processAndStoreApiData(data, env); // Use the new function

        return new Response(JSON.stringify({ success: true, stored: processedDates, fromDate, toDate }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch and store data', details: error.message }), { status: 500, headers: corsHeaders });
    }
}

// --- *** OPTIMIZED: handleHistoricalRates (for Charts) *** ---
// This now queries the fast "long" table.
async function handleHistoricalRates(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const currencyCode = url.searchParams.get('currency'); 
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const sampling = url.searchParams.get('sampling') || 'daily';
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!fromDate || !toDate || !dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
        return new Response(JSON.stringify({ error: 'Invalid date parameters' }), { status: 400, headers: corsHeaders });
    }

    try {
        let query: D1PreparedStatement;
        let responsePayload: any;

        if (currencyCode) {
            // --- Query for a single currency (for charts) ---
            const upperCaseCurrencyCode = currencyCode.toUpperCase();
            if (!CURRENCIES.includes(upperCaseCurrencyCode)) {
                return new Response(JSON.stringify({ success: false, error: 'Invalid currency' }), { status: 400, headers: corsHeaders });
            }

            let samplingClause = "";
            const bindings = [upperCaseCurrencyCode, fromDate, toDate];

            if (sampling !== 'daily') {
                switch (sampling) {
                    case 'weekly': samplingClause = "AND (STRFTIME('%w', date) = '0')"; break; // Sunday
                    case '15day': 
                        samplingClause = "AND ((JULIANDAY(date) - JULIANDAY(?)) % 15 = 0)";
                        bindings.push(fromDate);
                        break;
                    case 'monthly': samplingClause = "AND (STRFTIME('%d', date) = '01')"; break;
                }
                // Always include the start and end dates for accurate chart axis
                samplingClause += " OR date = ? OR date = ?";
                bindings.push(fromDate, toDate);
            }

            const sql = `
                SELECT date, buy_rate, sell_rate
                FROM forex_rates_historical
                WHERE currency_code = ? AND date >= ? AND date <= ?
                ${samplingClause}
                ORDER BY date ASC
            `;
            
            query = env.FOREX_DB.prepare(sql).bind(...bindings);
            const { results } = await query.all();
            
            const chartData = results.map((item: any) => ({
                date: item.date,
                buy: item.buy_rate, 
                sell: item.sell_rate
            }));

            responsePayload = { success: true, data: chartData, currency: currencyCode };
            return new Response(JSON.stringify(responsePayload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else if (fromDate === toDate) {
            // --- Query for a single day (for Converter/Homepage) ---
            // This still uses the WIDE table, which is optimized for this exact query.
            query = env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ? LIMIT 1`).bind(fromDate);
            const result = await query.first<any>();
            let ratesDataPayload: RatesData | null = null;

            if (result) {
                const rates: Rate[] = [];
                CURRENCIES.forEach(code => {
                    const buyRate = result[`${code}_buy`];
                    const sellRate = result[`${code}_sell`];
                    if (typeof buyRate === 'number' && typeof sellRate === 'number') {
                        rates.push({
                            currency: { ...CURRENCY_MAP[code], iso3: code },
                            buy: buyRate, sell: sellRate,
                        });
                    }
                });
                if (rates.length > 0) {
                    ratesDataPayload = {
                        date: result.date,
                        published_on: result.updated_at || result.date,
                        modified_on: result.updated_at || result.date,
                        rates: rates,
                    };
                }
            }
            return new Response(JSON.stringify(ratesDataPayload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        
        } else {
             // --- Query for a date range, ALL currencies (for ArchiveDetail tabs) ---
             // This also uses the WIDE table, as sampling makes this query small enough.
            let samplingClause = "";
            const bindings = [fromDate, toDate];
            if (sampling !== 'daily') {
                switch (sampling) {
                    case 'weekly': samplingClause = "AND (STRFTIME('%w', date) = '0')"; break;
                    case '15day': 
                        samplingClause = "AND ((JULIANDAY(date) - JULIANDAY(?)) % 15 = 0)";
                        bindings.push(fromDate);
                        break;
                    case 'monthly': samplingClause = "AND (STRFTIME('%d', date) = '01')"; break;
                }
                samplingClause += " OR date = ? OR date = ?";
                bindings.push(fromDate, toDate);
            }

            const sql = `SELECT * FROM forex_rates WHERE date >= ? AND date <= ? ${samplingClause} ORDER BY date ASC`;
            query = env.FOREX_DB.prepare(sql).bind(...bindings);
            
            const { results } = await query.all<any>();
            const payloads: RatesData[] = results.map(row => {
                const rates: Rate[] = [];
                CURRENCIES.forEach(code => {
                    const buyRate = row[`${code}_buy`];
                    const sellRate = row[`${code}_sell`];
                    if (typeof buyRate === 'number' && typeof sellRate === 'number') {
                         rates.push({
                            currency: { ...CURRENCY_MAP[code], iso3: code },
                            buy: buyRate, sell: sellRate
                        });
                    }
                });
                return {
                    date: row.date,
                    published_on: row.updated_at || row.date,
                    modified_on: row.updated_at || row.date,
                    rates: rates
                };
            }).filter(p => p.rates.length > 0); 

            responsePayload = { success: true, payload: payloads };
            return new Response(JSON.stringify(responsePayload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}

// --- *** OPTIMIZED: handleHistoricalStats (The 8M Read Fix) *** ---
// This now queries the new 'forex_rates_historical' table with indexes.
async function handleHistoricalStats(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    }

    try {
        const { dateRange, currencies } = (await request.json()) as { dateRange: { from: string; to: string }; currencies: string[] };
        const { from: fromDate, to: toDate } = dateRange;
        // ... (validation as before) ...
        if (!fromDate || !toDate || !Array.isArray(currencies)) {
             return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: corsHeaders });
        }

        const validCurrencies = currencies.filter(c => CURRENCIES.includes(c.toUpperCase()));
        if (validCurrencies.length === 0) {
            return new Response(JSON.stringify({ error: 'No valid currencies' }), { status: 400, headers: corsHeaders });
        }

        const stats: { [key: string]: any } = {};
        const queries: D1PreparedStatement[] = [];

        validCurrencies.forEach(code => {
            // These queries now hit the new table and its indexes.
            // This is EXTREMELY fast.
            
            // 1. High Buy
            queries.push(env.FOREX_DB.prepare(
                `SELECT date, buy_rate as rate FROM forex_rates_historical WHERE currency_code = ? AND date >= ? AND date <= ? AND buy_rate IS NOT NULL ORDER BY buy_rate DESC, date ASC LIMIT 1`
            ).bind(code, fromDate, toDate));
            // 2. Low Buy
            queries.push(env.FOREX_DB.prepare(
                `SELECT date, buy_rate as rate FROM forex_rates_historical WHERE currency_code = ? AND date >= ? AND date <= ? AND buy_rate > 0 ORDER BY buy_rate ASC, date ASC LIMIT 1`
            ).bind(code, fromDate, toDate));
            // 3. High Sell
            queries.push(env.FOREX_DB.prepare(
                `SELECT date, sell_rate as rate FROM forex_rates_historical WHERE currency_code = ? AND date >= ? AND date <= ? AND sell_rate IS NOT NULL ORDER BY sell_rate DESC, date ASC LIMIT 1`
            ).bind(code, fromDate, toDate));
            // 4. Low Sell
            queries.push(env.FOREX_DB.prepare(
                `SELECT date, sell_rate as rate FROM forex_rates_historical WHERE currency_code = ? AND date >= ? AND date <= ? AND sell_rate > 0 ORDER BY sell_rate ASC, date ASC LIMIT 1`
            ).bind(code, fromDate, toDate));
        });

        const results = await env.FOREX_DB.batch(queries);

        let i = 0;
        for (const code of validCurrencies) {
            stats[code] = {
                highBuy:  results[i++]?.results?.[0] || null,
                lowBuy:   results[i++]?.results?.[0] || null,
                highSell: results[i++]?.results?.[0] || null,
                lowSell:  results[i++]?.results?.[0] || null,
            };
        }

        return new Response(JSON.stringify({ success: true, stats }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('Error in handleHistoricalStats:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}
// --- END OF OPTIMIZATION ---


// --- Admin / Posts Handlers (Unchanged) ---

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
        
        await env.FOREX_DB.prepare(`INSERT OR REPLACE INTO user_recovery (recovery_data, created_at) VALUES (?, datetime('now'))`).bind(username).run();


        return new Response(JSON.stringify({ success: true, message: "Password updated." }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error('Password change error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

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
            const nowISO = new Date().toISOString(); 
            const status = ['draft', 'published'].includes(post.status) ? post.status : 'draft';
            const published_at = status === 'published' ? (post.published_at || nowISO) : null;
            const { meta } = await env.FOREX_DB.prepare(
                `INSERT INTO posts (title, slug, excerpt, content, featured_image_url, author_name, author_url, status, published_at, meta_title, meta_description, meta_keywords, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
            ).bind(
                post.title || 'Untitled', slug, post.excerpt || null, post.content || '', post.featured_image_url || null,
                post.author_name || 'Grisma', post.author_url || 'https://grisma.com.np/about', status, published_at,
                post.meta_title || post.title || 'Untitled', post.meta_description || post.excerpt || null, post.meta_keywords || null
            ).run();
            return new Response(JSON.stringify({ success: true, id: meta?.lastRowId || null }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
            // Also delete from historical table
            await env.FOREX_DB.prepare(`DELETE FROM forex_rates_historical WHERE currency_code IN (SELECT slug FROM posts WHERE id = ?)`).bind(postId).run();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handlePostById (${request.method}, ID: ${postId}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

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
            // This is a manual admin update. We must update BOTH tables.
            const data = await request.json();
            const date = data.date;
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!date || !dateRegex.test(date)) return new Response(JSON.stringify({ success: false, error: 'Invalid date' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            
            const wideColumns: string[] = ['date', 'updated_at'];
            const widePlaceholders: string[] = ['?', "datetime('now')"];
            const wideValues: (string | number | null)[] = [date];
            
            const longStatements: D1PreparedStatement[] = [];
            let validRatesFound = false;

            for (const currency of CURRENCIES) {
                const buyKey = `${currency}_buy`, sellKey = `${currency}_sell`;
                const parsedBuy = (data[buyKey] === '' || data[buyKey] == null) ? null : parseFloat(data[buyKey]);
                const parsedSell = (data[sellKey] === '' || data[sellKey] == null) ? null : parseFloat(data[sellKey]);
                
                wideColumns.push(`"${buyKey}"`, `"${sellKey}"`); 
                widePlaceholders.push('?', '?');
                wideValues.push(parsedBuy, parsedSell);

                if (parsedBuy !== null || parsedSell !== null) {
                    validRatesFound = true;
                    const unit = CURRENCY_MAP[currency].unit || 1;
                    const perUnitBuy = parsedBuy !== null ? parsedBuy / unit : null;
                    const perUnitSell = parsedSell !== null ? parsedSell / unit : null;
                    
                    longStatements.push(
                        env.FOREX_DB.prepare(
                            `INSERT OR REPLACE INTO forex_rates_historical (date, currency_code, buy_rate, sell_rate) VALUES (?, ?, ?, ?)`
                        ).bind(date, currency, perUnitBuy, perUnitSell)
                    );
                }
            }

            if (!validRatesFound) return new Response(JSON.stringify({ success: false, error: 'No rates provided' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });

            // Add the wide query statement
            const wideQuery = `INSERT OR REPLACE INTO forex_rates (${wideColumns.join(', ')}) VALUES (${widePlaceholders.join(', ')})`;
            longStatements.push(env.FOREX_DB.prepare(wideQuery).bind(...wideValues));

            // Run batch
            await env.FOREX_DB.batch(longStatements);
            
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handleForexData (${request.method}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

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

// --- Auth Helpers (Unchanged) ---
async function simpleHash(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + JWT_SECRET); 
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
