import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { fetchHistoricalRates, getFlagEmoji } from '@/services/forexService';
import { ChartDataPoint } from '@/types/forex';
import { format, subDays, parseISO, addDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Layout from '@/components/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ShareButtons from '@/components/ShareButtons';
import { canMakeChartRequest, recordChartRequest, getRemainingRequests } from '@/utils/chartRateLimiter';
import { toast } from 'sonner';

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
type RangeKey = 'week' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';
const DATE_RANGES: Record<RangeKey, { days: number, label: string }> = {
  'week': { days: 7, label: 'Week' },
  '1M': { days: 30, label: '1 Month' },
  '3M': { days: 90, label: '3 Months' },
  '6M': { days: 180, label: '6 Months' },
  '1Y': { days: 365, label: '1 Year' },
  '3Y': { days: 365 * 3, label: '3 Years' },
  '5Y': { days: 365 * 5, label: '5 Years' },
};

// Cache key for chart data
const getChartCacheKey = (currency: string, range: string) => `chart_cache_${currency}_${range}`;

// Save/load chart data to/from localStorage
const saveChartCache = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    console.error('Failed to cache chart data');
  }
};

const loadChartCache = (key: string, maxAge: number = 3600000): any | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > maxAge) return null;
    return data;
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

// Fetch week data from DB with fallback to NRB API
const fetchWeekData = async (currency: string, fromDate: string, toDate: string): Promise<ChartDataPoint[]> => {
  try {
    // Try DB first with 5 second timeout
    const dbResponse = await fetchWithTimeout(`/api/historical-rates?from=${fromDate}&to=${toDate}`, 5000);
    
    if (dbResponse.ok) {
      const result = await dbResponse.json();
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        // Convert wide format to chart data
        const chartData: ChartDataPoint[] = [];
        result.data.forEach((day: any) => {
          const buy = day[`${currency}_buy`];
          const sell = day[`${currency}_sell`];
          if (buy && sell) {
            chartData.push({
              date: day.date,
              buy: Number(buy),
              sell: Number(sell),
            });
          }
        });
        
        if (chartData.length > 0) {
          console.log('Loaded week data from DB');
          return chartData;
        }
      }
    }
  } catch (error) {
    console.warn('DB fetch failed or timed out, falling back to NRB API');
  }
  
  // Fallback to NRB API
  return fetchFromNRBApi(currency, fromDate, toDate);
};

// Fetch from NRB API
const fetchFromNRBApi = async (currency: string, fromDate: string, toDate: string): Promise<ChartDataPoint[]> => {
  const result = await fetchHistoricalRates(fromDate, toDate);
  
  if (!result.payload || result.payload.length === 0) {
    return [];
  }
  
  const chartData: ChartDataPoint[] = [];
  result.payload.forEach((day: any) => {
    const rate = day.rates?.find((r: any) => r.currency?.iso3 === currency);
    if (rate && rate.buy && rate.sell) {
      chartData.push({
        date: day.date,
        buy: Number(rate.buy),
        sell: Number(rate.sell),
      });
    }
  });
  
  return chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Load daily data in 90-day chunks
const loadDailyDataInChunks = async (
  currency: string, 
  fromDate: string, 
  toDate: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<ChartDataPoint[]> => {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const chunkSize = 90;
  const chunks = Math.ceil(daysDiff / chunkSize);
  
  let allData: ChartDataPoint[] = [];
  
  for (let i = 0; i < chunks; i++) {
    const chunkStart = new Date(from);
    chunkStart.setDate(chunkStart.getDate() + (i * chunkSize));
    
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + chunkSize - 1);
    if (chunkEnd > to) chunkEnd.setTime(to.getTime());
    
    const chunkData = await fetchFromNRBApi(
      currency,
      format(chunkStart, 'yyyy-MM-dd'),
      format(chunkEnd, 'yyyy-MM-dd')
    );
    
    allData = [...allData, ...chunkData];
    onProgress?.(i + 1, chunks);
  }
  
  return allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Calculate statistics
const calculateStats = (data: ChartDataPoint[], unit: number) => {
  if (data.length === 0) {
    return { high: 0, low: 0, change: 0, changePercent: 0, firstRate: 0, lastRate: 0, unit };
  }

  let high = 0;
  let low = Infinity;
  data.forEach(d => {
    if (d.buy && d.buy > high) high = d.buy;
    if (d.buy && d.buy < low) low = d.buy;
  });

  const firstRate = data[0]?.buy || 0;
  const lastRate = data[data.length - 1]?.buy || 0;
  const change = lastRate - firstRate;
  const changePercent = firstRate > 0 ? (change / firstRate) * 100 : 0;

  return { high, low, change, changePercent, firstRate, lastRate, unit };
};

// Process chart data (gap-fill for line breaks)
const processChartData = (data: ChartDataPoint[]): ChartDataPoint[] => {
  if (data.length === 0) return [];
  
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
        <p className="text-blue-500 text-xs">Buy: {data.buy.toFixed(4)}</p>
        <p className="text-green-500 text-xs">Sell: {data.sell.toFixed(4)}</p>
      </div>
    );
  }
  return null;
};

