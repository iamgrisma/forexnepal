import React, { useMemo, useState, useEffect, useRef } from 'react'; // Added useRef
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFlagEmoji, fetchFromNRBApi as fetchFromNRBApiRaw } from '../services/forexService';
import { fetchRatesForDateWithCache } from '../services/d1ForexService';
import { ChartDataPoint } from '../types/forex';
import { format, subDays, parseISO, addDays, differenceInDays, isValid, subYears } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Layout from '@/components/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowLeft, RefreshCw, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react'; // Added Download
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import ShareButtons from '@/components/ShareButtons';
import DateInput from '@/components/DateInput';
import { canMakeChartRequest, recordChartRequest, getRemainingRequests } from '@/utils/chartRateLimiter';
import { toast as sonnerToast } from 'sonner';
import { isValidDateString, isValidDateRange, sanitizeDateInput } from '../lib/validation';
import FlagIcon from '@/pages/FlagIcon'; // Import FlagIcon
import html2canvas from 'html2canvas'; // Import html2canvas

// --- Currency Info Map ---
// This map is necessary for units, names, and the new Next/Prev buttons
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
const ALL_CURRENCY_CODES = Object.keys(CURRENCY_MAP);

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
 * (Demand 2 & 3)
 * Fetches week data from DB (via internal API) with 5s timeout.
 * Falls back to NRB API *with rate limiting check*.
 */
const fetchWeekDataWithFallback = async (currency: string, fromDate: string, toDate: string, unit: number): Promise<ChartDataPoint[]> => {
  try {
    // Try DB first with 5 second timeout
    const dbResponse = await fetchWithTimeout(`/api/historical-rates?currency=${currency}&from=${fromDate}&to=${toDate}`, 5000);
    
    if (dbResponse.ok) {
      const result = await dbResponse.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        console.log('Loaded week data from DB');
        // Worker-side normalization is already done
        return result.data;
      }
    }
    throw new Error('DB fetch failed or returned no data');
  } catch (error) {
    console.warn('DB fetch failed or timed out, falling back to NRB API', error);

    // (Demand 10) Add rate limit check to the fallback path
    const limitCheck = canMakeChartRequest(7); // 'week' is 7 days
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason || 'Rate limit exceeded on fallback');
    }
    recordChartRequest(7);
    
    // Fallback to NRB API (imported)
    return fetchFromNRBApiRaw(currency, fromDate, toDate, unit);
  }
};

/**
 * (Demand 3 & 4)
 * Fetches full daily data from NRB API in 90-day chunks and NORMALIZES it.
 * Note: Rate limiting is handled by the *caller* of this function.
 */
const loadDailyDataInChunks = async (
  currency: string, 
  fromDate: string, 
  toDate: string,
  unit: number,
  onProgress: (progress: { percent: number, current: number, total: number }) => void
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

    // (Demand 9) Report progress
    onProgress({ percent: ((i + 1) / chunks) * 100, current: i + 1, total: chunks });
    
    // This is the external API call
    const chunkData = await fetchFromNRBApiRaw(
      currency,
      chunkFromDate,
      chunkToDate,
      unit
    );
    
    allData = [...allData, ...chunkData];
  }
  
  // De-duplicate (in case of overlapping chunk fetches) and sort
  const uniqueData = Array.from(new Map(allData.map(item => [item.date, item])).values());
  return uniqueData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * (Demand 1)
 * Generates a full array of data points for a fixed-rate currency,
 * plotting one point for *every single day* in the range.
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

  for (const d of data) {
    if (d.buy !== null) {
      firstRate = d.buy;
      break;
    }
  }
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

  if (low === Infinity) low = 0;
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
  samplingUsed: string; // "daily" or "daily (fixed)"
}

