// src/api-public.ts
// --- PUBLIC-FACING API HANDLERS ---

import { Env } from './worker-types';
import type { Rate, RatesData } from './types/forex';
import { corsHeaders, CURRENCIES, CURRENCY_MAP } from './constants';
import { formatDate } from './worker-utils';
import { getAllSettings } from './api-helpers'; // Import from new helper

/**
 * (PUBLIC) Fetches public-facing site settings.
 */
export async function handlePublicSettings(request: Request, env: Env): Promise<Response> {
    try {
        const settings = await getAllSettings(env.FOREX_DB);
        // Only return public-safe settings
        const publicSettings = {
            ticker_enabled: settings.ticker_enabled,
            adsense_enabled: settings.adsense_enabled,
            adsense_exclusions: settings.adsense_exclusions,
        };
        return new Response(JSON.stringify(publicSettings), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // Cache public settings for 5 mins
            }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: 'Failed to fetch settings' }), { status: 500, headers: corsHeaders });
    }
}

/**
 * (PUBLIC) Fetches the latest available rates (today or yesterday).
 */
export async function handleLatestRates(request: Request, env: Env): Promise<Response> {
    try {
        // Get NPT date (UTC+5:45)
        const nowUtc = new Date();
        const nptOffsetMs = (5 * 60 + 45) * 60 * 1000;
        const nowNpt = new Date(nowUtc.getTime() + nptOffsetMs);
        
        const todayStr = formatDate(nowNpt);
        const yesterdayStr = formatDate(new Date(nowNpt.getTime() - 86400000)); // 24h ago

        let row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(todayStr).first<any>();

        // If no data for today, try yesterday
        if (!row) {
            row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(yesterdayStr).first<any>();
        }

        if (!row) {
            return new Response(JSON.stringify({ error: 'No forex data found for today or yesterday.' }), { 
                status: 404, 
                headers: {...corsHeaders, 'Content-Type': 'application/json'} 
            });
        }

        // Format the row into RatesData
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
        console.error(`Error in handleLatestRates:`, error.message, error.cause);
        return new Response(JSON.stringify({ error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}


/**
 * (PUBLIC) Fetches rates for a specific date from the DB.
 */
export async function handleRatesByDate(request: Request, env: Env): Promise<Response> {
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

/**
 * (PUBLIC) Fetches historical rates for one or all currencies.
 */
export async function handleHistoricalRates(request: Request, env: Env): Promise<Response> {
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
            // Logic for single currency chart
            const upperCaseCurrencyCode = currencyCode.toUpperCase();
            if (!CURRENCIES.includes(upperCaseCurrencyCode)) {
                return new Response(JSON.stringify({ success: false, error: 'Invalid currency' }), { status: 400, headers: corsHeaders });
            }
            
            let samplingClause = "";
            const bindings = [fromDate, toDate];

            if (sampling !== 'daily') {
                switch (sampling) {
                    case 'weekly': samplingClause = "AND (CAST(STRFTIME('%w', date) AS INT) = 4)"; break; // Wednesday
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
            // Logic for multi-currency comparison (e.g., profit calculator)
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

/**
 * (PUBLIC) Fetches all published posts.
 */
export async function handlePublicPosts(request: Request, env: Env): Promise<Response> {
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

/**
 * (PUBLIC) Fetches a single published post by its slug.
 */
export async function handlePublicPostBySlug(request: Request, env: Env): Promise<Response> {
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
