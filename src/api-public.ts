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
    const nptOffset = 5.75 * 60; // 5 hours 45 minutes
    const nptTime = new Date(nowUtc.getTime() + nptOffset * 60000);
    const todayNpt = nptTime.toISOString().split('T')[0];
    
    let row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(todayNpt).first();
    
    if (row) {
        return row;
    }
    
    // If no data for today, try yesterday
    nptTime.setDate(nptTime.getDate() - 1);
    const yesterdayNpt = nptTime.toISOString().split('T')[0];
    row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(yesterdayNpt).first();
    
    return row; // This might be null if no data for yesterday either
}

/**
 * Helper to normalize wide row data to the desired API "long" format
 */
function normalizeRates(wideRow: any): RatesData | null {
    if (!wideRow) return null;

    const rates: Rate[] = [];
    CURRENCIES.forEach(code => {
        const currencyInfo = CURRENCY_MAP[code] || { name: code, unit: 1, country: 'Unknown' };
        const buy = wideRow[`${code}_buy`];
        const sell = wideRow[`${code}_sell`];

        // Only include if at least one value is present
        if (buy !== null || sell !== null) {
            rates.push({
                currency: {
                    code: code,
                    name: currencyInfo.name,
                    unit: currencyInfo.unit,
                },
                buy: buy ? parseFloat(buy).toFixed(2) : null,
                sell: sell ? parseFloat(sell).toFixed(2) : null,
            });
        }
    });

    return {
        date: wideRow.date,
        published_on: wideRow.created_at, // Use created_at from DB
        modified_on: wideRow.updated_at,   // Use updated_at from DB
        rates: rates,
    };
}

/**
 * (PUBLIC) GET latest rates.
 */