// Main Component
const CurrencyHistoricalData: React.FC = () => {
  const { currencyCode } = useParams<{ currencyCode: string }>();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>('week');
  const [dailyLoadProgress, setDailyLoadProgress] = useState<{ percent: number, current: number, total: number } | null>(null);
  const [cooldownTimer, setCooldownTimer] = useState<number>(0);
  const exportableCardRef = useRef<HTMLDivElement>(null); // --- NEW: Ref for the whole card ---
  
  // (Demand 4) State to trigger long-range (>3Y) queries
  const [isLongRangeJobRunning, setIsLongRangeJobRunning] = useState(false);

  // (Demand 4) Default custom range to 4 years
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const fourYearsAgoStr = format(subYears(new Date(), 4), 'yyyy-MM-dd');
  const [customFromDate, setCustomFromDate] = useState<string>(fourYearsAgoStr);
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

  // (Demand 1) Query to check if INR rate is fixed
  const { data: inrCheckData, isFetching: isCheckingINR } = useQuery({
    queryKey: ['currentRateCheckINR', upperCaseCurrencyCode],
    queryFn: () => fetchRatesForDateWithCache(format(new Date(), 'yyyy-MM-dd'), null),
    enabled: upperCaseCurrencyCode === 'INR',
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });

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
      return { fromDate: fourYearsAgoStr, toDate: todayStr, rangeInDays: 365 * 4 };
    }
    const days = DATE_RANGES[range]?.days || 7;
    return {
      fromDate: format(subDays(new Date(), days - 1), 'yyyy-MM-dd'),
      toDate: todayStr,
      rangeInDays: days
    };
  }, [range, customFromDate, customToDate, todayStr, fourYearsAgoStr]);

  // (Demand 4) Check if the current range is long (> 3 years)
  const isLongRange = rangeInDays > (365 * 3);

  // --- Main Data Fetching Query ---
  const { data: queryResult, isLoading, isError, error, isRefetching } = useQuery<QueryResult>({
    queryKey: ['currency-chart', upperCaseCurrencyCode, range, fromDate, toDate, isLongRangeJobRunning],
    queryFn: async () => {
      // (Demand 1) INR Special Case
      if (isINRFixed) {
        return { 
          data: generateINRFixedData(fromDate, toDate, unit), 
          samplingUsed: 'daily (fixed)' 
        };
      }

      // (Demand 2 & 3) "Week" Tab (DB-First with Fallback)
      if (range === 'week') {
        const data = await fetchWeekDataWithFallback(upperCaseCurrencyCode, fromDate, toDate, unit);
        return { data, samplingUsed: 'daily' };
      }

      // (Demand 3 & 4) All other tabs (1M+, Custom) use NRB API + 90-day chunking
      const limitCheck = canMakeChartRequest(rangeInDays);
      if (!limitCheck.allowed) {
        Promise.resolve().then(() => setCooldownTimer(limitCheck.cooldownSeconds!));
        throw new Error(limitCheck.reason || 'Rate limit exceeded on fallback');
      }
      recordChartRequest(rangeInDays);

      // (Demand 9) Set progress bar to 0%
      Promise.resolve().then(() => setDailyLoadProgress({ percent: 0, current: 0, total: 0 }));
      
      const data = await loadDailyDataInChunks(
        upperCaseCurrencyCode,
        fromDate,
        toDate,
        unit,
        (progress) => Promise.resolve().then(() => setDailyLoadProgress(progress))
      );
      
      Promise.resolve().then(() => setDailyLoadProgress(null));
      return { data, samplingUsed: 'daily' };
    },
    // (Demand 4) NEW: Enable logic
    enabled: !!(
      (upperCaseCurrencyCode === 'INR' ? !isCheckingINR : !!currencyInfo) && // Base check
      (!isLongRange || isLongRangeJobRunning) // -> AND ( (NOT long range) OR (IS long range AND button clicked) )
    ),
    staleTime: 1000 * 60 * 10,
    retry: false, // Don't retry on rate-limit errors
    // (Demand 11) NO CACHING
  });

  const chartData = queryResult?.data;

  // --- Handlers ---
  const handleRangeChange = (newRange: RangeKey) => {
    // (Demand 5) This triggers the lazy-loading query
    setRange(newRange);
    // (Demand 4) Reset the "load data" button click state
    setIsLongRangeJobRunning(false); 
  };

  const handleCustomApply = () => {
    if (!isValidDateString(customFromDate) || !isValidDateString(customToDate)) {
      sonnerToast.error("Invalid date format", { description: "Please use YYYY-MM-DD." });
      return;
    }
    if (!isValidDateRange(customFromDate, customToDate)) {
      sonnerToast.error("Invalid date range", { description: "Start date must be before end date." });
      return;
    }
    // (Demand 4) Reset the "load data" button click state
    setIsLongRangeJobRunning(false);
  };

  // --- UPDATED: Export Chart Function ---
  const handleExportChart = async () => {
    // --- FIX: Target the new card ref ---
    if (!exportableCardRef.current) {
      sonnerToast.error("Chart element not found.");
      return;
    }

    sonnerToast.info("Generating chart image...", { description: "This may take a moment." });

    try {
      // --- FIX: Target the new card ref ---
      const canvas = await html2canvas(exportableCardRef.current, {
        scale: 3, // 3x resolution for "full size" image
        backgroundColor: '#ffffff', // Explicit white background
        useCORS: true, // Allow loading flags from CDN
      });

      const link = document.createElement('a');
      link.download = `forex-chart-${upperCaseCurrencyCode}-${range}-${toDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      sonnerToast.success("Chart downloaded successfully!");

    } catch (err) {
      console.error("Failed to export chart:", err);
      sonnerToast.error("Failed to generate chart image.", { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  };
  // --- END UPDATED FUNCTION ---

  // (Demand 5) Next/Prev Currency Buttons
  const { prevCurrencyCode, nextCurrencyCode } = useMemo(() => {
    const currentIndex = ALL_CURRENCY_CODES.indexOf(upperCaseCurrencyCode);
    if (currentIndex === -1) return { prevCurrencyCode: null, nextCurrencyCode: null };
    
    const prevIndex = (currentIndex - 1 + ALL_CURRENCY_CODES.length) % ALL_CURRENCY_CODES.length;
    const nextIndex = (currentIndex + 1) % ALL_CURRENCY_CODES.length;
    
    return {
      prevCurrencyCode: ALL_CURRENCY_CODES[prevIndex],
      nextCurrencyCode: ALL_CURRENCY_CODES[nextIndex],
    };
  }, [upperCaseCurrencyCode]);

  const navigateCurrency = (code: string | null) => {
    if (code) {
      navigate(`/historical-data/${code}`);
    }
  };

  // --- Memoized calculations ---
  const processedData = useMemo(() => {
    if (!chartData) return { chartData: [], stats: calculateStats([]) };
    const stats = calculateStats(chartData);
    // (Demand 1) CRITICAL: Do not gap-fill INR data
    const filled = isINRFixed ? chartData : processChartData(chartData);
    return { chartData: filled, stats };
  }, [chartData, isINRFixed]);

  const changeColor = processedData.stats.change >= 0 ? 'text-green-600' : 'text-red-600';
  const pageTitle = `Historical Data for ${name} (${upperCaseCurrencyCode})`;
  const pageUrl = `https://forex.grisma.com.np/#/historical-data/${upperCaseCurrencyCode}`;
  const remainingRequests = getRemainingRequests();

  // Handle combined loading state
  const isPageLoading = (isLoading && !isRefetching) || (upperCaseCurrencyCode === 'INR' && isCheckingINR);
  const isUpdating = isRefetching || (isLoading && !isPageLoading);

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
              <div className="text-sm text-red-600 font-medium">
                Please wait: {cooldownTimer}s
              </div>
            )}
            
            {remainingRequests <= 10 && (
              <div className="text-sm text-muted-foreground">
                {remainingRequests} reqs left
              </div>
            )}
          </div>
        </div>
        
        {/* --- NEW: Added ref to Card --- */}
        <Card ref={exportableCardRef}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* (Demand 5) Next/Prev Buttons */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateCurrency(prevCurrencyCode)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center sm:text-left">
                  <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                    {/* --- FIX: Use FlagIcon component --- */}
                    <FlagIcon iso3={upperCaseCurrencyCode} className="text-3xl" />
                    {name} ({upperCaseCurrencyCode})
                  </CardTitle>
                  <CardDescription>
                    {country} | Official Unit: {unit}
                  </CardDescription>
                </div>
                 <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateCurrency(nextCurrencyCode)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* --- FIX: Added flex-wrap and justify-end --- */}
              <div className="w-full sm:w-auto flex flex-wrap items-center justify-start sm:justify-end gap-2">
          <ShareButtons 
            title={pageTitle}
          />
                {/* --- NEW: Export Button --- */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={handleExportChart}
                  disabled={isPageLoading || isUpdating || !processedData.chartData || processedData.chartData.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Chart
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={range} onValueChange={handleRangeChange as any}>
              <div className="overflow-x-auto scrollbar-hide border-b">
                <TabsList className="w-max">
                  {Object.entries(DATE_RANGES).map(([key, { label }]) => (
                    <TabsTrigger key={key} value={key} disabled={isUpdating || cooldownTimer > 0}>
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
                  <Button onClick={handleCustomApply} size="sm" disabled={isPageLoading || isUpdating || cooldownTimer > 0}>
                    Apply
                  </Button>
                </div>
              )}

              <div className="mt-6 relative min-h-[400px]">
                {/* Loading state for initial page load */}
                {isPageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Skeleton className="h-[400px] w-full" />
                  </div>
                )}
                
                {/* (Demand 4) NEW: Button for long-range data */}
                {isLongRange && !isLongRangeJobRunning && !isPageLoading && !isError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 space-y-4">
                    <p className="text-lg font-medium text-center">Load {DATE_RANGES[range].label} Data?</p>
                    <p className="text-sm text-muted-foreground text-center max-w-xs">
                      Fetching full daily data for this range may take some time.
                    </p>
                    <Button
                      size="lg"
                      onClick={() => setIsLongRangeJobRunning(true)} // This triggers the query
                      disabled={isUpdating || cooldownTimer > 0}
                    >
                      {cooldownTimer > 0 ? `Please wait ${cooldownTimer}s` : "Load Daily Data"}
                    </Button>
                  </div>
                )}
                
                {/* (Demand 9) NEW: Progress Bar / Loading Overlay */}
                {(dailyLoadProgress !== null || (isUpdating && !isPageLoading)) && (
                   <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    {dailyLoadProgress !== null && (
                      <div className="w-1/2 max-w-xs space-y-2">
                        <p className="text-center text-sm text-muted-foreground">
                          {dailyLoadProgress.current > 0 
                            ? `Fetched chunk ${dailyLoadProgress.current} of ${dailyLoadProgress.total}...`
                            : "Starting data fetch..."}
                        </p>
                        <Progress value={dailyLoadProgress.percent} />
                        <p className="text-center text-xs text-muted-foreground">
                          {dailyLoadProgress.percent.toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error state */}
                {isError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Chart</AlertTitle>
                    <AlertDescription>
                      {error instanceof Error ? error.message : 'Could not fetch historical data'}
                    </AlertDescription>
                  </Alert>
                )}

                {/* No data state */}
                {!isPageLoading && !isError && (!processedData.chartData || processedData.chartData.length === 0) && (!isLongRange || isLongRangeJobRunning) && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Data Available</AlertTitle>
                    <AlertDescription>
                      There is no historical data available for {name} in this date range.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Chart display state */}
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
                  
                    {/* This div is no longer the main export target, but remains for layout */}
                    <div className="h-[400px] w-full" id="chart-to-export">
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
                         `Showing full daily data (${chartData?.length || 0} points).`
                        } Gaps indicate missing data.
                      </p>
                      
                      {/* "Show Daily" button is no longer needed as per new logic */}
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
