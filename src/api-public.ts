// iamgrisma/forexnepal/forexnepal-0e3b0b928a538dcfb4920dfab92aefdb890deb1f/src/api-public.ts
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
 * Helper to get the latest available data row (today or yesterday)
 */
async function getLatestForexRow(env: Env): Promise<any> {
    const nowUtc = new Date();
    const nptOffsetMs = (5 * 60 + 45) * 60 * 1000;
    const nowNpt = new Date(nowUtc.getTime() + nptOffsetMs);
    
    const todayStr = formatDate(nowNpt);
    const yesterdayStr = formatDate(new Date(nowNpt.getTime() - 86400000)); // 24h ago

    let row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(todayStr).first<any>();
    if (!row) {
        row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(yesterdayStr).first<any>();
    }
    return row;
}

/**
 * (PUBLIC) Fetches the latest available rates (today or yesterday).
 * --- FIX: This now returns NORMALIZED (per-unit) rates. ---
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
            const unit = CURRENCY_MAP[code]?.unit || 1;
            
            if (typeof buyRate === 'number' || typeof sellRate === 'number') {
                rates.push({
                    currency: { ...CURRENCY_MAP[code], iso3: code },
                    // --- FIX: Normalize the rates ---
                    buy: (buyRate ?? 0) / unit,
                    sell: (sellRate ?? 0) / unit,
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
 * --- FIX: This now returns NORMALIZED (per-unit) rates. ---
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
            const unit = CURRENCY_MAP[code]?.unit || 1;

            if (typeof buyRate === 'number' || typeof sellRate === 'number') {
                rates.push({
                    currency: { ...CURRENCY_MAP[code], iso3: code },
                    // --- FIX: Normalize the rates ---
                    buy: (buyRate ?? 0) / unit,
                    sell: (sellRate ?? 0) / unit,
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
 * --- FIX: This now returns NORMALIZED (per-unit) rates for charts. ---
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
                    case '15day': samplingClause = "AND (CAST(STRFTIME('%d', date) AS INT) IN (1, 15))"; break; // Renamed from 'monthly'
                    case 'monthly': samplingClause = "AND (CAST(STRFTIME('%d', date) AS INT) = 1)"; break; // True monthly
                }
                // Always include the first and last date for accurate ranges
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
            
            // --- FIX: Normalize the rates for the chart ---
            const chartData = results.map((item: any) => ({
                date: item.date,
                buy: item.buy && typeof item.buy === 'number' ? item.buy / unit : null,
                sell: item.sell && typeof item.sell === 'number' ? item.sell / unit : null
            })).filter(d => d.buy !== null || d.sell !== null);
            // --- END FIX ---

            return new Response(JSON.stringify({ success: true, data: chartData, currency: currencyCode }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else {
            // Logic for multi-currency comparison (e.g., profit calculator)
            // --- FIX: This also needs to return NORMALIZED rates ---
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
                    const unit = CURRENCY_MAP[code]?.unit || 1;

                    if (typeof buyRate === 'number' && typeof sellRate === 'number') {
                        rates.push({
                            currency: { ...CURRENCY_MAP[code], iso3: code },
                            // --- FIX: Normalize the rates ---
                            buy: buyRate / unit,
                            sell: sellRate / unit,
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
            // --- END FIX ---

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
 * Returns HTML that renders the forex table on client side.
 * --- NOTE: This function intentionally returns UN-NORMALIZED rates ---
 */
