import { Rate, RatesData, HistoricalRates, ForexResponse } from '../types/forex';
import { fetchForexRatesByDate, fetchHistoricalRates as fetchRatesFromApi } from './forexService';
import { format, subDays } from 'date-fns';

const API_URL = '/api';

export interface FetchProgress {
  current: number;
  total: number;
  date?: string;
  message?: string;
  chunkInfo?: {
    current: number;
    total: number;
    fromDate?: string;
    toDate?: string;
  };
}

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
  // 1. Try API first (most current data)
  try {
    const apiResponse: ForexResponse = await fetchForexRatesByDate(date);
    if (apiResponse && apiResponse.data && apiResponse.data.payload.length > 0) {
      const ratesData = apiResponse.data.payload[0];
      cacheRates(date, ratesData);
      return ratesData;
    }
  } catch (apiError) {
    console.warn(`API fetch failed for ${date}, trying DB:`, apiError);
  }

  // 2. Try DB via worker as fallback
  try {
    const response = await fetch(`${API_URL}/rates/date/${date}`);
    if (response.ok) {
      const data: RatesData = await response.json();
      
      if (data && data.rates && data.rates.length > 0) {
        cacheRates(date, data);
        return data;
      }
    }
  } catch (dbError) {
    console.warn(`DB fetch failed for ${date}:`, dbError);
  }

  // 3. Try cache as final fallback
  if (!bypassCache) {
    const cachedData = await getCachedRates(date);
    if (cachedData) {
      return cachedData;
    }
  }

  // Final fallback - no data available
  return { 
    date, 
    rates: [],
    published_on: date,
    modified_on: date
  };
}

/**
 * Fetches historical rates for a currency (API-only) for charting/calculation.
 * NOTE: The data returned here is *always* for a single currency/multiple dates, not full daily rate tables.
 */
export async function fetchHistoricalRatesWithCache(
  currencyCode: string,
  from: string,
  to: string
): Promise<any[]> { // Returns a simplified { date, buy, sell }[] payload
  try {
    // This hits the worker's /api/historical-rates?currency=USD... endpoint
    const response = await fetch(`${API_URL}/historical-rates?currency=${currencyCode}&from=${from}&to=${to}`);
    
    if (!response.ok) {
        throw new Error(`Worker API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
        // The worker is now responsible for handling DB/API fetching and normalizing the data.
        return data.data; // This is the cleaned array of { date, buy, sell }
    }

    return [];
  } catch (error) {
    console.error("Failed to fetch historical rates for converter:", error);
    return []; // Return empty array on failure
  }
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
