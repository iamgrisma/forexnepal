import React, { useEffect, useMemo, Suspense, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Import useQueryClient
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
// Import services
import { fetchForexRatesByDate, formatDateLong, getFlagEmoji } from '../services/forexService';
import { fetchRatesForDateWithCache } from '../services/d1ForexService';
// Import types
import { Rate, RatesData } from '../types/forex';
import { format, parseISO, addDays, subDays, isValid, startOfDay, isBefore, differenceInDays, subMonths, subYears } from 'date-fns';
import Layout from '@/components/Layout';
import ForexTicker from '@/components/ForexTicker';
import ShareButtons from '@/components/ShareButtons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react'; // Import Loader

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

// --- UPDATED: This type now holds a single set of data, not one for each tab ---
export type HistoricalAnalysisData = {
  data: HistoricalChange[];
};

// Main props for the article component
export type ArticleTemplateProps = {
  analysisData: {
    allRates: AnalyzedRate[];
    top10High: AnalyzedRate[];
    top12Low: AnalyzedRate[];
    topGainer: AnalyzedRate;
    topLoser: AnalyzedRate;
    majorRates: AnalyzedRate[];
  };
  historicalAnalysis: HistoricalAnalysisData | null; // This will be loaded lazily
  isHistoricalLoading: boolean; // Loading state for the lazy-loaded data
  formattedDate: string;
  longDateHeader: string; // The new "news dateline"
  shortDate: string;
  rates: Rate[];
  activeTab: string;
  onTabChange: (tab: string) => void;
};

// --- MAIN PAGE COMPONENT ---
const ArchiveDetail = () => {
  const params = useParams();
  const date = params["*"];
  const targetDateStr = date ?? null;
  const queryClient = useQueryClient(); // Get query client
  
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
  
  // --- NEW: Create all date formats ---
  const formattedDate = formatDateLong(targetDate); // "Sunday, October 19, 2025"
  const longDateHeader = `${format(targetDate, 'EEEE, dd MMMM, yyyy')}, Kathmandu Nepal`; // "Friday, 07 November, 2025, Kathmandu Nepal"
  const shortDate = format(targetDate, 'yyyy-MM-dd'); // "2025-10-19"

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
  // --- NEW: State for the comparison date string ---
  const [comparisonDateStr, setComparisonDateStr] = useState<string | null>(null);

  // --- NEW: Lazy-loading query for the *single* comparison date ---
  const { data: comparisonDateData, isLoading: isComparisonLoading } = useQuery({
      queryKey: ['forex-archive-comparison', comparisonDateStr],
      queryFn: () => {
        if (!comparisonDateStr) return null;
        return fetchRatesForDateWithCache(comparisonDateStr, null);
      },
      enabled: !!comparisonDateStr, // Only run when a comparison date is set
      staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
      keepPreviousData: true,
  });

  // --- NEW: Effect to trigger lazy-loading when tab changes ---
  useEffect(() => {
    if (!isValidDate) return;

    let compareDate: Date;
    switch (activeTab) {
      case '7day':
        compareDate = subDays(targetDate, 7);
        break;
      case '30day':
        compareDate = subMonths(targetDate, 1);
        break;
      case '90day':
        compareDate = subMonths(targetDate, 3);
        break;
      case '365day':
        compareDate = subYears(targetDate, 1);
        break;
      case '5year':
        compareDate = subYears(targetDate, 5);
        break;
      case 'longterm':
        compareDate = parseISO('2002-03-04'); // Earliest reliable data start
        break;
      default:
        return;
    }
    
    const newCompareDateStr = format(compareDate, 'yyyy-MM-dd');

    // Prefetch the data for the new date
    queryClient.prefetchQuery({
      queryKey: ['forex-archive-comparison', newCompareDateStr],
      queryFn: () => fetchRatesForDateWithCache(newCompareDateStr, null),
    });
    
    // Set the state to trigger the useQuery
    setComparisonDateStr(newCompareDateStr);

  }, [activeTab, targetDate, queryClient, isValidDate]);
  
  // --- Data Analysis (Memoized) ---
  const analysisData = useMemo(() => {
    if (!currentDayData?.rates) return null;

    const currentRates = currentDayData.rates;
    const prevDayRates = prevDayData?.rates || [];

    const analyzedRates: AnalyzedRate[] = ALL_CURRENCY_CODES.map(code => {
      const rate = currentRates.find(r => r.currency.iso3 === code);
      const prevRate = prevDayRates.find(pr => pr.currency.iso3 === code);
      
      // Get currency info from map, default to rate data if missing
      const info = CURRENCY_MAP[code] || rate?.currency;
      
      // If rate doesn't exist for today, create a placeholder
      if (!rate || !info) {
        return null; 
      }

      const buy = Number(rate.buy);
      const sell = Number(rate.sell);
      const unit = info.unit || 1;
      const normalizedBuy = buy / unit;
      const normalizedSell = sell / unit;

      const prevBuy = prevRate ? (Number(prevRate.buy) / (prevRate.currency.unit || 1)) : 0;
      
      const dailyChange = prevRate ? (normalizedBuy - prevBuy) : 0;
      const dailyChangePercent = (prevRate && prevBuy > 0) ? (dailyChange / prevBuy) * 100 : 0;

      return {
        ...rate, // Spread the original rate
        currency: { // Ensure currency info is complete
            iso3: code,
            name: info.name,
            unit: info.unit
        },
        buy,
        sell,
        normalizedBuy,
        normalizedSell,
        dailyChange,
        dailyChangePercent,
      };
    }).filter((r): r is AnalyzedRate => r !== null); // Filter out nulls
    
    const filteredRates = analyzedRates.filter(r => r.currency.iso3 !== 'INR');
    const safeFilteredRates = filteredRates.length > 0 ? filteredRates : analyzedRates;

    const sortedRatesHigh = [...safeFilteredRates].sort((a, b) => b.normalizedSell - a.normalizedSell);
    const top10High = sortedRatesHigh.slice(0, 10);
    
    const sortedRatesLow = [...analyzedRates].sort((a, b) => a.normalizedSell - b.normalizedSell);
    const top12Low = sortedRatesLow.slice(0, 12);

    const topGainer = [...safeFilteredRates].sort((a, b) => b.dailyChangePercent - a.dailyChangePercent)[0] || analyzedRates[0];
    const topLoser = [...safeFilteredRates].sort((a, b) => a.dailyChangePercent - b.dailyChangePercent)[0] || analyzedRates[0];

    const majorRates = MAJOR_CURRENCY_CODES.map(code => 
      analyzedRates.find(r => r.currency.iso3 === code)
    ).filter((r): r is AnalyzedRate => r !== null);

    return {
      allRates: analyzedRates,
      top10High,
      top12Low,
      topGainer,
      topLoser,
      majorRates
    };
  }, [currentDayData, prevDayData]);

  // --- NEW: Helper to process historical data ---
  const processHistoricalData = (
    allCurrentRates: AnalyzedRate[] | undefined,
    comparisonRatesData: RatesData | null | undefined
  ): HistoricalAnalysisData | null => {
    
    if (!allCurrentRates || !comparisonRatesData || !comparisonRatesData.rates || comparisonRatesData.rates.length === 0) {
      return null;
    }
    
    const oldestDayRates = comparisonRatesData.rates;
    
    const data = allCurrentRates
      .filter(r => r.currency.iso3 !== 'INR')
      .map(currentRate => {
        const oldRateData = oldestDayRates.find(r => r.currency.iso3 === currentRate.currency.iso3);

        if (!oldRateData) return null;

        const oldRate = Number(oldRateData.buy) / (oldRateData.currency.unit || 1);
        const newRate = currentRate.normalizedBuy; // Already normalized

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
      
    return { data };
  };
  
  // --- Memoized Historical Data ---
  const historicalAnalysis = useMemo(() => {
    return processHistoricalData(analysisData?.allRates, comparisonDateData);
  }, [analysisData, comparisonDateData]);


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
                  historicalAnalysis={historicalAnalysis} // Pass the lazy-loaded data
                  isHistoricalLoading={isComparisonLoading} // Pass the loading state
                  formattedDate={formattedDate}
                  longDateHeader={longDateHeader}
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
 * Renders the new SIMPLIFIED data table
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
 * Renders the Top 10 High / Top 12 Low Ranking Grids (with expanded text)
 */
const CurrencyRankings: React.FC<{ topHigh: AnalyzedRate[], topLow: AnalyzedRate[], date: string, allRates: AnalyzedRate[] }> = ({ topHigh, topLow, date, allRates }) => {
  const text = ArchiveTextGenerator.getCurrencyRankingsText(date, allRates);
  return (
    <section>
      <h2>Currency Value Rankings (Per 1 Unit)</h2>
      <div dangerouslySetInnerHTML={{ __html: text }} />
      <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Today's Top 10 Most Expensive Currencies</CardTitle>
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
};

/**
 * Renders the Historical Performance Tabs with lazy loading
 */
const HistoricalAnalysisTabs: React.FC<{ 
  analysis: HistoricalAnalysisData | null;
  isLoading: boolean;
  activeTab: string; 
  onTabChange: (tab: string) => void 
}> = ({ analysis, isLoading, activeTab, onTabChange }) => (
  <section>
    <h2>Historical Performance Analysis (vs. NPR)</h2>
    <p>
      Today's daily change is only part of the story. The following tabs show the performance of various currencies against the Nepali Rupee over extended timeframes, all ending on this report's date. The analysis compares the normalized 'Buy' rate from the start of the period to the rate on this date.
    </p>
    <p>
      Data is loaded on-demand when you click a tab. This comparison helps identify long-term trends and currency strength relative to the NPR. For a more detailed visual breakdown, please visit our interactive <Link to='/historical-charts' className='text-blue-600 hover:underline font-medium'>historical charts page</Link>.
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
            <TabsTrigger value="longterm">Since 2002</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value={activeTab} className="mt-4">
          <HistoricalTabContent data={analysis?.data || []} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  </section>
);

/**
 * Renders a single tab's content
 */
const HistoricalTabContent: React.FC<{ data: HistoricalChange[]; isLoading: boolean; }> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 min-h-[200px]">
        {Array(22).fill(0).map((_, i) => (
          <div key={i} className="flex justify-between py-3 border-b">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    )
  }
  if (!data || data.length === 0) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <p className="text-muted-foreground py-4">No historical comparison data found for this period.</p>
      </div>
    )
  }
  return (
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
  );
};


// === DYNAMIC CONTENT GENERATORS (NEW & EXPANDED) ===

const ArchiveTextGenerator = {
  // Helper to pick a random item based on date
  _getVariant: (dateStr: string, variants: string[]) => {
    try {
      const day = parseISO(dateStr).getDate();
      return variants[day % variants.length];
    } catch {
      return variants[0];
    }
  },

  /**
   * Generates the "News Dateline" introduction
   */
  getNewsIntro: (longDateHeader: string, allRates: AnalyzedRate[], gainer: AnalyzedRate, loser: AnalyzedRate) => {
    const usd = allRates.find(r => r.currency.iso3 === 'USD');
    const usdBuy = usd ? usd.buy.toFixed(2) : 'N/A';
    const usdSell = usd ? usd.sell.toFixed(2) : 'N/A';
    const gainerName = gainer.currency.name;
    const gainerChange = (gainer.dailyChange * gainer.currency.unit).toFixed(3);
    const loserName = loser.currency.name;
    const loserChange = (loser.dailyChange * loser.currency.unit).toFixed(3);

    const variants = [
      // Variant 1
      `<p><strong>${longDateHeader}</strong> | Nepal Rastra Bank (NRB), the central monetary authority of Nepal, has published the official foreign exchange rates for today. These rates serve as the benchmark for all banks and financial institutions (BFIs) across the country for currency transactions. Today's market bulletin indicates a day of mixed movements, with the <strong>U.S. Dollar</strong> settling at a buying rate of <strong>Rs. ${usdBuy}</strong> and a selling rate of <strong>Rs. ${usdSell}</strong>. This rate is a critical indicator for Nepal's import-heavy economy and the remittance inflows that form its backbone. Among other major currencies, the ${gainerName} saw a notable appreciation of Rs. ${gainerChange} per unit, while the ${loserName} registered a decline of Rs. ${loserChange}. This report provides a detailed breakdown of all currency values, market trends, and historical performance analysis.</p>`,
      // Variant 2
      `<p><strong>${longDateHeader}</strong> | The Central Bank of Nepal, Nepal Rastra Bank (NRB), has released its daily 'Foreign Exchange Rates' bulletin, setting the reference values for the Nepali Rupee (NPR) against various international currencies. For today, the <strong>U.S. Dollar</strong>, a key currency for international trade, is fixed at a buying rate of <strong>Rs. ${usdBuy}</strong> and a selling rate of <strong>Rs. ${usdSell}</strong>. These official rates are mandatory for 'A' class commercial banks, 'B' class development banks, and 'C' class finance companies for their currency exchange operations. Today's data highlights the ${gainerName} as the top performer, gaining Rs. ${gainerChange}, while the ${loserName} saw the most significant drop at Rs. ${loserChange}. Below, you will find a comprehensive analysis of today's rates, long-term trends, and market summaries.</p>`,
      // Variant 3
      `<p><strong>${longDateHeader}</strong> | Today's foreign exchange market in Nepal is guided by the latest reference rates issued by Nepal Rastra Bank. The value of the <strong>U.S. Dollar</strong>, which heavily influences the nation's import-export balance, has been set at <strong>Rs. ${usdBuy}</strong> for buying and <strong>Rs. ${usdSell}</strong> for selling. This bulletin from ForexNepal provides a complete overview of the official rates for all listed currencies, including major players like the Euro, Pound Sterling, and various Gulf currencies. We will delve into the day's significant movers, with the ${gainerName} appreciating and the ${loserName} depreciating, and provide a detailed analysis of both short-term and long-term market trends.</p>`,
      // Variant 4
      `<p><strong>${longDateHeader}</strong> | The NRB has announced the official exchange rates for the Nepali Rupee (NPR) today. This daily publication is crucial for businesses and individuals engaged in foreign transactions. The benchmark <strong>U.S. Dollar</strong> is trading at <strong>Rs. ${usdBuy}</strong> (Buy) and <strong>Rs. ${usdSell}</strong> (Sell). This report offers an in-depth look at these figures, including a detailed table of all currencies, an analysis of the day's top gainer, the ${gainerName} (+Rs. ${gainerChange}), and the top loser, the ${loserName} (${loserChange}). Furthermore, we analyze the historical performance of these currencies over various periods to provide a clearer market perspective.</p>`,
      // Variant 5
      `<p><strong>${longDateHeader}</strong> | Nepal Rastra Bank has published the foreign exchange rates for today, providing the official valuation of the Nepali Rupee against a basket of 22 foreign currencies. The <strong>U.S. Dollar</strong>, a critical measure for the economy, is posted at a buy rate of <strong>Rs. ${usdBuy}</strong> and a sell rate of <strong>Rs. ${usdSell}</strong>. These rates are effective for transactions conducted by authorized dealers. In today's market, the ${gainerName} has shown significant strength, while the ${loserName} has weakened. This detailed analysis covers the day's summary, value rankings, and a multi-period historical performance review to give you a complete picture of the forex market.</p>`
    ];
    return this._getVariant(longDateHeader, variants);
  },

  /**
   * Generates the new "Today's Forex Detail" section
   */
  getTodaysForexDetail: (allRates: AnalyzedRate[]) => {
    let html = `<h2>Today's Forex Detail:</h2><p>`;
    const sentenceTemplates = [
      (r: AnalyzedRate) => `The <a href="/#/historical-data/${r.currency.iso3}" class="font-medium text-blue-600 hover:underline">${r.currency.name} (${r.currency.iso3})</a> is listed for a unit of ${r.currency.unit}, with a buying rate of <strong>Rs. ${r.buy.toFixed(2)}</strong> and a selling rate of <strong>Rs. ${r.sell.toFixed(2)}</strong>.`,
      (r: AnalyzedRate) => `For the ${getFlagEmoji(r.currency.iso3)} <strong>${r.currency.iso3}</strong>, the central bank has set the buying value at <strong>Rs. ${r.buy.toFixed(2)}</strong> and the selling value at <strong>Rs. ${r.sell.toFixed(2)}</strong> for every ${r.currency.unit} unit(s).`,
      (r: AnalyzedRate) => `Meanwhile, the <a href="/#/historical-data/${r.currency.iso3}" class="font-medium text-blue-600 hover:underline">${r.currency.name}</a> is trading at <strong>Rs. ${r.sell.toFixed(2)}</strong> (Sell) and <strong>Rs. ${r.buy.toFixed(2)}</strong> (Buy) per ${r.currency.unit} unit(s).`,
      (r: AnalyzedRate) => `Today's rate for the <strong>${r.currency.name} (${r.currency.iso3})</strong> shows a buy value of <strong>Rs. ${r.buy.toFixed(2)}</strong> and a sell value of <strong>Rs. ${r.sell.toFixed(2)}</strong> per ${r.currency.unit}.`,
      (r: AnalyzedRate) => `As for the ${getFlagEmoji(r.currency.iso3)} <strong>${r.currency.name}</strong>, financial institutions will buy ${r.currency.unit} unit(s) for <strong>Rs. ${r.buy.toFixed(2)}</strong> and sell for <strong>Rs. ${r.sell.toFixed(2)}</strong>.`,
      (r: AnalyzedRate) => `The <a href="/#/historical-data/${r.currency.iso3}" class="font-medium text-blue-600 hover:underline">${r.currency.iso3}</a> exchange rate is fixed at <strong>Rs. ${r.buy.toFixed(2)}</strong> (Buy) and <strong>Rs. ${r.sell.toFixed(2)}</strong> (Sell) for ${r.currency.unit} unit(s).`,
      (r: AnalyzedRate) => `Another key currency, the <strong>${r.currency.name}</strong>, is purchasable at <strong>Rs. ${r.sell.toFixed(2)}</strong> and can be sold at <strong>Rs. ${r.buy.toFixed(2)}</strong> per ${r.currency.unit} unit(s).`
    ];

    const inr = allRates.find(r => r.currency.iso3 === 'INR');
    if (inr) {
      html += `The <strong>Indian Rupee (INR)</strong>, to which the NPR is pegged, maintains its fixed rate. Today's official rate for 100 INR is <strong>Rs. ${inr.buy.toFixed(2)}</strong> (Buy) and <strong>Rs. ${inr.sell.toFixed(2)}</strong> (Sell). `;
    }

    let sentenceIndex = 0;
    allRates.filter(r => r.currency.iso3 !== 'INR').forEach(rate => {
      html += sentenceTemplates[sentenceIndex](rate) + " ";
      sentenceIndex = (sentenceIndex + 1) % sentenceTemplates.length;
    });

    html += `</p>`;
    return html;
  },

  /**
   * Generates the expanded "Currency Rankings" text
   */
  getCurrencyRankingsText: (date: string, allRates: AnalyzedRate[]) => {
    const variants = [
      `<p>This ranking provides insight into the relative strength of foreign currencies against the Nepali Rupee. The "Most Expensive" list shows currencies where 1 unit commands the highest NPR value, often led by strong Middle Eastern dinars from countries like Kuwait and Bahrain. The "Least Expensive" list shows currencies where 1 unit has the lowest NPR value, such as the Japanese Yen or Korean Won, which are typically traded in larger units. This per-unit comparison is useful for understanding relative value, but for practical conversions, always check the official units in the table above or use our <a href="/#/converter" class="text-blue-600 hover:underline font-medium">currency converter</a>. Note: The pegged <a href="/#/historical-data/INR" class="text-blue-600 hover:underline font-medium">Indian Rupee (INR)</a> is included in the "Least Expensive" ranking where 100 INR equals approximately 160 NPR.</p>`,
      `<p>Understanding the per-unit value provides a clear picture of currency hierarchy. On ${date}, the most valuable currencies (per single unit) are dominated by Gulf state dinars, reflecting their strong economic standing. Conversely, currencies like the Japanese Yen and South Korean Won appear "least expensive" because their denominations are much smaller; they are officially traded in units of 10 and 100, respectively. This ranking strips away the unit multiplier to show the raw 1-to-1 value against the NPR. For converting actual amounts, refer to the official table or our <a href="/#/converter" class="text-blue-600 hover:underline font-medium">converter tool</a>. The Indian Rupee is also shown here on a 1-unit basis for a clear comparison, although it trades officially in units of 100.</p>`,
      `<p>How do these currencies stack up head-to-head? This section ranks all currencies based on their normalized per-unit selling rate. The "Most Expensive" list is often a stable ranking of high-value currencies, primarily from the Middle East. The "Least Expensive" list highlights currencies where the NPR has significantly more purchasing power on a 1-to-1 basis. It's important to differentiate this normalized ranking from the official trading units. For example, while the JPY is on the "Least Expensive" list per 1 unit, it is officially quoted in units of 10. Always use the main table or the <a href="/#/converter" class="text-blue-600 hover:underline font-medium">converter</a> for practical transactions.</p>`
    ];
    return this._getVariant(date, variants);
  },

  /**
   * Generates the expanded "Market Trend Summary" text
   */
  getMarketTrendSummary: (analysisData: ArticleTemplateProps['analysisData'], historicalAnalysis: HistoricalAnalysisData | null) => {
    const { allRates, majorRates, topGainer, topLoser } = analysisData;
    const date = allRates[0].date;
    const gainersToday = allRates.filter(r => r.dailyChangePercent > 0.01 && r.currency.iso3 !== 'INR').length;
    const losersToday = allRates.filter(r => r.dailyChangePercent < -0.01 && r.currency.iso3 !== 'INR').length;
    
    let dailyTrend = 'a day of relative stability';
    if (gainersToday > losersToday * 1.5) dailyTrend = 'a strengthening trend for foreign currencies';
    else if (losersToday > gainersToday * 1.5) dailyTrend = 'a weakening trend for foreign currencies';

    const usd = majorRates.find(r => r.currency.iso3 === 'USD');
    const eur = majorRates.find(r => r.currency.iso3 === 'EUR');
    const sar = majorRates.find(r => r.currency.iso3 === 'SAR');

    const topWeekly = historicalAnalysis?.data[0];
    const topMonthly = historicalAnalysis?.data.find(r => r.percent > 0);
    const bottomWeekly = historicalAnalysis?.data[historicalAnalysis.data.length - 1];

    const variants = [
      // Variant 1
      `<p><strong>Market Summary:</strong> Today's forex market shows ${dailyTrend}, with <strong>${gainersToday}</strong> currencies gaining value against the NPR, while <strong>${losersToday}</strong> lost ground. This indicates a shift in market sentiment compared to yesterday's close. The day's biggest mover was the <strong>${topGainer.currency.name}</strong>, which surged by <strong>${topGainer.dailyChangePercent.toFixed(2)}%</strong>. On the flip side, the <strong>${loserName.currency.name}</strong> saw the sharpest decline, dropping <strong>${loserName.dailyChangePercent.toFixed(2)}%</strong>.</p>
       <p>Key currencies, crucial for remittances and trade, showed mixed results. The <a href="/#/historical-data/USD" class="text-blue-600 hover:underline font-medium">U.S. Dollar</a> ${usd && Math.abs(usd.dailyChangePercent) > 0.01 ? (usd.dailyChange > 0 ? 'gained' : 'lost') : 'remained stable'}, moving by <strong>${usd?.dailyChangePercent.toFixed(2)}%</strong>. The <a href="/#/historical-data/EUR" class="text-blue-600 hover:underline font-medium">European Euro</a> ${eur && Math.abs(eur.dailyChangePercent) > 0.01 ? (eur.dailyChange > 0 ? 'climbed' : 'fell') : 'held steady'}, posting a change of <strong>${eur?.dailyChangePercent.toFixed(2)}%</strong>. For remittance from the Gulf, the <a href="/#/historical-data/SAR" class="text-blue-600 hover:underline font-medium">Saudi Riyal</a> saw a change of <strong>${sar?.dailyChangePercent.toFixed(2)}%</strong>.</p>
       ${topWeekly ? `<p>Zooming out to the weekly trend, the <strong>${topWeekly.name}</strong> has been the strongest performer over the last 7 days, appreciating by <strong>${topWeekly.percent.toFixed(2)}%</strong> against the NPR. Conversely, the <strong>${bottomWeekly?.name}</strong> has been the weakest, depreciating by <strong>${bottomWeekly?.percent.toFixed(2)}%</strong> in the same period. This broader view helps to contextualize today's minor fluctuations.</p>` : ''}`,
      
      // Variant 2
      `<p><strong>Market Analysis:</strong> Analyzing the daily movements, <strong>${gainersToday}</strong> currencies appreciated against the NPR, while <strong>${losersToday}</strong> depreciated. This points to ${dailyTrend} in the short term. The most dramatic shift came from the <strong>${topGainer.currency.name}</strong>, which jumped <strong>${topGainer.dailyChangePercent.toFixed(2)}%</strong>. The <strong>${loserName.currency.name}</strong> faced the strongest headwind, falling <strong>${loserName.dailyChangePercent.toFixed(2)}%</strong>.</p>
       <p>The <a href="/#/historical-data/USD" class="text-blue-600 hover:underline font-medium">U.S. Dollar</a>, the primary currency for Nepal's international trade, ${usd && Math.abs(usd.dailyChange) > 0.01 ? `registered a change of <strong>Rs. ${usd.dailyChange.toFixed(3)}</strong> per unit` : 'showed minimal movement'}. This impacts everything from fuel costs to import duties. Other major currencies, such as the <a href="/#/historical-data/GBP" class="text-blue-600 hover:underline font-medium">Pound Sterling</a> and <a href="/#/historical-data/AUD" class="text-blue-600 hover:underline font-medium">Australian Dollar</a>, also reflected this mixed sentiment.</p>
       ${topMonthly ? `<p>Looking at the 30-day trend, the market has favored certain currencies. The <strong>${topMonthly.name}</strong>, for instance, has gained <strong>${topMonthly.percent.toFixed(2)}%</strong> over the past month, indicating sustained demand or strength. This contrasts with today's volatility and highlights the importance of viewing both short-term and long-term data for a complete financial picture.</p>` : ''}`,
       
       // Variant 3
      `<p><strong>Today's Trend:</strong> The currency market on ${date} saw <strong>${gainersToday}</strong> currencies rise and <strong>${losersToday}</strong> fall against the NPR. The most significant gainer was the <strong>${topGainer.currency.name}</strong>, posting an impressive <strong>${topGainer.dailyChangePercent.toFixed(2)}%</strong> increase. The heaviest loss was recorded by the <strong>${loserName.currency.name}</strong>, with a <strong>${loserName.dailyChangePercent.toFixed(2)}%</strong> drop.</p>
       <p>Major currencies pivotal for Nepali remittance and trade, such as the <a href="/#/historical-data/QAR" class="text-blue-600 hover:underline font-medium">Qatari Riyal</a> and <a href="/#/historical-data/AED" class="text-blue-600 hover:underline font-medium">UAE Dirham</a>, showed ${sar && Math.abs(sar.dailyChange) < 0.01 ? 'high stability' : 'some movement'}. The <a href="/#/historical-data/JPY" class="text-blue-600 hover:underline font-medium">Japanese Yen</a> (per 10 units) and <a href="/#/historical-data/KRW" class="text-blue-600 hover:underline font-medium">South Korean Won</a> (per 100 units) also saw shifts that are important for students and workers connected to those countries.</p>
       ${topWeekly && bottomWeekly ? `<p>The 7-day overview reveals a clearer trend for some. The <strong>${topWeekly.name}</strong> has been the 7-day champion with a <strong>${topWeekly.percent.toFixed(2)}%</strong> gain, while the <strong>${bottomWeekly.name}</strong> has struggled, losing <strong>${bottomWeekly.percent.toFixed(2)}%</strong>. This shows that today's ${dailyTrend} is part of a broader, more complex weekly pattern.</p>` : ''}`
    ];
    
    return this._getVariant(date, variants);
  }
};


// === THE DYNAMIC ARTICLE COMPONENT ===

export const GeneratedArchiveArticle: React.FC<ArticleTemplateProps> = (props) => {
  const {
    analysisData,
    historicalAnalysis,
    isHistoricalLoading,
    formattedDate,
    longDateHeader,
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
  
  // Get the generated text
  const introText = ArchiveTextGenerator.getNewsIntro(longDateHeader, allRates, topGainer, topLoser);
  const todaysDetailText = ArchiveTextGenerator.getTodaysForexDetail(allRates);
  const marketSummaryText = ArchiveTextGenerator.getMarketTrendSummary(analysisData, historicalAnalysis);

  return (
    <>
      <h1 className="!mb-2">Nepal Rastra Bank Forex Rates: {formattedDate}</h1>
      
      <p 
        className="text-lg lead text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: introText }}
      />
      
      <div dangerouslySetInnerHTML={{ __html: todaysDetailText }} />

      <SimplifiedRateTable rates={allRates} date={shortDate} />

      <section>
        <h2>Daily Market Commentary & Summary</h2>
        <div dangerouslySetInnerHTML={{ __html: marketSummaryText }} />
      </section>

      <CurrencyRankings topHigh={top10High} topLow={top12Low} date={shortDate} allRates={allRates} />

      <HistoricalAnalysisTabs 
        analysis={historicalAnalysis} 
        isLoading={isHistoricalLoading}
        activeTab={activeTab} 
        onTabChange={onTabChange} 
      />
    </>
  );
};

export default ArchiveDetail;
