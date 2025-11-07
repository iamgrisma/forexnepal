import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFlagEmoji, fetchFromNRBApi as fetchFromNRBApiRaw } from '../services/forexService';
import { fetchRatesForDateWithCache } from '../services/d1ForexService';
import { ChartDataPoint } from '../types/forex';
import { format, subDays, parseISO, addDays, differenceInDays, isValid } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Layout from '@/components/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import ShareButtons from '@/components/ShareButtons';
import DateInput from '@/components/DateInput'; // Import your custom date input
import { canMakeChartRequest, recordChartRequest, getRemainingRequests } from '@/utils/chartRateLimiter';
import { toast } from 'sonner';
import { isValidDateString, isValidDateRange, sanitizeDateInput } from '../lib/validation';

// --- Currency Info Map ---
const CURRENCY_MAP: { [key: string]: { name: string, unit: number, country: string } } = {
  'INR': { name: 'Indian Rupee', unit: 100, country: 'India' },
  'USD': { name: 'U.S. Dollar', unit: 1, country: 'United States' },
  'EUR': { name: 'European Euro', unit: 1, country: 'European Union' },
  'GBP': { name: 'UK Pound Sterling', unit: 1, country: 'United Kingdom' },
  'CHF': { name: 'Swiss Franc', unit: 1, country: 'Switzerland' },
  'AUD': { name: 'Australian Dollar', unit: 1, country: 'Australia' },
  'CAD': { name: 'Canadian Dollar', unit: 1, country: 'Canada' },
  'SGD': { name: 'Singapore Dollar', unit: 1, country: 'Singapore' },
  'JPY': { name: 'Japanese Yen', unit: 10, country: 'Japan' },
  'CNY': { name: 'Chinese Yuan', unit: 1, country: 'China' },
  'SAR': { name: 'Saudi Arabian Riyal', unit: 1, country: 'Saudi Arabia' },
  'QAR': { name: 'Qatari Riyal', unit: 1, country: 'Qatar' },
  'THB': { name: 'Thai Baht', unit: 1, country: 'Thailand' },
  'AED': { name: 'U.A.E Dirham', unit: 1, country: 'United Arab Emirates' },
  'MYR': { name: 'Malaysian Ringgit', unit: 1, country: 'Malaysia' },
  'KRW': { name: 'South Korean Won', unit: 100, country: 'South Korea' },
  'SEK': { name: 'Swedish Kroner', unit: 1, country: 'Sweden' },
  'DKK': { name: 'Danish Kroner', unit: 1, country: 'Denmark' },
  'HKD': { name: 'Hong Kong Dollar', unit: 1, country: 'Hong Kong' },
  'KWD': { name: 'Kuwaiti Dinar', unit: 1, country: 'Kuwait' },
  'BHD': { name: 'Bahraini Dinar', unit: 1, country: 'Bahrain' },
  'OMR': { name: 'Omani Rial', unit: 1, country: 'Oman' }
};

// --- Date Range Definitions ---
type RangeKey = 'week' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'custom';
const DATE_RANGES: Record<RangeKey, { days: number, label: string }> = {
  'week': { days: 7, label: 'Week' },
  '1M': { days: 30, label: '1 Month' },
  '3M': { days: 90, label: '3 Months' },
  '6M': { days: 180, label: '6 Months' },
  '1Y': { days: 365, label: '1 Year' },
  '3Y': { days: 365 * 3, label: '3 Years' },
  '5Y': { days: 365 * 5, label: '5 Years' },
  'custom': { days: 0, label: 'Custom' },
};

// Use a long cache time for chart data as requested
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days cache

// Cache key for chart data
const getChartCacheKey = (currency: string, range: string, from: string, to: string, daily: boolean) => `chart_cache_${currency}_${range}_${from}_${to}_${daily}`;