export async function handleLatestRates(request: Request, env: Env): Promise<Response> {
  try {
    const latestRateWide = await getLatestForexRow(env);
    
    if (!latestRateWide) {
      return new Response(JSON.stringify({ success: true, data: null, message: "No data available." }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const latestRateLong = normalizeRates(latestRateWide);

    return new Response(JSON.stringify({ success: true, data: latestRateLong }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // Cache for 1 minute
      },
    });
  } catch (e: any) {
    console.error("Error fetching latest rates:", e.message, e.cause);
    return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * (PUBLIC) GET rates by specific date.
 */
export async function handleRatesByDate(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const date = url.pathname.split('/').pop();
    
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ratesWide = await env.FOREX_DB.prepare(
      "SELECT * FROM forex_rates WHERE date = ?"
    ).bind(date).first();

    if (!ratesWide) {
        return new Response(JSON.stringify({ success: false, data: null, error: 'No data found for this date.' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const ratesLong = normalizeRates(ratesWide);

    return new Response(JSON.stringify({ success: true, data: ratesLong }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400' // Cache historical for 1 day
      },
    });
  } catch (e: any) {
    console.error("Error fetching rates by date:", e.message, e.cause);
    return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * (PUBLIC) GET historical rates for charts.
 */
export async function handleHistoricalRates(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const currency = url.searchParams.get('currency');

    if (!currency || !CURRENCIES.includes(currency.toUpperCase())) {
         return new Response(JSON.stringify({ success: false, error: 'Invalid or missing currency parameter' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
         return new Response(JSON.stringify({ success: false, error: 'Invalid or missing from/to date parameters. Use YYYY-MM-DD.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const buyCol = `${currency.toUpperCase()}_buy`;
    const sellCol = `${currency.toUpperCase()}_sell`;
    
    // Use prepared statement to select specific columns
    const query = `
      SELECT 
        date, 
        "${buyCol}" as buy, 
        "${sellCol}" as sell 
      FROM forex_rates 
      WHERE date >= ? AND date <= ? 
      ORDER BY date ASC
    `;

    const { results } = await env.FOREX_DB.prepare(query).bind(from, to).all();
    
    return new Response(JSON.stringify({ success: true, data: results || [] }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache charts for 1 hour
      },
    });
  } catch (e: any) {
    console.error("Error fetching historical rates:", e.message, e.cause);
    return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * (PUBLIC) GET all published posts (paginated).
 */
export async function handlePublicPosts(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const { results } = await env.FOREX_DB.prepare(
      "SELECT id, title, slug, excerpt, featured_image_url, author_name, author_url, published_at, updated_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    
    return new Response(JSON.stringify({ success: true, posts: results || [] }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600' // Cache posts list for 10 mins
      },
    });
  } catch (e: any) {
    console.error("Error fetching public posts:", e.message, e.cause);
    return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * (PUBLIC) GET a single post by its slug.
 */
export async function handlePublicPostBySlug(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const slug = url.pathname.split('/').pop();
    
    if (!slug) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid slug' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const post = await env.FOREX_DB.prepare(
      "SELECT id, title, slug, excerpt, content, featured_image_url, author_name, author_url, published_at, updated_at, meta_title, meta_description, meta_keywords FROM posts WHERE slug = ? AND status = 'published'"
    ).bind(slug).first();

    if (!post) {
      return new Response(JSON.stringify({ success: false, error: 'Post not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ success: true, post: post }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache post detail for 1 hour
      },
    });
  } catch (e: any) {
    console.error("Error fetching post by slug:", e.message, e.cause);
    return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * (PUBLIC) GET latest rates as an image (for embedding).
 */
export async function handleImageApi(request: Request, env: Env): Promise<Response> {
  // This is a placeholder. Image generation logic needs to be implemented.
  return new Response(JSON.stringify({ error: 'Image API not implemented' }), {
    status: 501,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * (PUBLIC) GET list of dates for archive.
 */
export async function handleArchiveListApi(request: Request, env: Env): Promise<Response> {
  try {
    const { results } = await env.FOREX_DB.prepare(
      "SELECT DISTINCT date, updated_at FROM forex_rates ORDER BY date DESC"
    ).all();

    const dates = (results as { date: string, updated_at: string }[]).map(row => ({
        date: row.date,
        published_on: row.updated_at
    }));
    
    return new Response(JSON.stringify({ success: true, dates: dates, total: dates.length }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache archive list for 1 hour
      },
    });
  } catch (e: any) {
    console.error("Error fetching archive list:", e.message, e.cause);
    return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * (PUBLIC) GET rates data for a specific archive date.
 * This is the full version from your repo.
 */
export async function handleArchiveDetailApi(request: Request, env: Env): Promise<Response> {
    try {
        const url = new URL(request.url);
        const date = url.pathname.split('/').pop();
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return new Response(JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD.' }), { status: 400, headers: corsHeaders });
        }

        const row = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(date).first<any>();
        if (!row) {
            return new Response(JSON.stringify({ error: 'No data found for this date' }), { status: 404, headers: corsHeaders });
        }

        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = prevDate.toISOString().split('T')[0];
        const prevRow = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(prevDateStr).first<any>();

        const rates: any[] = [];
        let gainersCount = 0;
        let losersCount = 0;
        let topGainer = { currency: 'N/A', change: -Infinity };
        let topLoser = { currency: 'N/A', change: Infinity };
        let usdRate: number | null = null;
        let usdSell: number | null = null;

        CURRENCIES.forEach(code => {
            const info = CURRENCY_MAP[code] || { name: code, unit: 1, country: 'Unknown' };
            const buy = row[`${code}_buy`] ? parseFloat(row[`${code}_buy`]) : null;
            const sell = row[`${code}_sell`] ? parseFloat(row[`${code}_sell`]) : null;

            if (code === 'USD') {
                usdRate = buy;
                usdSell = sell;
            }
            
            if (buy === null && sell === null) return;

            let prevBuy = null;
            let change = null;
            if (prevRow) {
                prevBuy = prevRow[`${code}_buy`] ? parseFloat(prevRow[`${code}_buy`]) : null;
                if (buy !== null && prevBuy !== null) {
                    change = buy - prevBuy;
                    if (change > 0) {
                        gainersCount++;
                        if (change > topGainer.change) {
                            topGainer = { currency: code, change: change };
                        }
                    } else if (change < 0) {
                        losersCount++;
                        if (change < topLoser.change) {
                            topLoser = { currency: code, change: change };
                        }
                    }
                }
            }
            
            rates.push({
                currency: {
                    code: code,
                    name: info.name,
                    unit: info.unit,
                    country: info.country
                },
                buy: buy ? buy.toFixed(2) : null,
                sell: sell ? sell.toFixed(2) : null,
                change: change ? change.toFixed(2) : null
            });
        });
        
        const normalizedData = {
            date: row.date,
            published_on: row.created_at,
            modified_on: row.updated_at,
            rates: rates
        };

        // --- Generate Summary Paragraphs ---
        let gainerName = 'N/A';
        if (topGainer.currency !== 'N/A') {
            const gainerInfo = CURRENCY_MAP[topGainer.currency];
            if (gainerInfo) {
                gainerName = `${gainerInfo.name} (${topGainer.currency})`;
            } else {
                gainerName = topGainer.currency;
            }
        }

        let loserName = 'N/A';
        if (topLoser.currency !== 'N/A') {
            const loserInfo = CURRENCY_MAP[topLoser.currency];
            if (loserInfo) {
                loserName = `${loserInfo.name} (${topLoser.currency})`;
            } else {
                loserName = topLoser.currency;
            }
        }
        
        const intro = `Nepal Rastra Bank (NRB) published the official foreign exchange rates for ${formatDate(date)}. The U.S. Dollar settled at a buying rate of Rs. ${usdRate?.toFixed(2)} and a selling rate of Rs. ${usdSell?.toFixed(2)}.`;
        
        const summary = `Today's market saw mixed movements. The ${gainerName} was the top gainer, while the ${loserName} saw the most significant decline. In total, ${gainersCount} currencies gained value against the NPR, while ${losersCount} lost ground.`;

        const inrInfo = CURRENCY_MAP['INR'];
        const inrBuy = row['INR_buy'] ? (parseFloat(row['INR_buy']) / inrInfo.unit).toFixed(2) : 'N/A';
        const inrSell = row['INR_sell'] ? (parseFloat(row['INR_sell']) / inrInfo.unit).toFixed(2) : 'N/A';

        const detail = `The Indian Rupee (INR) remained fixed at Rs. ${inrBuy} (Buy) and Rs. ${inrSell} (Sell) per 1 unit. Other major currencies like the European Euro and UK Pound Sterling also saw adjustments in line with global market trends.`;

        const responseData = {
            success: true,
            data: normalizedData,
            paragraphs: {
                intro: intro,
                summary: summary,
                detail: detail
            }
        };

        return new Response(JSON.stringify(responseData), { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=86400' // Cache for 1 day
            } 
        });

    } catch (error: any) {
        console.error(`Error in handleArchiveDetailApi:`, error.message, error.cause);
        return new Response(JSON.stringify({ error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}
