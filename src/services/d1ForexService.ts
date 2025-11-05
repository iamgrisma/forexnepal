// src/services/d1ForexService.ts

import { fetchForexRatesByDate, fetchHistoricalRates, splitDateRangeForRequests, formatDate } from './forexService';
import type { ChartDataPoint, Rate, RatesData } from '../types/forex';

export interface FetchProgress {
  stage: 'checking' | 'fetching' | 'storing' | 'loading' | 'complete' | 'error';
  message: string;
  chunkInfo?: {
    current: number;
    total: number;
    fromDate: string;
    toDate: string;
  };
}
export type ProgressCallback = (progress: FetchProgress | null) => void;

// --- (checkDataExists, groupDatesIntoRanges, fetchAndStore remain unchanged) ---
async function checkDataExists(fromDate: string, toDate: string): Promise<{
    exists: boolean;
    missingDateRanges: Array<{ from: string; to: string }>;
}> {
   try {
    const response = await fetch(`/api/check-data?from=${fromDate}&to=${toDate}`);
    if (response.ok) {
        const data = await response.json();
        const missingDates = data.missingDates || [];
        const missingDateRanges = groupDatesIntoRanges(missingDates);
        const exists = missingDates.length === 0 && data.expectedCount > 0;
        return { exists: exists, missingDateRanges };
    }
  } catch (error) {
    console.error('Error checking data existence:', error);
  }
  return { exists: false, missingDateRanges: [{ from: fromDate, to: toDate }] };
}

function groupDatesIntoRanges(dates: string[]): Array<{ from: string; to: string }> {
  if (dates.length === 0) return [];
  const sortedDates = [...dates].sort();
  const ranges: Array<{ from: string; to: string }> = [];
  let rangeStart = sortedDates[0];
  let rangeEnd = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i] + 'T00:00:00Z');
    const prevDate = new Date(sortedDates[i - 1] + 'T00:00:00Z');
     const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (dayDiff <= 1) {
      rangeEnd = sortedDates[i];
    } else {
      ranges.push({ from: rangeStart, to: rangeEnd });
      rangeStart = sortedDates[i];
      rangeEnd = sortedDates[i];
    }
  }
  ranges.push({ from: rangeStart, to: rangeEnd });
  return ranges;
}

async function fetchAndStore(fromDate: string, toDate: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/fetch-and-store?from=${fromDate}&to=${toDate}`, { method: 'POST' });
    if (response.ok) {
      const data = await response.json();
      return data.success === true;
    }
  } catch (error) {
    console.error('Error fetching and storing data:', error);
  }
  return false;
}

// --- (fetchFromD1ForConverter remains unchanged) ---
async function fetchFromD1ForConverter(date: string): Promise<RatesData | null> {
  try {
    const response = await fetch(
      `/api/historical-rates?from=${date}&to=${date}`
    );

    if (response.ok) {
      const data: RatesData | null = await response.json();
      if (data && data.rates && Array.isArray(data.rates) && data.rates.length > 0) {
        return data;
      }
      return null;
    } else {
        console.warn(`Non-OK response from D1 fetch for ${date}: ${response.status}`);
        return null;
    }
  } catch (error) {
    console.error(`Error fetching from D1 for converter (${date}):`, error);
    return null;
  }
}

// --- fetchRatesForDateWithCache (DB First, API Fallback) ---
// This is used by the Converter page and as the fallback for the Homepage
export async function fetchRatesForDateWithCache(
  date: string,
  onProgress: ProgressCallback | null
): Promise<RatesData | null> {
  try {
    onProgress?.({ stage: 'loading', message: `Checking database for ${date}...` });
    const d1Data = await fetchFromD1ForConverter(date);

    if (d1Data) {
      console.log(`[D1] Cache hit for ${date}. Using data from D1.`);
      onProgress?.({ stage: 'complete', message: `Rates for ${date} loaded from database.` });
      return d1Data;
    }

    onProgress?.({ stage: 'fetching', message: `No data in database for ${date}. Fetching from NRB API...` });
    console.warn(`[D1] Cache miss for ${date}. Fetching directly from NRB.`);
    
    const dateObj = new Date(date + 'T00:00:00');
    if (isNaN(dateObj.getTime())) {
        console.error(`[D1] Invalid date string provided: ${date}`);
        onProgress?.({ stage: 'error', message: `Invalid date format: ${date}.` });
        return null;
    }

    const apiResponse = await fetchForexRatesByDate(dateObj); 

    if (apiResponse && apiResponse.data && apiResponse.data.payload && apiResponse.data.payload.length > 0) {
      const ratesPayload = apiResponse.data.payload[0];
      onProgress?.({ stage: 'complete', message: `Rates for ${date} loaded from NRB API.` });

       fetch(`/api/fetch-and-store?from=${date}&to=${date}`, { method: 'POST' })
           .then(res => res.json())
           .then(storeResult => {
               if(storeResult.success) console.log(`[D1] Successfully stored ${date} data from API fallback.`);
               else console.warn(`[D1] Failed to store ${date} data into D1 after API fallback.`);
            })
           .catch(err => console.error(`[D1] Error triggering background store for ${date}:`, err));

      return ratesPayload;
    } else {
      onProgress?.({ stage: 'complete', message: `No rates found for ${date} from NRB API either.` });
      console.warn(`[D1] No data found for ${date} from NRB API fallback.`);
      return null;
    }

  } catch (error) {
    console.error(`[D1] Error fetching rates for ${date} (DB & API):`, error);
    onProgress?.({ stage: 'error', message: `Failed to load rates for ${date}.` });
    return null;
  } finally {
      if (onProgress) {
        setTimeout(() => onProgress(null), 2500);
      }
  }
}


// --- MODIFIED: fetchFromD1 (Helper for Charts - Fetches specific currency) ---
// Now accepts a sampling parameter
async function fetchFromD1(
  currencyCode: string,
  fromDate: string,
  toDate: string,
  sampling: 'daily' | 'weekly' | '15day' | 'monthly' = 'daily' // Add sampling
): Promise<ChartDataPoint[]> {
  try {
    const response = await fetch(
      // Pass sampling parameter to the worker API
      `/api/historical-rates?currency=${currencyCode}&from=${fromDate}&to=${toDate}&sampling=${sampling}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        return data.data;
      }
    }
  } catch (error) {
    console.error(`Error fetching ${currencyCode} from D1:`, error);
  }
  return []; // Return empty array on failure
}