// Save/load chart data to/from localStorage
const saveChartCache = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    // If cache is full, try to remove old chart data
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      console.warn('Cache quota exceeded. Clearing old chart cache...');
      let keysToRemove: { key: string, timestamp: number }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('chart_cache_')) {
          const item = localStorage.getItem(key);
          if (item) {
            try {
              const { timestamp } = JSON.parse(item);
              keysToRemove.push({ key, timestamp: timestamp || 0 });
            } catch (e) { /* ignore broken cache item */ }
          }
        }
      }
      // Sort by oldest and remove 5 items
      keysToRemove.sort((a, b) => a.timestamp - b.timestamp).slice(0, 5).forEach(item => {
        console.log(`Removing old cache: ${item.key}`);
        localStorage.removeItem(item.key);
      });
      
      // Try saving again
      try {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
      } catch (e2) {
        console.error('Failed to cache chart data even after clearing:', e2);
      }
    } else {
      console.error('Failed to cache chart data:', e);
    }
  }
};

const loadChartCache = (key: string, maxAge: number = CACHE_MAX_AGE): any | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    // --- FIX: Check if cached data is empty ---
    if (!data || !data.data || data.data.length === 0) {
      console.warn('Found empty or invalid cache. Ignoring.');
      localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - timestamp > maxAge) {
      localStorage.removeItem(key); // Remove stale cache
      return null;
    }
    return data; // Returns the { data, samplingUsed } object
  } catch (e) {
    return null;
  }
};

// Helper to fetch data with timeout
const fetchWithTimeout = async (url: string, timeout: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

// --- DATA FETCHING FUNCTIONS ---

/**
 * Fetches week data from DB (via internal API) with 5s timeout, falls back to NRB API.
 */
const fetchWeekData = async (currency: string, fromDate: string, toDate: string, unit: number): Promise<ChartDataPoint[]> => {
  try {
    // Try DB first with 5 second timeout
    const dbResponse = await fetchWithTimeout(`/api/historical-rates?currency=${currency}&from=${fromDate}&to=${toDate}`, 5000);
    
    if (dbResponse.ok) {
      const result = await dbResponse.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        console.log('Loaded week data from DB');
        // Worker already normalizes this data, so just return
        return result.data;
      }
    }
  } catch (error) {
    console.warn('DB fetch failed or timed out, falling back to NRB API', error);
  }
  
  // Fallback to NRB API
  return fetchFromNRBApiRaw(currency, fromDate, toDate, unit);
};

/**
 * Fetches full daily data from NRB API in 90-day chunks and NORMALIZES it.
 */
const loadDailyDataInChunks = async (
  currency: string, 
  fromDate: string, 
  toDate: string,
  unit: number,
  onProgress: (progress: number) => void // Progress as 0-100
): Promise<ChartDataPoint[]> => {
  const from = parseISO(fromDate);
  const to = parseISO(toDate);
  const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const chunkSize = 90;
  const chunks = Math.ceil(daysDiff / chunkSize);
  
  let allData: ChartDataPoint[] = [];
  
  for (let i = 0; i < chunks; i++) {
    const chunkStart = addDays(from, i * chunkSize);
    let chunkEnd = addDays(chunkStart, chunkSize - 1);
    if (chunkEnd > to) chunkEnd = to;
    
    const chunkFromDate = format(chunkStart, 'yyyy-MM-dd');
    const chunkToDate = format(chunkEnd, 'yyyy-MM-dd');
    
    const chunkData = await fetchFromNRBApiRaw(
      currency,
      chunkFromDate,
      chunkToDate,
      unit
    );
    
    allData = [...allData, ...chunkData];
    onProgress(((i + 1) / chunks) * 100); // Report progress as 0-100
  }
  
  // De-duplicate (in case of overlapping chunk fetches) and sort
  const uniqueData = Array.from(new Map(allData.map(item => [item.date, item])).values());
  return uniqueData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Applies sampling to a full dataset for initial chart display.
 */
const sampleData = (data: ChartDataPoint[], days: number): { sampledData: ChartDataPoint[], samplingUsed: string } => {
  if (data.length === 0) return { sampledData: [], samplingUsed: 'daily' };

  let interval;
  let samplingUsed: string;

  if (days <= 90) { // 0-3 months
    interval = 1; 
    samplingUsed = 'daily';
  } else if (days <= 730) { // 3 months - 2 years
    interval = 7;
    samplingUsed = 'weekly';
  } else if (days <= 1825) { // 2-5 years
    interval = 15;
    samplingUsed = '15-day';
  } else { // > 5 years
    interval = 30;
    samplingUsed = 'monthly';
  }

  if (interval === 1) return { sampledData: data, samplingUsed };

  const sampledData = data.filter((_, index) => index % interval === 0);
  
  // Ensure the last point is always included
  const lastDataPoint = data[data.length - 1];
  if (lastDataPoint && (!sampledData.length || sampledData[sampledData.length - 1].date !== lastDataPoint.date)) {
    sampledData.push(lastDataPoint);
  }
  
  return { sampledData, samplingUsed };
};

/**
 * --- NEW INR FIX ---
 * Generates a full array of data points for a fixed-rate currency.
 */
const generateINRFixedData = (fromDate: string, toDate: string, unit: number): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  let currentDate = parseISO(fromDate);
  const endDate = parseISO(toDate);
  
  while (currentDate <= endDate) {
    data.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      buy: 160 / unit,
      sell: 160.15 / unit,
    });
    currentDate = addDays(currentDate, 1);
  }
  return data;
};


