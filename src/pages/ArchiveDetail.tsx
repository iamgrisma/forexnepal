// Filename: src/pages/ArchiveDetail.tsx

import React, { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchForexRatesByDate, formatDateLong, getFlagEmoji } from '@/services/forexService';
import { format, parseISO, addDays, subDays, isValid, startOfDay, isBefore } from 'date-fns';
import Layout from '@/components/Layout';
import ForexTicker from '@/components/ForexTicker';
import { Rate, RatesData, HistoricalRates } from '@/types/forex';
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
    longTerm: HistoricalAnalysisData; // 20yr+
  };
  highLowData: {
    data: (HighLow & { iso3: string; name: string })[];
    isLoading: boolean;
  };
  formattedDate: string;
  shortDate: string;
  rates: Rate[]; // Pass raw rates for ticker
};

// --- NEW DB-FIRST HISTORICAL FETCHER ---
/**
 * Fetches historical rates from the worker API (/api/historical-rates)
 * This endpoint is DB-first.
 */
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
    
    // Worker API returns { success: true, payload: [] }
    if (data.success && Array.isArray(data.payload)) {
      return {
        status: { code: 200, message: "OK" },
        payload: data.payload || [],
      };
    }
    
    // Fallback for just in case it returns the raw array
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
  
  // Fetch Target Day's Data
  const { data: currentDayResponse, isLoading: currentDayLoading, isError: isCurrentDayError } = useQuery({
    queryKey: ['forex-archive-day', targetDateStr],
    queryFn: () => fetchForexRatesByDate(targetDate), // Fetches target date from NRB (will be stored by worker)
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60,
  });

  // Fetch Previous Day's Data (for comparison)
  const { data: prevDayResponse, isLoading: prevDayLoading } = useQuery({
    queryKey: ['forex-archive-prev-day', targetDateStr],
    queryFn: () => fetchForexRatesByDate(subDays(targetDate, 1)), // Fetches prev day
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60,
  });

  // --- Historical Data Queries (Using NEW DB-FIRST function) ---
  const fetchRange = (days: number) => {
    const from = format(subDays(targetDate, days - 1), 'yyyy-MM-dd');
    const to = shortDate;
    return fetchHistoricalRatesFromWorker(from, to);
  }
  
  const fetchLongRange = (startDate: string) => {
    return fetchHistoricalRatesFromWorker(startDate, shortDate);
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
    queryFn: () => fetchLongRange('2000-01-01'), // 20+ years
    enabled: isValidDate, staleTime: Infinity,
  });
  
  // --- Data Analysis (Memoized) ---
  const analysisData = useMemo(() => {
    if (!currentDayResponse?.data?.payload?.[0]?.rates) return null;

    const currentRates = currentDayResponse.data.payload[0].rates;
    const prevDayRates = prevDayResponse?.data?.payload?.[0]?.rates || [];

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
        dailyChange, // This is normalized daily change
        dailyChangePercent,
      };
    });
    
    const filteredRates = analyzedRates.filter(r => r.currency.iso3 !== 'INR');

    // Top 10 High, Top 12 Low
    const sortedRatesHigh = [...filteredRates].sort((a, b) => b.normalizedSell - a.normalizedSell);
    const top10High = sortedRatesHigh.slice(0, 10);
    
    const sortedRatesLow = [...filteredRates].sort((a, b) => a.normalizedSell - b.normalizedSell);
    const top12Low = sortedRatesLow.slice(0, 12);

    const topGainer = [...filteredRates].sort((a, b) => b.dailyChangePercent - a.dailyChangePercent)[0] || analyzedRates[0];
    const topLoser = [...filteredRates].sort((a, b) => a.dailyChangePercent - b.dailyChangePercent)[0] || analyzedRates[0];

    return {
      allRates: analyzedRates,
      top10High: top10High,
      top12Low: top12Low,
      topGainer: topGainer,
      topLoser: topLoser,
    };
  }, [currentDayResponse, prevDayResponse]);

  // Helper to process historical data
  const processHistoricalData = (data: HistoricalRates | undefined, allCurrentRates: AnalyzedRate[]): HistoricalChange[] => {
    if (!data?.payload || data.payload.length < 2 || !allCurrentRates) return [];
    
    const oldestDay = data.payload[0];
    const latestDay = data.payload[data.payload.length - 1];

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
  
  // Helper to get 52-week high/low
  const getHighLow = (data: HistoricalRates | undefined, iso3: string): HighLow | null => {
    if (!data?.payload || data.payload.length === 0) return null;
    let lowBuy = Infinity, highBuy = -Infinity, lowSell = Infinity, highSell = -Infinity;
    
    data.payload.forEach(day => {
      const rate = day.rates.find(r => r.currency.iso3 === iso3);
      if (rate) {
        const unit = rate.currency.unit || 1;
        const buy = Number(rate.buy) / unit;
        const sell = Number(rate.sell) / unit;
        if (buy > 0) {
          if (buy < lowBuy) lowBuy = buy;
          if (buy > highBuy) highBuy = buy;
        }
        if (sell > 0) {
          if (sell < lowSell) lowSell = sell;
          if (sell > highSell) highSell = sell;
        }
      }
    });
    if (lowBuy === Infinity) return null;
    return { lowBuy, highBuy, lowSell, highSell };
  }

  // --- Memoized Historical & High/Low Data ---
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

  const highLowData = useMemo(() => {
    if (!yearData?.payload || !analysisData) return { data: [], isLoading: true };
    const majorCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SAR', 'AED', 'QAR', 'JPY', 'MYR', 'KRW'];
    return {
      data: majorCurrencies.map(iso3 => {
        const data = getHighLow(yearData, iso3);
        const name = analysisData?.allRates.find(r => r.currency.iso3 === iso3)?.currency.name || iso3;
        return { iso3, name, ...data };
      }).filter(d => d.lowBuy),
      isLoading: yearLoading
    };
  }, [yearData, yearLoading, analysisData]);

  // --- Render Logic ---
  const isLoading = currentDayLoading || prevDayLoading || !analysisData;
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
          <ForexTicker rates={currentDayResponse?.data?.payload?.[0]?.rates || []} isLoading={currentDayLoading} />
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" asChild>
              <Link to="/archive" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Archives
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/daily-update/forex-for/${previousDate}`} className="flex items-center gap-1">
                  <ChevronLeft className="h-4 w-4" /> Previous Day
                </Link>
              </Button>
              {canGoNext && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/daily-update/forex-for/${nextDate}`} className="flex items-center gap-1">
                    Next Day <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
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
              <GeneratedArchiveArticle 
                analysisData={analysisData}
                historicalAnalysis={historicalAnalysis}
                highLowData={highLowData}
                formattedDate={formattedDate}
                shortDate={shortDate}
                rates={currentDayResponse.data.payload[0].rates}
              />
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