// --- NEW FUNCTION: Fetch High/Low Stats ---
// This calls the new /api/historical-stats endpoint
export async function fetchHistoricalStats(
  currencies: string[],
  fromDate: string,
  toDate: string
): Promise<{ [key: string]: any } | null> {
  try {
    const response = await fetch('/api/historical-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currencies: currencies,
        dateRange: { from: fromDate, to: toDate }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data.data; // Returns the map { USD: { highBuy: ... }, ... }
      }
    } else {
       console.error(`Error fetching historical stats: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error fetching historical stats:', error);
  }
  return null;
}


// --- MODIFIED: fetchHistoricalRatesWithCache (FOR CHARTS) ---
// Now accepts a sampling parameter
export async function fetchHistoricalRatesWithCache(
  currencyCode: string,
  fromDate: string,
  toDate: string,
  onProgress?: ProgressCallback,
  sampling: 'daily' | 'weekly' | '15day' | 'monthly' = 'daily' // Add sampling
): Promise<ChartDataPoint[]> {
  try {
    onProgress?.({ stage: 'checking', message: 'Checking database...' });
    // Check for *all* dates, not just sampled ones
    const { exists, missingDateRanges } = await checkDataExists(fromDate, toDate);

    if (!exists && missingDateRanges.length > 0) {
      onProgress?.({ stage: 'fetching', message: `Fetching missing ${missingDateRanges.length} date range(s) from API...` });

      let totalChunks = 0;
      missingDateRanges.forEach(range => {
          const rangeStart = new Date(range.from + 'T00:00:00Z');
          const rangeEnd = new Date(range.to + 'T00:00:00Z');
          if (!isNaN(rangeStart.getTime()) && !isNaN(rangeEnd.getTime())) {
             totalChunks += splitDateRangeForRequests(rangeStart, rangeEnd).length;
          }
      });

      let processedChunks = 0;
      for (const missingRange of missingDateRanges) {
         const rangeStart = new Date(missingRange.from + 'T00:00:00Z');
         const rangeEnd = new Date(missingRange.to + 'T00:00:00Z');
         if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) continue;

         const dateRanges = splitDateRangeForRequests(rangeStart, rangeEnd);
         for (let i = 0; i < dateRanges.length; i++) {
            const range = dateRanges[i];
            processedChunks++;
            onProgress?.({
                stage: 'fetching',
                message: `Fetching chunk ${processedChunks} of ${totalChunks}...`,
                chunkInfo: { current: processedChunks, total: totalChunks, fromDate: range.from, toDate: range.to }
            });

            const success = await fetchAndStore(range.from, range.to);

             if (success) {
                onProgress?.({ stage: 'storing', message: `Stored data from ${range.from} to ${range.to}.`, chunkInfo: { current: processedChunks, total: totalChunks, fromDate: range.from, toDate: range.to }});
             } else {
                onProgress?.({ stage: 'error', message: `Failed to fetch/store chunk ${processedChunks}.`, chunkInfo: { current: processedChunks, total: totalChunks, fromDate: range.from, toDate: range.to }});
                 console.warn(`Failed to fetch/store chunk ${processedChunks} (${range.from} - ${range.to})`);
             }
             if (processedChunks < totalChunks) await new Promise(resolve => setTimeout(resolve, 300));
         }
      }
    }

    onProgress?.({ stage: 'loading', message: 'Loading data from database...' });
    // Pass the sampling parameter to the D1 fetcher
    let data = await fetchFromD1(currencyCode, fromDate, toDate, sampling);

    if (data.length > 0) {
      // Don't fill gaps on sampled data, it creates incorrect straight lines.
      // Gaps will be filled only on full daily data.
      onProgress?.({ stage: 'complete', message: 'Chart data loaded successfully!' });
      return data;
    }

    // Fallback: If DB fetch yields no results
    onProgress?.({ stage: 'fetching', message: 'Database empty/failed. Fetching chart data directly from API...' });
    console.warn(`No data found in D1 for ${currencyCode} (${fromDate} - ${toDate}). Using API fallback for chart.`);
    const fallbackData = await fetchFromAPIFallback(currencyCode, fromDate, toDate);
    if(fallbackData.length > 0) {
        onProgress?.({ stage: 'complete', message: 'Chart data loaded from API fallback.' });
        return fillMissingDatesWithPreviousData(fallbackData, fromDate, toDate); // Fill gaps in fallback data
    } else {
        onProgress?.({ stage: 'error', message: 'Failed to load chart data from DB and API.' });
        return [];
    }

  } catch (error) {
    console.error('Error in fetchHistoricalRatesWithCache:', error);
    onProgress?.({ stage: 'error', message: 'An error occurred fetching chart data.' });
    return [];
  } finally {
     if (onProgress) {
        setTimeout(() => onProgress(null), 2500);
     }
  }
}

// --- (fillMissingDatesWithPreviousData remains unchanged) ---
function fillMissingDatesWithPreviousData(
  data: ChartDataPoint[],
  fromDate: string,
  toDate: string
): ChartDataPoint[] {
  if (data.length === 0) return [];
  const filledData: ChartDataPoint[] = [];
  const dataMap = new Map(data.map(d => [d.date, d]));
  const start = new Date(fromDate + 'T00:00:00Z');
  const end = new Date(toDate + 'T00:00:00Z');
  let previousDataPoint: ChartDataPoint | null = data[0]; 

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (isNaN(d.getTime())) continue;
    const dateStr = formatDate(d); 
    if (dataMap.has(dateStr)) {
      const currentData = dataMap.get(dateStr)!;
      const pointToAdd: ChartDataPoint = {
          date: dateStr,
          buy: currentData.buy ?? previousDataPoint?.buy ?? 0,
          sell: currentData.sell ?? previousDataPoint?.sell ?? 0
      };
      filledData.push(pointToAdd);
      previousDataPoint = pointToAdd;
    } else if (previousDataPoint) {
      filledData.push({
        date: dateStr,
        buy: previousDataPoint.buy ?? 0,
        sell: previousDataPoint.sell ?? 0
      });
    } else {
        filledData.push({ date: dateStr, buy: 0, sell: 0 });
    }
  }
  return filledData;
}

// --- (fetchFromAPIFallback remains unchanged, it correctly fetches chunks) ---
async function fetchFromAPIFallback(
  currencyCode: string,
  fromDate: string,
  toDate: string
): Promise<ChartDataPoint[]> {
  try {
    const fromDateObj = new Date(fromDate + 'T00:00:00Z');
    const toDateObj = new Date(toDate + 'T00:00:00Z');
     if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
         console.error("Invalid date range for API fallback:", fromDate, toDate);
         return [];
     }

    const dateRanges = splitDateRangeForRequests(fromDateObj, toDateObj);
    let allData: ChartDataPoint[] = [];

    for (const range of dateRanges) {
      const histData = await fetchHistoricalRates(range.from, range.to); 

      if (histData.status.code === 200 && histData.payload.length > 0) {
        histData.payload.forEach((dayData) => {
          const currencyRate = dayData.rates.find(
            (rate) => rate.currency.iso3 === currencyCode
          );

          if (currencyRate) {
              const buyVal = parseFloat(currencyRate.buy.toString());
              const sellVal = parseFloat(currencyRate.sell.toString());
            allData.push({
              date: dayData.date,
              buy: isNaN(buyVal) ? 0 : buyVal,
              sell: isNaN(sellVal) ? 0 : sellVal,
            });
          } else {
              allData.push({ date: dayData.date, buy: 0, sell: 0 });
          }
        });
      }
       if (dateRanges.length > 1) await new Promise(res => setTimeout(res, 100));
    }

     allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
     return allData;

  } catch (error) {
    console.error('API fallback error:', error);
    return [];
  }
}