// Calculate statistics
const calculateStats = (data: ChartDataPoint[]) => {
  if (data.length === 0) {
    return { high: 0, low: 0, change: 0, changePercent: 0, firstRate: 0, lastRate: 0 };
  }

  let high = -Infinity;
  let low = Infinity;
  let firstRate = 0;
  let lastRate = 0;

  // Find first valid rate
  for (const d of data) {
    if (d.buy !== null) {
      firstRate = d.buy;
      break;
    }
  }

  // Find last valid rate
  for (let i = data.length - 1; i >= 0; i--) {
    const d = data[i];
    if (d.buy !== null) {
      lastRate = d.buy;
      break;
    }
  }

  data.forEach(d => {
    if (d.buy !== null) {
      if (d.buy > high) high = d.buy;
      if (d.buy < low) low = d.buy;
    }
  });

  if (low === Infinity) low = 0; // Handle case where all data is null

  const change = lastRate - firstRate;
  const changePercent = firstRate > 0 ? (change / firstRate) * 100 : 0;

  return { high, low, change, changePercent, firstRate, lastRate };
};

// Process chart data (gap-fill for line breaks)
const processChartData = (data: ChartDataPoint[]): ChartDataPoint[] => {
  if (data.length < 2) return data;
  
  const filledData: ChartDataPoint[] = [];
  let currentDate = parseISO(data[0].date);
  const endDate = parseISO(data[data.length - 1].date);
  let dataIndex = 0;

  while (currentDate <= endDate) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    if (dataIndex < data.length && data[dataIndex].date === dateStr) {
      filledData.push(data[dataIndex]);
      dataIndex++;
    } else {
      filledData.push({ date: dateStr, buy: null, sell: null });
    }
    currentDate = addDays(currentDate, 1);
  }

  return filledData;
};

// Custom Tooltip
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length && payload[0].payload.buy !== null) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-bold text-sm">{format(parseISO(label), 'MMM d, yyyy')}</p>
        <p className="text-primary text-xs">Buy: {data.buy.toFixed(4)}</p>
        <p className="text-red-500 text-xs">Sell: {data.sell.toFixed(4)}</p>
      </div>
    );
  }
  return null;
};

// --- Query Result Type ---
type QueryResult = {
  data: ChartDataPoint[];
  samplingUsed: string;
}

