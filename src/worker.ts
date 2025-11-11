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

// --- UPDATED ENV INTERFACE ---
export interface Env {
    FOREX_DB: D1Database;
    __STATIC_CONTENT: KVNamespace;
    
    // Secrets
    BREVO_API_KEY: string; 
    JWT_SECRET: string; // <-- MOVED SECRET HERE
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
// const JWT_SECRET = 'forexnepal-jwt-secret-key-2025'; // <-- DELETED! Now read from env.

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

// --- Type for Settings ---
interface SiteSettings {
    ticker_enabled: boolean;
    adsense_enabled: boolean;
    adsense_exclusions: string;
}

// Helper to safely get settings
async function getAllSettings(db: D1Database): Promise<SiteSettings> {
    const { results } = await db.prepare("SELECT key, value FROM site_settings").all();
    
    const settings: any = {
        ticker_enabled: true,
        adsense_enabled: false,
        adsense_exclusions: '/admin,/login'
    };

    if (results) {
        results.forEach((row: any) => {
            if (row.key === 'ticker_enabled' || row.key === 'adsense_enabled') {
                settings[row.key] = row.value === 'true';
            }
            if (row.key === 'adsense_exclusions') {
                settings[row.key] = row.value;
            }
        });
    }
    return settings;
}

// --- DATA INGESTION LOGIC ---
async function processAndStoreApiData(data: any, env: Env, action: 'update' | 'replace'): Promise<number> {
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
                }
            }
        }

        if (hasRatesForDate) {
            let query: string;
            if (action === 'replace') {
                query = `INSERT OR REPLACE INTO forex_rates (${wideColumns.join(', ')}) VALUES (${widePlaceholders.join(', ')})`;
            
            } else {
                const updateSetters: string[] = [];
                CURRENCIES.forEach(code => {
                    const buyCol = `"${code}_buy"`;
                    const sellCol = `"${code}_sell"`;
                    updateSetters.push(`${buyCol} = COALESCE(forex_rates.${buyCol}, excluded.${buyCol})`);
                    updateSetters.push(`${sellCol} = COALESCE(forex_rates.${sellCol}, excluded.${sellCol})`);
                });
                updateSetters.push("updated_at = datetime('now')");

                query = `
                    INSERT INTO forex_rates (${wideColumns.join(', ')}) 
                    VALUES (${widePlaceholders.join(', ')}) 
                    ON CONFLICT(date) DO UPDATE SET
                    ${updateSetters.join(', \n')}`;
            }

            statements.push(env.FOREX_DB.prepare(query).bind(...wideValues));
            processedDates++;
        }
    }

    if (statements.length > 0) {
        await env.FOREX_DB.batch(statements);
        console.log(`D1 Batch finished. ${processedDates} dates processed (action: ${action}).`);
    }

    return processedDates;
}

async function copyPreviousDayData(prevDayRow: any, todayDateStr: string, env: Env): Promise<void> {
    if (!prevDayRow) {
        console.error(`Cannot copy data for ${todayDateStr}: Previous day's data is null.`);
        return;
    }

    const columns: string[] = [];
    const values: (string | number | null)[] = [];
    
    CURRENCIES.forEach(code => {
        const buyCol = `"${code}_buy"`;
        const sellCol = `"${code}_sell"`;
        columns.push(buyCol, sellCol);
        values.push(prevDayRow[`${code}_buy`] ?? null, prevDayRow[`${code}_sell`] ?? null);
    });

    const placeholders = columns.map(() => '?').join(',');

    const query = `
        INSERT OR REPLACE INTO forex_rates (date, updated_at, ${columns.join(',')}) 
        VALUES (?, datetime('now'), ${placeholders})
    `;
    
    await env.FOREX_DB.prepare(query).bind(todayDateStr, ...values).run();
    console.log(`Successfully copied previous day's data to ${todayDateStr}.`);
}


