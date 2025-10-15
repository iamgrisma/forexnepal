import { fetchHistoricalRates, splitDateRangeForRequests } from './forexService';
import { ChartDataPoint } from '../types/forex';

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

export type ProgressCallback = (progress: FetchProgress) => void;

// Check if data exists in D1 for given date range
async function checkDataExists(fromDate: string, toDate: string): Promise<{
  exists: boolean;
  missingDates: string[];
}> {
  try {
    const response = await fetch(
      `/api/check-data?from=${fromDate}&to=${toDate}`
    );
    
    if (response.ok) {
      const data = await response.json();
      return {
        exists: data.exists || false,
        missingDates: data.missingDates || []
      };
    }
  } catch (error) {
    console.log('Error checking data existence:', error);
  }
  
  return { exists: false, missingDates: [] };
}

// Fetch from API and store in D1
async function fetchAndStore(fromDate: string, toDate: string): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/fetch-and-store?from=${fromDate}&to=${toDate}`
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.success === true;
    }
  } catch (error) {
    console.error('Error fetching and storing data:', error);
  }
  
  return false;
}

// Fetch data from D1
async function fetchFromD1(currencyCode: string, fromDate: string, toDate: string): Promise<ChartDataPoint[]> {
  try {
    const response = await fetch(
      `/api/historical-rates?currency=${currencyCode}&from=${fromDate}&to=${toDate}`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        return data.data.map((item: any) => ({
          date: item.date,
          buy: item.buy_rate,
          sell: item.sell_rate
        }));
      }
    }
  } catch (error) {
    console.error('Error fetching from D1:', error);
  }
  
  return [];
}

// Main function to fetch historical rates with smart caching
export async function fetchHistoricalRatesWithCache(
  currencyCode: string,
  fromDate: string,
  toDate: string,
  onProgress?: ProgressCallback
): Promise<ChartDataPoint[]> {
  try {
    // Step 1: Check if data exists in DB
    onProgress?.({
      stage: 'checking',
      message: 'Checking if data exists in database...'
    });
    
    const { exists } = await checkDataExists(fromDate, toDate);
    
    if (!exists) {
      // Step 2: Data doesn't exist, need to fetch from API
      onProgress?.({
        stage: 'fetching',
        message: 'Data not found in database. Fetching from API...'
      });
      
      // Split into 90-day chunks
      const fromDateObj = new Date(fromDate);
      const toDateObj = new Date(toDate);
      const dateRanges = splitDateRangeForRequests(fromDateObj, toDateObj);
      
      console.log(`Need to fetch ${dateRanges.length} chunks`);
      
      // Fetch and store each chunk
      for (let i = 0; i < dateRanges.length; i++) {
        const range = dateRanges[i];
        
        onProgress?.({
          stage: 'fetching',
          message: `Fetching data chunk ${i + 1} of ${dateRanges.length}...`,
          chunkInfo: {
            current: i + 1,
            total: dateRanges.length,
            fromDate: range.from,
            toDate: range.to
          }
        });
        
        // Fetch and store this chunk
        const success = await fetchAndStore(range.from, range.to);
        
        if (success) {
          onProgress?.({
            stage: 'storing',
            message: `Stored data from ${range.from} to ${range.to}`,
            chunkInfo: {
              current: i + 1,
              total: dateRanges.length,
              fromDate: range.from,
              toDate: range.to
            }
          });
        } else {
          console.warn(`Failed to fetch chunk ${i + 1}`);
        }
        
        // Small delay to avoid rate limiting
        if (i < dateRanges.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // Step 3: Load data from D1
    onProgress?.({
      stage: 'loading',
      message: 'Loading data from database...'
    });
    
    const data = await fetchFromD1(currencyCode, fromDate, toDate);
    
    if (data.length > 0) {
      onProgress?.({
        stage: 'complete',
        message: exists 
          ? 'Data loaded successfully!' 
          : 'Data fetched from API and stored in database. You won\'t have to wait this long again!'
      });
      
      return data;
    }
    
    // Step 4: Fallback to direct API call if D1 fails
    onProgress?.({
      stage: 'fetching',
      message: 'Database unavailable. Fetching directly from API as fallback...'
    });
    
    return await fetchFromAPIFallback(currencyCode, fromDate, toDate);
    
  } catch (error) {
    console.error('Error in fetchHistoricalRatesWithCache:', error);
    
    onProgress?.({
      stage: 'error',
      message: 'Error occurred. Using API fallback...'
    });
    
    // Fallback to direct API call
    return await fetchFromAPIFallback(currencyCode, fromDate, toDate);
  }
}

// Fallback: Direct API call (old method)
async function fetchFromAPIFallback(
  currencyCode: string,
  fromDate: string,
  toDate: string
): Promise<ChartDataPoint[]> {
  try {
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
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
            allData.push({
              date: dayData.date,
              buy: parseFloat(currencyRate.buy.toString()),
              sell: parseFloat(currencyRate.sell.toString()),
            });
          }
        });
      }
    }
    
    return allData;
  } catch (error) {
    console.error('API fallback error:', error);
    return [];
  }
}
