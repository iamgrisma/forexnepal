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
            // *** UPDATED TO FIX 230K READ PROBLEM (TABS) ***
            return handleHistoricalRates(request, env); 
        }
        if (pathname === '/api/historical-stats') {
            // *** UPDATED TO FIX 230K READ PROBLEM (STATS) ***
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

// --- *** DATA INGESTION LOGIC (Unchanged) *** ---
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
        if (!dateStr || !dateRegex.test(dateStr)) continue;

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

                wideColumns.push(`"${currencyCode}_buy"`, `"${currencyCode}_sell"`);
                widePlaceholders.push('?', '?');
                wideValues.push(buyRate, sellRate);
                
                if (buyRate !== null || sellRate !== null) {
                    hasRatesForDate = true;
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
        await env.FOREX_DB.batch(statements);
        console.log(`D1 Batch finished. ${processedDates} dates processed.`);
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

        if (!response.ok) throw new Error(`NRB API error: ${response.status}`);
        
        const data = await response.json();
        await processAndStoreApiData(data, env);
        
    } catch (error: any) {
        console.error('FATAL Error during scheduled update:', error.message, error.cause);
    }
}


// --- API Handlers (Updated) ---

async function handleCheckData(request: Request, env: Env): Promise<Response> {
    // This queries the 'long' table, which is fast with the (code, date) index.
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!fromDate || !toDate || !dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
        return new Response(JSON.stringify({ error: 'Invalid date parameters' }), { status: 400, headers: corsHeaders });
    }

    try {
        // We only need to check for one currency to see if data exists
        const { results } = await env.FOREX_DB.prepare(
            `SELECT DISTINCT date FROM forex_rates_historical WHERE currency_code = 'USD' AND date >= ? AND date <= ? ORDER BY date ASC`
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
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}

async function handleFetchAndStore(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
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
        const processedDates = await processAndStoreApiData(data, env);

        return new Response(JSON.stringify({ success: true, stored: processedDates, fromDate, toDate }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch and store data' }), { status: 500, headers: corsHeaders });
    }
}

// --- *** FIX FOR 529K READ PROBLEM *** ---
// This endpoint now handles both chart and tab data by querying the
// fast, indexed 'forex_rates_historical' table.
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
        if (currencyCode) {
            // --- 1. Query for a SINGLE CURRENCY (for Charts) ---
            // This query is now FAST because of the index:
            // (currency_code, date) from migration 006
            const upperCaseCurrencyCode = currencyCode.toUpperCase();
            if (!CURRENCIES.includes(upperCaseCurrencyCode)) {
                return new Response(JSON.stringify({ success: false, error: 'Invalid currency' }), { status: 400, headers: corsHeaders });
            }

            let samplingClause = "";
            const bindings = [upperCaseCurrencyCode, fromDate, toDate];

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

            const sql = `
                SELECT date, buy_rate, sell_rate
                FROM forex_rates_historical
                WHERE currency_code = ? AND date >= ? AND date <= ?
                ${samplingClause}
                ORDER BY date ASC
            `;
            
            const { results } = await env.FOREX_DB.prepare(sql).bind(...bindings).all();
            
            const chartData = results.map((item: any) => ({
                date: item.date,
                buy: item.buy_rate, 
                sell: item.sell_rate
            }));

            return new Response(JSON.stringify({ success: true, data: chartData, currency: currencyCode }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else if (fromDate === toDate) {
            // --- 2. Query for a SINGLE DAY (for Converter/Homepage) ---
            // This still uses the WIDE table, which is fast for this. (1 read)
            const result = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ? LIMIT 1`).bind(fromDate).first<any>();
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
             // --- 3. Query for a date range, ALL currencies (for ArchiveDetail tabs) ---
             // *** THIS IS THE FIX for the ~230K "Tabs" problem ***
             // We now query the FAST 'forex_rates_historical' table.
            
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

            // This query is now FAST because of the (currency_code, date) index.
            const sql = `
                SELECT date, currency_code, buy_rate, sell_rate 
                FROM forex_rates_historical 
                WHERE date >= ? AND date <= ? 
                ${samplingClause} 
                ORDER BY date ASC
            `;
            
            const { results } = await env.FOREX_DB.prepare(sql).bind(...bindings).all<any>();
            
            // Re-structure the "long" data back into the "wide" RatesData format
            const dateMap = new Map<string, RatesData>();
            for (const row of results) {
                const { date, currency_code, buy_rate, sell_rate } = row;
                if (!CURRENCIES.includes(currency_code)) continue;

                if (!dateMap.has(date)) {
                    dateMap.set(date, {
                        date: date,
                        published_on: date,
                        modified_on: date,
                        rates: []
                    });
                }
                
                const currencyInfo = CURRENCY_MAP[currency_code];
                const unit = currencyInfo.unit || 1;
                
                dateMap.get(date)!.rates.push({
                    currency: { ...currencyInfo, iso3: currency_code },
                    buy: buy_rate * unit, // Convert back from per-unit
                    sell: sell_rate * unit // Convert back from per-unit
                });
            }
            
            const payloads = Array.from(dateMap.values());
            return new Response(JSON.stringify({ success: true, payload: payloads }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}

// --- *** FIX FOR 529K READ PROBLEM *** ---
// This endpoint now uses two-step queries to be hyper-efficient
// and use the indexes from migration 005.
async function handleHistoricalStats(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    }

    try {
        const { dateRange, currencies } = (await request.json()) as { dateRange: { from: string; to: string }; currencies: string[] };
        const { from: fromDate, to: toDate } = dateRange;
        if (!fromDate || !toDate || !Array.isArray(currencies)) {
             return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: corsHeaders });
        }

        const validCurrencies = currencies.filter(c => CURRENCIES.includes(c.toUpperCase()));
        if (validCurrencies.length === 0) {
            return new Response(JSON.stringify({ error: 'No valid currencies' }), { status: 400, headers: corsHeaders });
        }

        const stats: { [key: string]: any } = {};
        const queries: D1PreparedStatement[] = [];

        // This is the new, fast, two-step query process.
        // It uses the indexes from migration 005.
        for (const code of validCurrencies) {
            // 1. Get MIN/MAX aggregate. This uses the (code, date) index from migration 006
            // combined with the rate columns, which is very fast.
            queries.push(env.FOREX_DB.prepare(
                `SELECT 
                    MAX(CASE WHEN buy_rate IS NOT NULL THEN buy_rate ELSE NULL END) as highBuy,
                    MIN(CASE WHEN buy_rate > 0 THEN buy_rate ELSE NULL END) as lowBuy,
                    MAX(CASE WHEN sell_rate IS NOT NULL THEN sell_rate ELSE NULL END) as highSell,
                    MIN(CASE WHEN sell_rate > 0 THEN sell_rate ELSE NULL END) as lowSell
                FROM forex_rates_historical 
                WHERE currency_code = ? AND date >= ? AND date <= ?`
            ).bind(code, fromDate, toDate));
        }
        
        // Run the batch to get all MIN/MAX values
        const minMaxResults = await env.FOREX_DB.batch(queries);

        const dateQueries: D1PreparedStatement[] = [];
        const statOrder: { code: string, type: 'highBuy' | 'lowBuy' | 'highSell' | 'lowSell', rate: number }[] = [];

        // 2. Build a second batch to find the *dates* for those MIN/MAX values.
        // This uses the (code, buy_rate) and (code, sell_rate) indexes from migration 005.
        minMaxResults.forEach((result, index) => {
            const code = validCurrencies[index];
            const rates = result.results[0] as any;
            stats[code] = {}; // Initialize

            if (rates && rates.highBuy !== null) {
                statOrder.push({ code, type: 'highBuy', rate: rates.highBuy });
                dateQueries.push(env.FOREX_DB.prepare(
                    `SELECT date FROM forex_rates_historical WHERE currency_code = ? AND buy_rate = ? ORDER BY date ASC LIMIT 1`
                ).bind(code, rates.highBuy));
            }
            if (rates && rates.lowBuy !== null) {
                statOrder.push({ code, type: 'lowBuy', rate: rates.lowBuy });
                dateQueries.push(env.FOREX_DB.prepare(
                    `SELECT date FROM forex_rates_historical WHERE currency_code = ? AND buy_rate = ? ORDER BY date ASC LIMIT 1`
                ).bind(code, rates.lowBuy));
            }
            if (rates && rates.highSell !== null) {
                statOrder.push({ code, type: 'highSell', rate: rates.highSell });
                dateQueries.push(env.FOREX_DB.prepare(
                    `SELECT date FROM forex_rates_historical WHERE currency_code = ? AND sell_rate = ? ORDER BY date ASC LIMIT 1`
                ).bind(code, rates.highSell));
            }
            if (rates && rates.lowSell !== null) {
                statOrder.push({ code, type: 'lowSell', rate: rates.lowSell });
                dateQueries.push(env.FOREX_DB.prepare(
                    `SELECT date FROM forex_rates_historical WHERE currency_code = ? AND sell_rate = ? ORDER BY date ASC LIMIT 1`
                ).bind(code, rates.lowSell));
            }
        });

        // 3. Run the second batch to get the dates
        let dateResults: D1Result<any>[] = [];
        if (dateQueries.length > 0) {
            dateResults = await env.FOREX_DB.batch(dateQueries);
        }

        // 4. Combine all the results
        dateResults.forEach((result, index) => {
            const { code, type, rate } = statOrder[index];
            const date = result.results[0]?.date || null;
            stats[code][type] = { date, rate };
        });

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
            if (date) {
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
            const wideQuery = `INSERT OR REPLACE INTO forex_rates (${wideColumns.join(', ')}) VALUES (${widePlaceholders.join(', ')})`;
            longStatements.push(env.FOREX_DB.prepare(wideQuery).bind(...wideValues));
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
        const { results } = await query.all();
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
