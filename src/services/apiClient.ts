import { fetchForexRatesByDate, fetchPreviousDayRates } from './forexService';
import { fetchRatesForDateWithCache } from './d1ForexService';
import { RatesData, ForexResponse } from '@/types/forex';
import { format, subDays } from 'date-fns';

const API_TIMEOUT = 10000; // 10 seconds

/**
 * Creates a promise that rejects after a specified timeout.
 */
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('API request timed out')), ms)
  );
}

/**
 * Fetches rates for a specific date using an "API-First, DB-Fallback" strategy.
 * Tries to fetch from NRB API with a timeout, falls back to D1 cache on failure.
 */
export const fetchRatesApiFirst = async (date: Date): Promise<RatesData | null> => {
  const dateString = format(date, 'yyyy-MM-dd');
  
  try {
    // Race the API call against a 10-second timeout
    const apiResponse = await Promise.race([
      fetchForexRatesByDate(date),
      timeout(API_TIMEOUT)
    ]) as ForexResponse;

    if (apiResponse && apiResponse.data.payload.length > 0) {
      console.log(`[APIClient] API-First success for ${dateString}`);
      // Asynchronously trigger a background store to D1, but don't wait for it
      fetch(`/api/fetch-and-store?from=${dateString}&to=${dateString}`, { method: 'POST' })
        .catch(err => console.error(`[APIClient] Background store failed: ${err.message}`));
      return apiResponse.data.payload[0];
    }
    // If API returns no data (e.g., 404 for holiday), try DB
    throw new Error("API returned no payload, trying cache.");

  } catch (error) {
    console.warn(`[APIClient] API-First failed for ${dateString} (Error: ${error instanceof Error ? error.message : String(error)}). Falling back to DB.`);
    // On failure or timeout, fall back to the DB-first cache
    return fetchRatesForDateWithCache(dateString, null);
  }
};

/**
 * Fetches previous day rates using an "API-First, DB-Fallback" strategy.
 * Tries to fetch from NRB API, falls back to D1 cache on failure.
 */
export const fetchPreviousDayRatesApiFirst = async (currentDate: Date): Promise<RatesData | null> => {
  const yesterday = subDays(currentDate, 1);
  const yesterdayString = format(yesterday, 'yyyy-MM-dd');

  try {
    // Race the API call against a 10-second timeout
    const apiResponse = await Promise.race([
        fetchPreviousDayRates(currentDate), // This service already has retry logic for holidays
        timeout(API_TIMEOUT)
    ]) as ForexResponse | null;

    if (apiResponse && apiResponse.data.payload.length > 0) {
      console.log(`[APIClient] API-First success for previous day ${yesterdayString}`);
      
      // Find the actual date returned (in case of holiday fallback)
      const actualDate = apiResponse.data.payload[0].date;
       // Asynchronously trigger a background store to D1
      fetch(`/api/fetch-and-store?from=${actualDate}&to=${actualDate}`, { method: 'POST' })
        .catch(err => console.error(`[APIClient] Background store failed: ${err.message}`));
      
      return apiResponse.data.payload[0];
    }
    // If API returns no data, try DB
    throw new Error("API returned no payload, trying cache.");

  } catch (error) {
    console.warn(`[APIClient] API-First failed for previous day ${yesterdayString} (Error: ${error instanceof Error ? error.message : String(error)}). Falling back to DB.`);
    // On failure or timeout, fall back to the DB-first cache for yesterday
    return fetchRatesForDateWithCache(yesterdayString, null);
  }
};
