import { fetchHistoricalRates } from './forexService';

// Fetch historical rates from D1 cache or fallback to NRB API
export async function fetchHistoricalRatesFromCache(
  currencyCode: string,
  fromDate: string,
  toDate: string
): Promise<any> {
  try {
    // Try to fetch from worker API (D1 cache)
    const response = await fetch(
      `/api/historical-rates?currency=${currencyCode}&from=${fromDate}&to=${toDate}`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        // Transform D1 data to match NRB API format
        return {
          data: {
            payload: [{
              date: toDate,
              rates: data.data.map((item: any) => ({
                date: item.date,
                currency: {
                  iso3: currencyCode,
                  name: item.currency_name || currencyCode
                },
                buy: item.buy_rate.toString(),
                sell: item.sell_rate.toString()
              }))
            }]
          }
        };
      }
    }
  } catch (error) {
    console.log('D1 cache miss, falling back to NRB API');
  }
  
  // Fallback to NRB API
  return fetchHistoricalRates(fromDate, toDate);
}
