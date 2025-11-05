import React, { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
// --- MODIFIED IMPORTS ---
import { formatDateLong, getFlagEmoji } from '@/services/forexService';
import { fetchRatesForDateWithCache, fetchHistoricalStats } from '@/services/d1ForexService'; // Import D1 services
import { Rate, RatesData, HistoricalRates } from '@/types/forex';
// ---
import { format, parseISO, addDays, subDays, isValid, startOfDay, isBefore } from 'date-fns';
import Layout from '@/components/Layout';
import ForexTicker from '@/components/ForexTicker';
import ShareButtons from '@/components/ShareButtons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

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
export type HighLow = {
  highBuy: number;
  lowBuy: number;
  highSell: number;
  lowSell: number;
  highBuyDate?: string;
  lowBuyDate?: string;
  highSellDate?: string;
  lowSellDate?: string;
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
  highLowData: {
    data: (HighLow & { iso3: string; name: string })[];
    isLoading: boolean;
  };
  allTimeHighLowData: {
    data: (HighLow & { iso3: string; name: string })[];
    isLoading: boolean;
  };
  formattedDate: string;
  shortDate: string;
  rates: Rate[]; // Pass raw rates for ticker
};

// --- List of currencies for stats (move to a shared config if needed) ---
const MAJOR_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SAR', 'AED', 'QAR', 'JPY', 'MYR', 'KRW',
  'INR', 'CHF', 'SGD', 'CNY', 'THB', 'SEK', 'DKK', 'HKD', 'KWD', 'BHD', 'OMR'
];


