
import { ForexResponse, HistoricalRates } from '../types/forex';

export const fetchForexRates = async (): Promise<ForexResponse> => {
  try {
    const today = new Date();
    const formattedDate = formatDate(today);
    
    const response = await fetch(
      `https://www.nrb.org.np/api/forex/v1/rates?from=${formattedDate}&to=${formattedDate}&per_page=100&page=1`
    );
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch forex rates:", error);
    throw error;
  }
};

export const fetchPreviousDayRates = async (): Promise<ForexResponse | null> => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedYesterday = formatDate(yesterday);
    
    const response = await fetch(
      `https://www.nrb.org.np/api/forex/v1/rates?from=${formattedYesterday}&to=${formattedYesterday}&per_page=100&page=1`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        // Try one more day back if yesterday's data is not available
        const dayBeforeYesterday = new Date(today);
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
        const formattedDayBeforeYesterday = formatDate(dayBeforeYesterday);
        
        const retryResponse = await fetch(
          `https://www.nrb.org.np/api/forex/v1/rates?from=${formattedDayBeforeYesterday}&to=${formattedDayBeforeYesterday}&per_page=100&page=1`
        );
        
        if (!retryResponse.ok) {
          console.warn("Unable to fetch previous day rates");
          return null;
        }
        
        return await retryResponse.json();
      }
      throw new Error(`Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch previous day rates:", error);
    return null;
  }
};

export const fetchHistoricalRates = async (fromDate: string, toDate: string): Promise<HistoricalRates> => {
  try {
    const response = await fetch(
      `https://www.nrb.org.np/api/forex/v1/rates?from=${fromDate}&to=${toDate}&per_page=100&page=1`
    );
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      payload: data.data.payload,
      status: data.status
    };
  } catch (error) {
    console.error("Failed to fetch historical forex rates:", error);
    throw error;
  }
};

export const getDateRanges = () => {
  const today = new Date();
  
  // Week range
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  // Month range
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  
  // Year range - split into two 6-month periods to handle API limitations
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  
  // For the year range, we'll provide a range that is exactly 1 year ago
  // The component will handle splitting this into multiple requests if needed
  
  return {
    week: {
      from: formatDate(weekAgo),
      to: formatDate(today)
    },
    month: {
      from: formatDate(monthAgo),
      to: formatDate(today)
    },
    year: {
      from: formatDate(yearAgo),
      to: formatDate(today)
    }
  };
};

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateLong = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return date.toLocaleDateString(undefined, options);
};

// ISO3 to ISO2 mapping for flag icons
const countryCodeMapping: { [key: string]: string } = {
  "USD": "us",
  "EUR": "eu",
  "GBP": "gb",
  "CHF": "ch",
  "AUD": "au",
  "CAD": "ca",
  "SGD": "sg",
  "JPY": "jp",
  "CNY": "cn",
  "SAR": "sa",
  "QAR": "qa",
  "THB": "th",
  "AED": "ae",
  "MYR": "my",
  "KRW": "kr",
  "SEK": "se",
  "DKK": "dk",
  "HKD": "hk",
  "KWD": "kw",
  "BHD": "bh",
  "OMR": "om",
  "INR": "in",
};

export const getFlagEmoji = (iso3: string): string => {
  const flagEmojis: { [key: string]: string } = {
    "USD": "🇺🇸",
    "EUR": "🇪🇺",
    "GBP": "🇬🇧",
    "CHF": "🇨🇭",
    "AUD": "🇦🇺",
    "CAD": "🇨🇦",
    "SGD": "🇸🇬",
    "JPY": "🇯🇵",
    "CNY": "🇨🇳",
    "SAR": "🇸🇦",
    "QAR": "🇶🇦",
    "THB": "🇹🇭",
    "AED": "🇦🇪",
    "MYR": "🇲🇾",
    "KRW": "🇰🇷",
    "SEK": "🇸🇪",
    "DKK": "🇩🇰",
    "HKD": "🇭🇰",
    "KWD": "🇰🇼",
    "BHD": "🇧🇭",
    "OMR": "🇴🇲",
    "INR": "🇮🇳",
  };
  
  return flagEmojis[iso3] || "🏳️";
};

// Function to get flag icon HTML for a currency
export const getFlagIcon = (iso3: string): string => {
  const iso2 = countryCodeMapping[iso3];
  if (iso2) {
    return `<span class="fi fi-${iso2}"></span>`;
  }
  return getFlagEmoji(iso3); // Fallback to emoji if no mapping exists
};
