import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

// Cloudflare Workers type declarations
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
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

// All supported currencies
const CURRENCIES = [
  'INR', 'USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD', 'SGD', 
  'JPY', 'CNY', 'SAR', 'QAR', 'THB', 'AED', 'MYR', 'KRW', 
  'SEK', 'DKK', 'HKD', 'KWD', 'BHD', 'OMR'
];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // API endpoint to check if data exists
    if (url.pathname === '/api/check-data') {
      return handleCheckData(request, env);
    }
    
    // API endpoint to fetch and store data
    if (url.pathname === '/api/fetch-and-store') {
      return handleFetchAndStore(request, env);
    }
    
    // API endpoint for D1 historical data
    if (url.pathname === '/api/historical-rates') {
      return handleHistoricalRates(request, env);
    }
    
    // Handle static assets
    try {
      return await getAssetFromKV(
        {
          request,
          waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: {},
        }
      );
    } catch (e) {
      // SPA fallback - serve index.html for all routes
      const indexRequest = new Request(new URL('/', request.url), request);
      try {
        return await getAssetFromKV(
          {
            request: indexRequest,
            waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: {},
          }
        );
      } catch (e) {
        return new Response('Not Found', { status: 404 });
      }
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(updateForexData(env));
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Check if data exists in DB for given date range
async function handleCheckData(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    const results = await env.FOREX_DB.prepare(
      `SELECT date FROM forex_rates WHERE date >= ? AND date <= ? ORDER BY date ASC`
    ).bind(fromDate, toDate).all();

    // Get all dates in range
    const existingDates = new Set(results.results.map((r: any) => r.date));
    
    // Calculate expected dates
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const expectedDates: string[] = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      expectedDates.push(formatDate(new Date(d)));
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
    console.error('Database error:', error);
    return new Response(JSON.stringify({ error: 'Database error', exists: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Fetch from API and store in DB
async function handleFetchAndStore(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    console.log(`Fetching data from NRB API: ${fromDate} to ${toDate}`);
    
    // Fetch from NRB API
    const response = await fetch(
      `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDate}&to=${toDate}`
    );
    
    if (!response.ok) {
      throw new Error(`NRB API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data?.data?.payload || data.data.payload.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No data available from API',
        data: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Store in database
    let storedCount = 0;
    for (const dayData of data.data.payload) {
      const dateStr = dayData.date;
      
      // Build the column values dynamically
      const columns: string[] = ['date', 'updated_at'];
      const placeholders: string[] = ['?', "datetime('now')"];
      const values: any[] = [dateStr];
      
      // Add each currency's buy/sell rates
      for (const rate of dayData.rates) {
        const currencyCode = rate.currency.iso3;
        if (CURRENCIES.includes(currencyCode)) {
          columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`);
          placeholders.push('?', '?');
          values.push(parseFloat(rate.buy), parseFloat(rate.sell));
        }
      }
      
      const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
      
      try {
        await env.FOREX_DB.prepare(query).bind(...values).run();
        storedCount++;
      } catch (err) {
        console.error(`Error storing data for ${dateStr}:`, err);
      }
    }
    
    console.log(`Stored ${storedCount} days of data`);

    return new Response(JSON.stringify({ 
      success: true, 
      stored: storedCount,
      fromDate,
      toDate
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching and storing data:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch and store data' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle historical rates API - returns data from DB
async function handleHistoricalRates(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const currencyCode = url.searchParams.get('currency');
  const fromDate = url.searchParams.get('from');
  const toDate = url.searchParams.get('to');

  if (!currencyCode || !fromDate || !toDate) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Query D1 database
    const results = await env.FOREX_DB.prepare(
      `SELECT date, ${currencyCode}_buy as buy_rate, ${currencyCode}_sell as sell_rate
       FROM forex_rates 
       WHERE date >= ? AND date <= ? AND ${currencyCode}_buy IS NOT NULL
       ORDER BY date ASC`
    ).bind(fromDate, toDate).all();

    return new Response(JSON.stringify({ 
      success: true, 
      data: results.results,
      currency: currencyCode
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Database error',
      data: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Scheduled function to update forex data daily at 5 AM Nepal time (23:15 UTC previous day)
async function updateForexData(env: Env): Promise<void> {
  try {
    // Get last 7 days to ensure we have recent data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const fromDateStr = formatDate(startDate);
    const toDateStr = formatDate(endDate);
    
    console.log(`Fetching forex data from ${fromDateStr} to ${toDateStr}`);
    
    // Fetch from NRB API
    const response = await fetch(
      `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDateStr}&to=${toDateStr}`
    );
    
    if (!response.ok) {
      throw new Error(`NRB API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data?.data?.payload) {
      let totalInserted = 0;
      
      for (const dayData of data.data.payload) {
        const dateStr = dayData.date;
        
        // Build the column values dynamically
        const columns: string[] = ['date', 'updated_at'];
        const placeholders: string[] = ['?', "datetime('now')"];
        const values: any[] = [dateStr];
        
        // Add each currency's buy/sell rates
        for (const rate of dayData.rates) {
          const currencyCode = rate.currency.iso3;
          if (CURRENCIES.includes(currencyCode)) {
            columns.push(`${currencyCode}_buy`, `${currencyCode}_sell`);
            placeholders.push('?', '?');
            values.push(parseFloat(rate.buy), parseFloat(rate.sell));
          }
        }
        
        const query = `INSERT OR REPLACE INTO forex_rates (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
        
        try {
          await env.FOREX_DB.prepare(query).bind(...values).run();
          totalInserted++;
        } catch (err) {
          console.error(`Error inserting data for ${dateStr}:`, err);
        }
      }
      
      console.log(`Successfully updated ${totalInserted} days of forex rates`);
    } else {
      console.log('No data payload received from NRB API');
    }
  } catch (error) {
    console.error('Error updating forex data:', error);
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