// --- Helper to fetch data for HISTORICAL TABS ---
// This function is fine as-is. It only fetches small ranges (e.g., 7 days)
// from the DB-backed endpoint, not the whole dataset.
const fetchHistoricalRatesFromWorker = async (fromDate: string, toDate: string): Promise<HistoricalRates> => {
  try {
    const response = await fetch(
      `/api/historical-rates?from=${fromDate}&to=${toDate}`
    );

    if (!response.ok) {
        if (response.status === 404) {
            console.warn(`No historical data found in range: ${fromDate} to ${toDate}`);
            return { status: { code: 404, message: "No data found for this range" }, payload: [] };
        }
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && Array.isArray(data.payload)) {
      return {
        status: { code: 200, message: "OK" },
        payload: data.payload || [],
      };
    }
    
    if (Array.isArray(data)) {
       return { status: { code: 200, message: "OK" }, payload: data };
    }
    
    throw new Error("Invalid data structure from historical API");

  } catch (error) {
    console.error("Failed to fetch historical forex rates:", error);
    throw error; 
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
  
  // MODIFIED: Fetch Target Day's Data (DB-First, API-Fallback)
  const { data: currentDayData, isLoading: currentDayLoading, isError: isCurrentDayError } = useQuery({
    queryKey: ['forex-archive-day', targetDateStr],
    queryFn: () => fetchRatesForDateWithCache(shortDate, null), // Use D1 cache service
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // MODIFIED: Fetch Previous Day's Data (DB-First, API-Fallback)
  const { data: prevDayData, isLoading: prevDayLoading } = useQuery({
    queryKey: ['forex-archive-prev-day', targetDateStr],
    queryFn: () => fetchRatesForDateWithCache(format(subDays(targetDate, 1), 'yyyy-MM-dd'), null), // Use D1 cache service
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60,
  });

  // --- KEPT AS-IS: Historical Data Queries (For "Historical Performance" tabs) ---
  // This logic is efficient and correct. It only fetches small date ranges.
  const fetchRange = (days: number) => {
    const from = format(subDays(targetDate, days - 1), 'yyyy-MM-dd');
    const to = shortDate;
    return fetchHistoricalRatesFromWorker(from, to);
  }

  const { data: weekData, isLoading: weekLoading } = useQuery({
    queryKey: ['historical-7-day', targetDateStr],
    queryFn: () => fetchRange(7),
    enabled: isValidDate, staleTime: Infinity,
  });

  const { data: monthData, isLoading: monthLoading } = useQuery({
    queryKey: ['historical-30-day', targetDateStr],
    queryFn: () => fetchRange(30),
    enabled: isValidDate, staleTime: Infinity,
  });
  
  const { data: quarterlyData, isLoading: quarterlyLoading } = useQuery({
    queryKey: ['historical-90-day', targetDateStr],
    queryFn: () => fetchRange(90),
    enabled: isValidDate, staleTime: Infinity,
  });

  const { data: yearData, isLoading: yearLoading } = useQuery({
    queryKey: ['historical-365-day', targetDateStr],
    queryFn: () => fetchRange(365),
    enabled: isValidDate, staleTime: Infinity,
  });
  
  const { data: fiveYearData, isLoading: fiveYearLoading } = useQuery({
    queryKey: ['historical-5-year', targetDateStr],
    queryFn: () => fetchRange(365 * 5),
    enabled: isValidDate, staleTime: Infinity,
  });

  const { data: longTermData, isLoading: longTermLoading } = useQuery({
    queryKey: ['historical-long-term', targetDateStr],
    queryFn: () => fetchRange(365 * 26), // ~26 years
    enabled: isValidDate, staleTime: Infinity,
  });
  
  // --- NEW: Optimized High/Low Data Queries ---
  // This replaces the old logic of fetching all data
  const { data: highLowStats, isLoading: highLowLoading } = useQuery({
    queryKey: ['historical-stats-52-week', targetDateStr],
    queryFn: () => {
      const from = format(subDays(targetDate, 365), 'yyyy-MM-dd');
      return fetchHistoricalStats(MAJOR_CURRENCIES, from, shortDate);
    },
    enabled: isValidDate, staleTime: Infinity,
  });

  const { data: allTimeStats, isLoading: allTimeLoading } = useQuery({
    queryKey: ['historical-stats-all-time', targetDateStr],
    queryFn: () => fetchHistoricalStats(MAJOR_CURRENCIES, '2000-01-01', shortDate),
    enabled: isValidDate, staleTime: Infinity,
  });
  
  // --- MODIFIED: Data Analysis (Memoized) ---
  const analysisData = useMemo(() => {
    // Use new data structure from fetchRatesForDateWithCache
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
      top10High: top10High,
      top12Low: top12Low,
      topGainer: topGainer,
      topLoser: topLoser,
    };
  }, [currentDayData, prevDayData]);

  // --- KEPT AS-IS: Helper to process historical data for tabs ---
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
  
  // --- REMOVED: getHighLow helper (logic is now in backend) ---

  // --- KEPT AS-IS: Memoized Historical (Tabs) ---
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

  // --- MODIFIED: Memoized High/Low Data (use new stats) ---
  const highLowData = useMemo(() => {
    if (!highLowStats || !analysisData) return { data: [], isLoading: highLowLoading };
    return {
      data: MAJOR_CURRENCIES.map(iso3 => {
        const stats = highLowStats[iso3];
        const name = analysisData?.allRates.find(r => r.currency.iso3 === iso3)?.currency.name || iso3;
        return {
          iso3,
          name,
          highBuy: stats?.highBuy?.rate ?? 0,
          lowBuy: stats?.lowBuy?.rate ?? 0,
          highSell: stats?.highSell?.rate ?? 0,
          lowSell: stats?.lowSell?.rate ?? 0,
          highBuyDate: stats?.highBuy?.date,
          lowBuyDate: stats?.lowBuy?.date,
          highSellDate: stats?.highSell?.date,
          lowSellDate: stats?.lowSell?.date,
        };
      }).filter(d => d.lowBuy > 0), // Filter out currencies with no data
      isLoading: highLowLoading
    };
  }, [highLowStats, highLowLoading, analysisData]);

  const allTimeHighLowData = useMemo(() => {
    if (!allTimeStats || !analysisData) return { data: [], isLoading: allTimeLoading };
    return {
      data: MAJOR_CURRENCIES.map(iso3 => {
        const stats = allTimeStats[iso3];
        const name = analysisData?.allRates.find(r => r.currency.iso3 === iso3)?.currency.name || iso3;
        return {
          iso3,
          name,
          highBuy: stats?.highBuy?.rate ?? 0,
          lowBuy: stats?.lowBuy?.rate ?? 0,
          highSell: stats?.highSell?.rate ?? 0,
          lowSell: stats?.lowSell?.rate ?? 0,
          highBuyDate: stats?.highBuy?.date,
          lowBuyDate: stats?.lowBuy?.date,
          highSellDate: stats?.highSell?.date,
          lowSellDate: stats?.lowSell?.date,
        };
      }).filter(d => d.lowBuy > 0),
      isLoading: allTimeLoading
    };
  }, [allTimeStats, allTimeLoading, analysisData]);

  // --- Render Logic ---
  const isLoading = currentDayLoading || prevDayLoading; // We wait for current/prev, but not all historicals
  const previousDate = format(subDays(targetDate, 1), 'yyyy-MM-dd');
  const nextDate = format(addDays(targetDate, 1), 'yyyy-MM-dd');
  const today = startOfDay(new Date());
  const canGoNext = isBefore(targetDate, today);

  useEffect(() => {
    document.title = `Foreign Exchange Rate for ${shortDate} | Nepal Rastra Bank`;
  }, [shortDate]);

  // --- (PageSkeleton remains unchanged) ---
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
          {/* MODIFIED: Pass rates from new data structure */}
          <ForexTicker rates={currentDayData?.rates || []} isLoading={currentDayLoading} />
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* --- (Navigation buttons remain unchanged) --- */}
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

          {/* --- (ShareButtons remain unchanged) --- */}
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

            {/* MODIFIED: Check analysisData.allRates */}
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
            {/* MODIFIED: Pass rates from new data structure */}
            {!isLoading && analysisData && analysisData.allRates.length > 0 && (
              <GeneratedArchiveArticle 
                analysisData={analysisData}
                historicalAnalysis={historicalAnalysis}
                highLowData={highLowData}
                allTimeHighLowData={allTimeHighLowData}
                formattedDate={formattedDate}
                shortDate={shortDate}
                rates={currentDayData.rates}
              />
            )}

            {/* --- (Disclaimer remains unchanged) --- */}
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

// === HELPER COMPONENTS (All remain unchanged) ===

const getChangeColor = (change: number) => {
  if (change > 0.0001) return 'text-green-600';
  if (change < -0.0001) return 'text-red-600';
  return 'text-gray-500';
};

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
                {rate.currency.name} ({rate.currency.iso3})
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
          <CardTitle className="text-xl">Top 10 Most Expensive Currencies</CardTitle>
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
          <CardTitle className="text-xl">Top 12 Least Expensive Currencies</CardTitle>
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

const HistoricalAnalysisTabs: React.FC<{ analysis: ArticleTemplateProps['historicalAnalysis'] }> = ({ analysis }) => (
  <section>
    <h2>Historical Performance Analysis (vs. NPR)</h2>
    <p>
      Today's daily change is only part of the story. The following tabs show the performance of various currencies against the Nepali Rupee over extended timeframes, all ending on this report's date. This data, pulled from our historical database, is essential for identifying long-term trends, seasonal patterns, and overall market direction.
    </p>
    <p>
      The analysis compares the normalized 'Buy' rate from the start of the period to the rate on this date. For a more detailed visual breakdown, please visit our interactive <Link to='/historical-charts' className='text-blue-600 hover:underline font-medium'>historical charts page</Link>.
    </p>
    <div className="not-prose">
      <Tabs defaultValue="7day">
        <div className="overflow-x-auto scrollbar-hide border-b">
          <TabsList className="w-max">
            <TabsTrigger value="7day">7 Days</TabsTrigger>
            <TabsTrigger value="30day">30 Days</TabsTrigger>
            <TabsTrigger value="90day">Quarterly</TabsTrigger>
            <TabsTrigger value="1year">1 Year</TabsTrigger>
            <TabsTrigger value="5year">5 Years</TabsTrigger>
            <TabsTrigger value="alltime">Since 2000</TabsTrigger>
          </TabsList>
        </div>
        <HistoricalTabContent data={analysis.weekly.data} isLoading={analysis.weekly.isLoading} value="7day" />
        <HistoricalTabContent data={analysis.monthly.data} isLoading={analysis.monthly.isLoading} value="30day" />
        <HistoricalTabContent data={analysis.quarterly.data} isLoading={analysis.quarterly.isLoading} value="90day" />
        <HistoricalTabContent data={analysis.yearly.data} isLoading={analysis.yearly.isLoading} value="1year" />
        <HistoricalTabContent data={analysis.fiveYear.data} isLoading={analysis.fiveYear.isLoading} value="5year" />
        <HistoricalTabContent data={analysis.longTerm.data} isLoading={analysis.longTerm.isLoading} value="alltime" />
      </Tabs>
    </div>
  </section>
);

const HistoricalTabContent: React.FC<{ data: HistoricalChange[]; isLoading: boolean; value: string }> = ({ data, isLoading, value }) => {
  if (isLoading) {
    return (
      <TabsContent value={value} className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        {Array(22).fill(0).map((_, i) => (
          <div key={i} className="flex justify-between py-3 border-b">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-5 w-24 rounded" />
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

const YearlyHighLow: React.FC<{ data: (HighLow & { iso3: string; name: string })[]; isLoading: boolean; }> = ({ data, isLoading }) => {
  return (
    <section>
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold">52-Week High & Low Analysis</h2>
      <p>
        The 52-week trading range provides critical context for a currency's annual volatility. A currency trading near its 52-week high may be seen as strong but potentially overbought, while one near its low could signal weakness or a potential buying opportunity. Below is the high-low range for major currencies over the past year, based on per-unit buy and sell rates. This is essential for long-term financial planning and understanding market cycles.
      </p>
      <div className="not-prose grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array(9).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        {data && data.map((item) => (
          <Card key={item.iso3} className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                <Link to={`/historical-data/${item.iso3}`} className="text-blue-600 hover:underline">
                  {getFlagEmoji(item.iso3)} {item.name} ({item.iso3})
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">Buy Range (Per 1 Unit):</span>
                <div className="flex justify-between font-medium">
                  <span>
                    Low: <span className="text-red-600">Rs. {item.lowBuy.toFixed(2)}</span>
                    {item.lowBuyDate && (
                      <Link to={`/daily-update/forex-for/${item.lowBuyDate}`} className="ml-1 text-xs text-blue-600 hover:underline">
                        ({format(parseISO(item.lowBuyDate), 'MMM d')})
                      </Link>
                    )}
                  </span>
                  <span>
                    High: <span className="text-green-600">Rs. {item.highBuy.toFixed(2)}</span>
                    {item.highBuyDate && (
                      <Link to={`/daily-update/forex-for/${item.highBuyDate}`} className="ml-1 text-xs text-blue-600 hover:underline">
                        ({format(parseISO(item.highBuyDate), 'MMM d')})
                      </Link>
                    )}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Sell Range (Per 1 Unit):</span>
                <div className="flex justify-between font-medium">
                  <span>
                    Low: <span className="text-red-600">Rs. {item.lowSell.toFixed(2)}</span>
                    {item.lowSellDate && (
                      <Link to={`/daily-update/forex-for/${item.lowSellDate}`} className="ml-1 text-xs text-blue-600 hover:underline">
                        ({format(parseISO(item.lowSellDate), 'MMM d')})
                      </Link>
                    )}
                  </span>
                  <span>
                    High: <span className="text-green-600">Rs. {item.highSell.toFixed(2)}</span>
                    {item.highSellDate && (
                      <Link to={`/daily-update/forex-for/${item.highSellDate}`} className="ml-1 text-xs text-blue-600 hover:underline">
                        ({format(parseISO(item.highSellDate), 'MMM d')})
                      </Link>
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

const AllTimeHighLow: React.FC<{ data: (HighLow & { iso3: string; name: string })[]; isLoading: boolean; }> = ({ data, isLoading }) => {
  return (
    <section>
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold">All-Time Highest and Lowest Records</h2>
      <p>
        This section displays the all-time highest and lowest exchange rates for major currencies since January 1, 2000. These records provide valuable historical context for understanding extreme market movements and long-term currency trends.
      </p>
      <div className="not-prose grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array(9).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        {data && data.map((item) => (
          <Card key={item.iso3} className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                <Link to={`/historical-data/${item.iso3}`} className="text-blue-600 hover:underline">
                  {getFlagEmoji(item.iso3)} {item.name} ({item.iso3})
                </Link>
              </CardTitle>
              <CardDescription className="text-xs">Since Jan 1, 2000</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">Buy Range (Per 1 Unit):</span>
                <div className="flex justify-between font-medium">
                  <span>
                    {item.lowBuy > 0 ? (
                      <>
                        Low: <span className="text-red-600">Rs. {item.lowBuy.toFixed(2)}</span>
                        {item.lowBuyDate && (
                          <Link to={`/daily-update/forex-for/${item.lowBuyDate}`} className="ml-1 text-xs text-blue-600 hover:underline">
                            ({format(parseISO(item.lowBuyDate), 'MMM d, yyyy')})
                          </Link>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </span>
                  <span>
                    High: <span className="text-green-600">Rs. {item.highBuy.toFixed(2)}</span>
                    {item.highBuyDate && (
                      <Link to={`/daily-update/forex-for/${item.highBuyDate}`} className="ml-1 text-xs text-blue-600 hover:underline">
                        ({format(parseISO(item.highBuyDate), 'MMM d, yyyy')})
                      </Link>
                    )}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Sell Range (Per 1 Unit):</span>
                <div className="flex justify-between font-medium">
                  <span>
                    {item.lowSell > 0 ? (
                      <>
                        Low: <span className="text-red-600">Rs. {item.lowSell.toFixed(2)}</span>
                        {item.lowSellDate && (
                          <Link to={`/daily-update/forex-for/${item.lowSellDate}`} className="ml-1 text-xs text-blue-600 hover:underline">
                            ({format(parseISO(item.lowSellDate), 'MMM d, yyyy')})
                          </Link>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </span>
                  <span>
                    High: <span className="text-green-600">Rs. {item.highSell.toFixed(2)}</span>
                    {item.highSellDate && (
                      <Link to={`/daily-update/forex-for/${item.highSellDate}`} className="ml-1 text-xs text-blue-600 hover:underline">
                        ({format(parseISO(item.highSellDate), 'MMM d, yyyy')})
                      </Link>
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

// --- (Dynamic Content Helpers remain unchanged) ---
const getDynamicIntro = (date: string, gainer: AnalyzedRate, loser: AnalyzedRate) => {
  const intros = [
    `Nepal Rastra Bank (NRB) has published the official foreign exchange rates for <strong>${date}</strong>. This report provides a complete analysis of today's currency values, daily fluctuations, and long-term historical trends.`,
    `Here is the definitive breakdown of Nepal's foreign exchange market for <strong>${date}</strong>, based on the reference rates set by Nepal Rastra Bank. Today's market shows mixed results, with the ${gainer.currency.name} gaining ground while the ${loser.currency.name} faced a slight decline.`,
    `On <strong>${date}</strong>, the Nepali Rupee (NPR) sees varied performance against major world currencies. This daily analysis from ForexNepal details the official NRB rates, tracks the day's biggest movers, and provides historical context for importers, exporters, and remitters.`,
    `Welcome to the daily forex bulletin for <strong>${date}</strong>. Today's rates from Nepal Rastra Bank are now available, and this report dives deep into the numbers, offering a simplified table, market rankings, and a comprehensive historical analysis against the Nepali Rupee.`,
  ];
  return intros[new Date(date).getDate() % intros.length];
};

const getDynamicCommentary = (gainer: AnalyzedRate, loser: AnalyzedRate, usd: AnalyzedRate) => {
  const gainerColor = "text-green-600";
  const loserColor = "text-red-600";
  const usdColor = getChangeColor(usd.dailyChange);
  
  const gainerLink = `<a href="/#/historical-data/${gainer.currency.iso3}" class="font-bold ${gainerColor} hover:underline">${gainer.currency.name} (${gainer.currency.iso3})</a>`;
  const loserLink = `<a href="/#/historical-data/${loser.currency.iso3}" class="font-bold ${loserColor} hover:underline">${loser.currency.name} (${loser.currency.iso3})</a>`;
  const usdLink = `<a href="/#/historical-data/USD" class="font-bold ${usdColor} hover:underline">U.S. Dollar (USD)</a>`;

  const sentences = [
    `The primary benchmark, the ${usdLink}, opened today at a buy rate of <strong>Rs. ${usd.buy.toFixed(2)}</strong> and a sell rate of <strong>Rs. ${usd.sell.toFixed(2)}</strong>, reflecting a daily (per-unit) change of <span class="font-medium ${usdColor}">${usd.dailyChange.toFixed(3)}</span>.`,
    `In today's trading, the standout performer was the ${gainerLink}, which appreciated by a notable <strong>${gainer.dailyChangePercent.toFixed(2)}%</strong> against the NPR.`,
    `Conversely, the ${loserLink} experienced the most significant decline, depreciating by <strong>${loser.dailyChangePercent.toFixed(2)}%</strong>.`,
    `This volatility highlights the dynamic nature of the forex market. For those looking to convert currency, it's crucial to check these daily changes. You can plan your conversions using our <a href="/#/converter" class="text-blue-600 hover:underline font-medium">currency converter</a>.`,
    `The ${usdLink} showed a ${usd.dailyChange > 0 ? "gain" : "loss"} of <strong>Rs. ${Math.abs(usd.dailyChange).toFixed(3)}</strong>, a key metric for Nepal's import-driven economy.`,
    `Today's biggest gainer was the ${gainerLink}, surging by <strong>${gainer.dailyChangePercent.toFixed(2)}%</strong>. Meanwhile, the ${loserLink} saw the steepest drop at <strong>${loser.dailyChangePercent.toFixed(2)}%</strong>.`,
    `Fluctuations were seen across the board, with the ${gainerLink} leading the gains. The <strong>${loser.currency.name}</strong> posted the largest loss for the day.`,
  ];
  
  const day = new Date().getDate();
  return `
    <p>${sentences[day % 3]}</p>
    <p>${sentences[3 + (day % 3)]}</p>
    <p>${sentences[3]}</p>
  `;
};

const getTrendSummary = (analysisData: ArticleTemplateProps['analysisData'], historicalAnalysis: ArticleTemplateProps['historicalAnalysis']) => {
  const { allRates } = analysisData;
  const gainersToday = allRates.filter(r => r.dailyChangePercent > 0.01 && r.currency.iso3 !== 'INR').length;
  const losersToday = allRates.filter(r => r.dailyChangePercent < -0.01 && r.currency.iso3 !== 'INR').length;
  const stableToday = allRates.filter(r => Math.abs(r.dailyChangePercent) <= 0.01 && r.currency.iso3 !== 'INR').length;

  let dailyTrend = 'balanced';
  if (gainersToday > losersToday * 1.5) dailyTrend = 'increasing';
  else if (losersToday > gainersToday * 1.5) dailyTrend = 'decreasing';

  const weeklyGainers = historicalAnalysis.weekly.data.filter(r => r.percent > 0).length;
  const weeklyLosers = historicalAnalysis.weekly.data.filter(r => r.percent < 0).length;
  let weeklyTrend = 'mixed';
  if (weeklyGainers > weeklyLosers * 1.3) weeklyTrend = 'strengthening';
  else if (weeklyLosers > weeklyGainers * 1.3) weeklyTrend = 'weakening';

  const monthlyGainers = historicalAnalysis.monthly.data.filter(r => r.percent > 0).length;
  const monthlyLosers = historicalAnalysis.monthly.data.filter(r => r.percent < 0).length;
  let monthlyTrend = 'stable';
  if (monthlyGainers > monthlyLosers * 1.3) monthlyTrend = 'appreciating';
  else if (monthlyLosers > monthlyGainers * 1.3) monthlyTrend = 'depreciating';
  
  const topWeekly = historicalAnalysis.weekly.data[0];
  const topMonthly = historicalAnalysis.monthly.data[0];

  return `
    <p>
      <strong>Market Summary:</strong> In today's forex market, ${gainersToday} currencies strengthened against the Nepali Rupee, while ${losersToday} weakened, and ${stableToday} remained relatively stable. Overall, the market is showing a <strong>${dailyTrend}</strong> trend compared to yesterday.
    </p>
    <p>
      Looking at the weekly perspective, currencies have been <strong>${weeklyTrend}</strong> against the NPR, with ${topWeekly?.name || 'USD'} leading the weekly gains at ${topWeekly?.percent.toFixed(2) || '0.00'}%. The monthly trend indicates a <strong>${monthlyTrend}</strong> pattern, with ${topMonthly?.name || 'EUR'} posting the strongest monthly performance at ${topMonthly?.percent.toFixed(2) || '0.00'}%.
    </p>
  `;
};

// --- DYNAMIC ARTICLE COMPONENT (Unchanged) ---
export const GeneratedArchiveArticle: React.FC<ArticleTemplateProps> = (props) => {
  const {
    analysisData,
    historicalAnalysis,
    highLowData,
    allTimeHighLowData,
    formattedDate,
    shortDate,
  } = props;

  if (!analysisData || analysisData.allRates.length === 0) {
    return null;
  }

  const { topGainer, topLoser, allRates, top10High, top12Low } = analysisData;
  const usdRate = allRates.find(r => r.currency.iso3 === 'USD');
  const eurRate = allRates.find(r => r.currency.iso3 === 'EUR');
  const sarRate = allRates.find(r => r.currency.iso3 === 'SAR');
  const aedRate = allRates.find(r => r.currency.iso3 === 'AED');

  if (!usdRate || !eurRate || !sarRate || !aedRate || !topGainer || !topLoser) {
    return (
      <Card className="not-prose bg-red-50 border-red-200">
        <CardHeader><CardTitle className="text-destructive">Data Analysis Incomplete</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Could not analyze data for this day. Key currencies (USD, EUR, etc.) might be missing from the report.</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <h1 dangerouslySetInnerHTML={{ __html: `Nepal Rastra Bank Forex Rates: <strong>${formattedDate}</strong>` }} />
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
      <HistoricalAnalysisTabs analysis={historicalAnalysis} />
      <YearlyHighLow data={highLowData.data} isLoading={highLowData.isLoading} />
      <AllTimeHighLow data={allTimeHighLowData.data} isLoading={allTimeHighLowData.isLoading} />
      <section>
        <h2>Market Trend Summary</h2>
        <div dangerouslySetInnerHTML={{ __html: getTrendSummary(analysisData, historicalAnalysis) }} />
      </section>
    </>
  );
};

export default ArchiveDetail;
