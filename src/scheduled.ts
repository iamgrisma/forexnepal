// src/scheduled.ts
import { Env, ScheduledEvent, D1Database, D1PreparedStatement } from './worker-types';
import { CURRENCIES } from './constants';
import { formatDate } from './worker-utils';

/**
 * Processes raw NRB API data and prepares D1 batch statements.
 */
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

/**
 * Copies the previous day's rates to today's date if NRB fails to publish.
 */
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

/**
 * The main scheduled event handler (cron job).
 */
export async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
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
