import React, { useEffect, useMemo, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
// Import services
import { fetchForexRatesByDate, formatDateLong, getFlagEmoji } from '../services/forexService';
import { fetchRatesForDateWithCache } from '../services/d1ForexService';
// Import types
import { Rate, RatesData, HistoricalRates, ChartDataPoint } from '../types/forex';
import { format, parseISO, addDays, subDays, isValid, startOfDay, isBefore, differenceInDays } from 'date-fns';
import Layout from '@/components/Layout';
import ForexTicker from '@/components/ForexTicker';
import ShareButtons from '@/components/ShareButtons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

// --- CURRENCY MAP (Needed for stats) ---
const CURRENCY_MAP: { [key: string]: { name: string, unit: number } } = {
    'INR': { name: 'Indian Rupee', unit: 100 },
    'USD': { name: 'U.S. Dollar', unit: 1 },
    'EUR': { name: 'European Euro', unit: 1 },
    'GBP': { name: 'UK Pound Sterling', unit: 1 },
    'CHF': { name: 'Swiss Franc', unit: 1 },
    'AUD': { name: 'Australian Dollar', unit: 1 },
    'CAD': { name: 'Canadian Dollar', unit: 1 },
    'SGD': { name: 'Singapore Dollar', unit: 1 },
    'JPY': { name: 'Japanese Yen', unit: 10 },
    'CNY': { name: 'Chinese Yuan', unit: 1 },
    'SAR': { name: 'Saudi Arabian Riyal', unit: 1 },
    'QAR': { name: 'Qatari Riyal', unit: 1 },
    'THB': { name: 'Thai Baht', unit: 1 },
    'AED': { name: 'U.A.E Dirham', unit: 1 },
    'MYR': { name: 'Malaysian Ringgit', unit: 1 },
    'KRW': { name: 'South Korean Won', unit: 100 },
    'SEK': { name: 'Swedish Kroner', unit: 1 },
    'DKK': { name: 'Danish Kroner', unit: 1 },
    'HKD': { name: 'Hong Kong Dollar', unit: 1 },
    'KWD': { name: 'Kuwaity Dinar', unit: 1 },
    'BHD': { name: 'Bahrain Dinar', unit: 1 },
    'OMR': { name: 'Omani Rial', unit: 1 }
};
const ALL_CURRENCY_CODES = Object.keys(CURRENCY_MAP);
const MAJOR_CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SAR', 'AED', 'QAR', 'JPY', 'MYR', 'KRW', 'INR'];


// --- TYPES (Self-Contained) ---
export type AnalyzedRate = Rate & {
  normalizedBuy: number;
  normalizedSell: number;
  dailyChange: number; // Normalized (per-unit) change vs. previous day
  dailyChangePercent: number;
};
export type HistoricalChange = {
  iso3: string;
  name: string;
  unit: number;
  change: number;
  percent: number;
  oldRate: number;
  newRate: number;
};

export type HistoricalAnalysisData = {
  data: HistoricalChange[];
  isLoading: boolean;
};
export type ArticleTemplateProps = {
  analysisData: {
    allRates: AnalyzedRate[];
    top10High: AnalyzedRate[];
    top12Low: AnalyzedRate[];
    topGainer: AnalyzedRate;
    topLoser: AnalyzedRate;
  };
  historicalAnalysis: {
    weekly: HistoricalAnalysisData;
    monthly: HistoricalAnalysisData;
    quarterly: HistoricalAnalysisData;
    yearly: HistoricalAnalysisData;
    fiveYear: HistoricalAnalysisData;
    longTerm: HistoricalAnalysisData;
  };
  formattedDate: string;
  shortDate: string;
  rates: Rate[];
  activeTab: string;
  onTabChange: (tab: string) => void;
};

// This function now only fetches the START and END dates for the range,
// as that is all the Historical Performance tabs need.
const fetchHistoricalRatesFromWorker = async (
    fromDate: string, 
    toDate: string, 
    sampling: string = 'daily' // Sampling param is now ignored, but kept for compatibility
): Promise<HistoricalRates> => {
  try {
    // We only need two dates: the start and the end.
    // We fetch them in parallel from the API endpoint.
    // This will hit the /api/historical-rates endpoint which is optimized
    // for single-day "wide" table lookups. This will be 2 row reads.
    const [fromResponse, toResponse] = await Promise.all([
      fetch(`/api/historical-rates?from=${fromDate}&to=${fromDate}`),
      fetch(`/api/historical-rates?from=${toDate}&to=${toDate}`)
    ]);

    if (!fromResponse.ok || !toResponse.ok) {
        console.warn(`Could not fetch boundary dates: ${fromDate}, ${toDate}`);
        return { status: { code: 404, message: "No data found" }, payload: [] };
    }

    const fromData: RatesData | null = await fromResponse.json(); // This is a RatesData object
    const toData: RatesData | null = await toResponse.json();   // This is a RatesData object

    const payload: RatesData[] = [];
    // Ensure data is valid and has rates before pushing
    if (fromData && fromData.rates && fromData.rates.length > 0) {
      payload.push(fromData);
    }
    // Only add the 'toData' if it's different from 'fromData' and is valid
    if (toData && toData.rates && toData.rates.length > 0 && fromDate !== toDate) {
      payload.push(toData);
    }

    if (payload.length === 0) {
       return { status: { code: 404, message: "No data found for boundaries" }, payload: [] };
    }
    
    // Return the two rows (or one) in the same format as the old API
    return {
      status: { code: 200, message: "OK" },
      payload: payload,
    };

  } catch (error) {
    console.error("Failed to fetch historical boundary rates:", error);
    throw error; // Let react-query handle the error
  }
};

// --- MAIN PAGE COMPONENT ---
const ArchiveDetail = () => {
  const params = useParams();
  const date = params["*"];
  const targetDateStr = date ?? null;
  
  // --- Date Validation ---
  let targetDate = new Date();
  let isValidDate = false;
  if (targetDateStr) {
    try {
      const parsedDate = parseISO(targetDateStr);
      if (isValid(parsedDate)) {
        targetDate = startOfDay(parsedDate);
        isValidDate = true;
      }
    } catch (e) { console.error('Error parsing date:', e); }
  }
  
  const formattedDate = formatDateLong(targetDate);
  const shortDate = format(targetDate, 'yyyy-MM-dd');

  // --- Data Fetching ---
  
  // Fetch Target Day's Data (DB-First, API-Fallback)
  const { data: currentDayData, isLoading: currentDayLoading, isError: isCurrentDayError } = useQuery({
    queryKey: ['forex-archive-day', targetDateStr],
    queryFn: () => fetchRatesForDateWithCache(shortDate, null), // DB-First
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Fetch Previous Day's Data (DB-First, API-Fallback)
  const { data: prevDayData, isLoading: prevDayLoading } = useQuery({
    queryKey: ['forex-archive-prev-day', targetDateStr],
    queryFn: () => fetchRatesForDateWithCache(format(subDays(targetDate, 1), 'yyyy-MM-dd'), null), // DB-First
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // --- State for lazy loading tabs ---
  const [activeTab, setActiveTab] = React.useState<string>('7day');

  // --- Historical Data Queries (Lazy Loading) ---
  const fetchRange = (days: number, sampling: string) => {
    const from = format(subDays(targetDate, days - 1), 'yyyy-MM-dd');
    const to = shortDate;
    return fetchHistoricalRatesFromWorker(from, to, sampling);
  }

  // Week data loads by default
  const { data: weekData, isLoading: weekLoading } = useQuery({
    queryKey: ['historical-7-day', targetDateStr],
    queryFn: () => fetchRange(7, 'daily'),
    enabled: isValidDate,
    staleTime: Infinity,
  });

  // Other ranges load only when their tab is active
  const { data: monthData, isLoading: monthLoading } = useQuery({
    queryKey: ['historical-30-day', targetDateStr],
    queryFn: () => fetchRange(30, 'daily'),
    enabled: isValidDate && activeTab === '30day',
    staleTime: Infinity,
  });
  
  const { data: quarterlyData, isLoading: quarterlyLoading } = useQuery({
    queryKey: ['historical-90-day', targetDateStr],
    queryFn: () => fetchRange(90, 'daily'),
    enabled: isValidDate && activeTab === '90day',
    staleTime: Infinity,
  });

  const { data: yearData, isLoading: yearLoading } = useQuery({
    queryKey: ['historical-365-day', targetDateStr],
    queryFn: () => fetchRange(365, 'weekly'),
    enabled: isValidDate && activeTab === '365day',
    staleTime: Infinity,
  });
  
  const { data: fiveYearData, isLoading: fiveYearLoading } = useQuery({
    queryKey: ['historical-5-year', targetDateStr],
    queryFn: () => fetchRange(365 * 5, 'monthly'),
    enabled: isValidDate && activeTab === '5year',
    staleTime: Infinity,
  });

  const { data: longTermData, isLoading: longTermLoading } = useQuery({
    queryKey: ['historical-long-term', targetDateStr],
    queryFn: () => fetchHistoricalRatesFromWorker('2000-01-01', shortDate, 'monthly'),
    enabled: isValidDate && activeTab === 'longterm',
    staleTime: Infinity,
  });
  
  // --- Data Analysis (Memoized) ---
  const analysisData = useMemo(() => {
    if (!currentDayData?.rates) return null;

    const currentRates = currentDayData.rates;
    const prevDayRates = prevDayData?.rates || [];

    const analyzedRates: AnalyzedRate[] = currentRates.map(rate => {
      const buy = Number(rate.buy);
      const sell = Number(rate.sell);
      const unit = rate.currency.unit || 1;
      const normalizedBuy = buy / unit;
      const normalizedSell = sell / unit;

      const prevRate = prevDayRates.find(pr => pr.currency.iso3 === rate.currency.iso3);
      const prevBuy = prevRate ? (Number(prevRate.buy) / (prevRate.currency.unit || 1)) : 0;
      
      const dailyChange = prevRate ? (normalizedBuy - prevBuy) : 0;
      const dailyChangePercent = (prevRate && prevBuy > 0) ? (dailyChange / prevBuy) * 100 : 0;

      return {
        ...rate,
        buy,
        sell,
        normalizedBuy,
        normalizedSell,
        dailyChange,
        dailyChangePercent,
      };
    });
    
    const filteredRates = analyzedRates.filter(r => r.currency.iso3 !== 'INR');
    const safeFilteredRates = filteredRates.length > 0 ? filteredRates : analyzedRates;

    const sortedRatesHigh = [...safeFilteredRates].sort((a, b) => b.normalizedSell - a.normalizedSell);
    const top10High = sortedRatesHigh.slice(0, 10);
    
    const sortedRatesLow = [...analyzedRates].sort((a, b) => a.normalizedSell - b.normalizedSell);
    const top12Low = sortedRatesLow.slice(0, 12);

    const topGainer = [...safeFilteredRates].sort((a, b) => b.dailyChangePercent - a.dailyChangePercent)[0] || analyzedRates[0];
    const topLoser = [...safeFilteredRates].sort((a, b) => a.dailyChangePercent - b.dailyChangePercent)[0] || analyzedRates[0];

    return {
      allRates: analyzedRates,
      top10High,
      top12Low,
      topGainer,
      topLoser,
    };
  }, [currentDayData, prevDayData]);

  // Helper to process historical data
  const processHistoricalData = (data: HistoricalRates | undefined, allCurrentRates: AnalyzedRate[]): HistoricalChange[] => {
    if (!data?.payload || data.payload.length < 1 || !allCurrentRates) return [];
    
    const oldestDay = data.payload[0];
    const latestDay = data.payload[data.payload.length - 1];

    if (!oldestDay || !latestDay) return [];

    return allCurrentRates
      .filter(r => r.currency.iso3 !== 'INR')
      .map(currentRate => {
        const oldRateData = oldestDay.rates.find(r => r.currency.iso3 === currentRate.currency.iso3);
        const latestRateData = latestDay.rates.find(r => r.currency.iso3 === currentRate.currency.iso3);

        if (!oldRateData || !latestRateData) return null;

        const oldRate = Number(oldRateData.buy) / (oldRateData.currency.unit || 1);
        const newRate = Number(latestRateData.buy) / (latestRateData.currency.unit || 1);

        if (oldRate === 0) return null;
        const change = newRate - oldRate;
        const percent = (change / oldRate) * 100;

        return {
          iso3: currentRate.currency.iso3,
          name: currentRate.currency.name,
          unit: currentRate.currency.unit,
          change, percent, oldRate, newRate,
        };
      })
      .filter((r): r is HistoricalChange => r !== null) 
      .sort((a, b) => b.percent - a.percent); 
  };
  
  // --- Memoized Historical Data ---
  const historicalAnalysis = useMemo(() => {
    const defaultData = { data: [], isLoading: true };
    if (!analysisData) return {
      weekly: defaultData, monthly: defaultData, quarterly: defaultData,
      yearly: defaultData, fiveYear: defaultData, longTerm: defaultData,
    };
    return {
      weekly: { data: processHistoricalData(weekData, analysisData.allRates), isLoading: weekLoading },
      monthly: { data: processHistoricalData(monthData, analysisData.allRates), isLoading: monthLoading },
      quarterly: { data: processHistoricalData(quarterlyData, analysisData.allRates), isLoading: quarterlyLoading },
      yearly: { data: processHistoricalData(yearData, analysisData.allRates), isLoading: yearLoading },
      fiveYear: { data: processHistoricalData(fiveYearData, analysisData.allRates), isLoading: fiveYearLoading },
      longTerm: { data: processHistoricalData(longTermData, analysisData.allRates), isLoading: longTermLoading },
    };
  }, [
    analysisData, 
    weekData, monthData, quarterlyData, yearData, fiveYearData, longTermData,
    weekLoading, monthLoading, quarterlyLoading, yearLoading, fiveYearLoading, longTermLoading
  ]);

  // --- Render Logic ---
  const isLoading = currentDayLoading; // Only block on the main content
  const previousDate = format(subDays(targetDate, 1), 'yyyy-MM-dd');
  const nextDate = format(addDays(targetDate, 1), 'yyyy-MM-dd');
  const today = startOfDay(new Date());
  const canGoNext = isBefore(targetDate, today);

  useEffect(() => {
    document.title = `Foreign Exchange Rate for ${shortDate} | Nepal Rastra Bank`;
  }, [shortDate]);

  const PageSkeleton = () => (
    <div className="max-w-6xl mx-auto space-y-8">
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-6 w-full" /> <Skeleton className="h-6 w-5/6" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-96 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
  
  return (
    <Layout>
      <div className="container mx-auto px-4 pt-8">
        <div className="max-w-7xl mx-auto">
          <ForexTicker 
            rates={currentDayData?.rates || []} 
            previousDayRates={prevDayData?.rates || []}
            isLoading={currentDayLoading || prevDayLoading} 
          />
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <Button variant="outline" asChild className="flex-shrink-0 w-full sm:w-auto">
              <Link to="/archive" className="flex items-center gap-2 justify-center">
                <ArrowLeft className="h-4 w-4" /> Back to Archives
              </Link>
            </Button>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-initial">
                <Link to={`/daily-update/forex-for/${previousDate}`} className="flex items-center gap-1 justify-center">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Link>
              </Button>
              {canGoNext && (
                <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-initial">
                  <Link to={`/daily-update/forex-for/${nextDate}`} className="flex items-center gap-1 justify-center">
                    Next <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Share Buttons */}
          <div className="flex justify-center mb-6">
            <ShareButtons 
              url={`/daily-update/forex-for/${shortDate}`}
              title={`Nepal Rastra Bank Forex Rates for ${formattedDate}`}
            />
          </div>

          <article className="prose prose-lg max-w-none prose-h1:text-3xl md:prose-h1:text-4xl prose-h2:text-2xl prose-h2:border-b prose-h2:pb-2 prose-h2:mt-10 prose-h3:text-xl">
            {isLoading && <PageSkeleton />}
            
            {!isLoading && isCurrentDayError && (
              <Card className="not-prose bg-red-50 border-red-200">
                <CardHeader><CardTitle className="text-destructive">Error Loading Data</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground">There was an error loading the exchange rates for this date. Please try another date.</p></CardContent>
              </Card>
            )}

            {!isLoading && !isCurrentDayError && (!analysisData || analysisData.allRates.length === 0) && (
              <Card className="not-prose bg-blue-50 border-blue-200">
                <CardHeader><CardTitle>No Data Published</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">No exchange rate data was published by Nepal Rastra Bank for {shortDate}. This may be a weekend or public holiday.</p>
                  <Button asChild className="mt-4"><Link to="/">View Today's Rates</Link></Button>
                </CardContent>
              </Card>
            )}

            {/* Render the new single, dynamic article template */}
            {!isLoading && analysisData && analysisData.allRates.length > 0 && (
              <Suspense fallback={<PageSkeleton />}>
                <GeneratedArchiveArticle 
                  analysisData={analysisData}
                  historicalAnalysis={historicalAnalysis}
                  formattedDate={formattedDate}
                  shortDate={shortDate}
                  rates={currentDayData.rates}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </Suspense>
            )}

            {/* Disclaimer */}
            {!isLoading && analysisData && analysisData.allRates.length > 0 && (
              <div className="not-prose mt-12 p-4 bg-gray-50 rounded-lg border">
                <h3 className="text-base font-semibold mt-0">Important Disclaimer</h3>
                <p className="text-sm text-muted-foreground !mt-2">
                  The foreign exchange rates published by Nepal Rastra Bank are indicative rates. 
                  Actual rates offered by commercial banks and money exchangers may vary. 
                  This information is for general reference only. 
                  Always verify current rates with authorized financial institutions before conducting transactions.
                </p>
              </div>
            )}
          </article>
        </div>
      </div>
    </Layout>
  );
};

// === HELPER COMPONENTS (NEW & IMPROVED) ===

/**
 * Gets a color class based on the value
 */
const getChangeColor = (change: number) => {
  if (change > 0.0001) return 'text-green-600';
  if (change < -0.0001) return 'text-red-600';
  return 'text-gray-500';
};
const getChangeColorStrong = (change: number) => {
  if (change > 0.0001) return 'text-green-700 font-bold';
  if (change < -0.0001) return 'text-red-700 font-bold';
  return 'text-gray-600';
}

/**
 * Renders a change value with color and arrow
 */
const ChangeIndicator: React.FC<{ value: number, decimals?: number, unit?: 'Rs.' | '%' }> = ({ value, decimals = 2, unit = 'Rs.' }) => {
  const color = getChangeColor(value);
  let formattedValue = (value > 0 ? `+` : '') + value.toFixed(decimals);
  if (value > -0.0001 && value < 0.0001) formattedValue = value.toFixed(decimals);
  
  return (
    <span className={cn('font-medium inline-flex items-center text-xs', color)}>
      {value > 0.0001 && <TrendingUp className="h-3 w-3 mr-0.5" />}
      {value < -0.0001 && <TrendingDown className="h-3 w-3 mr-0.5" />}
      {value >= -0.0001 && value <= 0.0001 && <Minus className="h-3 w-3 mr-0.5" />}
      {formattedValue}{unit === '%' ? '%' : ''}
    </span>
  );
};

/**
 * Renders the new SIMPLIFIED data table (as requested)
 */
const SimplifiedRateTable: React.FC<{ rates: AnalyzedRate[], date: string }> = ({ rates, date }) => (
  <section>
    <h2 className="!mb-6">Official Rate Table ({date})</h2>
    <div className="not-prose overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Currency</TableHead>
            <TableHead className="text-center">Unit</TableHead>
            <TableHead className="text-right">Buy Rate (NPR)</TableHead>
            <TableHead className="text-right">Sell Rate (NPR)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rates.map((rate) => (
            <TableRow key={rate.currency.iso3}>
              <TableCell className="font-medium">
                {getFlagEmoji(rate.currency.iso3)} {rate.currency.name} ({rate.currency.iso3})
              </TableCell>
              <TableCell className="text-center">{rate.currency.unit}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-base">Rs. {rate.buy.toFixed(2)}</span>
                  <ChangeIndicator value={rate.dailyChange * rate.currency.unit} decimals={3} />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-base">Rs. {rate.sell.toFixed(2)}</span>
                  <ChangeIndicator value={rate.dailyChange * rate.currency.unit} decimals={3} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </section>
);

/**
 * Renders the Top 10 High / Top 12 Low Ranking Grids (as requested)
 */
const CurrencyRankings: React.FC<{ topHigh: AnalyzedRate[], topLow: AnalyzedRate[] }> = ({ topHigh, topLow }) => (
  <section>
    <h2>Currency Value Rankings (Per 1 Unit)</h2>
    <p>
      This ranking provides insight into the relative strength of foreign currencies against the Nepali Rupee. The "Most Expensive" list shows currencies where 1 unit commands the highest NPR value, often led by strong Middle Eastern dinars. The "Least Expensive" list shows currencies where 1 unit has the lowest NPR value, such as the Japanese Yen or Korean Won, which are typically traded in larger units.
    </p>
    <p>
      This per-unit comparison is useful for understanding relative value, but for practical conversions, always check the official units in the table above or use our <Link to='/converter' className='text-blue-600 hover:underline font-medium'>currency converter</Link>. Note: The pegged <Link to="/historical-data/INR" className="text-blue-600 hover:underline font-medium">Indian Rupee (INR)</Link> is included in the "Least Expensive" ranking where 100 INR equals approximately 160 NPR.
    </p>
    <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Todays Top 10 Most Expensive Currencies</CardTitle>
          <CardDescription>Ranked by per-unit sell rate.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2">
            {topHigh.map((rate) => (
              <li key={rate.currency.iso3} className="text-sm">
                <Link to={`/historical-data/${rate.currency.iso3}`} className="font-medium text-blue-600 hover:underline">
                  {getFlagEmoji(rate.currency.iso3)} {rate.currency.name}
                </Link>
                <span className="text-muted-foreground ml-2">Rs. {rate.normalizedSell.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Today's Top 12 Least Expensive Currencies</CardTitle>
          <CardDescription>Ranked by per-unit sell rate.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2">
            {topLow.map((rate) => (
              <li key={rate.currency.iso3} className="text-sm">
                <Link to={`/historical-data/${rate.currency.iso3}`} className="font-medium text-blue-600 hover:underline">
                  {getFlagEmoji(rate.currency.iso3)} {rate.currency.name}
                </Link>
                <span className="text-muted-foreground ml-2">Rs. {rate.normalizedSell.toFixed(4)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  </section>
);

/**
 * Renders the Historical Performance Tabs with lazy loading
 */
const HistoricalAnalysisTabs: React.FC<{ 
  analysis: ArticleTemplateProps['historicalAnalysis']; 
  activeTab: string; 
  onTabChange: (tab: string) => void 
}> = ({ analysis, activeTab, onTabChange }) => (
  <section>
    <h2>Historical Performance Analysis (vs. NPR)</h2>
    <p>
      Today's daily change is only part of the story. The following tabs show the performance of various currencies against the Nepali Rupee over extended timeframes, all ending on this report's date. Data is calculated on-demand when you select a tab.
    </p>
    <p>
      The analysis compares the normalized 'Buy' rate from the start of the period to the rate on this date. For a more detailed visual breakdown, please visit our interactive <Link to='/historical-charts' className='text-blue-600 hover:underline font-medium'>historical charts page</Link>.
    </p>
    <div className="not-prose">
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <div className="overflow-x-auto scrollbar-hide border-b">
          <TabsList className="w-max">
            <TabsTrigger value="7day">7 Days</TabsTrigger>
            <TabsTrigger value="30day">30 Days</TabsTrigger>
            <TabsTrigger value="90day">Quarterly</TabsTrigger>
            <TabsTrigger value="365day">1 Year</TabsTrigger>
            <TabsTrigger value="5year">5 Years</TabsTrigger>
            <TabsTrigger value="longterm">Since 2000</TabsTrigger>
          </TabsList>
        </div>
        <HistoricalTabContent data={analysis.weekly.data} isLoading={analysis.weekly.isLoading} value="7day" />
        <HistoricalTabContent data={analysis.monthly.data} isLoading={analysis.monthly.isLoading} value="30day" />
        <HistoricalTabContent data={analysis.quarterly.data} isLoading={analysis.quarterly.isLoading} value="90day" />
        <HistoricalTabContent data={analysis.yearly.data} isLoading={analysis.yearly.isLoading} value="365day" />
        <HistoricalTabContent data={analysis.fiveYear.data} isLoading={analysis.fiveYear.isLoading} value="5year" />
        <HistoricalTabContent data={analysis.longTerm.data} isLoading={analysis.longTerm.isLoading} value="longterm" />
      </Tabs>
    </div>
  </section>
);

/**
 * Renders a single tab's content
 */
const HistoricalTabContent: React.FC<{ data: HistoricalChange[]; isLoading: boolean; value: string }> = ({ data, isLoading, value }) => {
  if (isLoading) {
    return (
      <TabsContent value={value} className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        {Array(22).fill(0).map((_, i) => (
          <div key={i} className="flex justify-between py-3 border-b">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </TabsContent>
    )
  }
  if (!data || data.length === 0) {
    return (
      <TabsContent value={value}>
        <p className="text-muted-foreground py-4">No historical data available for this period.</p>
      </TabsContent>
    )
  }
  return (
    <TabsContent value={value}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        {data.map((item) => (
          <div key={item.iso3} className="flex items-center justify-between py-3 border-b border-gray-200">
            <Link to={`/historical-data/${item.iso3}`} className="font-medium text-sm text-blue-600 hover:underline">
              {getFlagEmoji(item.iso3)} {item.name}
            </Link>
            <div className="flex flex-col items-end">
              <ChangeIndicator value={item.change} decimals={4} />
              <ChangeIndicator value={item.percent} decimals={2} unit="%" />
            </div>
          </div>
        ))}
      </div>
    </TabsContent>
  );
};

// --- DYNAMIC CONTENT HELPERS ---

const getDynamicIntro = (date: string, gainer: AnalyzedRate, loser: AnalyzedRate) => {
  const gainerLink = `<a href="/#/historical-data/${gainer.currency.iso3}" class="font-bold text-green-700 hover:underline">${gainer.currency.name} (${gainer.currency.iso3})</a>`;
  const loserLink = `<a href="/#/historical-data/${loser.currency.iso3}" class="font-bold text-red-700 hover:underline">${loser.currency.name} (${loser.currency.iso3})</a>`;
  
  const intros = [
    `Nepal Rastra Bank (NRB) has officially released the foreign currency exchange rates for <strong>${date}</strong>. This detailed report provides a comprehensive analysis of today's currency values, highlighting significant daily fluctuations and placing them within the context of broader historical trends. As Nepal's economy remains closely tied to global markets, these figures are vital for businesses, remitters, and individuals alike.`,
    `Here is the definitive breakdown of Nepal's foreign exchange market for <strong>${date}</strong>, based on the reference rates published by Nepal Rastra Bank. Today's market bulletin reveals a day of mixed movements across the board. The ${gainerLink} emerged as the day's standout performer, while the ${loserLink} faced a notable decline. This report analyzes these changes and explores the long-term performance of major currencies against the Nepali Rupee.`,
    `On <strong>${date}</strong>, the Nepali Rupee (NPR) demonstrated varied performance against major international currencies according to the latest data from Nepal Rastra Bank. This daily analysis from ForexNepal details the official NRB rates, tracks the day's most significant movers, and provides crucial historical context for importers, exporters, and families receiving remittances.`,
    `Welcome to the official daily forex bulletin for <strong>${date}</strong>. Today's reference rates from Nepal Rastra Bank are now available, and this report dives deep into the numbers. We present a simplified rate table, analyze market rankings, and offer a comprehensive historical analysis to help you understand today's rates in the grander scheme of market movements.`,
  ];
  return intros[new Date(date).getDate() % intros.length]; // Use day of month for variety
};

const getDynamicCommentary = (gainer: AnalyzedRate, loser: AnalyzedRate, usd: AnalyzedRate) => {
  const gainerColor = "text-green-700 font-bold";
  const loserColor = "text-red-700 font-bold";
  const usdColor = getChangeColorStrong(usd.dailyChange);
  
  const gainerLink = `<a href="/#/historical-data/${gainer.currency.iso3}" class="${gainerColor} hover:underline">${gainer.currency.name} (${gainer.currency.iso3})</a>`;
  const loserLink = `<a href="/#/historical-data/${loser.currency.iso3}" class="${loserColor} hover:underline">${loser.currency.name} (${loser.currency.iso3})</a>`;
  const usdLink = `<a href="/#/historical-data/USD" class="${usdColor} hover:underline">U.S. Dollar (USD)</a>`;
  const gainerPercent = `(<span class="${gainerColor}">${gainer.dailyChangePercent > 0 ? '+' : ''}${gainer.dailyChangePercent.toFixed(2)}%</span>)`;
  const loserPercent = `(<span class="${loserColor}">${loser.dailyChangePercent.toFixed(2)}%</span>)`;

  const sentences = [
    `The primary benchmark for Nepal's economy, the ${usdLink}, saw a ${usd.dailyChange > 0.001 ? 'notable gain' : usd.dailyChange < -0.001 ? 'slight depreciation' : 'period of stability'}, moving by <span class="${usdColor}">${usd.dailyChange.toFixed(3)} NPR</span> per unit. Today, the dollar is trading with a buy rate of <strong>Rs. ${usd.buy.toFixed(2)}</strong> and a sell rate of <strong>Rs. ${usd.sell.toFixed(2)}</strong>. This movement is critical for tracking import costs and remittance values.`,
    `In today's trading, the standout performer was the ${gainerLink}, which appreciated significantly ${gainerPercent} against the NPR. This surge makes it the day's top gainer among major currencies.`,
    `Conversely, the ${loserLink} experienced the most significant decline, depreciating by ${loserPercent}. This makes it the day's biggest loser, impacting its value relative to the Rupee.`,
    `These daily fluctuations highlight the dynamic nature of the forex market. For those planning transactions, these changes are crucial. You can model potential conversions using our <a href="/#/converter" class="text-blue-600 hover:underline font-medium">currency converter</a>, which uses these official rates.`,
    `The ${usdLink} showed a ${usd.dailyChange >= 0 ? "gain" : "loss"} of <strong>Rs. ${Math.abs(usd.dailyChange).toFixed(3)}</strong> per unit, a key metric for Nepal's trade balance. Elsewhere, the ${gainerLink} led the pack ${gainerPercent}, while the ${loserLink} lagged behind ${loserPercent}.`,
  ];
  
  const day = new Date().getDate();
  const para1 = sentences[day % 2]; // 0 or 1
  const para2 = sentences[2 + (day % 2)]; // 2 or 3
  const para3 = sentences[4];

  return `
    <p>${para1}</p>
    <p>${para2}</p>
    <p>${para3}</p>
  `;
};

const getTrendSummary = (analysisData: ArticleTemplateProps['analysisData'], historicalAnalysis: ArticleTemplateProps['historicalAnalysis']) => {
  const { allRates } = analysisData;
  const gainersToday = allRates.filter(r => r.dailyChangePercent > 0.01 && r.currency.iso3 !== 'INR').length;
  const losersToday = allRates.filter(r => r.dailyChangePercent < -0.01 && r.currency.iso3 !== 'INR').length;
  const stableToday = allRates.filter(r => Math.abs(r.dailyChangePercent) <= 0.01 && r.currency.iso3 !== 'INR').length;

  let dailyTrend = 'a balanced market';
  if (gainersToday > losersToday * 1.5) dailyTrend = 'a strengthening trend';
  else if (losersToday > gainersToday * 1.5) dailyTrend = 'a weakening trend';

  const weeklyGainers = historicalAnalysis.weekly.data.filter(r => r.percent > 0).length;
  const weeklyLosers = historicalAnalysis.weekly.data.filter(r => r.percent < 0).length;
  let weeklyTrend = 'mixed signals';
  if (weeklyGainers > weeklyLosers * 1.3) weeklyTrend = 'broad strengthening';
  else if (weeklyLosers > weeklyGainers * 1.3) weeklyTrend = 'broad weakening';

  const monthlyGainers = historicalAnalysis.monthly.data.filter(r => r.percent > 0).length;
  const monthlyLosers = historicalAnalysis.monthly.data.filter(r => r.percent < 0).length;
  let monthlyTrend = 'general stability';
  if (monthlyGainers > monthlyLosers * 1.3) monthlyTrend = 'a clear appreciation pattern';
  else if (monthlyLosers > monthlyLosers * 1.3) monthlyTrend = 'a clear depreciation pattern';

  const topWeekly = historicalAnalysis.weekly.data[0];
  const topMonthly = historicalAnalysis.monthly.data[0];

  return `
    <p>
      <strong>Market Summary:</strong> Today's forex market shows ${dailyTrend}, with <strong>${gainersToday}</strong> currencies gaining value against the NPR, while <strong>${losersToday}</strong> lost ground and <strong>${stableToday}</strong> remained stable. This indicates a shift in market sentiment compared to yesterday.
    </p>
    <p>
      Looking at the weekly perspective, currencies have shown <strong>${weeklyTrend}</strong> against the NPR. The <strong class="text-green-600">${topWeekly?.name || 'N/A'}</strong> led this short-term trend with a <strong>+${topWeekly?.percent.toFixed(2) || '0.00'}%</strong> gain. On a 30-day basis, the market indicates <strong>${monthlyTrend}</strong>, with the <strong class="text-green-600">${topMonthly?.name || 'N/A'}</strong> posting the strongest performance at <strong>+${topMonthly?.percent.toFixed(2) || '0.00'}%</strong>.
    </p>
    <p>
      Key currencies such as the <a href="/#/historical-data/USD" class="text-blue-600 hover:underline font-medium">U.S. Dollar</a>, <a href="/#/historical-data/EUR" class="text-blue-600 hover:underline font-medium">Euro</a>, and <a href="/#/historical-data/SAR" class="text-blue-600 hover:underline font-medium">Saudi Riyal</a> showed ${Math.abs(analysisData.allRates.find(r => r.currency.iso3 === 'USD')?.dailyChangePercent || 0) < 0.1 ? 'minimal volatility' : 'notable movement'} today, which is particularly relevant for remittances and international trade.
    </p>
  `;
};

// === THE DYNAMIC ARTICLE COMPONENT ===

export const GeneratedArchiveArticle: React.FC<ArticleTemplateProps> = (props) => {
  const {
    analysisData,
    historicalAnalysis,
    formattedDate,
    shortDate,
    activeTab,
    onTabChange,
  } = props;

  if (!analysisData || analysisData.allRates.length === 0) {
    return null;
  }

  const { topGainer, topLoser, allRates, top10High, top12Low } = analysisData;
  const usdRate = allRates.find(r => r.currency.iso3 === 'USD');

  if (!usdRate || !topGainer || !topLoser) {
    return (
      <Card className="not-prose bg-red-50 border-red-200">
        <CardHeader><CardTitle className="text-destructive">Data Analysis Incomplete</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Could not analyze data for this day. Key currencies (USD) might be missing.</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <h1>Nepal Rastra Bank Forex Rates: {formattedDate}</h1>
      
      <p 
        className="text-lg lead text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: getDynamicIntro(formattedDate, topGainer, topLoser) }}
      />

      <SimplifiedRateTable rates={allRates} date={shortDate} />

      <section>
        <h2>Daily Market Commentary</h2>
        <div dangerouslySetInnerHTML={{ __html: getDynamicCommentary(topGainer, topLoser, usdRate) }} />
      </section>

      <CurrencyRankings topHigh={top10High} topLow={top12Low} />

      <HistoricalAnalysisTabs 
        analysis={historicalAnalysis} 
        activeTab={activeTab} 
        onTabChange={onTabChange} 
      />

      <section>
        <h2>Market Trend Summary</h2>
        <div dangerouslySetInnerHTML={{ __html: getTrendSummary(analysisData, historicalAnalysis) }} />
      </section>
    </>
  );
};

export default ArchiveDetail;
