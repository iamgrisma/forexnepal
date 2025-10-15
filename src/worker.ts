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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
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

// Handle historical rates API
async function handleHistoricalRates(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const currencyCode = url.searchParams.get('currency');
  const fromDate = url.searchParams.get('from');
  const toDate = url.searchParams.get('to');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!currencyCode || !fromDate || !toDate) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Query D1 database
    const results = await env.FOREX_DB.prepare(
      `SELECT date, buy_rate, sell_rate, currency_name
       FROM forex_rates 
       WHERE currency_code = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`
    ).bind(currencyCode, fromDate, toDate).all();

    if (results.results.length === 0) {
      // Fallback to NRB API if no data in D1
      const nrbData = await fetchFromNRB(fromDate, toDate);
      return new Response(JSON.stringify(nrbData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, data: results.results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database error:', error);
    // Fallback to NRB API on error
    try {
      const nrbData = await fetchFromNRB(fromDate, toDate);
      return new Response(JSON.stringify(nrbData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
}

// Fetch from NRB API
async function fetchFromNRB(fromDate: string, toDate: string): Promise<any> {
  const response = await fetch(
    `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDate}&to=${toDate}`
  );
  
  if (!response.ok) {
    throw new Error(`NRB API error: ${response.status}`);
  }
  
  return response.json();
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
        const publishedDate = dayData.date;
        
        for (const rate of dayData.rates) {
          try {
            await env.FOREX_DB.prepare(
              `INSERT OR REPLACE INTO forex_rates 
               (currency_code, currency_name, date, buy_rate, sell_rate, updated_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'))`
            ).bind(
              rate.currency.iso3,
              rate.currency.name,
              publishedDate,
              parseFloat(rate.buy),
              parseFloat(rate.sell)
            ).run();
            
            totalInserted++;
          } catch (err) {
            console.error(`Error inserting rate for ${rate.currency.iso3} on ${publishedDate}:`, err);
          }
        }
      }
      
      console.log(`Successfully updated ${totalInserted} forex rates`);
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