export async function handleImageApi(request: Request, env: Env): Promise<Response> {
    try {
        const row = await getLatestForexRow(env);
        if (!row) {
            return new Response('<html><body><p>No forex data found</p></body></html>', { 
                status: 404, 
                headers: {...corsHeaders, 'Content-Type': 'text/html'} 
            });
        }
        
        const yesterdayStr = formatDate(new Date(new Date(row.date).getTime() - 86400000));
        const prevRow = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(yesterdayStr).first<any>();

        let tableRows = '';
        CURRENCIES.forEach(code => {
            // --- NOTE: We use the RAW, UN-NORMALIZED rates for this embed ---
            const buyRate = row[`${code}_buy`];
            const sellRate = row[`${code}_sell`];
            
            if (typeof buyRate === 'number' || typeof sellRate === 'number') {
                const currencyInfo = CURRENCY_MAP[code];
                const unit = currencyInfo?.unit || 1;
                
                let buyTrend = '●';
                let sellTrend = '●';
                let buyColor = '#9ca3af';
                let sellColor = '#9ca3af';

                if (prevRow) {
                    // Compare raw rates
                    const prevBuy = (prevRow[`${code}_buy`] || 0);
                    const prevSell = (prevRow[`${code}_sell`] || 0);
                    
                    const buyDiff = buyRate - prevBuy;
                    const sellDiff = sellRate - prevSell;

                    if (buyDiff > 0.0001) {
                        buyTrend = '▲';
                        buyColor = '#10b981';
                    } else if (buyDiff < -0.0001) {
                        buyTrend = '▼';
                        buyColor = '#ef4444';
                    }

                    if (sellDiff > 0.0001) {
                        sellTrend = '▲';
                        sellColor = '#10b981';
                    } else if (sellDiff < -0.0001) {
                        sellTrend = '▼';
                        sellColor = '#ef4444';
                    }
                }

                const countryCode = code === 'EUR' ? 'EU' : code.substring(0, 2);
                tableRows += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center;">
                            <img src="https://flagsapi.com/${countryCode}/flat/32.png" 
                                 alt="${code}" 
                                 style="width: 24px; height: 18px; margin-right: 8px; border: 1px solid #e5e7eb;">
                            <strong>${code}</strong> (${unit})
                        </div>
                    </td>
                    <td>${buyRate.toFixed(2)} <span style="color: ${buyColor}">${buyTrend}</span></td>
                    <td>${sellRate.toFixed(2)} <span style="color: ${sellColor}">${sellTrend}</span></td>
                </tr>`;
            }
        });

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nepal Forex Rates - ${row.date}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #f9fafb;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px;
            text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { font-size: 14px; opacity: 0.9; }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            text-align: left;
            padding: 16px;
            border-bottom: 1px solid #f3f4f6;
        }
        th {
            background: #f9fafb;
            font-weight: 600;
            font-size: 14px;
            color: #4b5563;
        }
        td {
            font-size: 14px;
            color: #1f2937;
        }
        tr:hover { background: #f9fafb; }
        .footer {
            text-align: center;
            padding: 16px;
            background: #f9fafb;
            font-size: 12px;
            color: #6b7280;
        }
        .footer a { color: #2563eb; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Nepal Forex Exchange Rates</h1>
            <p>Published on ${row.date}</p>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Currency</th>
                    <th>Buy (NPR)</th>
                    <th>Sell (NPR)</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        <div class="footer">
            Source: <a href="https://forex.grisma.com.np" target="_blank">Forex by Grisma</a> | 
            Powered by NRB Real-time API
        </div>
    </div>
</body>
</html>`;

        return new Response(html, { 
            headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } 
        });

    } catch (error: any) {
        console.error(`Error in handleImageApi:`, error.message, error.cause);
        return new Response('<html><body><p>Error loading data</p></body></html>', { 
            status: 500, 
            headers: {...corsHeaders, 'Content-Type': 'text/html'} 
        });
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
        const prevDate = formatDate(new Date(new Date(date).getTime() - 86400000));
        
        const row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(date).first<any>();
        const prevRow = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(prevDate).first<any>();

        if (!row) {
            return new Response(JSON.stringify({ error: 'No data found for this date' }), { status: 404, headers: corsHeaders });
        }
        
        // --- NOTE: This API uses RAW rates for its text ---
        const usdRate = row['USD_buy']; // Raw rate
        const usdSell = row['USD_sell']; // Raw rate
        let gainerName = 'N/A';
        let loserName = 'N/A';
        let maxChange = -Infinity;
        let minChange = Infinity;

        let gainersCount = 0;
        let losersCount = 0;

        if (prevRow) {
            for (const code of CURRENCIES) {
                if (code === 'INR') continue;
                
                // Compare raw rates directly
                const buy = (row[`${code}_buy`] || 0);
                const prevBuy = (prevRow[`${code}_buy`] || 0);
                
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
