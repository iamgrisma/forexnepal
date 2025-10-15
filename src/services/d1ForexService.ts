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
  missingDateRanges: Array<{ from: string; to: string }>;
}> {
  try {
    const response = await fetch(
      `/api/check-data?from=${fromDate}&to=${toDate}`
    );
    
    if (response.ok) {
      const data = await response.json();
      const missingDates = data.missingDates || [];
      
      // Convert missing dates to contiguous date ranges
      const missingDateRanges = groupDatesIntoRanges(missingDates);
      
      return {
        exists: data.exists || false,
        missingDateRanges
      };
    }
  } catch (error) {
    console.log('Error checking data existence:', error);
  }
  
  return { exists: false, missingDateRanges: [{ from: fromDate, to: toDate }] };
}

// Group missing dates into contiguous ranges
function groupDatesIntoRanges(dates: string[]): Array<{ from: string; to: string }> {
  if (dates.length === 0) return [];
  
  const sortedDates = [...dates].sort();
  const ranges: Array<{ from: string; to: string }> = [];
  let rangeStart = sortedDates[0];
  let rangeEnd = sortedDates[0];
  
  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i]);
    const prevDate = new Date(sortedDates[i - 1]);
    const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (dayDiff <= 1) {
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
    
    const { exists, missingDateRanges } = await checkDataExists(fromDate, toDate);
    
    if (!exists && missingDateRanges.length > 0) {
      // Step 2: Only fetch missing date ranges
      onProgress?.({
        stage: 'fetching',
        message: `Found ${missingDateRanges.length} missing date range(s). Fetching from API...`
      });
      
      let totalChunks = 0;
      let processedChunks = 0;
      
      // Calculate total chunks needed
      for (const missingRange of missingDateRanges) {
        const rangeFromDate = new Date(missingRange.from);
        const rangeToDate = new Date(missingRange.to);
        const chunks = splitDateRangeForRequests(rangeFromDate, rangeToDate);
        totalChunks += chunks.length;
      }
      
      // Fetch and store each missing range
      for (const missingRange of missingDateRanges) {
        const rangeFromDate = new Date(missingRange.from);
        const rangeToDate = new Date(missingRange.to);
        const dateRanges = splitDateRangeForRequests(rangeFromDate, rangeToDate);
        
        for (let i = 0; i < dateRanges.length; i++) {
          const range = dateRanges[i];
          processedChunks++;
          
          onProgress?.({
            stage: 'fetching',
            message: `Fetching chunk ${processedChunks} of ${totalChunks}...`,
            chunkInfo: {
              current: processedChunks,
              total: totalChunks,
              fromDate: range.from,
              toDate: range.to
            }
          });
          
          const success = await fetchAndStore(range.from, range.to);
          
          if (success) {
            onProgress?.({
              stage: 'storing',
              message: `Stored data from ${range.from} to ${range.to}`,
              chunkInfo: {
                current: processedChunks,
                total: totalChunks,
                fromDate: range.from,
                toDate: range.to
              }
            });
          } else {
            console.warn(`Failed to fetch chunk ${processedChunks}`);
          }
          
          // Small delay to avoid rate limiting
          if (processedChunks < totalChunks) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    }
    
    // Step 3: Load data from D1
    onProgress?.({
      stage: 'loading',
      message: 'Loading data from database...'
    });
    
    let data = await fetchFromD1(currencyCode, fromDate, toDate);
    
    // Fill gaps with previous day's data
    if (data.length > 0) {
      data = fillMissingDatesWithPreviousData(data, fromDate, toDate);
      
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

// Fill missing dates with previous day's data
function fillMissingDatesWithPreviousData(
  data: ChartDataPoint[],
  fromDate: string,
  toDate: string
): ChartDataPoint[] {
  if (data.length === 0) return data;
  
  const filledData: ChartDataPoint[] = [];
  const dataMap = new Map(data.map(d => [d.date, d]));
  
  const start = new Date(fromDate);
  const end = new Date(toDate);
  let previousData: ChartDataPoint | null = null;
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    
    if (dataMap.has(dateStr)) {
      const currentData = dataMap.get(dateStr)!;
      filledData.push(currentData);
      previousData = currentData;
    } else if (previousData) {
      // Use previous day's data for missing dates
      filledData.push({
        date: dateStr,
        buy: previousData.buy,
        sell: previousData.sell
      });
    }
  }
  
  return filledData;
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