async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
    console.log(`[cron ${event.cron}] Triggered at ${new Date().toISOString()}`);
    
    const nowUtc = new Date();
    const nptOffsetMs = (5 * 60 + 45) * 60 * 1000;
    const nowNpt = new Date(nowUtc.getTime() + nptOffsetMs);
    const todayNptStr = formatDate(nowNpt);

    try {
        const existingData = await env.FOREX_DB.prepare(
            `SELECT date FROM forex_rates WHERE date = ?`
        ).bind(todayNptStr).first();
        
        if (existingData) {
            console.log(`[cron ${event.cron}] Data for ${todayNptStr} already exists. Skipping.`);
            return;
        }

        console.log(`[cron ${event.cron}] No data for ${todayNptStr}. Fetching from NRB...`);
        const apiUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=1&from=${todayNptStr}&to=${todayNptStr}`;
        const response = await fetch(apiUrl);

        if (response.ok) {
            const data = await response.json();
            const processedDates = await processAndStoreApiData(data, env, 'replace');
            console.log(`[cron ${event.cron}] Successfully stored ${processedDates} record(s) for ${todayNptStr}.`);
            return;
        }

        if (response.status === 404) {
            console.log(`[cron ${event.cron}] NRB data not published yet (404).`);
            
            const isFinalAttempt = event.cron === "15 23 * * *"; // 23:15 UTC = 5:00 AM NPT
            
            if (isFinalAttempt) {
                console.log(`[cron ${event.cron}] Final attempt. Copying previous day's data...`);
                const yesterdayNpt = new Date(nowNpt);
                yesterdayNpt.setDate(yesterdayNpt.getDate() - 1);
                const yesterdayNptStr = formatDate(yesterdayNpt);

                const prevDayRow = await env.FOREX_DB.prepare(
                    `SELECT * FROM forex_rates WHERE date = ?`
                ).bind(yesterdayNptStr).first();

                if (prevDayRow) {
                    await copyPreviousDayData(prevDayRow, todayNptStr, env);
                } else {
                    console.error(`[cron ${event.cron}] FATAL: Previous day ${yesterdayNptStr} not found.`);
                }
            } else {
                console.log(`[cron ${event.cron}] Not final attempt. Will retry later.`);
            }
            return;
        }

        console.error(`[cron ${event.cron}] NRB API error: ${response.status} ${response.statusText}`);
        
    } catch (error: any) {
        console.error(`[cron ${event.cron}] Error:`, error.message);
    }
}


// --- API Handlers ---

