
import { ForexResponse } from '../types/forex';

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
  };
  
  return flagEmojis[iso3] || "🏳️";
};
