import { ForexResponse, HistoricalRates, Rate, RatesData, ChartDataPoint } from '../types/forex';
import { format } from 'date-fns';

// Define the base URL for the NRB API
const API_BASE_URL = 'https://www.nrb.org.np/api/forex/v1';

// Original function to fetch latest rates (implicitly fetches for today)
export const fetchForexRates = async (): Promise<ForexResponse> => {
  try {
    const today = new Date();
    const formattedDate = formatDate(today);

    const response = await fetch(
      `${API_BASE_URL}/rates?from=${formattedDate}&to=${formattedDate}&per_page=100&page=1`
    );

    if (!response.ok) {
        if (response.status === 404) {
            console.warn("Today's rates not found, trying yesterday's...");
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return fetchForexRatesByDate(yesterday);
        }
      throw new Error(`HTTP Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch latest forex rates:", error);
    throw error;
  }
};

// Function to fetch rates for a specific date - accepts string OR Date
export const fetchForexRatesByDate = async (date: Date | string): Promise<ForexResponse> => {
  try {
    const formattedDate = typeof date === 'string' ? date : formatDate(date);

    const response = await fetch(
      `${API_BASE_URL}/rates?from=${formattedDate}&to=${formattedDate}&per_page=100&page=1`
    );

    if (!response.ok) {
       if (response.status === 404) {
           console.warn(`No forex data found for date: ${formattedDate}. Returning empty payload.`);
           return {
               status: { code: 404, message: "Data not found for this date" },
               data: { payload: [], pagination: { page: 1, per_page: 100, total_page: 0, total_count: 0 } }
           };
       }
      throw new Error(`HTTP Error: ${response.status} fetching rates for ${formattedDate}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch forex rates for ${typeof date === 'string' ? date : formatDate(date)}:`, error);
    throw error;
  }
};


// Updated function to fetch rates for the day *before* the given date
export const fetchPreviousDayRates = async (currentDate: Date): Promise<ForexResponse | null> => {
   const yesterday = new Date(currentDate);
   yesterday.setDate(yesterday.getDate() - 1);
   const formattedYesterday = formatDate(yesterday);

   try {
     const response = await fetch(
       `${API_BASE_URL}/rates?from=${formattedYesterday}&to=${formattedYesterday}&per_page=100&page=1`
     );

     if (!response.ok) {
       if (response.status === 404) {
         console.warn(`No rates found for ${formattedYesterday}, trying the day before.`);
         const dayBeforeYesterday = new Date(yesterday);
         dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
         const formattedDayBefore = formatDate(dayBeforeYesterday);

         const retryResponse = await fetch(
           `${API_BASE_URL}/rates?from=${formattedDayBefore}&to=${formattedDayBefore}&per_page=100&page=1`
         );

         if (!retryResponse.ok) {
            if (retryResponse.status === 404) {
                console.warn(`No rates found for ${formattedDayBefore} either.`);
                return { status: { code: 404, message: "No recent previous day data found"}, data: { payload: [], pagination: { page: 1, per_page: 100, total_page: 0, total_count: 0 } }};
            }
           throw new Error(`Retry HTTP Error: ${retryResponse.status}`);
         }
         return await retryResponse.json();
       }
       throw new Error(`HTTP Error: ${response.status}`);
     }

     return await response.json();
   } catch (error) {
     console.error("Failed to fetch previous day rates:", error);
     return null;
   }
 };


/**
 * --- THIS IS THE CRITICAL FIX ---
 * Fetches historical rates, correctly handling pagination per the API docs.
 * (per_page max 100).
 */
export const fetchHistoricalRates = async (
  fromDate: string, 
  toDate: string,
  onProgress?: (progress: { percent: number, current: number, total: number }) => void
): Promise<HistoricalRates> => {
  const allPayloads: RatesData[] = [];
  let currentPage = 1;
  let totalPages = 1;

  try {
    do {
      const response = await fetch(
        `${API_BASE_URL}/rates?from=${fromDate}&to=${toDate}&per_page=100&page=${currentPage}`
      );

      if (!response.ok) {
        if (response.status === 404 && currentPage === 1) {
          console.warn(`No historical data found in range: ${fromDate} to ${toDate}`);
          return { status: { code: 404, message: "No data found" }, payload: [] };
        }
        throw new Error(`HTTP Error: ${response.status} on page ${currentPage}`);
      }

      const data = await response.json();
      
      if (data?.data?.payload) {
        allPayloads.push(...data.data.payload);
      }

      if (currentPage === 1) {
        totalPages = data.pagination?.total_page || 1;
      }
      
      if (onProgress) {
        onProgress({ percent: (currentPage / totalPages) * 100, current: currentPage, total: totalPages });
      }

      currentPage++;
    } while (currentPage <= totalPages);

    return {
      status: { code: 200, message: "OK" },
      payload: allPayloads,
    };
  } catch (error) {
    console.error("Failed to fetch paginated historical forex rates:", error);
    throw error;
  }
};

/**
 * --- NEW FUNCTION NAME ---
 * Fetches data *strictly* from NRB API (using the fixed fetchHistoricalRates)
 * and NORMALIZES it by the unit.
 */
export const fetchAndNormalizeNRBData = async (
  currency: string, 
  fromDate: string, 
  toDate: string, 
  unit: number,
  onProgress?: (progress: { percent: number, current: number, total: number }) => void
): Promise<ChartDataPoint[]> => {
  
  // Call the new paginated function
  const result = await fetchHistoricalRates(fromDate, toDate, onProgress); 
  
  if (!result.payload || result.payload.length === 0) {
    return [];
  }
  
  const chartData: ChartDataPoint[] = [];
  result.payload.forEach((day: any) => {
    const rate = day.rates?.find((r: any) => r.currency?.iso3 === currency);
    if (rate && rate.buy && rate.sell) {
      chartData.push({
        date: day.date,
        buy: Number(rate.buy) / unit, // Normalize
        sell: Number(rate.sell) / unit, // Normalize
      });
    }
  });
  
  return chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};


// Helper to get predefined date ranges
export const getDateRanges = () => {
  const today = new Date();

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  const fiveYearsAgo = new Date(today);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  return {
    week: {
      from: formatDate(weekAgo),
      to: formatDate(today)
    },
    month: {
      from: formatDate(monthAgo),
      to: formatDate(today)
    },
    threeMonth: {
      from: formatDate(threeMonthsAgo),
      to: formatDate(today)
    },
    sixMonth: {
      from: formatDate(sixMonthsAgo),
      to: formatDate(today)
    },
    year: {
      from: formatDate(yearAgo),
      to: formatDate(today)
    },
    fiveYear: {
      from: formatDate(fiveYearsAgo),
      to: formatDate(today)
    }
  };
};

// Basic date formatter (YYYY-MM-DD)
export const formatDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

// Long date formatter (e.g., Sunday, October 19, 2025)
export const formatDateLong = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  try {
      return new Date(date).toLocaleDateString('en-US', options);
  } catch (e) {
      console.error("Error formatting long date:", date, e);
      return "Invalid Date";
  }
};


// Mapping for flag emojis (can be expanded)
export const getFlagEmoji = (iso3: string): string => {
  const flagEmojis: { [key: string]: string } = {
    "USD": "🇺🇸", "EUR": "🇪🇺", "GBP": "🇬🇧", "CHF": "🇨🇭", "AUD": "🇦🇺",
    "CAD": "🇨🇦", "SGD": "🇸🇬", "JPY": "🇯🇵", "CNY": "🇨🇳", "SAR": "🇸🇦",
    "QAR": "🇶🇦", "THB": "🇹🇭", "AED": "🇦🇪", "MYR": "🇲🇾", "KRW": "🇰🇷",
    "SEK": "🇸🇪", "DKK": "🇩🇰", "HKD": "🇭🇰", "KWD": "🇰🇼", "BHD": "🇧🇭",
    "OMR": "🇴🇲", "INR": "🇮🇳",
  };
  return flagEmojis[iso3.toUpperCase()] || "🏳️";
};

// This function is no longer needed as pagination is handled inside fetchHistoricalRates
// export const splitDateRangeForRequests = ...
