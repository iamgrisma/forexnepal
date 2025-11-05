// src/services/d1ForexService.ts

// Import functions for direct API calls and types
import { fetchForexRatesByDate, fetchHistoricalRates, splitDateRangeForRequests, formatDate } from './forexService';
import type { ChartDataPoint, Rate, RatesData, HistoricalRates as ApiHistoricalRates } from '../types/forex'; // Ensure Rate and RatesData are imported

// Define progress types (keep as is)
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
export type ProgressCallback = (progress: FetchProgress | null) => void; // Allow null to clear progress

// --- checkDataExists, groupDatesIntoRanges, fetchAndStore (Keep as they are for historical charts) ---
// (These functions are primarily used by fetchHistoricalRatesWithCache for charts, not the converter's fetchRatesForDateWithCache)
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
        // Ensure 'exists' reflects if *all* dates are present
        const exists = missingDates.length === 0 && data.expectedCount > 0;
        return { exists: exists, missingDateRanges };
    }
  } catch (error) {
    console.error('Error checking data existence:', error);
  }
  // If check fails, assume nothing exists for the full range
  return { exists: false, missingDateRanges: [{ from: fromDate, to: toDate }] };
}

function groupDatesIntoRanges(dates: string[]): Array<{ from: string; to: string }> {
  if (dates.length === 0) return [];
  const sortedDates = [...dates].sort();
  const ranges: Array<{ from: string; to: string }> = [];
  let rangeStart = sortedDates[0];
  let rangeEnd = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i] + 'T00:00:00Z'); // Use UTC for comparison
    const prevDate = new Date(sortedDates[i - 1] + 'T00:00:00Z'); // Use UTC
     // Check difference in days robustly
     const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (dayDiff <= 1) { // Allows for consecutive days
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
    // Ensure the API call uses POST if required by the worker, or keep GET if appropriate
    const response = await fetch(`/api/fetch-and-store?from=${fromDate}&to=${toDate}`, { method: 'POST' }); // Use POST if needed
    if (response.ok) {
      const data = await response.json();
      return data.success === true;
    }
  } catch (error) {
    console.error('Error fetching and storing data:', error);
  }
  return false;
}

// --- fetchFromD1ForConverter (Helper for Converter) ---
// Fetches all rates for a single date from the worker API
async function fetchFromD1ForConverter(date: string): Promise<RatesData | null> {
  try {
    const response = await fetch(
      `/api/historical-rates?from=${date}&to=${date}` // No currency param needed
    );

    if (response.ok) {
       // Worker should return RatesData directly or null when no currency is specified
      const data: RatesData | null = await response.json();
      // Ensure the returned data is valid RatesData (has rates array)
      if (data && data.rates && Array.isArray(data.rates) && data.rates.length > 0) {
        return data;
      }
      return null; // Return null if response is ok but data is empty/null/invalid
    } else {
        console.warn(`Non-OK response from D1 fetch for ${date}: ${response.status}`);
        return null; // Return null for non-OK responses (like 404)
    }
  } catch (error) {
    console.error(`Error fetching from D1 for converter (${date}):`, error);
    return null; // Return null on network or parsing error
  }
}

// --- fetchRatesForDateWithCache (FOR CONVERTER - DB First, API Fallback) ---
export async function fetchRatesForDateWithCache(
  date: string, // Expect 'yyyy-MM-dd' format
  onProgress: ProgressCallback | null
): Promise<RatesData | null> {
  try {
    onProgress?.({ stage: 'loading', message: `Checking database for ${date}...` });

    // Step 1: Try fetching from D1 via the worker API endpoint
    const d1Data = await fetchFromD1ForConverter(date);

    if (d1Data) {
      console.log(`Cache hit for ${date}. Using data from D1.`);
      onProgress?.({ stage: 'complete', message: `Rates for ${date} loaded from database.` });
      // Ensure the structure matches RatesData
      return d1Data;
    }

    // Step 2: Fallback - D1 data not found or empty, fetch directly from NRB API
    onProgress?.({ stage: 'fetching', message: `No data in database for ${date}. Fetching from NRB API...` });
    console.warn(`Cache miss for ${date}. Fetching directly from NRB.`);

    // Convert 'yyyy-MM-dd' string back to Date object for fetchForexRatesByDate
    // Add time component and handle potential timezone issues if necessary
    const dateObj = new Date(date + 'T00:00:00'); // Assuming local timezone is acceptable, or use UTC T00:00:00Z
    if (isNaN(dateObj.getTime())) {
        console.error(`Invalid date string provided to fetchRatesForDateWithCache: ${date}`);
        onProgress?.({ stage: 'error', message: `Invalid date format: ${date}.` });
        return null;
    }

    const apiResponse = await fetchForexRatesByDate(dateObj); // Pass Date object

    // Check if the API call was successful and returned data
    if (apiResponse && apiResponse.data && apiResponse.data.payload && apiResponse.data.payload.length > 0) {
      const ratesPayload = apiResponse.data.payload[0]; // Get the first (and only) payload entry for the date
      onProgress?.({ stage: 'complete', message: `Rates for ${date} loaded from NRB API.` });

      // Optional: Trigger background storage to D1 (fire-and-forget)
      // This helps populate the cache for future requests
       fetch(`/api/fetch-and-store?from=${date}&to=${date}`, { method: 'POST' })
           .then(res => res.json())
           .then(storeResult => {
               if(storeResult.success) console.log(`Successfully stored ${date} data fetched from API into D1.`);
               else console.warn(`Failed to store ${date} data into D1 after API fallback.`);
            })
           .catch(err => console.error(`Error triggering background store for ${date}:`, err));


      return ratesPayload; // Return the fetched data
    } else {
      // API call failed or returned no data (e.g., holiday)
      onProgress?.({ stage: 'complete', message: `No rates found for ${date} from NRB API either.` });
      console.warn(`No data found for ${date} from NRB API fallback.`);
      return null;
    }

  } catch (error) {
    console.error(`Error fetching rates for ${date} (DB & API):`, error);
    onProgress?.({ stage: 'error', message: `Failed to load rates for ${date}.` });
    return null; // Return null on any critical error
  } finally {
      // Clear progress message after a short delay
      if (onProgress) {
        setTimeout(() => onProgress(null), 2500);
      }
  }
}


