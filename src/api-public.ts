// src/api-public.ts
// --- PUBLIC-FACING API HANDLERS ---

import { Env } from './worker-types';
import type { Rate, RatesData } from './types/forex';
import { corsHeaders, CURRENCIES, CURRENCY_MAP } from './constants';
import { formatDate } from './worker-utils';
import { getAllSettings } from './api-helpers';

/**
 * (PUBLIC) Fetches public-facing site settings.
 */
export async function handlePublicSettings(request: Request, env: Env): Promise<Response> {
    try {
        const settings = await getAllSettings(env.FOREX_DB);
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
                'Cache-Control': 'public, max-age=300'
            }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: 'Failed to fetch settings' }), { status: 500, headers: corsHeaders });
    }
}

/**
 * Helper to get the latest available data row (today or yesterday)
 */
async function getLatestForexRow(env: Env): Promise<any> {
    const nowUtc = new Date();
    const nptOffsetMs = (5 * 60 + 45) * 60 * 1000;
    const nowNpt = new Date(nowUtc.getTime() + nptOffsetMs);
    
    const todayStr = formatDate(nowNpt);
    const yesterdayStr = formatDate(new Date(nowNpt.getTime() - 86400000));

    let row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(todayStr).first<any>();
    if (!row) {
        row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(yesterdayStr).first<any>();
    }
    return row;
}

/**
 * (PUBLIC) Fetches the latest available rates (today or yesterday).
 */
