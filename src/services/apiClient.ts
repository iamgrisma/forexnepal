import { fetchForexRatesByDate, fetchPreviousDayRates } from './forexService';
import { fetchRatesForDateWithCache } from './d1ForexService';
import { RatesData, ForexResponse } from '@/types/forex';
import { format, subDays } from 'date-fns';

const API_TIMEOUT = 10000; // 10 seconds

// --- NEW: General-Purpose API Client for Frontend Requests ---

/**
 * Utility to fetch the JWT token from localStorage.
 */
const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('forex_admin_token');
  }
  return null;
};

/**
 * Base function for API requests, handling headers and error parsing.
 */
async function fetcher(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    // Attach authorization header if a token exists
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  // Prepend /api to the path for all requests
  const response = await fetch(`/api${path}`, { ...options, headers });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
    // Throw an error that toast/react-query can easily handle
    throw new Error(errorBody.error || errorBody.message || 'API request failed');
  }

  // Return raw response for requests that don't expect JSON (e.g. DELETE without content)
  if (response.status === 204) return null; 

  return response.json();
}

/**
 * Exported API Client wrapper for authenticated and general calls.
 */
export const apiClient = {
  get: <T>(path: string, options?: RequestInit) => {
    return fetcher(path, { method: 'GET', ...options }) as Promise<T>;
  },
  post: <T>(path: string, data?: any, options?: RequestInit) => {
    return fetcher(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }) as Promise<T>;
  },
  put: <T>(path: string, data?: any, options?: RequestInit) => {
    return fetcher(path, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    }) as Promise<T>;
  },
  delete: <T>(path: string, options?: RequestInit) => {
    return fetcher(path, { method: 'DELETE', ...options }) as Promise<T>;
  },
};

// --- Original Logic (Exported as well) ---

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
      fetch(`/api/fetch-and-store?from=${dateString}&to=${dateString}`, { method: 'POST', headers: { Authorization: `Bearer ${getAuthToken()}` } })
        .catch(err => console.error(`[APIClient] Background store failed: ${err.message}`));
      return apiResponse.data.payload[0];
    }
    // If API returns no data (e.g., 404 for holiday), try DB
    throw new Error("API returned no payload, trying cache.");

  } catch (error) {
    console.warn(`[APIClient] API-First failed for ${dateString} (Error: ${error instanceof Error ? error.message : String(error)}). Falling back to DB.`);
    // On failure or timeout, fall back to the DB-first cache
    // Note: fetchRatesForDateWithCache has its *own* API fallback, so it's a robust cache.
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
      const actualDate = apiResponse.data.payload[0].date;
      console.log(`[APIClient] API-First success for previous day (found ${actualDate})`);
      
       // Asynchronously trigger a background store to D1
      fetch(`/api/fetch-and-store?from=${actualDate}&to=${actualDate}`, { method: 'POST', headers: { Authorization: `Bearer ${getAuthToken()}` } })
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