// --- fetchFromD1 (Helper for Charts - Fetches specific currency) ---
// --- UPDATED FOR TASK 2: Add sampling parameter ---
async function fetchFromD1(
  currencyCode: string, 
  fromDate: string, 
  toDate: string,
  sampling: string = 'daily' // Add sampling parameter
): Promise<ChartDataPoint[]> {
  try {
    // Add sampling to the query string
    const response = await fetch(
      `/api/historical-rates?currency=${currencyCode}&from=${fromDate}&to=${toDate}&sampling=${sampling}`
    );

    if (response.ok) {
      const data = await response.json();
      // Expect { success: true, data: ChartDataPoint[] } from worker when currencyCode is present
      if (data.success && Array.isArray(data.data)) {
        return data.data;
      }
    }
  } catch (error) {
    console.error(`Error fetching ${currencyCode} from D1:`, error);
  }
  return []; // Return empty array on failure
}
// --- END OF TASK 2 UPDATE ---


// --- fetchHistoricalRatesWithCache (FOR CHARTS - More complex logic with chunking) ---
// --- UPDATED FOR TASK 2: Add sampling parameter ---
export async function fetchHistoricalRatesWithCache(
  currencyCode: string,
  fromDate: string,
  toDate: string,
  onProgress?: ProgressCallback,
  sampling: string = 'daily' // Add sampling parameter
): Promise<ChartDataPoint[]> {
  try {
    onProgress?.({ stage: 'checking', message: 'Checking database...' });
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
         if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) continue; // Skip invalid ranges

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
                 // Decide if you want to stop or continue on chunk failure
             }
             if (processedChunks < totalChunks) await new Promise(resolve => setTimeout(resolve, 300)); // Small delay
         }
      }
    }

    onProgress?.({ stage: 'loading', message: 'Loading data from database...' });
    // Pass the sampling parameter to the D1 fetcher
    let data = await fetchFromD1(currencyCode, fromDate, toDate, sampling);

    if (data.length > 0) {
      // Only fill gaps if we are NOT sampling
      if (sampling === 'daily') {
        data = fillMissingDatesWithPreviousData(data, fromDate, toDate);
      }
      onProgress?.({ stage: 'complete', message: 'Chart data loaded successfully!' });
      return data;
    }

    // Fallback: If DB fetch (even after attempting to fill) yields no results, try direct API as last resort
    onProgress?.({ stage: 'fetching', message: 'Database empty/failed. Fetching chart data directly from API...' });
    console.warn(`No data found in D1 for ${currencyCode} (${fromDate} - ${toDate}). Using API fallback for chart.`);
    const fallbackData = await fetchFromAPIFallback(currencyCode, fromDate, toDate);
    if(fallbackData.length > 0) {
        onProgress?.({ stage: 'complete', message: 'Chart data loaded from API fallback.' });
        // Only fill gaps if we are NOT sampling
        if (sampling === 'daily') {
          return fillMissingDatesWithPreviousData(fallbackData, fromDate, toDate);
        }
        return fallbackData; // Return raw data if sampling (gaps are expected)
    } else {
        onProgress?.({ stage: 'error', message: 'Failed to load chart data from DB and API.' });
        return []; // Return empty if fallback also fails
    }

  } catch (error) {
    console.error('Error in fetchHistoricalRatesWithCache:', error);
    onProgress?.({ stage: 'error', message: 'An error occurred fetching chart data.' });
    return []; // Return empty on critical error
  } finally {
     if (onProgress) {
        setTimeout(() => onProgress(null), 2500); // Clear progress message
     }
  }
}
// --- END OF TASK 2 UPDATE ---


/**
 * --- NEW FUNCTION FOR TASK 1 ---
 * Fetches high/low stats for a list of currencies over a date range.
 * This calls the new POST /api/historical-stats endpoint.
 */