export async function handleLatestRates(request: Request, env: Env): Promise<Response> {
    try {
        const row = await getLatestForexRow(env);
        if (!row) {
            return new Response(JSON.stringify({ error: 'No forex data found for today or yesterday.' }), { 
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

// --- NEW PUBLIC API ENDPOINTS ---

/**
 * (PUBLIC) API for Image Embed
 * Returns JSON data needed for the client-side image render.
 * Does not generate an image on the server.
 */
export async function handleImageApi(request: Request, env: Env): Promise<Response> {
    try {
        const row = await getLatestForexRow(env);
        if (!row) {
            return new Response(JSON.stringify({ error: 'No forex data found' }), { 
                status: 404, 
                headers: {...corsHeaders, 'Content-Type': 'application/json'} 
            });
        }
        
        const yesterdayStr = formatDate(new Date(new Date(row.date).getTime() - 86400000));
        const prevRow = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(yesterdayStr).first<any>();

        const rates: any[] = [];
        CURRENCIES.forEach(code => {
            const buyRate = row[`${code}_buy`];
            const sellRate = row[`${code}_sell`];
            
            if (typeof buyRate === 'number' || typeof sellRate === 'number') {
                const currencyInfo = CURRENCY_MAP[code];
                const unit = currencyInfo?.unit || 1;
                
                let buyTrend = { diff: 0, trend: 'stable' };
                let sellTrend = { diff: 0, trend: 'stable' };

                if (prevRow) {
                    const prevBuy = prevRow[`${code}_buy`] / (prevRow.unit || 1);
                    const prevSell = prevRow[`${code}_sell`] / (prevRow.unit || 1);
                    const currentBuy = buyRate / unit;
                    const currentSell = sellRate / unit;
                    
                    const buyDiff = currentBuy - prevBuy;
                    const sellDiff = currentSell - prevSell;

                    buyTrend = { diff: buyDiff, trend: buyDiff > 0.0001 ? 'increase' : (buyDiff < -0.0001 ? 'decrease' : 'stable') };
                    sellTrend = { diff: sellDiff, trend: sellDiff > 0.0001 ? 'increase' : (sellDiff < -0.0001 ? 'decrease' : 'stable') };
                }

                rates.push({
                    iso3: code,
                    name: currencyInfo?.name || 'Unknown',
                    unit: unit,
                    buy: buyRate ?? 0,
                    sell: sellRate ?? 0,
                    buyTrend: buyTrend,
                    sellTrend: sellTrend,
                });
            }
        });

        const responseData = {
            success: true,
            date: row.date,
            published_on: row.updated_at || row.date,
            rates: rates
        };

        return new Response(JSON.stringify(responseData), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (error: any) {
        console.error(`Error in handleImageApi:`, error.message, error.cause);
        return new Response(JSON.stringify({ error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}

/**
 * (PUBLIC) API for Archive List
 * Returns a paginated list of dates for which data exists.
 */
export async function handleArchiveListApi(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '30', 10);
    const offset = (page - 1) * limit;

    try {
        const { results } = await env.FOREX_DB.prepare(
            `SELECT date FROM forex_rates ORDER BY date DESC LIMIT ? OFFSET ?`
        ).bind(limit, offset).all<{ date: string }>();
        
        const countResult = await env.FOREX_DB.prepare(`SELECT COUNT(*) as total FROM forex_rates`).first<{ total: number }>();
        
        const total = countResult?.total || 0;
        const totalPages = Math.ceil(total / limit);

        const responseData = {
            success: true,
            pagination: {
                page,
                limit,
                total,
                totalPages
            },
            dates: results.map(r => r.date)
        };

        return new Response(JSON.stringify(responseData), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (error: any) {
        console.error(`Error in handleArchiveListApi:`, error.message, error.cause);
        return new Response(JSON.stringify({ error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}

/**
 * (PUBLIC) API for Archive Detail Page Content
 * Returns the generated text paragraphs for the archive detail page.
 */
export async function handleArchiveDetailApi(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const date = url.pathname.split('/').pop();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!date || !dateRegex.test(date)) {
        return new Response(JSON.stringify({ error: 'Invalid date format' }), { status: 400, headers: corsHeaders });
    }

    try {
        // Fetch data for the selected date and the day before
        const prevDate = formatDate(new Date(new Date(date).getTime() - 86400000));
        
        const row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(date).first<any>();
        const prevRow = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(prevDate).first<any>();

        if (!row) {
            return new Response(JSON.stringify({ error: 'No data found for this date' }), { status: 404, headers: corsHeaders });
        }
        
        // --- Re-generate text content (simplified version of ArchiveDetail.tsx logic) ---
        const usdRate = row['USD_buy'];
        const usdSell = row['USD_sell'];
        let gainerName = 'N/A';
        let loserName = 'N/A';
        let maxChange = -Infinity;
        let minChange = Infinity;

        let gainersCount = 0;
        let losersCount = 0;

        if (prevRow) {
            for (const code of CURRENCIES) {
                if (code === 'INR') continue;
                
                const unit = CURRENCY_MAP[code]?.unit || 1;
                const buy = row[`${code}_buy`] / unit;
                const prevBuy = prevRow[`${code}_buy`] / unit;
                
                if (buy && prevBuy) {
                    const change = buy - prevBuy;
                    if (change > 0.0001) gainersCount++;
                    if (change < -0.0001) losersCount++;

                    if (change > maxChange) {
                        maxChange = change;
                        gainerName = CURRENCY_MAP[code]?.name || code;
                    }
                    if (change < minChange) {
                        minChange = change;
                        loserName = CURRENCY_MAP[code]?.name || code;
                    }
                }
            }
        }
        
        // --- Generate Paragraphs ---
        const intro = `Nepal Rastra Bank (NRB) published the official foreign exchange rates for ${date}. The U.S. Dollar settled at a buying rate of Rs. ${usdRate?.toFixed(2)} and a selling rate of Rs. ${usdSell?.toFixed(2)}.`;
        
        const summary = `Today's market saw mixed movements. The ${gainerName} was the top gainer, while the ${loserName} saw the most significant decline. In total, ${gainersCount} currencies gained value against the NPR, while ${losersCount} lost ground.`;

        const detail = `The Indian Rupee (INR) remained fixed at Rs. 160.00 (Buy) and Rs. 160.15 (Sell) per 100 units. Other major currencies like the European Euro and UK Pound Sterling also saw adjustments in line with global market trends.`;

        const responseData = {
            success: true,
            date: date,
            paragraphs: {
                intro: intro,
                summary: summary,
                detail: detail
            }
        };

        return new Response(JSON.stringify(responseData), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (error: any) {
        console.error(`Error in handleArchiveDetailApi:`, error.message, error.cause);
        return new Response(JSON.stringify({ error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}
