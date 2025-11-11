// src/scheduled.ts
import { Env, ExecutionContext, ScheduledEvent, D1Database } from './worker-types';
import { CURRENCIES, CURRENCY_MAP } from './constants';
import { formatDate } from './worker-utils';
import { handleSitemap } from './sitemapGenerator';
import { pruneApiUsageLogs } from './api-helpers'; // NEW: Import log pruner

interface NrbRate {
    date: string; // "2024-07-20"
    published_on: string; // "2024-07-20T10:00:00+05:45"
    modified_on: string; // "2024-07-20T10:00:00+05:45"
    rates: NrbCurrencyRate[];
}

interface NrbCurrencyRate {
    currency: {
        iso3: string; // "USD"
        name: string;
        unit: number;
    };
    buy: string; // "133.50"
    sell: string; // "134.10"
}

interface NrbApiResponse {
    status: {
        code: number;
        message: string;
    };
    payload: NrbRate[];
    pagination: {
        page: number;
        per_page: number;
        total_pages: number;
        total: number;
    };
}

/**
 * Parses and stores API data in D1.
 */
export async function processAndStoreApiData(
    data: NrbApiResponse,
    env: Env,
    mode: 'update' | 'replace' = 'update'
): Promise<number> {
    if (!data.payload || data.payload.length === 0) {
        console.log('No payload in NRB data, skipping storage.');
        return 0;
    }

    const stmts: D1PreparedStatement[] = [];
    const datesProcessed = new Set<string>();

    for (const dayData of data.payload) {
        const date = dayData.date;
        datesProcessed.add(date);

        const wideColumns: string[] = ['date', 'updated_at'];
        const widePlaceholders: string[] = ['?', "datetime('now')"];
        const wideValues: (string | number | null)[] = [date];

        let validRatesFound = false;

        for (const rate of dayData.rates) {
            const code = rate.currency.iso3;
            if (CURRENCIES.includes(code)) {
                const unit = CURRENCY_MAP[code]?.unit || rate.currency.unit || 1;
                
                // Parse buy/sell rates, handling "N/A" or empty strings
                const buyRate = parseFloat(rate.buy);
                const sellRate = parseFloat(rate.sell);
                
                // Use per-unit rate
                const buyPerUnit = !isNaN(buyRate) ? buyRate / unit : null;
                const sellPerUnit = !isNaN(sellRate) ? sellRate / unit : null;

                wideColumns.push(`"${code}_buy"`, `"${code}_sell"`);
                widePlaceholders.push('?', '?');
                wideValues.push(buyPerUnit, sellPerUnit);
                
                if (buyPerUnit !== null || sellPerUnit !== null) {
                    validRatesFound = true;
                }
            }
        }

        if (validRatesFound) {
            const query = (mode === 'replace')
                ? `INSERT OR REPLACE INTO forex_rates (${wideColumns.join(', ')}) VALUES (${widePlaceholders.join(', ')})`
                : `INSERT OR IGNORE INTO forex_rates (${wideColumns.join(', ')}) VALUES (${widePlaceholders.join(', ')})`;
            
            stmts.push(env.FOREX_DB.prepare(query).bind(...wideValues));
        }
    }

    if (stmts.length > 0) {
        await env.FOREX_DB.batch(stmts);
        console.log(`Successfully stored/updated data for ${stmts.length} dates.`);
    }

    return datesProcessed.size;
}

/**
 * Main scheduled event handler.
 */
export async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`Scheduled event triggered at: ${new Date(event.scheduledTime).toISOString()}`);
    
    const nowUtc = new Date();
    const nptOffsetMs = (5 * 60 + 45) * 60 * 1000;
    const nowNpt = new Date(nowUtc.getTime() + nptOffsetMs);
    const todayStr = formatDate(nowNpt);

    // 1. Fetch data from NRB API
    const apiUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=1&from=${todayStr}&to=${todayStr}`;
    
    try {
        const response = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) {
            if (response.status === 404) {
                 console.log('No data available from NRB for today yet.');
            } else {
                throw new Error(`NRB API request failed with status ${response.status}`);
            }
        } else {
            const data = await response.json<NrbApiResponse>();
            await processAndStoreApiData(data, env, 'replace'); // Use 'replace' to ensure today's data is updated
        }
    } catch (error: any) {
        console.error('Error fetching or storing NRB data:', error.message, error.cause);
    }
    
    // 2. Regenerate Sitemap
    try {
        // We pass a dummy request to satisfy the handler's signature
        const dummyRequest = new Request('https://forex.grisma.com.np/sitemap.xml');
        await handleSitemap(dummyRequest, env);
        console.log('Sitemap regeneration complete.');
    } catch (error: any) {
        console.error('Error regenerating sitemap:', error.message, error.cause);
    }
    
    // 3. NEW: Prune old API usage logs
    try {
        await pruneApiUsageLogs(env.FOREX_DB);
        console.log('Pruned old API usage logs.');
    } catch (error: any) {
        console.error('Error pruning API usage logs:', error.message, error.cause);
    }
}