// === HELPER COMPONENTS (Now part of the same file) ===

/**
 * Gets a color class based on the value
 */
const getChangeColor = (change: number) => {
  if (change > 0.0001) return 'text-green-600';
  if (change < -0.0001) return 'text-red-600';
  return 'text-gray-500';
};

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
                {rate.currency.name} ({rate.currency.iso3})
              </TableCell>
              <TableCell className="text-center">{rate.currency.unit}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-base">Rs. {rate.buy.toFixed(2)}</span>
                  {/* Note: dailyChange is per-unit, so we multiply by unit for the table */}
                  <ChangeIndicator value={rate.dailyChange * rate.currency.unit} decimals={3} />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-base">Rs. {rate.sell.toFixed(2)}</span>
                  {/* We don't have sell change, so we show buy change again as an indicator */}
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
      This per-unit comparison is useful for understanding relative value, but for practical conversions, always check the official units in the table above or use our <Link to='/converter' className='text-blue-600 hover:underline font-medium'>currency converter</Link>. The pegged <Link to="/historical-data/INR" className="text-blue-600 hover:underline font-medium">Indian Rupee (INR)</Link> is excluded from this analysis.
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

/**
 * Renders the Historical Performance Tabs
 */
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

/**
 * Renders the 52-Week High/Low Grid
 */