async function handleFetchAndStore(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    // --- UPDATED: Pass env to verifyToken ---
    if (!token || !(await verifyToken(token, env))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    
    if (!fromDate || !toDate) {
           return new Response(JSON.stringify({ error: 'Missing date parameters' }), { status: 400, headers: corsHeaders });
    }

    try {
        const { action } = await request.json() as { action: 'update' | 'replace' };
        if (action !== 'update' && action !== 'replace') {
            return new Response(JSON.stringify({ error: 'Invalid action specified' }), { status: 400, headers: corsHeaders });
        }

        const apiUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDate}&to=${toDate}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            if (response.status === 404) {
                 return new Response(JSON.stringify({ success: true, stored: 0, message: 'No data available from NRB.' }), { headers: corsHeaders });
            }
            throw new Error(`NRB API error: ${response.status}`);
        }

        const data = await response.json();
        const processedDates = await processAndStoreApiData(data, env, action);

        return new Response(JSON.stringify({ success: true, stored: processedDates, fromDate, toDate }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch and store data' }), { status: 500, headers: corsHeaders });
    }
}

async function handleRatesByDate(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const date = url.pathname.split('/').pop();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!date || !dateRegex.test(date)) {
        return new Response(JSON.stringify({ date: date, rates: [] }), { 
            status: 400, 
            headers: {...corsHeaders, 'Content-Type': 'application/json'} 
        });
    }

    try {
        const row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(date).first<any>();

        if (!row) {
            return new Response(JSON.stringify({ date: date, rates: [] }), { 
                status: 404, 
                headers: {...corsHeaders, 'Content-Type': 'application/json'} 
            });
        }

        const rates: Rate[] = [];
        CURRENCIES.forEach(code => {
            const buyRate = row[`${code}_buy`];
            const sellRate = row[`${code}_sell`];
            if (typeof buyRate === 'number' || typeof sellRate === 'number') {
                rates.push({
                    currency: { ...CURRENCY_MAP[code], iso3: code },
                    buy: buyRate ?? 0,
                    sell: sellRate ?? 0,
                });
            }
        });
        
        const ratesData: RatesData = {
            date: row.date,
            published_on: row.updated_at || row.date,
            modified_on: row.updated_at || row.date,
            rates: rates
        };

        return new Response(JSON.stringify(ratesData), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (error: any) {
        console.error(`Error in handleRatesByDate for ${date}:`, error.message, error.cause);
        return new Response(JSON.stringify({ error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}

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
            const upperCaseCurrencyCode = currencyCode.toUpperCase();
            if (!CURRENCIES.includes(upperCaseCurrencyCode)) {
                return new Response(JSON.stringify({ success: false, error: 'Invalid currency' }), { status: 400, headers: corsHeaders });
            }
            
            let samplingClause = "";
            const bindings = [fromDate, toDate];

            if (sampling !== 'daily') {
                switch (sampling) {
                    case 'weekly': samplingClause = "AND (CAST(STRFTIME('%w', date) AS INT) = 4)"; break;
                    case 'monthly': samplingClause = "AND (CAST(STRFTIME('%d', date) AS INT) IN (1, 15))"; break;
                    case 'yearly': samplingClause = "AND (CAST(STRFTIME('%j', date) AS INT) IN (1, 180, 365))"; break;
                }
                samplingClause += ` OR date = ? OR date = ?`;
                bindings.push(fromDate, toDate);
            }

            const sql = `
                SELECT date, "${upperCaseCurrencyCode}_buy" as buy, "${upperCaseCurrencyCode}_sell" as sell
                FROM forex_rates
                WHERE date >= ? AND date <= ?
                ${samplingClause}
                ORDER BY date ASC
            `;
            
            const { results } = await env.FOREX_DB.prepare(sql).bind(...bindings).all<any>();
            
            const currencyInfo = CURRENCY_MAP[upperCaseCurrencyCode];
            const unit = currencyInfo?.unit || 1;
            
            const chartData = results.map((item: any) => ({
                date: item.date,
                buy: item.buy && typeof item.buy === 'number' ? item.buy / unit : null,
                sell: item.sell && typeof item.sell === 'number' ? item.sell / unit : null
            })).filter(d => d.buy !== null || d.sell !== null);

            return new Response(JSON.stringify({ success: true, data: chartData, currency: currencyCode }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });


        } else {
            const sql = `
                SELECT * FROM forex_rates
                WHERE date = ? OR date = ?
                ORDER BY date ASC
            `;
            const { results } = await env.FOREX_DB.prepare(sql).bind(fromDate, toDate).all<any>();

            const payloads: RatesData[] = results.map(row => {
                const rates: Rate[] = [];
                CURRENCIES.forEach(code => {
                    const buyRate = row[`${code}_buy`];
                    const sellRate = row[`${code}_sell`];
                    if (typeof buyRate === 'number' && typeof sellRate === 'number') {
                        rates.push({
                            currency: { ...CURRENCY_MAP[code], iso3: code },
                            buy: buyRate,
                            sell: sellRate,
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

            return new Response(JSON.stringify({ status: { code: 200, message: 'OK' }, payload: payloads }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

    } catch (error: any) {
        console.error('handleHistoricalRates failed:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}

// --- Admin / Posts Handlers ---

async function handlePublicSettings(request: Request, env: Env): Promise<Response> {
    try {
        const settings = await getAllSettings(env.FOREX_DB);
        return new Response(JSON.stringify(settings), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
            }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: 'Failed to fetch settings' }), { status: 500, headers: corsHeaders });
    }
}

async function handleSiteSettings(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    // --- UPDATED: Pass env to verifyToken ---
    if (!token || !(await verifyToken(token, env))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    try {
        if (request.method === 'GET') {
            const settings = await getAllSettings(env.FOREX_DB);
            return new Response(JSON.stringify(settings), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }

        if (request.method === 'POST') {
            const settings: SiteSettings = await request.json();

            if (
                typeof settings.ticker_enabled === 'undefined' ||
                typeof settings.adsense_enabled === 'undefined' ||
                typeof settings.adsense_exclusions === 'undefined'
            ) {
                 return new Response(JSON.stringify({ success: false, error: 'Missing settings keys' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            }

            const stmt1 = env.FOREX_DB.prepare("INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES ('ticker_enabled', ?, datetime('now'))")
                .bind(settings.ticker_enabled ? 'true' : 'false');
            const stmt2 = env.FOREX_DB.prepare("INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES ('adsense_enabled', ?, datetime('now'))")
                .bind(settings.adsense_enabled ? 'true' : 'false');
            const stmt3 = env.FOREX_DB.prepare("INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES ('adsense_exclusions', ?, datetime('now'))")
                .bind(settings.adsense_exclusions);

            await env.FOREX_DB.batch([stmt1, stmt2, stmt3]);

            const updatedSettings = await getAllSettings(env.FOREX_DB);
            return new Response(JSON.stringify(updatedSettings), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handleSiteSettings (${request.method}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

async function handleCheckUser(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        const { username, ipAddress, sessionId } = await request.json();
        if (!username || !ipAddress || !sessionId) {
             return new Response(JSON.stringify({ success: false, error: 'Missing credentials/identifiers' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const { results: attemptsResults } = await env.FOREX_DB.prepare(
            `SELECT COUNT(*) as count FROM login_attempts WHERE (ip_address = ? OR session_id = ?) AND type = 'check' AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`
        ).bind(ipAddress, sessionId).all<{ count: number }>();
        const failedAttempts = attemptsResults[0]?.count || 0;

        if (failedAttempts >= 10) {
            return new Response(JSON.stringify({ success: false, error: 'Bro, get out of my system!' }), { status: 429, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }
        
        if (Math.random() < 0.05) {
            return new Response(JSON.stringify({ success: false, error: 'Redirect' }), { status: 418, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const user = await env.FOREX_DB.prepare(
            `SELECT username FROM users WHERE username = ?`
        ).bind(username).first<{ username: string }>();

        const userExists = !!user;

        await env.FOREX_DB.prepare(
            `INSERT INTO login_attempts (ip_address, session_id, username, success, type) VALUES (?, ?, ?, ?, 'check')`
        ).bind(ipAddress, sessionId, username, userExists ? 1 : 0).run();

        if (!userExists) {
            return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        return new Response(JSON.stringify({ success: true, message: "User verified" }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Check user error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error during user check' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}


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
            `SELECT COUNT(*) as count FROM login_attempts WHERE (ip_address = ? OR session_id = ?) AND type = 'login' AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`
        ).bind(ipAddress, sessionId).all<{ count: number }>();
        const failedAttempts = attemptsResults[0]?.count || 0;

        if (failedAttempts >= 7) {
            return new Response(JSON.stringify({ success: false, error: 'Too many failed password attempts.' }), { status: 429, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const user = await env.FOREX_DB.prepare(
            `SELECT username, plaintext_password, password_hash FROM users WHERE username = ?`
        ).bind(username).first<{ username: string; plaintext_password: string | null; password_hash: string | null }>();

        let isValid = false;
        let mustChangePassword = false;

        if (user) {
            if (user.plaintext_password && user.password_hash) {
                // --- UPDATED: Pass env to hash function ---
                if (password === user.plaintext_password || await simpleHashCompare(password, user.password_hash, env)) {
                    isValid = true;
                    mustChangePassword = true;
                }
            } else if (user.plaintext_password && !user.password_hash) {
                if (password === user.plaintext_password) {
                    isValid = true;
                    mustChangePassword = true;
                }
            } else if (!user.plaintext_password && user.password_hash) {
                // --- UPDATED: Pass env to hash function ---
                isValid = await simpleHashCompare(password, user.password_hash, env);
                mustChangePassword = false;
            }
        }

        await env.FOREX_DB.prepare(
            `INSERT INTO login_attempts (ip_address, session_id, username, success, type) VALUES (?, ?, ?, ?, 'login')`
        ).bind(ipAddress, sessionId, username, isValid ? 1 : 0).run();

        if (!isValid) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        // --- UPDATED: Pass env to token function ---
        const token = await generateToken(username, env);
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
            `SELECT COUNT(*) as count FROM login_attempts WHERE (ip_address = ? OR session_id = ?) AND type = 'login' AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`
        ).bind(ipAddress, sessionId).first<{ count: number }>();
        const attempts = result?.count || 0;
        return new Response(JSON.stringify({ attempts: attempts, remaining: Math.max(0, 7 - attempts) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
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
    // --- UPDATED: Pass env to verifyToken ---
    if (!token || !(await verifyToken(token, env))) {
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
                // --- UPDATED: Pass env to hash function ---
                newPasswordHash = await simpleHash(user.plaintext_password, env);
            } else {
                 return new Response(JSON.stringify({ success: false, error: 'Cannot keep password, no hash or plaintext found.' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            }
        } else {
            // --- UPDATED: Pass env to hash function ---
            newPasswordHash = await simpleHash(newPassword, env);
        }

        await env.FOREX_DB.prepare(
            `UPDATE users SET password_hash = ?, plaintext_password = NULL, updated_at = datetime('now') WHERE username = ?`
        ).bind(newPasswordHash, username).run();

        await env.FOREX_DB.prepare(`INSERT OR REPLACE INTO user_recovery (recovery_data, created_at) VALUES (?, datetime('now'))`).bind(username).run();


        return new Response(JSON.stringify({ success: true, message: "Password updated." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error('Password change error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Brevo Email Sending Function ---
async function sendPasswordResetEmail(
    env: Env,
    to: string,
    username: string,
    resetToken: string,
    resetUrl: string,
    ctx: ExecutionContext
): Promise<void> {
    const BREVO_API_KEY = env.BREVO_API_KEY;
    if (!BREVO_API_KEY) {
        console.error('BREVO_API_KEY secret not set in Cloudflare Worker.');
        return;
    }

    const emailPromise = fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': BREVO_API_KEY,
        },
        body: JSON.stringify({
            sender: {
                name: 'Forex Nepal Admin',
                email: 'cadmin@grisma.com.np',
            },
            to: [{ email: to, name: username }],
            subject: 'Password Reset Request - Forex Nepal Admin',
            htmlContent: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                  .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                  .token { font-family: 'Courier New', monospace; background: #e9ecef; padding: 10px; border-radius: 4px; font-size: 18px; letter-spacing: 2px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Password Reset Request</h1>
                  </div>
                  <div class="content">
                    <p>Hello <strong>${username}</strong>,</p>
                    <p>We received a request to reset your password for the Forex Nepal Admin Dashboard.</p>
                    <p>Click the button below to reset your password:</p>
                    <p style="text-align: center;">
                      <a href="${resetUrl}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
                    <p>Alternatively, use this reset code:</p>
                    <p style="text-align: center;" class="token">${resetToken}</p>
                    <p><strong>This link and code will expire in 1 hour.</strong></p>
                    <p>If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.</p>
                  </div>
                  <div class="footer">
                    <p>Forex Nepal Admin Dashboard | Powered by Grisma</p>
                    <p>This is an automated email, please do not reply.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
        }),
    }).then(async (emailResponse) => {
         if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error('Brevo API error:', errorText);
        } else {
            console.log('Password reset email sent successfully via Brevo.');
        }
    }).catch(emailError => {
        console.error('Email sending error:', emailError);
    });

    ctx.waitUntil(emailPromise);
}


// --- Request Password Reset Handler ---
async function handleRequestPasswordReset(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    try {
        const { username } = await request.json();
        if (!username) {
            return new Response(JSON.stringify({ success: false, error: 'Username required' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const user = await env.FOREX_DB.prepare(
            `SELECT username, email FROM users WHERE username = ?`
        ).bind(username).first<{ username: string; email: string | null }>();

        if (!user || !user.email) {
            console.log(`Password reset request for "${username}", but user or email not found. Sending success for security.`);
            return new Response(JSON.stringify({ success: true, message: "If account exists, reset email sent" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const resetToken = crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

        await env.FOREX_DB.prepare(
            `INSERT INTO password_reset_tokens (username, token, expires_at) VALUES (?, ?, ?)`
        ).bind(username, resetToken, expiresAt).run();

        const resetUrl = `https://forex.grisma.com.np/#/admin/reset-password?token=${resetToken}`;
        
        sendPasswordResetEmail(
            env,
            user.email,
            user.username,
            resetToken,
            resetUrl,
            ctx
        );

        return new Response(JSON.stringify({ success: true, message: "If account exists, reset email sent" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Request password reset error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Reset Password Handler ---
async function handleResetPassword(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    try {
        const { token, newPassword } = await request.json();
        if (!token || !newPassword) {
            return new Response(JSON.stringify({ success: false, error: 'Token and password required' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        if (newPassword.length < 8) {
            return new Response(JSON.stringify({ success: false, error: 'Password must be >= 8 characters' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const resetRecord = await env.FOREX_DB.prepare(
            `SELECT username, expires_at, used FROM password_reset_tokens WHERE token = ?`
        ).bind(token).first<{ username: string; expires_at: string; used: number }>();

        if (!resetRecord) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid or expired reset token' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        if (resetRecord.used === 1) {
            return new Response(JSON.stringify({ success: false, error: 'Reset token already used' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const expiresAt = new Date(resetRecord.expires_at);
        if (expiresAt < new Date()) {
            return new Response(JSON.stringify({ success: false, error: 'Reset token expired' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        // --- UPDATED: Pass env to hash function ---
        const newPasswordHash = await simpleHash(newPassword, env);
        await env.FOREX_DB.prepare(
            `UPDATE users SET password_hash = ?, plaintext_password = NULL, updated_at = datetime('now') WHERE username = ?`
        ).bind(newPasswordHash, resetRecord.username).run();

        await env.FOREX_DB.prepare(
            `UPDATE password_reset_tokens SET used = 1 WHERE token = ?`
        ).bind(token).run();

        return new Response(JSON.stringify({ success: true, message: "Password reset successfully" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Reset password error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- User Management Handlers ---
async function handleUsers(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    // --- UPDATED: Pass env to verifyToken ---
    if (!token || !(await verifyToken(token, env))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    try {
        if (request.method === 'GET') {
            const { results } = await env.FOREX_DB.prepare(
                `SELECT username, email, role, is_active, created_at FROM users ORDER BY created_at DESC`
            ).all();
            return new Response(JSON.stringify({ success: true, users: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        if (request.method === 'POST') {
            const { username, email, password, role } = await request.json();
            if (!username || !password) {
                return new Response(JSON.stringify({ success: false, error: 'Username and password required' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            }
            
            // --- UPDATED: Pass env to hash function ---
            const passwordHash = await simpleHash(password, env);
            await env.FOREX_DB.prepare(
                `INSERT INTO users (username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
            ).bind(username, email || null, passwordHash, role || 'admin').run();
            
            return new Response(JSON.stringify({ success: true }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error('User management error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

async function handleUserById(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    // --- UPDATED: Pass env to verifyToken ---
    if (!token || !(await verifyToken(token, env))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    const url = new URL(request.url);
    const username = url.pathname.split('/').pop();
    
    try {
        if (request.method === 'DELETE') {
            await env.FOREX_DB.prepare(`DELETE FROM users WHERE username = ?`).bind(username).run();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error('User delete error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

async function handlePosts(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    // --- UPDATED: Pass env to verifyToken ---
    if (!token || !(await verifyToken(token, env))) {
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
    // --- UPDATED: Pass env to verifyToken ---
    if (!token || !(await verifyToken(token, env))) {
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
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }
        if (request.method === 'DELETE') {
            await env.FOREX_DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(postId).run();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
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
    // --- UPDATED: Pass env to verifyToken ---
    if (!token || !(await verifyToken(token, env))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const date = url.searchParams.get('date');
            if (date) {
                const result = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(date).first();
                return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
            } else {
                const { results } = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates ORDER BY date DESC LIMIT 30`).all();
                return new Response(JSON.stringify({ success: true, data: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
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
                }
            }

            if (!validRatesFound) return new Response(JSON.stringify({ success: false, error: 'No rates provided' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });

            const wideQuery = `INSERT OR REPLACE INTO forex_rates (${wideColumns.join(', ')}) VALUES (${widePlaceholders.join(', ')})`;
            await env.FOREX_DB.prepare(wideQuery).bind(...wideValues).run();

            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handleForexData (${request.method}):`, error.message, error.cause);
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
        return new Response(JSON.stringify({ success: true, posts: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
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
        return new Response(JSON.stringify({ success: true, post }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error fetching post by slug (${slug}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- Auth Helpers (UPDATED to use env) ---
async function simpleHash(password: string, env: Env): Promise<string> {
    const encoder = new TextEncoder();
    // --- UPDATED: Read secret from env ---
    const data = encoder.encode(password + env.JWT_SECRET);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function simpleHashCompare(password: string, storedHash: string | null, env: Env): Promise<boolean> {
    if (!storedHash) {
        return false;
    }
    // --- UPDATED: Pass env to hash function ---
    const inputHash = await simpleHash(password, env);
    return inputHash === storedHash;
}


async function generateToken(username: string, env: Env): Promise<string> {
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
    // --- UPDATED: Read secret from env ---
    const key = await crypto.subtle.importKey('raw', encoder.encode(env.JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
    let base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${signatureInput}.${base64Signature}`;
}

async function verifyToken(token: string, env: Env): Promise<boolean> {
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
        // --- UPDATED: Read secret from env ---
        const key = await crypto.subtle.importKey('raw', encoder.encode(env.JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
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

// --- Default Export (Router) ---
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return handleOptions(request);
        }

        const pathname = url.pathname;

        // --- API ROUTING ---
        // PUBLIC API
        if (pathname === '/api/settings') {
            return handlePublicSettings(request, env);
        }
        if (pathname === '/api/fetch-and-store') {
            return handleFetchAndStore(request, env);
        }
        if (pathname === '/api/historical-rates') {
            return handleHistoricalRates(request, env);
        }
        if (pathname === '/api/posts') {
            return handlePublicPosts(request, env);
        }
        if (pathname.startsWith('/api/posts/')) {
            return handlePublicPostBySlug(request, env);
        }
        if (pathname.startsWith('/api/rates/date/')) {
            return handleRatesByDate(request, env);
        }

        // ADMIN API - Login/Security
        if (pathname === '/api/admin/check-user') {
            return handleCheckUser(request, env);
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
        if (pathname === '/api/admin/request-password-reset') {
            return handleRequestPasswordReset(request, env, ctx);
        }
        if (pathname === '/api/admin/reset-password') {
            return handleResetPassword(request, env);
NEW:
        }

        // ADMIN API - Data/Posts/Settings (Requires Token Verification)
        if (pathname === '/api/admin/settings') {
            return handleSiteSettings(request, env);
        }
        if (pathname === '/api/admin/forex-data') {
            return handleForexData(request, env);
        }
        if (pathname === '/api/admin/users') {
            return handleUsers(request, env);
        }
        if (pathname.startsWith('/api/admin/users/')) {
            return handleUserById(request, env);
        }
        if (pathname === '/api/admin/posts') {
            return handlePosts(request, env);
        }
        if (pathname.startsWith('/api/admin/posts/')) {
            return handlePostById(request, env);
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

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(handleScheduled(event, env));
    }
};