// Main Component
const CurrencyHistoricalData: React.FC = () => {
  const { currencyCode } = useParams<{ currencyCode: string }>();
  const [range, setRange] = useState<RangeKey>('week');
  const [showDaily, setShowDaily] = useState(false);
  const [dailyLoadProgress, setDailyLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [cooldownTimer, setCooldownTimer] = useState<number>(0);

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

  // Calculate date range
  const rangeInDays = DATE_RANGES[range]?.days || 7;
  const fromDate = format(subDays(new Date(), rangeInDays - 1), 'yyyy-MM-dd');
  const toDate = format(new Date(), 'yyyy-MM-dd');

  // Check rate limit before fetching
  const handleRangeChange = (newRange: RangeKey) => {
    const newRangeInDays = DATE_RANGES[newRange]?.days || 7;
    const limitCheck = canMakeChartRequest(newRangeInDays);
    
    if (!limitCheck.allowed) {
      toast.error(limitCheck.reason || 'Rate limit exceeded');
      if (limitCheck.cooldownSeconds) {
        setCooldownTimer(limitCheck.cooldownSeconds);
      }
      return;
    }
    
    setRange(newRange);
    setShowDaily(false);
    recordChartRequest(newRangeInDays);
  };

  // Fetch chart data
  const { data: chartData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['currency-chart', upperCaseCurrencyCode, range, showDaily],
    queryFn: async () => {
      // Check cache first
      const cacheKey = getChartCacheKey(upperCaseCurrencyCode, `${range}_${showDaily}`);
      const cached = loadChartCache(cacheKey);
      if (cached) {
        console.log('Loaded from cache');
        return cached;
      }

      let data: ChartDataPoint[];
      
      if (showDaily) {
        // Load daily data in chunks
        data = await loadDailyDataInChunks(
          upperCaseCurrencyCode,
          fromDate,
          toDate,
          (loaded, total) => setDailyLoadProgress({ loaded, total })
        );
        setDailyLoadProgress(null);
      } else if (range === 'week') {
        // Use DB for week, fallback to API
        data = await fetchWeekData(upperCaseCurrencyCode, fromDate, toDate);
      } else {
        // Use NRB API for longer ranges
        data = await fetchFromNRBApi(upperCaseCurrencyCode, fromDate, toDate);
      }

      // Cache the data
      saveChartCache(cacheKey, data);
      return data;
    },
    enabled: !!upperCaseCurrencyCode && upperCaseCurrencyCode !== 'UNKNOWN',
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const processedData = useMemo(() => {
    if (!chartData) return { chartData: [], stats: calculateStats([], unit) };
    const filled = processChartData(chartData);
    return { chartData: filled, stats: calculateStats(chartData, unit) };
  }, [chartData, unit]);

  const changeColor = processedData.stats.change >= 0 ? 'text-green-600' : 'text-red-600';
  const pageTitle = `Historical Data for ${name} (${upperCaseCurrencyCode})`;
  const pageUrl = `https://forexnepal.com/historical-data/${upperCaseCurrencyCode}`;
  const remainingRequests = getRemainingRequests();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="outline" size="sm" asChild>
            <Link to="/historical-charts" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to All Currencies
            </Link>
          </Button>
          
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
                    <TabsTrigger key={key} value={key} disabled={cooldownTimer > 0}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="mt-6">
                {isLoading && (
                  <div className="space-y-4">
                    <Skeleton className="h-[400px] w-full" />
                    {dailyLoadProgress && (
                      <div className="text-center text-sm text-muted-foreground">
                        Loading daily data: {dailyLoadProgress.loaded} / {dailyLoadProgress.total} chunks
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

                {!isLoading && !isError && processedData.chartData.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Data Available</AlertTitle>
                    <AlertDescription>
                      There is no historical data available for {name} in this date range.
                    </AlertDescription>
                  </Alert>
                )}

                {!isLoading && !isError && processedData.chartData.length > 0 && (
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
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2} 
                            dot={false}
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-xs text-muted-foreground text-center sm:text-left">
                        {showDaily ? 'Showing daily data' : 'Showing per-unit normalized "Buy" rate'}. Gaps indicate missing data.
                      </p>
                      
                      {!showDaily && range !== 'week' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const limitCheck = canMakeChartRequest(rangeInDays);
                            if (!limitCheck.allowed) {
                              toast.error(limitCheck.reason || 'Rate limit exceeded');
                              if (limitCheck.cooldownSeconds) {
                                setCooldownTimer(limitCheck.cooldownSeconds);
                              }
                              return;
                            }
                            setShowDaily(true);
                            recordChartRequest(rangeInDays);
                          }}
                          disabled={isLoading || cooldownTimer > 0}
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