export async function fetchHistoricalStats(
  currencies: string[],
  fromDate: string,
  toDate: string
): Promise<any | null> { // Returns the 'stats' object from the worker
  try {
    const response = await fetch(
      `/api/historical-stats`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRange: { from: fromDate, to: toDate },
          currencies: currencies
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return data.stats; // Returns { USD: { highBuy: ... }, EUR: { ... } }
      }
    }
    console.error('Failed to fetch historical stats, server responded with error.');
    return null; // Return null if fetch failed or API returned success: false
  } catch (error) {
    console.error('Error fetching historical stats:', error);
    return null;
  }
}
// --- END OF TASK 1 FUNCTION ---


// --- fillMissingDatesWithPreviousData & fetchFromAPIFallback (Keep as they are) ---
function fillMissingDatesWithPreviousData(
  data: ChartDataPoint[],
  fromDate: string,
  toDate: string
): ChartDataPoint[] {
  if (data.length === 0) return [];
  const filledData: ChartDataPoint[] = [];
  const dataMap = new Map(data.map(d => [d.date, d]));
  const start = new Date(fromDate + 'T00:00:00Z'); // Use UTC
  const end = new Date(toDate + 'T00:00:00Z');     // Use UTC
  
  // Find the first available data point *at or before* the start date
  let previousDataPoint: ChartDataPoint | null = null;
  for (let i = 0; i < data.length; i++) {
      if (new Date(data[i].date + 'T00:00:00Z') <= start) {
          previousDataPoint = data[i];
          // Use the closest one to the start date
      } else if (!previousDataPoint) {
          // If start date is before *any* data, use the very first data point
          previousDataPoint = data[0];
          break;
      } else {
          // We found the last point before the start date
          break;
      }
  }
  // If no data point was found (e.g., all data is after start), use the first one
  if (!previousDataPoint && data.length > 0) {
      previousDataPoint = data[0];
  }


  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Check for invalid date objects
    if (isNaN(d.getTime())) continue;

    const dateStr = formatDate(d); // Get 'yyyy-MM-dd' string

    if (dataMap.has(dateStr)) {
      const currentData = dataMap.get(dateStr)!;
      // Ensure buy/sell are numbers, default to previous if null/undefined
      const pointToAdd: ChartDataPoint = {
          date: dateStr,
          buy: currentData.buy ?? previousDataPoint?.buy ?? 0,
          sell: currentData.sell ?? previousDataPoint?.sell ?? 0
      };
      // Only push if rates are valid
      if (pointToAdd.buy > 0 || pointToAdd.sell > 0) {
        filledData.push(pointToAdd);
      }
      previousDataPoint = pointToAdd; // Update the last known good data point
    } else if (previousDataPoint) {
      // Use previous day's data, ensuring buy/sell are numbers
       const pointToAdd: ChartDataPoint = {
        date: dateStr,
        buy: previousDataPoint.buy ?? 0, // Fallback to 0 if even previous is somehow null
        sell: previousDataPoint.sell ?? 0
      };
       // Only push if rates are valid
      if (pointToAdd.buy > 0 || pointToAdd.sell > 0) {
         filledData.push(pointToAdd);
      }
      // Do NOT update previousDataPoint here, keep the last *actual* data point
    } else {
        // Very start of the range and no data, push with 0 or handle as needed
        // We'll just skip this day, as there's no data to fill from
        // filledData.push({ date: dateStr, buy: 0, sell: 0 });
    }
  }
  return filledData;
}

async function fetchFromAPIFallback(
  currencyCode: string,
  fromDate: string,
  toDate: string
): Promise<ChartDataPoint[]> {
  try {
    const fromDateObj = new Date(fromDate + 'T00:00:00Z'); // Use UTC
    const toDateObj = new Date(toDate + 'T00:00:00Z');     // Use UTC
     if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
         console.error("Invalid date range for API fallback:", fromDate, toDate);
         return [];
     }

    const dateRanges = splitDateRangeForRequests(fromDateObj, toDateObj); // Use the helper
    let allData: ChartDataPoint[] = [];

    for (const range of dateRanges) {
      const histData: ApiHistoricalRates = await fetchHistoricalRates(range.from, range.to); // Direct NRB call

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
              // Use null if parsing fails, let fillMissingDates handle it
              buy: isNaN(buyVal) ? 0 : buyVal, // Default to 0 instead of null for charts
              sell: isNaN(sellVal) ? 0 : sellVal,
            });
          } else {
              // Add entry with 0 if currency not found for that day, to avoid gaps before filling
              allData.push({ date: dayData.date, buy: 0, sell: 0 });
          }
        });
      }
        // Add a small delay between chunks if needed
       if (dateRanges.length > 1) await new Promise(res => setTimeout(res, 100));
    }

     // Sort before returning, as API chunks might arrive out of order
     allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
     return allData;

  } catch (error) {
    console.error('API fallback error:', error);
    return [];
  }
}
