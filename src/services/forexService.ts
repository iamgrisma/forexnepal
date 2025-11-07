import { ForexResponse, HistoricalRates, Rate } from '../types/forex';
import { format } from 'date-fns'; // Make sure date-fns is imported

// Define the base URL for the NRB API
const API_BASE_URL = 'https://www.nrb.org.np/api/forex/v1';

// Original function to fetch latest rates (implicitly fetches for today)
export const fetchForexRates = async (): Promise<ForexResponse> => {
  try {
    const today = new Date();
    const formattedDate = formatDate(today); // Use your existing formatDate

    const response = await fetch(
      // Corrected endpoint structure based on previous examples
      `${API_BASE_URL}/rates?from=${formattedDate}&to=${formattedDate}&per_page=100&page=1`
    );

    if (!response.ok) {
        // If today's data isn't found, try yesterday
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

// New function to fetch rates for a specific date - accepts string OR Date
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
   const formattedYesterday = formatDate(yesterday); // Format the day before

   try {
     const response = await fetch(
       `${API_BASE_URL}/rates?from=${formattedYesterday}&to=${formattedYesterday}&per_page=100&page=1`
     );

     if (!response.ok) {
       // If yesterday's data is 404, try the day before that
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
                return { status: { code: 404, message: "No recent previous day data found"}, data: { payload: [], pagination: { page: 1, per_page: 100, total_page: 0, total_count: 0 } }}; // Return empty structure
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
     // Return null or a specific error structure if the fetch fails completely
     return null;
   }
 };


// Function to fetch historical rates over a range (potentially multiple API calls)
export const fetchHistoricalRates = async (fromDate: string, toDate: string): Promise<HistoricalRates> => {
  try {
    // Determine the number of pages needed if the range is large (API might paginate)
    // For simplicity, this example assumes per_page=100 is enough for typical ranges used in charts.
    // A more robust solution might check pagination info and make multiple requests if needed.
    const response = await fetch(
      `${API_BASE_URL}/rates?from=${fromDate}&to=${toDate}&per_page=500&page=1` // Increased per_page
    );

    if (!response.ok) {
         // Handle 404 gracefully if no data exists in the entire range
        if (response.status === 404) {
            console.warn(`No historical data found in range: ${fromDate} to ${toDate}`);
            return { status: { code: 404, message: "No data found for this range" }, payload: [] };
        }
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    // Ensure the payload structure matches HistoricalRates expectation
    return {
      status: data.status, // Pass along the status object
      payload: data.data.payload || [], // Ensure payload is always an array
    };
  } catch (error) {
    console.error("Failed to fetch historical forex rates:", error);
    throw error; // Re-throw the error to be handled by the caller (e.g., react-query)
  }
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
  return format(date, 'yyyy-MM-dd'); // Using date-fns for consistency
};

// Long date formatter (e.g., Sunday, October 19, 2025)
export const formatDateLong = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  // Ensure date is treated correctly, handle potential timezone issues if needed
  // For display, locale string is usually fine.
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
  return flagEmojis[iso3.toUpperCase()] || "🏳️"; // Default flag
};

// Function to split date range for API limits (if necessary, NRB seems okay with ~90 days)
export const splitDateRangeForRequests = (fromDate: Date, toDate: Date, maxDaysChunk = 90): Array<{from: string, to: string}> => {
  const dateRanges: Array<{from: string, to: string}> = [];
  let currentStart = new Date(fromDate);

  while (currentStart <= toDate) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + maxDaysChunk - 1); // Calculate end of chunk

    // Ensure the chunk end date doesn't exceed the overall toDate
    if (currentEnd > toDate) {
      currentEnd = new Date(toDate);
    }

    dateRanges.push({
      from: formatDate(currentStart),
      to: formatDate(currentEnd)
    });

    // Move to the next day after the current chunk ends
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  return dateRanges;
};
