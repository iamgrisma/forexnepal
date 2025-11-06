import { Rate, RatesData, HistoricalRates } from '../types/forex';
import { fetchForexRatesByDate, fetchHistoricalRates as fetchRatesFromApi } from './forexService';
import { format, subDays } from 'date-fns';

const API_URL = '/api'; // Using the worker proxy

// --- Cache Management ---
const CACHE_NAME = 'forex-rates-cache-v1';

async function cacheRates(date: string, data: RatesData) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(new Request(`/rates/${date}`), new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    console.warn("Failed to cache rates:", error);
  }
}

async function getCachedRates(date: string): Promise<RatesData | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(new Request(`/rates/${date}`));
    if (response) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.warn("Failed to retrieve cached rates:", error);
    return null;
  }
}

// --- Public Functions ---

/**
 * Fetches rates for a specific date with a DB-first, API-fallback, and cache layer.
 * This is the primary function for getting daily rates.
 */
export async function fetchRatesForDateWithCache(date: string, bypassCache: boolean = false): Promise<RatesData> {
  // 1. Try to get from cache (unless bypassed)
  if (!bypassCache) {
    const cachedData = await getCachedRates(date);
    if (cachedData) {
      // console.log(`[Cache] HIT for ${date}`);
      return cachedData;
    }
  }

  // console.log(`[Cache] MISS for ${date}. Fetching from worker...`);

  // 2. Try to get from worker (which will check DB)
  try {
    const response = await fetch(`${API_URL}/rates/date/${date}`);
    if (!response.ok) {
      throw new Error(`Worker API error: ${response.statusText}`);
    }
    
    const data: RatesData = await response.json();

    // 3. If worker returns empty (e.g., DB miss), try fetching from NRB API
    if (!data || !data.rates || data.rates.length === 0) {
      // console.log(`[DB] MISS for ${date}. Fetching from NRB API...`);
      const apiData = await fetchForexRatesByDate(date);
      if (apiData && apiData.rates.length > 0) {
        // console.log(`[API] HIT for ${date}. Caching...`);
        // Don't await caching, let it happen in the background
        cacheRates(date, apiData);
        // We don't need to send this to the worker to save,
        // the worker will do that on its next scheduled run.
        return apiData;
      }
      // console.log(`[API] MISS for ${date}. Returning empty.`);
      return { date: date, rates: [] }; // Return empty if API also fails
    }

    // 4. If worker returns data, cache it and return
    // console.log(`[DB] HIT for ${date}. Caching...`);
    // Don't await caching
    cacheRates(date, data);
    return data;

  } catch (error) {
    console.error(`Failed to fetch rates for ${date} from worker.`, error);
    // Fallback directly to NRB API if worker fails
    try {
      // console.log(`[Worker FAIL] Fetching from NRB API for ${date}...`);
      const apiData = await fetchForexRatesByDate(date);
      if (apiData && apiData.rates.length > 0) {
        cacheRates(date, apiData);
        return apiData;
      }
    } catch (apiError) {
      console.error(`Failed to fetch rates from NRB API as fallback for ${date}.`, apiError);
    }

    return { date: date, rates: [] }; // Final fallback
  }
}

/**
 * Fetches historical rates for a currency (API-only).
 * This function bypasses the D1 database and hits the worker's API proxy.
 */
export async function fetchHistoricalRates(
  currencyCode: string,
  from: string,
  to: string
): Promise<HistoricalRates> {
  // Use the API-only endpoint from forexService
  return fetchRatesFromApi(currencyCode, from, to);
}

/**
 * Fetches rates for today and (if needed) the previous day.
 * Caches results.
 */
export async function fetchTodayAndYesterday() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const [todayData, yesterdayData] = await Promise.all([
    fetchRatesForDateWithCache(today),
    fetchRatesForDateWithCache(yesterday)
  ]);

  // If today's data is missing (e.g., it's morning),
  // return yesterday's data as "today" and the day before as "yesterday".
  if (!todayData || todayData.rates.length === 0) {
    const dayBefore = format(subDays(new Date(), 2), 'yyyy-MM-dd');
    const [prevToday, prevYesterday] = await Promise.all([
      fetchRatesForDateWithCache(yesterday),
      fetchRatesForDateWithCache(dayBefore)
    ]);
    return { today: prevToday, yesterday: prevYesterday };
  }

  return { today: todayData, yesterday: yesterdayData };
}

/**
 * Invalidates the cache for a specific date.
 */
export async function invalidateCacheForDate(date: string) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(new Request(`/rates/${date}`));
    // console.log(`[Cache] Invalidated for ${date}`);
  } catch (error) {
    console.error("Failed to invalidate cache:", error);
  }
}

/**
 * Clears the entire rate cache.
 */
export async function clearAllCaches() {
  try {
    await caches.delete(CACHE_NAME);
    console.log('[Cache] All rate caches cleared.');
  } catch (error) {
    console.error("Failed to clear all caches:", error);
  }
}