// Main Component
const CurrencyHistoricalData: React.FC = () => {
  const { currencyCode } = useParams<{ currencyCode: string }>();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeKey>('week');
  const [showDaily, setShowDaily] = useState(false);
  const [dailyLoadProgress, setDailyLoadProgress] = useState<number | null>(null);
  const [cooldownTimer, setCooldownTimer] = useState<number>(0);
  const [currentSampling, setCurrentSampling] = useState('daily');
  
  // Custom date states
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const monthAgoStr = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const [customFromDate, setCustomFromDate] = useState<string>(monthAgoStr);
  const [customToDate, setCustomToDate] = useState<string>(todayStr);

  const currencyInfo = CURRENCY_MAP[currencyCode?.toUpperCase() || ''];
  const { name = 'Unknown', unit = 1, country = 'Unknown' } = currencyInfo || {};
  const upperCaseCurrencyCode = currencyCode?.toUpperCase() || 'UNKNOWN';

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownTimer > 0) {
      const timer = setInterval(() => {
        setCooldownTimer(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownTimer]);

  // --- INR Fixed Rate Check ---
  // This query runs ONLY for INR to check if its rate is fixed.
  const { data: inrCheckData, isFetching: isCheckingINR } = useQuery({
    queryKey: ['currentRateCheckINR', upperCaseCurrencyCode],
    queryFn: () => fetchRatesForDateWithCache(format(new Date(), 'yyyy-MM-dd')), // DB-first check
    enabled: upperCaseCurrencyCode === 'INR', // Only run this query for INR
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
  });

  // Determine if INR rate is fixed
  const isINRFixed = useMemo(() => {
    if (upperCaseCurrencyCode !== 'INR' || !inrCheckData) return false;
    const inrRate = inrCheckData.rates.find(r => r.currency.iso3 === 'INR');
    return inrRate && inrRate.buy === 160 && inrRate.sell === 160.15;
  }, [inrCheckData, upperCaseCurrencyCode]);

  // Calculate date range
  const { fromDate, toDate, rangeInDays } = useMemo(() => {
    if (range === 'custom') {
      if (isValidDateString(customFromDate) && isValidDateString(customToDate) && isValidDateRange(customFromDate, customToDate)) {
        const from = parseISO(customFromDate);
        const to = parseISO(customToDate);
        const days = differenceInDays(to, from) + 1;
        return { fromDate: customFromDate, toDate: customToDate, rangeInDays: days };
      }
      // Fallback to 1M if custom dates are invalid
      return { fromDate: monthAgoStr, toDate: todayStr, rangeInDays: 30 };
    }
    const days = DATE_RANGES[range]?.days || 7;
    return {
      fromDate: format(subDays(new Date(), days - 1), 'yyyy-MM-dd'),
      toDate: todayStr,
      rangeInDays: days
    };
  }, [range, customFromDate, customToDate, todayStr, monthAgoStr]);

  // --- Main Data Fetching Query ---
  const { data: queryResult, isLoading, isError, error } = useQuery<QueryResult>({
    queryKey: ['currency-chart', upperCaseCurrencyCode, range, fromDate, toDate, showDaily],
    queryFn: async () => {
      // 1. Check for fixed INR (using the state set by the query above)
      if (isINRFixed) {
        return { 
          // --- FIX: Generate data for the *entire* range ---
          data: generateINRFixedData(fromDate, toDate, unit), 
          samplingUsed: 'daily (fixed)' 
        };
      }

      // 2. Check local cache
      const cacheKey = getChartCacheKey(upperCaseCurrencyCode, range, fromDate, toDate, showDaily);
      const cached = loadChartCache(cacheKey);
      if (cached) {
        console.log('Loaded from cache');
        return cached; // This is { data, samplingUsed }
      }

      let data: ChartDataPoint[];
      let samplingUsed = 'daily';

      // 3. Rate Limit Check (for NRB API calls)
      if (range !== 'week' || showDaily) {
        const limitCheck = canMakeChartRequest(rangeInDays);
        if (!limitCheck.allowed) {
          if (limitCheck.cooldownSeconds) {
            // Use a stable state update, not one inside queryFn
            Promise.resolve().then(() => setCooldownTimer(limitCheck.cooldownSeconds!));
          }
          throw new Error(limitCheck.reason || 'Rate limit exceeded');
        }
        recordChartRequest(rangeInDays);
      }

      // 4. Fetch new data
      if (range === 'week' && !showDaily) {
        // Use DB-first for 'week' tab
        data = await fetchWeekData(upperCaseCurrencyCode, fromDate, toDate, unit);
        samplingUsed = 'daily';
      } else if (showDaily) {
        // Load full daily data in chunks from NRB API
        // Use stable state update for progress
        Promise.resolve().then(() => setDailyLoadProgress(0));
        data = await loadDailyDataInChunks(
          upperCaseCurrencyCode,
          fromDate,
          toDate,
          unit,
          (progress) => Promise.resolve().then(() => setDailyLoadProgress(progress))
        );
        Promise.resolve().then(() => setDailyLoadProgress(null));
        samplingUsed = 'daily';
      } else {
        // Load full data from NRB API, then sample
        const fullData = await fetchFromNRBApiRaw(upperCaseCurrencyCode, fromDate, toDate, unit);
        const { sampledData, samplingUsed: sUsed } = sampleData(fullData, rangeInDays);
        data = sampledData;
        samplingUsed = sUsed;
      }

      // 5. Cache and return
      const result = { data, samplingUsed };
      
      // --- FIX: ONLY CACHE IF DATA IS NOT EMPTY ---
      if (data && data.length > 0) {
        saveChartCache(cacheKey, result);
      }
      return result;
    },
    // --- FIX: This query should be enabled *after* the INR check is done (if INR), or immediately if not INR ---
    enabled: (upperCaseCurrencyCode === 'INR' ? !isCheckingINR : !!currencyInfo),
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: false, // Don't retry on rate-limit errors
  });

  // --- FIX: Set sampling state based on query result ---
  useEffect(() => {
    if (queryResult?.samplingUsed) {
      setCurrentSampling(queryResult.samplingUsed);
    }
  }, [queryResult]);

  const chartData = queryResult?.data;

  // --- Handlers ---
  const handleRangeChange = (newRange: RangeKey) => {
    if (newRange === 'custom') {
      setRange('custom');
      setShowDaily(false);
      return; // Wait for "Apply" click
    }
    
    setRange(newRange);
    setShowDaily(false);
  };

  const handleCustomApply = () => {
    if (!isValidDateString(customFromDate) || !isValidDateString(customToDate)) {
      toast.error("Invalid date format", { description: "Please use YYYY-MM-DD." });
      return;
    }
    if (!isValidDateRange(customFromDate, customToDate)) {
      toast.error("Invalid date range", { description: "Start date must be before end date." });
      return;
    }

    // Set showDaily to false to trigger a new query with sampling
    setShowDaily(false);
    // Invalidate just in case, though state change should trigger it
    queryClient.invalidateQueries({ queryKey: ['currency-chart', upperCaseCurrencyCode, 'custom', customFromDate, customToDate] });
  };

  const handleShowDaily = () => {
    setShowDaily(true);
  };

  // --- Memoized calculations ---
  const processedData = useMemo(() => {
    if (!chartData) return { chartData: [], stats: calculateStats([]) };
    // Use raw data for stats
    const stats = calculateStats(chartData);
    // Use processed data (gap-filled) for chart
    // Don't gap-fill for INR fixed, as it only has 2 points
    const filled = isINRFixed ? chartData : processChartData(chartData);
    return { chartData: filled, stats };
  }, [chartData, isINRFixed]);

  const changeColor = processedData.stats.change >= 0 ? 'text-green-600' : 'text-red-600';
  const pageTitle = `Historical Data for ${name} (${upperCaseCurrencyCode})`;
  const pageUrl = `https://forex.grisma.com.np/#/historical-data/${upperCaseCurrencyCode}`;
  const remainingRequests = getRemainingRequests();

  // Handle combined loading state
  const isPageLoading = isLoading || (upperCaseCurrencyCode === 'INR' && isCheckingINR);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            <Link to="/historical-charts" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to All Currencies
            </Link>
          </Button>
          
          <div className='flex items-center gap-4'>
            {cooldownTimer > 0 && (
              <div className="text-sm text-muted-foreground">
                Refresh available in: {cooldownTimer}s
              </div>
            )}
            
            {remainingRequests <= 5 && remainingRequests > 0 && (
              <div className="text-sm text-orange-600">
                {remainingRequests} chart requests remaining this hour
              </div>
            )}
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                  {getFlagEmoji(upperCaseCurrencyCode)}
                  {name} ({upperCaseCurrencyCode})
                </CardTitle>
                <CardDescription>
                  {country} | Official Unit: {unit}
                </CardDescription>
              </div>
              <div className="w-full sm:w-auto">
                <ShareButtons url={pageUrl} title={pageTitle} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={range} onValueChange={handleRangeChange as any}>
              <div className="overflow-x-auto scrollbar-hide border-b">
                <TabsList className="w-max">
                  {Object.entries(DATE_RANGES).map(([key, { label }]) => (
                    <TabsTrigger key={key} value={key} disabled={cooldownTimer > 0 || (isINRFixed && key !== 'custom' && key !== 'week') /* Allow changing tabs for INR, but data will be same */}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {range === 'custom' && (
                <div className="flex flex-wrap items-end gap-2 my-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex flex-col">
                    <label className="text-xs mb-1">From (YYYY-MM-DD)</label>
                    <DateInput
                      value={customFromDate}
                      onChange={(val) => setCustomFromDate(sanitizeDateInput(val))}
                      className="w-36 h-9"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs mb-1">To (YYYY-MM-DD)</label>
                    <DateInput
                      value={customToDate}
                      onChange={(val) => setCustomToDate(sanitizeDateInput(val))}
                      className="w-36 h-9"
                    />
                  </div>
                  <Button onClick={handleCustomApply} size="sm" disabled={isPageLoading || cooldownTimer > 0}>
                    Apply
                  </Button>
                </div>
              )}

              <div className="mt-6">
                {(isPageLoading || dailyLoadProgress !== null) && (
                  <div className="space-y-4">
                    <Skeleton className="h-[400px] w-full" />
                    {dailyLoadProgress !== null && (
                      <div className="space-y-2">
                        <Progress value={dailyLoadProgress} className="w-full" />
                        <p className="text-center text-sm text-muted-foreground">
                          Loading full daily data... {dailyLoadProgress.toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {isError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Chart</AlertTitle>
                    <AlertDescription>
                      {error instanceof Error ? error.message : 'Could not fetch historical data'}
                    </AlertDescription>
                  </Alert>
                )}

                {!isPageLoading && !isError && (!processedData.chartData || processedData.chartData.length === 0) && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Data Available</AlertTitle>
                    <AlertDescription>
                      There is no historical data available for {name} in this date range.
                    </AlertDescription>
                  </Alert>
                )}

                {!isPageLoading && !isError && processedData.chartData.length > 0 && (
                  <>
                    <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard title="Last Rate" value={processedData.stats.lastRate} decimals={4} />
                      <StatCard title="Period High" value={processedData.stats.high} decimals={4} colorClass="text-green-600" />
                      <StatCard title="Period Low" value={processedData.stats.low} decimals={4} colorClass="text-red-600" />
                      <StatCard 
                        title="Period Change" 
                        value={processedData.stats.changePercent} 
                        prefix=""
                        suffix="%" 
                        decimals={2} 
                        colorClass={changeColor} 
                      />
                    </div>
                  
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={processedData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(dateStr) => format(parseISO(dateStr), 'MMM yy')}
                            minTickGap={60}
                            dy={5}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis 
                            domain={['auto', 'auto']}
                            tickFormatter={(val) => val.toFixed(2)}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Line 
                            type="monotone" 
                            dataKey="buy" 
                            name="Buy (per 1 Unit)"
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2} 
                            dot={false}
                            connectNulls={false}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="sell" 
                            name="Sell (per 1 Unit)"
                            stroke="#ef4444" // red-500
                            strokeWidth={2} 
                            dot={false}
                            connectNulls={false}
                            strokeDasharray="5 5"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-xs text-muted-foreground text-center sm:text-left">
                        {isINRFixed ? `Showing fixed rate for INR (1 Unit = Rs. 1.60).` : 
                         showDaily ? `Showing full daily data (${chartData?.length || 0} points).` :
                         `Showing ${currentSampling} data (${chartData?.length || 0} points).`
                        } Gaps indicate missing data.
                      </p>
                      
                      {!showDaily && range !== 'week' && !isINRFixed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleShowDaily}
                          disabled={isPageLoading || cooldownTimer > 0}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Load Full Daily Data
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

// Stat Card Component
const StatCard: React.FC<{ 
  title: string; 
  value: number; 
  prefix?: string; 
  suffix?: string; 
  decimals?: number; 
  colorClass?: string 
}> = ({
  title,
  value,
  prefix = 'Rs. ',
  suffix = '',
  decimals = 2,
  colorClass = 'text-foreground'
}) => (
  <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg">
    <span className="text-xs text-muted-foreground uppercase">{title}</span>
    <span className={`text-lg font-bold ${colorClass}`}>
      {value > 0 && prefix === 'Rs. ' && '+'}
      {prefix}{value.toFixed(decimals)}{suffix}
    </span>
  </div>
);

export default CurrencyHistoricalData;