const YearlyHighLow: React.FC<{ data: (HighLow & { iso3: string; name: string })[]; isLoading: boolean; }> = ({ data, isLoading }) => {
  return (
    <section>
      <h2>52-Week High & Low Analysis</h2>
      <p>
        The 52-week trading range provides critical context for a currency's annual volatility. A currency trading near its 52-week high may be seen as strong but potentially overbought, while one near its low could signal weakness or a potential buying opportunity. Below is the high-low range for major currencies over the past year, based on per-unit buy and sell rates. This is essential for long-term financial planning and understanding market cycles.
      </p>
      <div className="not-prose grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array(9).fill(0).map((_, i) => <div key={i} className="h-32 w-full bg-gray-200 rounded-lg animate-pulse" />)}
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
                  <span>Low: <span className="text-red-600">Rs. {item.lowBuy.toFixed(2)}</span></span>
                  <span>High: <span className="text-green-600">Rs. {item.highBuy.toFixed(2)}</span></span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Sell Range (Per 1 Unit):</span>
                <div className="flex justify-between font-medium">
                  <span>Low: <span className="text-red-600">Rs. {item.lowSell.toFixed(2)}</span></span>
                  <span>High: <span className="text-green-600">Rs. {item.highSell.toFixed(2)}</span></span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};


// === THE NEW DYNAMIC ARTICLE COMPONENT ===

export const GeneratedArchiveArticle: React.FC<ArticleTemplateProps> = (props) => {
  const {
    analysisData,
    historicalAnalysis,
    highLowData,
    formattedDate,
    shortDate,
  } = props;

  if (!analysisData || analysisData.allRates.length === 0) {
    return null; // The parent component handles the "No Data" card
  }

  const { topGainer, topLoser, allRates, top10High, top12Low } = analysisData;
  const usdRate = allRates.find(r => r.currency.iso3 === 'USD');
  const eurRate = allRates.find(r => r.currency.iso3 === 'EUR');
  const sarRate = allRates.find(r => r.currency.iso3 === 'SAR');
  const aedRate = allRates.find(r => r.currency.iso3 === 'AED');

  return (
    <>
      {/* 1. Dynamic Title */}
      <h1>Nepal Rastra Bank Forex Rates: {formattedDate}</h1>
      
      {/* 2. Dynamic Intro Paragraph */}
      <p className="text-lg lead text-muted-foreground">
        Nepal Rastra Bank (NRB) has released the official foreign exchange rates for <strong>{formattedDate}</strong>. This daily report is the official benchmark for all banks and financial institutions in Nepal, influencing international trade, foreign investment, and personal remittances. This detailed analysis provides a complete overview of today's currency values, daily fluctuations, and long-term historical trends to help you make informed decisions.
      </p>
      
      {/* 3. Daily Market Commentary */}
      <h2>Daily Market Summary</h2>
      <p>
        On this day, the market shows varied movements against the Nepali Rupee (NPR). The <strong>U.S. Dollar ({getFlagEmoji('USD')} USD)</strong>, a primary indicator for Nepal's economy, is set at a buy rate of <strong>Rs. {usdRate?.buy.toFixed(2)}</strong> and a sell rate of <strong>Rs. {usdRate?.sell.toFixed(2)}</strong>. This represents a per-unit daily change of <ChangeIndicator value={usdRate?.dailyChange || 0} decimals={4} />, signaling a {usdRate?.dailyChange ?? 0 > 0 ? "slight strengthening" : "slight weakening"} against the NPR compared to the previous trading day.
      </p>
      <p>
        Today's most significant gainer among major currencies is the <strong>{getFlagEmoji(topGainer.currency.iso3)} {topGainer.currency.name} ({topGainer.currency.iso3})</strong>, which has appreciated by a notable <ChangeIndicator value={topGainer.dailyChangePercent} unit="%" />. This upward movement could impact importers dealing with {topGainer.currency.name}. On the other side of the spectrum, the <strong>{getFlagEmoji(loser.currency.iso3)} {loser.currency.name} ({loser.currency.iso3})</strong> saw the largest decline, depreciating by <ChangeIndicator value={loser.dailyChangePercent} unit="%" />.
      </p>
      <p>
        Other key currencies also show notable figures. The <strong>{getFlagEmoji('EUR')} European Euro (EUR)</strong> is trading at <strong>Rs. {eurRate?.buy.toFixed(2)}</strong> (Buy) / <strong>Rs. {eurRate?.sell.toFixed(2)}</strong> (Sell), with a daily change of <ChangeIndicator value={eurRate?.dailyChange || 0} decimals={4} />. For the crucial remittance market from the Gulf, the <strong>{getFlagEmoji('SAR')} Saudi Riyal (SAR)</strong> is at <strong>Rs. {sarRate?.buy.toFixed(2)}</strong> (Buy) / <strong>Rs. {sarRate?.sell.toFixed(2)}</strong> (Sell), and the <strong>{getFlagEmoji('AED')} U.A.E Dirham (AED)</strong> is at <strong>Rs. {aedRate?.buy.toFixed(2)}</strong> (Buy) / <strong>Rs. {aedRate?.sell.toFixed(2)}</strong>.
      </p>
      <p>
        These daily fluctuations are critical. For precise calculations for tuition fees, travel, or business invoices, you can use our <Link to='/converter' className='text-blue-600 hover:underline font-medium'>currency conversion tool</Link>.
      </p>

      {/* 4. Simplified Rate Table (User Request) */}
      <SimplifiedRateTable rates={allRates} date={shortDate} />
      
      {/* 5. Currency Rankings (User Request) */}
      <CurrencyRankings topHigh={top10High} topLow={top12Low} />
      
      {/* 6. Historical Analysis Tabs (User Request) */}
      <HistoricalAnalysisTabs analysis={historicalAnalysis} />
      
      {/* 7. 52-Week High/Low */}
      <YearlyHighLow data={highLowData.data} isLoading={highLowData.isLoading} />
    </>
  );
};


export default ArchiveDetail;
