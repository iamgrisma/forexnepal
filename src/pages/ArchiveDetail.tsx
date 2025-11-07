import React, { useEffect, useMemo, Suspense, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
// Import services
import { fetchForexRatesByDate, formatDateLong, getFlagEmoji } from '../services/forexService';
import { fetchRatesForDateWithCache } from '../services/d1ForexService';
// Import types
import { Rate, RatesData } from '../types/forex';
import { format, parseISO, addDays, subDays, isValid, startOfDay, isBefore, differenceInDays, subMonths, subYears, getDay } from 'date-fns';
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

// --- This type now holds a single set of data, not one for each tab ---
export type HistoricalAnalysisData = {
  data: HistoricalChange[];
};

// This type holds the complex sorted data for the new text generator
export type DailyAnalysis = {
  allRates: AnalyzedRate[];
  top10High: AnalyzedRate[];
  top12Low: AnalyzedRate[];
  topGainer: AnalyzedRate;
  topLoser: AnalyzedRate;
  majorRates: AnalyzedRate[];
  // --- NEW: Data for complex text generation ---
  interleavedList: AnalyzedRate[];
  allStable: boolean;
  allPositive: boolean;
  allNegative: boolean;
};


// Main props for the article component
export type ArticleTemplateProps = {
  analysisData: DailyAnalysis;
  historicalAnalysis: HistoricalAnalysisData | null; // This will be loaded lazily
  isHistoricalLoading: boolean; // Loading state for the lazy-loaded data
  formattedDate: string;
  longDateHeader: string; // The new "news dateline"
  shortDate: string;
  dayOfWeek: number; // 0 for Sunday, 1 for Monday...
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
  let dayOfWeek = 0;
  if (targetDateStr) {
    try {
      const parsedDate = parseISO(targetDateStr);
      if (isValid(parsedDate)) {
        targetDate = startOfDay(parsedDate);
        dayOfWeek = getDay(targetDate); // 0 = Sunday, 1 = Monday, etc.
        isValidDate = true;
      }
    } catch (e) { console.error('Error parsing date:', e); }
  }
  
  // --- Create all date formats ---
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
  // --- State for the comparison date string ---
  const [comparisonDateStr, setComparisonDateStr] = useState<string | null>(null);

  // --- Lazy-loading query for the *single* comparison date ---
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

  // --- Effect to trigger lazy-loading when tab changes ---
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
        // On component mount, default to 7day
        compareDate = subDays(targetDate, 7);
        break;
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
  const analysisData: DailyAnalysis | null = useMemo(() => {
    if (!currentDayData?.rates) return null;

    const currentRates = currentDayData.rates;
    const prevDayRates = prevDayData?.rates || [];

    const analyzedRates: AnalyzedRate[] = ALL_CURRENCY_CODES.map(code => {
      const rate = currentRates.find(r => r.currency.iso3 === code);
      const prevRate = prevDayRates.find(pr => pr.currency.iso3 === code);
      
      const info = CURRENCY_MAP[code] || rate?.currency;
      
      if (!rate || !info) {
        return null; 
      }

      const buy = Number(rate.buy);
      const sell = Number(rate.sell);
      const unit = info.unit || 1;
      const normalizedBuy = buy / unit;
      const normalizedSell = sell / unit;

      const prevBuy = prevRate ? (Number(prevRate.buy) / (prevRate.currency.unit || 1)) : 0;
      const prevSell = prevRate ? (Number(prevRate.sell) / (prevRate.currency.unit || 1)) : 0;
      
      // --- IMPORTANT: Calculate change based on BUY rate for consistency ---
      const dailyChange = prevRate ? (normalizedBuy - prevBuy) : 0;
      const dailyChangePercent = (prevRate && prevBuy > 0) ? (dailyChange / prevBuy) * 100 : 0;
      
      // Also calculate sell change just in case
      const dailySellChange = prevRate ? (normalizedSell - prevSell) : 0;


      return {
        ...rate, 
        currency: { 
            iso3: code,
            name: info.name,
            unit: info.unit
        },
        buy,
        sell,
        normalizedBuy,
        normalizedSell,
        dailyChange, // This is normalized (per-unit) buy change
        dailyChangePercent, // This is normalized (per-unit) buy % change
      };
    }).filter((r): r is AnalyzedRate => r !== null); // Filter out nulls
    
    const filteredForRanking = analyzedRates.filter(r => r.currency.iso3 !== 'INR');
    const safeFilteredRates = filteredForRanking.length > 0 ? filteredForRanking : analyzedRates;

    const sortedRatesHigh = [...safeFilteredRates].sort((a, b) => b.normalizedSell - a.normalizedSell);
    const top10High = sortedRatesHigh.slice(0, 10);
    
    const sortedRatesLow = [...analyzedRates].sort((a, b) => a.normalizedSell - b.normalizedSell);
    const top12Low = sortedRatesLow.slice(0, 12);

    // --- NEW: Complex Sorting Logic ---
    const currenciesToSort = analyzedRates.filter(r => r.currency.iso3 !== 'INR');
    
    // Sort by percent change (desc), then alphabetically
    const sortedByChange = [...currenciesToSort].sort((a, b) => {
        if (a.dailyChangePercent > b.dailyChangePercent) return -1;
        if (a.dailyChangePercent < b.dailyChangePercent) return 1;
        return a.currency.iso3.localeCompare(b.currency.iso3);
    });

    const positiveChanges = sortedByChange.filter(r => r.dailyChangePercent > 0.0001);
    const negativeChanges = sortedByChange.filter(r => r.dailyChangePercent < -0.0001).reverse(); // .reverse() to get most negative first
    const stableChanges = sortedByChange.filter(r => Math.abs(r.dailyChangePercent) <= 0.0001);

    const interleavedList: AnalyzedRate[] = [];
    const maxLen = Math.max(positiveChanges.length, negativeChanges.length);
    for (let i = 0; i < maxLen; i++) {
        if (positiveChanges[i]) interleavedList.push(positiveChanges[i]);
        if (negativeChanges[i]) interleavedList.push(negativeChanges[i]);
    }
    interleavedList.push(...stableChanges); // Add stable ones at the end

    const allStable = positiveChanges.length === 0 && negativeChanges.length === 0;
    const allPositive = negativeChanges.length === 0 && positiveChanges.length > 0;
    const allNegative = positiveChanges.length === 0 && negativeChanges.length > 0;
    
    const topGainer = positiveChanges[0] || stableChanges[0] || analyzedRates[0];
    const topLoser = negativeChanges[0] || stableChanges[0] || analyzedRates[0];

    const majorRates = MAJOR_CURRENCY_CODES.map(code => 
      analyzedRates.find(r => r.currency.iso3 === code)
    ).filter((r): r is AnalyzedRate => r !== null);

    return {
      allRates: analyzedRates,
      top10High,
      top12Low,
      topGainer,
      topLoser,
      majorRates,
      interleavedList,
      allStable,
      allPositive,
      allNegative,
    };
  }, [currentDayData, prevDayData]);

  // --- Helper to process historical data ---
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
                  dayOfWeek={dayOfWeek}
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
                  {/* We multiply by unit here to show the *actual* paisa change for the unit */}
                  <ChangeIndicator value={rate.dailyChange * rate.currency.unit} decimals={3} />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-base">Rs. {rate.sell.toFixed(2)}</span>
                  {/* We don't have daily *sell* change, so we just show the buy change for both as an indicator */}
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
const CurrencyRankings: React.FC<{ topHigh: AnalyzedRate[], topLow: AnalyzedRate[], date: string, allRates: AnalyzedRate[], dayOfWeek: number }> = ({ topHigh, topLow, date, allRates, dayOfWeek }) => {
  const text = ArchiveTextGenerator.getCurrencyRankingsText(date, allRates, dayOfWeek);
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
  onTabChange: (tab: string) => void;
  dayOfWeek: number;
}> = ({ analysis, isLoading, activeTab, onTabChange, dayOfWeek }) => {
  const introText = ArchiveTextGenerator.getHistoricalAnalysisIntro(dayOfWeek);
  return(
    <section>
      <h2>Historical Performance Analysis (vs. NPR)</h2>
      <div dangerouslySetInnerHTML={{ __html: introText }} />
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
};

/**
 * Renders a single tab's content
 */
const HistoricalTabContent: React.FC<{ data: HistoricalChange[]; isLoading: boolean; }> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 min-h-[200px] relative">
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        {Array(22).fill(0).map((_, i) => (
          <div key={i} className="flex justify-between py-3 border-b opacity-50">
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
  // --- FIX: Helper now takes dayOfWeek (0-6) ---
  _getVariant: (dayOfWeek: number, variants: string[]) => {
    try {
      return variants[dayOfWeek % variants.length];
    } catch {
      return variants[0];
    }
  },

  /**
   * Generates the "News Dateline" introduction (7 Variations)
   */
  getNewsIntro: (longDateHeader: string, analysisData: DailyAnalysis, dayOfWeek: number) => {
    const { allRates, topGainer, topLoser } = analysisData;
    const usd = allRates.find(r => r.currency.iso3 === 'USD');
    const usdBuy = usd ? usd.buy.toFixed(2) : 'N/A';
    const usdSell = usd ? usd.sell.toFixed(2) : 'N/A';
    const gainerName = topGainer.currency.name;
    const gainerChange = (topGainer.dailyChange * topGainer.currency.unit).toFixed(3);
    const loserName = topLoser.currency.name;
    const loserChange = (topLoser.dailyChange * topLoser.currency.unit).toFixed(3);

    const variants = [
      // 0: Sunday
      `<p><strong>${longDateHeader}</strong> | Nepal Rastra Bank (NRB), the central monetary authority of Nepal, has published the official foreign exchange rates for today. These rates serve as the benchmark for all banks and financial institutions (BFIs) across the country for currency transactions. Today's market bulletin indicates a day of mixed movements, with the <strong>U.S. Dollar</strong> settling at a buying rate of <strong>Rs. ${usdBuy}</strong> and a selling rate of <strong>Rs. ${usdSell}</strong>. This rate is a critical indicator for Nepal's import-heavy economy and the remittance inflows that form its backbone. Among other major currencies, the ${gainerName} saw a notable appreciation of Rs. ${gainerChange} per unit, while the ${loserName} registered a decline of Rs. ${loserChange}. This report provides a detailed breakdown of all currency values, market trends, and historical performance analysis.</p>`,
      // 1: Monday
      `<p><strong>${longDateHeader}</strong> | The Central Bank of Nepal, Nepal Rastra Bank (NRB), has released its daily 'Foreign Exchange Rates' bulletin, setting the reference values for the Nepali Rupee (NPR) against various international currencies. For today, the <strong>U.S. Dollar</strong>, a key currency for international trade, is fixed at a buying rate of <strong>Rs. ${usdBuy}</strong> and a selling rate of <strong>Rs. ${usdSell}</strong>. These official rates are mandatory for 'A' class commercial banks, 'B' class development banks, and 'C' class finance companies for their currency exchange operations. Today's data highlights the ${gainerName} as the top performer, gaining Rs. ${gainerChange}, while the ${loserName} saw the most significant drop at Rs. ${loserChange}. Below, you will find a comprehensive analysis of today's rates, long-term trends, and market summaries.</p>`,
      // 2: Tuesday
      `<p><strong>${longDateHeader}</strong> | Today's foreign exchange market in Nepal is guided by the latest reference rates issued by Nepal Rastra Bank. The value of the <strong>U.S. Dollar</strong>, which heavily influences the nation's import-export balance, has been set at <strong>Rs. ${usdBuy}</strong> for buying and <strong>Rs. ${usdSell}</strong> for selling. This bulletin from ForexNepal provides a complete overview of the official rates for all listed currencies, including major players like the Euro, Pound Sterling, and various Gulf currencies. We will delve into the day's significant movers, with the ${gainerName} appreciating and the ${loserName} depreciating, and provide a detailed analysis of both short-term and long-term market trends.</p>`,
      // 3: Wednesday
      `<p><strong>${longDateHeader}</strong> | The NRB has announced the official exchange rates for the Nepali Rupee (NPR) today. This daily publication is crucial for businesses and individuals engaged in foreign transactions. The benchmark <strong>U.S. Dollar</strong> is trading at <strong>Rs. ${usdBuy}</strong> (Buy) and <strong>Rs. ${usdSell}</strong> (Sell). This report offers an in-depth look at these figures, including a detailed table of all currencies, an analysis of the day's top gainer, the ${gainerName} (+Rs. ${gainerChange}), and the top loser, the ${loserName} (${loserChange}). Furthermore, we analyze the historical performance of these currencies over various periods to provide a clearer market perspective.</p>`,
      // 4: Thursday
      `<p><strong>${longDateHeader}</strong> | Nepal Rastra Bank has published the foreign exchange rates for today, providing the official valuation of the Nepali Rupee against a basket of 22 foreign currencies. The <strong>U.S. Dollar</strong>, a critical measure for the economy, is posted at a buy rate of <strong>Rs. ${usdBuy}</strong> and a sell rate of <strong>Rs. ${usdSell}</strong>. These rates are effective for transactions conducted by authorized dealers. In today's market, the ${gainerName} has shown significant strength, while the ${loserName} has weakened. This detailed analysis covers the day's summary, value rankings, and a multi-period historical performance review to give you a complete picture of the forex market.</p>`,
      // 5: Friday
      `<p><strong>${longDateHeader}</strong> | As the week concludes, Nepal Rastra Bank has set the official forex rates. The <strong>U.S. Dollar</strong> is valued at <strong>Rs. ${usdBuy}</strong> for buying and <strong>Rs. ${usdSell}</strong> for selling. These rates are pivotal for weekend planning for businesses and individuals awaiting remittances. Today's market activity was defined by a strong performance from the ${gainerName} and a downturn for the ${loserName}. This report will guide you through all 22 currency rates, their daily changes, and their performance over time.</p>`,
      // 6: Saturday
      `<p><strong>${longDateHeader}</strong> | While banks are closed today, Nepal Rastra Bank has published the reference exchange rates that will be effective for today's transactions where applicable. The <strong>U.S. Dollar</strong> is quoted at <strong>Rs. ${usdBuy}</strong> (Buy) and <strong>Rs. ${usdSell}</strong> (Sell). Often, weekend rates reflect the closing rates of the previous day. Today’s report analyzes these figures, including the daily change of the ${gainerName} (up by Rs. ${gainerChange}) and the ${loserName} (down by Rs. ${loserChange}), providing a full summary and historical context.</p>`
    ];
    
    return ArchiveTextGenerator._getVariant(dayOfWeek, variants);
  },

  /**
   * Generates the new "Today's Forex Detail" section based on complex sorting
   */
  getTodaysForexDetail: (analysisData: DailyAnalysis, dayOfWeek: number) => {
    const { allRates, interleavedList, allStable, allPositive, allNegative } = analysisData;
    
    // --- Define 7 variations for each sentence type ---
    const link = (r: AnalyzedRate) => `<a href="/#/historical-data/${r.currency.iso3}" class="font-medium text-blue-600 hover:underline">${r.currency.name} (${r.currency.iso3})</a>`;
    const flag = (r: AnalyzedRate) => getFlagEmoji(r.currency.iso3);
    const buy = (r: AnalyzedRate) => `<strong>Rs. ${r.buy.toFixed(2)}</strong>`;
    const sell = (r: AnalyzedRate) => `<strong>Rs. ${r.sell.toFixed(2)}</strong>`;
    const unit = (r: AnalyzedRate) => `${r.currency.unit} unit${r.currency.unit > 1 ? 's' : ''}`;
    const change = (r: AnalyzedRate) => `Rs. ${Math.abs(r.dailyChange * r.currency.unit).toFixed(3)}`;
    const changePercent = (r: AnalyzedRate) => `(${Math.abs(r.dailyChangePercent).toFixed(2)}%)`;

    // 7 variations for a positive change sentence
    const positiveSentences = [
      (r: AnalyzedRate) => `The ${link(r)} ${flag(r)} advanced against the NPR, gaining ${change(r)} ${changePercent} to reach a buying rate of ${buy(r)} and a selling rate of ${sell(r)} per ${unit(r)}.`,
      (r: AnalyzedRate) => `A notable gainer today is the ${link(r)}, which appreciated by ${change(r)} ${changePercent}; it is now trading at ${buy(r)} (Buy) and ${sell(r)} (Sell) for ${unit(r)}.`,
      (r: AnalyzedRate) => `The Nepali Rupee weakened against the ${link(r)} ${flag(r)}, which climbed by ${change(r)}. Financial institutions will now buy ${unit(r)} for ${buy(r)} and sell for ${sell(r)}.`,
      (r: AnalyzedRate) => `Showing strength, the ${link(r)} rose by ${change(r)} ${changePercent}, bringing its official buy rate to ${buy(r)} and sell rate to ${sell(r)} for ${unit(r)}.`,
      (r: AnalyzedRate) => `Similarly, the ${link(r)} ${flag(r)} also saw an increase of ${change(r)}. Its value is now set at ${buy(r)} (Buy) and ${sell(r)} (Sell) per ${unit(r)}.`,
      (r: AnalyzedRate) => `The ${link(r)} has become more expensive, appreciating by ${change(r)} ${changePercent}. The new rate is ${buy(r)} for buying and ${sell(r)} for selling per ${unit(r)}.`,
      (r: AnalyzedRate) => `An upward trend was seen in the ${link(r)} ${flag(r)}, which increased by ${change(r)}. Today, ${unit(r)} can be bought for ${buy(r)} and sold for ${sell(r)}.`
    ];
    
    // 7 variations for a negative change sentence
    const negativeSentences = [
      (r: AnalyzedRate) => `Conversely, the ${link(r)} ${flag(r)} depreciated by ${change(r)} ${changePercent}, settling at a buying rate of ${buy(r)} and a selling rate of ${sell(r)} per ${unit(r)}.`,
      (r: AnalyzedRate) => `The ${link(r)} weakened today, dropping by ${change(r)} ${changePercent}. It is now listed at ${buy(r)} (Buy) and ${sell(r)} (Sell) for ${unit(r)}.`,
      (r: AnalyzedRate) => `The Nepali Rupee strengthened against the ${link(r)} ${flag(r)}, which fell by ${change(r)}. Banks will now purchase ${unit(r)} for ${buy(r)} and sell for ${sell(r)}.`,
      (r: AnalyzedRate) => `Showing weakness, the ${link(r)} declined by ${change(r)} ${changePercent}, adjusting its official buy rate to ${buy(r)} and sell rate to ${sell(r)} for ${unit(r)}.`,
      (r: AnalyzedRate) => `In contrast, the ${link(r)} ${flag(r)} saw a decrease of ${change(r)}. Its value is now fixed at ${buy(r)} (Buy) and ${sell(r)} (Sell) per ${unit(r)}.`,
      (r: AnalyzedRate) => `The ${link(r)} has become cheaper, depreciating by ${change(r)} ${changePercent}. The new rate is ${buy(r)} for buying and ${sell(r)} for selling per ${unit(r)}.`,
      (r: AnalyzedRate) => `A downward trend was observed for the ${link(r)} ${flag(r)}, which decreased by ${change(r)}. Today, ${unit(r)} can be bought for ${buy(r)} and sold for ${sell(r)}.`
    ];

    // 7 variations for a stable sentence
    const stableSentences = [
      (r: AnalyzedRate) => `The ${link(r)} ${flag(r)} remained stable with no change from yesterday, holding at ${buy(r)} (Buy) and ${sell(r)} (Sell) per ${unit(r)}.`,
      (r: AnalyzedRate) => `No change was recorded for the ${link(r)}, which maintains its rate of ${buy(r)} for buying and ${sell(r)} for selling (${unit(r)}).`,
      (r: AnalyzedRate) => `The ${link(r)} ${flag(r)} held steady, with its buying rate at ${buy(r)} and selling rate at ${sell(r)} per ${unit(r)}.`,
      (r: AnalyzedRate) => `Similarly, the ${link(r)} also showed no fluctuation, remaining at ${buy(r)} (Buy) and ${sell(r)} (Sell) for ${unit(r)}.`,
      (r: AnalyzedRate) => `The rate for the ${link(r)} ${flag(r)} is unchanged, listed at ${buy(r)} (Buy) and ${sell(r)} (Sell) per ${unit(r)}.`,
      (r: AnalyzedRate) => `A stable rate was posted for the ${link(r)}, which continues to trade at ${buy(r)} (Buy) and ${sell(r)} (Sell) per ${unit(r)}.`,
      (r: AnalyzedRate) => `The ${link(r)} ${flag(r)} saw no movement, with its value constant at ${buy(r)} for buying and ${sell(r)} for selling (${unit(r)}).`
    ];

    let html = `<h2>Today's Forex Detail:</h2>`;
    
    // Start with INR
    const inr = allRates.find(r => r.currency.iso3 === 'INR');
    if (inr) {
      html += `<p>The <strong>Indian Rupee (INR)</strong>, to which the NPR is pegged, maintains its fixed rate. Today's official rate for ${unit(inr)} is <strong>Rs. ${inr.buy.toFixed(2)}</strong> (Buy) and <strong>Rs. ${inr.sell.toFixed(2)}</strong> (Sell).</p>`;
    }
    
    // Handle Edge Cases
    if (allStable) {
      const stableIntros = [
        `Today's market is exceptionally stable, with no currencies showing any change from yesterday's closing rates.`,
        `In a rare market event, all foreign currencies remained unchanged against the Nepali Rupee today.`,
        `Nepal Rastra Bank reports a day of complete stability, with all exchange rates holding steady from the previous day.`,
        `There has been no fluctuation in the forex market today. All rates are identical to yesterday's bulletin.`,
        `The currency market saw no movement today, with all 21 other currencies remaining stable against the NPR.`,
        `A day of calm in the forex market: no currencies reported any gains or losses against the Nepali Rupee.`,
        `All currencies, from the US Dollar to the Bahraini Dinar, have remained stable today with no price changes.`
      ];
      html += `<p>${ArchiveTextGenerator._getVariant(dayOfWeek, stableIntros)} `;
      // List first 5-7 stable currencies
      interleavedList.slice(0, 7).forEach((rate, i) => {
          html += stableSentences[i % stableSentences.length](rate) + " ";
      });
      html += `All other currencies also remained unchanged.</p>`;
      return html;
    }
    
    if (allPositive) {
      const positiveIntros = [
        `The Nepali Rupee has weakened against all other 21 foreign currencies in today's trading.`,
        `In a significant market shift, the NPR depreciated against every other currency in the bulletin today.`,
        `Today's market shows a broad weakening of the Nepali Rupee, with all foreign currencies gaining value.`,
        `All 21 foreign currencies appreciated against the NPR in today's forex update from the central bank.`,
        `A challenging day for the Rupee, as it lost ground to all other currencies listed by the NRB.`,
        `The forex market moved in unison today, with every foreign currency strengthening against the NPR.`,
        `Today's report indicates a universal gain for foreign currencies, as the Nepali Rupee weakened across the board.`
      ];
      html += `<p>${ArchiveTextGenerator._getVariant(dayOfWeek, positiveIntros)} `;
      // List all, sorted from most positive to least
      interleavedList.forEach((rate, i) => {
        html += positiveSentences[i % positiveSentences.length](rate) + " ";
      });
      html += `</p>`;
      return html;
    }
    
    if (allNegative) {
      const negativeIntros = [
        `The Nepali Rupee has strengthened against all other 21 foreign currencies in today's trading.`,
        `In a significant market shift, the NPR appreciated against every other currency in the bulletin today.`,
        `Today's market shows a broad strengthening of the Nepali Rupee, with all foreign currencies losing value.`,
        `All 21 foreign currencies depreciated against the NPR in today's forex update from the central bank.`,
        `A strong day for the Rupee, as it gained ground on all other currencies listed by the NRB.`,
        `The forex market moved in unison today, with every foreign currency weakening against the NPR.`,
        `Today's report indicates a universal loss for foreign currencies, as the Nepali Rupee strengthened across the board.`
      ];
      html += `<p>${ArchiveTextGenerator._getVariant(dayOfWeek, negativeIntros)} `;
      // List all, sorted from most negative to least
      interleavedList.forEach((rate, i) => {
        html += negativeSentences[i % negativeSentences.length](rate) + " ";
      });
      html += `</p>`;
      return html;
    }

    // --- Default: Mixed Market ---
    const mixedIntros = [
      `Today's market shows a mixed performance. The biggest gain was seen in the ${link(interleavedList[0])}, while the ${link(interleavedList[1])} saw the largest drop.`,
      `It was a volatile day for the NPR. While the ${link(interleavedList[0])} advanced significantly, the ${link(interleavedList[1])} faced a notable decline.`,
      `The currency market was mixed today. The ${link(interleavedList[0])} led the gainers, as the ${link(interleavedList[1])} led the losers.`,
      `A day of mixed trends: the ${link(interleavedList[0])} was the top performer, whereas the ${link(interleavedList[1])} depreciated the most.`,
      `The market saw movements in both directions. The ${link(interleavedList[0])} appreciated the most, while the ${link(interleavedList[1])} saw the biggest fall.`,
      `Key currencies were split: the ${link(interleavedList[0])} recorded the largest gain, and the ${link(interleavedList[1])} posted the largest loss.`,
      `Today's bulletin highlights a divided market. The ${link(interleavedList[0])} surged, but the ${link(interleavedList[1])} fell.`,
    ];
    html += `<p>${ArchiveTextGenerator._getVariant(dayOfWeek, mixedIntros)} `;
    
    // Loop through the interleaved list
    interleavedList.forEach((rate, i) => {
      if (rate.dailyChangePercent > 0.0001) {
        html += positiveSentences[i % positiveSentences.length](rate) + " ";
      } else if (rate.dailyChangePercent < -0.0001) {
        html += negativeSentences[i % negativeSentences.length](rate) + " ";
      } else {
        html += stableSentences[i % stableSentences.length](rate) + " ";
      }
    });
    html += `</p>`;
    return html;
  },

  /**
   * Generates the expanded "Currency Rankings" text (7 Variations)
   */
  getCurrencyRankingsText: (date: string, allRates: AnalyzedRate[], dayOfWeek: number) => {
    const variants = [
      // 0: Sunday
      `<p>This ranking provides insight into the relative strength of foreign currencies against the Nepali Rupee. The "Most Expensive" list shows currencies where 1 unit commands the highest NPR value, often led by strong Middle Eastern dinars from countries like Kuwait and Bahrain. This high value is a reflection of their stable economies, often backed by significant oil and gas reserves. These currencies are less common in daily transactions but are crucial for businesses and investments related to these specific regions. Their position at the top of the value chain has been consistent for many years.</p>
       <p>The "Least Expensive" list shows currencies where 1 unit has the lowest NPR value, such as the Japanese Yen or Korean Won, which are
       typically traded in larger units (10 and 100, respectively). This per-unit comparison is useful for understanding relative value, but for practical conversions, always check the official units in the table above or use our <a href="/#/converter" class="text-blue-600 hover:underline font-medium">currency converter</a>. Note: The pegged <a href="/#/historical-data/INR" class="text-blue-600 hover:underline font-medium">Indian Rupee (INR)</a> is included in the "Least Expensive" ranking on a 1-to-1 basis, where 1 INR is valued at Rs. 1.60.</p>`,
      // 1: Monday
      `<p>Understanding the per-unit value provides a clear picture of currency hierarchy. On ${date}, the most valuable currencies (per single unit) are dominated by Gulf state dinars, reflecting their strong economic standing. This normalized view strips away the trading units to show raw value. Conversely, currencies like the Japanese Yen and South Korean Won appear "least expensive" because their denominations are much smaller; they are officially traded in units of 10 and 100. This ranking is for academic comparison. For converting actual amounts, refer to the official table or our <a href="/#/converter" class="text-blue-600 hover:underline font-medium">converter tool</a>. The Indian Rupee is also shown here on a 1-unit basis for a clear comparison, although it trades officially in units of 100.</p>
       <p>This comparison is essential for travelers and investors. Seeing the Omani Rial or Kuwaiti Dinar at the top signifies their high purchasing power, whereas seeing the Korean Won at the bottom simply means its base unit is very small. It does not necessarily reflect a "weak" economy but rather a different monetary scale, similar to how one might compare a 'paisa' to a 'rupee'.</p>`,
      // 2: Tuesday
      `<p>How do these currencies stack up head-to-head? This section ranks all currencies based on their normalized per-unit selling rate. The "Most Expensive" list is often a stable ranking of high-value currencies, primarily from the Middle East, such as the Bahraini Dinar and Omani Rial. Their high value per unit is a long-standing feature of the global forex market. The "Least Expensive" list highlights currencies where the NPR has significantly more purchasing power on a 1-to-1 basis. It's important to differentiate this normalized ranking from the official trading units. For example, while the JPY is on the "Least Expensive" list per 1 unit, it is officially quoted in units of 10. Always use the main table or the <a href="/#/converter" class="text-blue-600 hover:underline font-medium">converter</a> for practical transactions.</p>`,
      // 3: Wednesday
      `<p>The following lists provide a clear "value ranking" of all 22 currencies against the NPR, based on the cost of a single unit. The "Most Expensive" list is consistently topped by currencies like the Kuwaiti Dinar (KWD), which reflects its high nominal value. This list is useful for understanding which currencies are worth the most on a per-unit basis. On the other end of the spectrum, the "Least Expensive" list features currencies like the Japanese Yen (JPY) and South Korean Won (KRW). It is critical to note that these currencies are officially traded in units of 10 and 100, respectively. Their position on this list is due to their small base unit, not necessarily economic weakness. The Indian Rupee (INR) is also shown, with 1 unit valued at Rs. 1.60, though its official trading unit is 100.</p>`,
      // 4: Thursday
      `<p>Here we analyze the nominal value of each currency per single unit. The "Most Expensive" list is dominated by currencies from the Gulf Cooperation Council (GCC) countries. The high value of the Kuwaiti Dinar, Bahraini Dinar, and Omani Rial is a stable feature of the forex market. In contrast, the "Least Expensive" list includes major world currencies like the Japanese Yen and South Korean Won. This is not an indicator of poor economic health, but rather a structural choice in their monetary system where transactions involve larger numbers. For instance, a small purchase in Japan might cost 1,000 Yen. Our <a href="/#/converter" class="text-blue-600 hover:underline font-medium">converter</a> automatically handles these official units, but this ranking is provided for a pure 1-to-1 value comparison.</p>`,
      // 5: Friday
      `<p>This per-unit value ranking clarifies which currencies are nominally high or low against the NPR. The "Most Expensive" list is consistently led by Gulf currencies, whose 1 unit fetches a very high amount of NPR. This is crucial for businesses dealing in high-value imports or assets from these regions. The "Least Expensive" list is equally important for understanding currency structures. Currencies like the JPY and KRW have low per-unit values, which is why NRB quotes them in units of 10 and 100 to make the rates more manageable. This list also includes the pegged Indian Rupee, showing its 1-to-1 value of Rs. 1.60. For accurate financial planning, always refer to the official units in the main table.</p>`,
      // 6: Saturday
      `<p>The value of a single unit of currency can vary dramatically, as shown in these rankings for ${date}. The "Most Expensive" list features the global heavyweights in nominal value, such as the KWD and BHD. This demonstrates the significant capital required to purchase even one unit of these currencies. The "Least Expensive" list, however, is a matter of denomination. The JPY, KRW, and INR all have small base units, making them appear "cheap" in this 1-to-1 comparison. This ranking is for informational purposes; real-world transactions will use the official units (e.g., 100 for KRW, 10 for JPY) as specified in the main table. Our <a href="/#/converter" class="text-blue-600 hover:underline font-medium">converter</a> handles this automatically.</p>`
    ];
    return ArchiveTextGenerator._getVariant(dayOfWeek, variants);
  },

  /**
   * Generates the expanded "Historical Analysis" intro text (7 Variations)
   */
  getHistoricalAnalysisIntro: (dayOfWeek: number) => {
    const variants = [
      // 0: Sunday
      `<p>Today's daily change is only part of the story. The following tabs show the performance of various currencies against the Nepali Rupee over extended timeframes, all ending on this report's date. The analysis compares the normalized 'Buy' rate from the start of the period to the rate on this date. This long-term view is essential for identifying sustained trends versus short-term volatility. Data is loaded on-demand when you click a tab. This comparison helps identify long-term trends and currency strength relative to the NPR. For a more detailed visual breakdown, please visit our interactive <a href="/#/historical-charts" class="text-blue-600 hover:underline font-medium">historical charts page</a>.</p>`,
      // 1: Monday
      `<p>To understand the full context of today's rates, we must look at their performance over time. This section provides a historical analysis by comparing today's 'Buy' rates to those from 7 days, 30 days, 90 days, 1 year, 5 years, and even as far back as 2002. This reveals the long-term appreciation or depreciation of currencies against the NPR. Click a tab to load the comparison data for that period. This is crucial for long-term investors and for understanding Nepal's economic position over time. For a granular daily chart, please use our <a href="/#/historical-charts" class="text-blue-600 hover:underline font-medium">historical charts tool</a>.</p>`,
      // 2: Tuesday
      `<p>A single day's movement can be misleading. To provide a clearer picture, this section analyzes the historical performance of each currency. We compare the current 'Buy' rate (normalized per 1 unit) with the rate from various periods in the past. This allows you to see which currencies have been on a sustained upward or downward trend. The data for each tab is fetched from our database only when you click on it. This analysis is vital for assessing long-term investments and understanding the historical trajectory of remittance values. For a more detailed visual breakdown, please visit our interactive <a href="/#/historical-charts" class="text-blue-600 hover:underline font-medium">historical charts page</a>.</p>`,
      // 3: Wednesday
      `<p>While daily changes are important, the long-term trend provides a more stable indicator of a currency's health. The tabs below show the percentage and absolute change in the 'Buy' rate of each currency from a specific point in the past (e.g., 7 days ago, 1 year ago) to today. This analysis, which loads when you select a tab, helps differentiate between a temporary dip and a long-term decline. This is especially useful for tracking the value of savings or understanding the changing cost of imports over time. For a more detailed visual breakdown, please visit our interactive <a href="/#/historical-charts" class="text-blue-600 hover:underline font-medium">historical charts page</a>.</p>`,
      // 4: Thursday
      `<p>This section provides a much-needed historical perspective on today's rates. By comparing the current 'Buy' rate with historical data, we can see the true performance of each currency over time. The tabs below allow you to dynamically load and analyze performance over a week, a month, a quarter, a year, five years, or even since 2002. This data is critical for economists, businesses making long-term plans, and anyone interested in the macroeconomic trends affecting the Nepali Rupee. For a more detailed visual breakdown, please visit our interactive <a href="/#/historical-charts" class="text-blue-600 hover:underline font-medium">historical charts page</a>.</p>`,
      // 5: Friday
      `<p>How does today's rate compare to last week, last month, or last year? This historical analysis section answers that question. By clicking a tab, you will load a comparison of today's normalized 'Buy' rate against the rate from that period. This helps to smooth out daily noise and reveal the underlying market direction. Understanding whether a currency has gained or lost 20% in a year is far more significant than a 0.2% daily change. This is the data that informs long-range financial strategy. For a more detailed visual breakdown, please visit our interactive <a href="/#/historical-charts" class="text-blue-600 hover:underline font-medium">historical charts page</a>.</p>`,
      // 6: Saturday
      `<p>Context is key in finance. This section provides that context by comparing today's rates to historical benchmarks. We analyze the change in the normalized 'Buy' rate over six different timeframes, from one week to over two decades. This allows you to assess the long-term performance and stability of each currency against the NPR. The data is loaded dynamically when you select a tab to ensure performance. This analysis is crucial for understanding the true appreciation or depreciation of assets over time. For a more detailed visual breakdown, please visit our interactive <a href="/#/historical-charts" class="text-blue-600 hover:underline font-medium">historical charts page</a>.</p>`
    ];
    return ArchiveTextGenerator._getVariant(dayOfWeek, variants);
  },

  /**
   * Generates the expanded "Market Trend Summary" text (7 Variations)
   */
  getMarketTrendSummary: (analysisData: DailyAnalysis, historicalAnalysis: HistoricalAnalysisData | null, dayOfWeek: number) => {
    const { allRates, majorRates, topGainer, topLoser } = analysisData;
    const date = allRates[0].date;
    const gainersToday = allRates.filter(r => r.dailyChangePercent > 0.01 && r.currency.iso3 !== 'INR').length;
    const losersToday = allRates.filter(r => r.dailyChangePercent < -0.01 && r.currency.iso3 !== 'INR').length;
    const stableToday = allRates.filter(r => Math.abs(r.dailyChangePercent) <= 0.01 && r.currency.iso3 !== 'INR').length;

    let dailyTrend = 'a balanced market, with no clear consensus';
    if (gainersToday > losersToday * 1.5) dailyTrend = 'a strengthening trend for foreign currencies';
    else if (losersToday > gainersToday * 1.5) dailyTrend = 'a weakening trend for foreign currencies, favoring the NPR';

    const usd = majorRates.find(r => r.currency.iso3 === 'USD');
    const eur = majorRates.find(r => r.currency.iso3 === 'EUR');
    const sar = majorRates.find(r => r.currency.iso3 === 'SAR');

    const topWeekly = historicalAnalysis?.data[0];
    const topMonthly = historicalAnalysis?.data.find(r => r.percent > 0);
    const bottomWeekly = historicalAnalysis?.data[historicalAnalysis.data.length - 1];
    
    const loserName = topLoser ? topLoser.currency : { name: 'N/A', iso3: 'N/A' };

    const variants = [
      // 0: Sunday
      `<p><strong>Market Summary:</strong> Today's forex market shows ${dailyTrend}, with <strong>${gainersToday}</strong> currencies gaining value against the NPR, while <strong>${losersToday}</strong> lost ground. This indicates a shift in market sentiment compared to yesterday's close. The day's biggest mover was the <strong>${topGainer.currency.name}</strong>, which surged by <strong>${topGainer.dailyChangePercent.toFixed(2)}%</strong>. On the flip side, the <strong>${loserName.name}</strong> saw the sharpest decline, dropping <strong>${topLoser.dailyChangePercent.toFixed(2)}%</strong>.</p>
       <p>Key currencies, crucial for remittances and trade, showed mixed results. The <a href="/#/historical-data/USD" class="text-blue-600 hover:underline font-medium">U.S. Dollar</a> ${usd && Math.abs(usd.dailyChangePercent) > 0.01 ? (usd.dailyChange > 0 ? 'gained' : 'lost') : 'remained stable'}, moving by <strong>${usd?.dailyChangePercent.toFixed(2)}%</strong>. The <a href="/#/historical-data/EUR" class="text-blue-600 hover:underline font-medium">European Euro</a> ${eur && Math.abs(eur.dailyChangePercent) > 0.01 ? (eur.dailyChange > 0 ? 'climbed' : 'fell') : 'held steady'}, posting a change of <strong>${eur?.dailyChangePercent.toFixed(2)}%</strong>. For remittance from the Gulf, the <a href="/#/historical-data/SAR" class="text-blue-600 hover:underline font-medium">Saudi Riyal</a> saw a change of <strong>${sar?.dailyChangePercent.toFixed(2)}%</strong>.</p>
       ${topWeekly ? `<p>Zooming out to the weekly trend, the <strong>${topWeekly.name}</strong> has been the strongest performer over the last 7 days, appreciating by <strong>${topWeekly.percent.toFixed(2)}%</strong> against the NPR. Conversely, the <strong>${bottomWeekly?.name}</strong> has been the weakest, depreciating by <strong>${bottomWeekly?.percent.toFixed(2)}%</strong> in the same period. This broader view helps to contextualize today's minor fluctuations.</p>` : ''}`,
      
      // 1: Monday
      `<p><strong>Market Analysis:</strong> Analyzing the daily movements, <strong>${gainersToday}</strong> currencies appreciated against the NPR, while <strong>${losersToday}</strong> depreciated. This points to ${dailyTrend} in the short term. The most dramatic shift came from the <strong>${topGainer.currency.name}</strong>, which jumped <strong>${topGainer.dailyChangePercent.toFixed(2)}%</strong>. The <strong>${loserName.name}</strong> faced the strongest headwind, falling <strong>${topLoser.dailyChangePercent.toFixed(2)}%</strong>.</p>
       <p>The <a href="/#/historical-data/USD" class="text-blue-600 hover:underline font-medium">U.S. Dollar</a>, the primary currency for Nepal's international trade, ${usd && Math.abs(usd.dailyChange) > 0.01 ? `registered a change of <strong>Rs. ${usd.dailyChange.toFixed(3)}</strong> per unit` : 'showed minimal movement'}. This impacts everything from fuel costs to import duties. Other major currencies, such as the <a href="/#/historical-data/GBP" class="text-blue-600 hover:underline font-medium">Pound Sterling</a> and <a href="/#/historical-data/AUD" class="text-blue-600 hover:underline font-medium">Australian Dollar</a>, also reflected this mixed sentiment.</p>
       ${topMonthly ? `<p>Looking at the 30-day trend, the market has favored certain currencies. The <strong>${topMonthly.name}</strong>, for instance, has gained <strong>${topMonthly.percent.toFixed(2)}%</strong> over the past month, indicating sustained demand or strength. This contrasts with today's volatility and highlights the importance of viewing both short-term and long-term data for a complete financial picture.</p>` : ''}`,
       
       // 2: Tuesday
      `<p><strong>Today's Trend:</strong> The currency market on ${date} saw <strong>${gainersToday}</strong> currencies rise and <strong>${losersToday}</strong> fall against the NPR. The most significant gainer was the <strong>${topGainer.currency.name}</strong>, posting an impressive <strong>${topGainer.dailyChangePercent.toFixed(2)}%</strong> increase. The heaviest loss was recorded by the <strong>${loserName.name}</strong>, with a <strong>${topLoser.dailyChangePercent.toFixed(2)}%</strong> drop.</p>
       <p>Major currencies pivotal for Nepali remittance and trade, such as the <a href="/#/historical-data/QAR" class="text-blue-600 hover:underline font-medium">Qatari Riyal</a> and <a href="/#/historical-data/AED" class="text-blue-600 hover:underline font-medium">UAE Dirham</a>, showed ${sar && Math.abs(sar.dailyChange) < 0.01 ? 'high stability' : 'some movement'}. The <a href="/#/historical-data/JPY" class="text-blue-600 hover:underline font-medium">Japanese Yen</a> (per 10 units) and <a href="/#/historical-data/KRW" class="text-blue-600 hover:underline font-medium">South Korean Won</a> (per 100 units) also saw shifts that are important for students and workers connected to those countries.</p>
       ${topWeekly && bottomWeekly ? `<p>The 7-day overview reveals a clearer trend for some. The <strong>${topWeekly.name}</strong> has been the 7-day champion with a <strong>${topWeekly.percent.toFixed(2)}%</strong> gain, while the <strong>${bottomWeekly.name}</strong> has struggled, losing <strong>${bottomWeekly.percent.toFixed(2)}%</strong>. This shows that today's ${dailyTrend} is part of a broader, more complex weekly pattern.</p>` : ''}`,

      // 3: Wednesday
      `<p><strong>Market Commentary:</strong> Today's foreign exchange landscape was mixed, with <strong>${gainersToday}</strong> currencies gaining and <strong>${losersToday}</strong> losing value against the Rupee. The <strong>${topGainer.currency.name}</strong> led the charge with a <strong>${topGainer.dailyChangePercent.toFixed(2)}%</strong> rise, while the <strong>${loserName.name}</strong> fell by <strong>${topLoser.dailyChangePercent.toFixed(2)}%</strong>. This indicates a selective market rather than a broad trend.</p>
       <p>The <a href="/#/historical-data/USD" class="text-blue-600 hover:underline font-medium">U.S. Dollar</a> fluctuated by <strong>${usd?.dailyChangePercent.toFixed(2)}%</strong>, a critical movement for the national economy. Meanwhile, key Asian currencies like the <a href="/#/historical-data/MYR" class="text-blue-600 hover:underline font-medium">Malaysian Ringgit</a> and <a href="/#/historical-data/CNY" class="text-blue-600 hover:underline font-medium">Chinese Yuan</a> also saw adjustments. These shifts directly affect the thousands of Nepalis working and studying abroad.</p>
       ${topMonthly ? `<p>Over the last 30 days, the <strong>${topMonthly.name}</strong> has shown the most significant positive trend, with a gain of <strong>${topMonthly.percent.toFixed(2)}%</strong>. This longer-term perspective helps to filter out daily market "noise" and identify more substantial economic shifts that could be influencing the currency's value over time.</p>` : ''}`,

      // 4: Thursday
      `<p><strong>Daily Analysis:</strong> The forex market presented ${dailyTrend} today. We saw <strong>${gainersToday}</strong> currencies appreciate, while <strong>${losersToday}</strong> depreciated. The <strong>${topGainer.currency.name}</strong> was the day's top gainer at <strong>+${topGainer.dailyChangePercent.toFixed(2)}%</strong>. The <strong>${loserName.name}</strong> saw the largest loss, dropping <strong>${topLoser.dailyChangePercent.toFixed(2)}%</strong>.</p>
       <p>European currencies had a mixed session. The <a href="/#/historical-data/EUR" class="text-blue-600 hover:underline font-medium">Euro</a> moved by <strong>${eur?.dailyChangePercent.toFixed(2)}%</strong>, while the <a href="/#/historical-data/GBP" class="text-blue-600 hover:underline font-medium">Pound Sterling</a> also saw a change. These fluctuations are important for students and businesses with ties to Europe. The <a href="/#/historical-data/CHF" class="text-blue-600 hover:underline font-medium">Swiss Franc</a> also saw movement, impacting its standing as a stable asset.</p>
       ${topWeekly && bottomWeekly ? `<p>The 7-day trend analysis shows that the <strong>${topWeekly.name}</strong> has been the most consistent gainer with a <strong>${topWeekly.percent.toFixed(2)}%</strong> rise. In contrast, the <strong>${bottomWeekly.name}</strong> has seen the most significant drop over the week, falling <strong>${bottomWeekly.percent.toFixed(2)}%</strong>. This highlights the ongoing volatility in the global market.</p>` : ''}`,

      // 5: Friday
      `<p><strong>End-of-Week Summary:</strong> As the week's trading winds down, today's market closed with <strong>${gainersToday}</strong> winners and <strong>${losersToday}</strong> losers against the NPR. The <strong>${topGainer.currency.name}</strong> stood out with a <strong>${topGainer.dailyChangePercent.toFixed(2)}%</strong> gain. The <strong>${loserName.name}</strong> ended the day as the weakest performer, down <strong>${topLoser.dailyChangePercent.toFixed(2)}%</strong>.</p>
       <p>Remittance-heavy currencies from the Gulf, including the <a href="/#/historical-data/SAR" class="text-blue-600 hover:underline font-medium">Saudi Riyal</a>, <a href="/#/historical-data/QAR" class="text-blue-600 hover:underline font-medium">Qatari Riyal</a>, and <a href="/#/historical-data/AED" class="text-blue-600 hover:underline font-medium">UAE Dirham</a>, ${sar && Math.abs(sar.dailyChange) < 0.01 ? 'remained exceptionally stable, as expected' : 'showed minor adjustments'}. The <a href="/#/historical-data/USD" class="text-blue-600 hover:underline font-medium">U.S. Dollar</a> also saw a slight change of <strong>${usd?.dailyChangePercent.toFixed(2)}%</strong>.</p>
       ${topMonthly ? `<p>Over the past 30 days, the <strong>${topMonthly.name}</strong> has demonstrated the most substantial growth, appreciating by <strong>${topMonthly.percent.toFixed(2)}%</strong>. This provides a valuable medium-term perspective on currency performance, beyond the daily back-and-forth, which is crucial for financial planning and import/export scheduling.</p>` : ''}`,

      // 6: Saturday
      `<p><strong>Weekend Rate Analysis:</strong> The reference rates for today, ${date}, show <strong>${gainersToday}</strong> currencies up and <strong>${losersToday}</strong> down compared to the previous bulletin. The <strong>${topGainer.currency.name}</strong> was the most notable gainer (<strong>+${topGainer.dailyChangePercent.toFixed(2)}%</strong>), while the <strong>${loserName.name}</strong> saw the largest drop (<strong>${topLoser.dailyChangePercent.toFixed(2)}%</strong>).</p>
       <p>The <a href="/#/historical-data/USD" class="text-blue-600 hover:underline font-medium">U.S. Dollar</a>, the peg for many international transactions, ${usd && Math.abs(usd.dailyChange) > 0.01 ? `shifted by <strong>Rs. ${usd.dailyChange.toFixed(3)}</strong> per unit` : 'remained stable'}. Other currencies from the Oceania region, like the <a href="/#/historical-data/AUD" class="text-blue-600 hover:underline font-medium">Australian Dollar</a>, and North America, like the <a href="/#/historical-data/CAD" class="text-blue-600 hover:underline font-medium">Canadian Dollar</a>, also posted changes, reflecting the end of the global trading week.</p>
       ${topWeekly && bottomWeekly ? `<p>This week, the <strong>${topWeekly.name}</strong> has emerged as the strongest currency with a <strong>${topWeekly.percent.toFixed(2)}%</strong> increase. The <strong>${bottomWeekly.name}</strong>, on the other hand, has seen the most significant decline over the past seven days, falling <strong>${bottomWeekly.percent.toFixed(2)}%</strong>. This weekly summary helps to understand the underlying momentum of currencies.</p>` : ''}`
    ];
    
    // --- FIX: Call ArchiveTextGenerator._getVariant ---
    return ArchiveTextGenerator._getVariant(dayOfWeek, variants);
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
    dayOfWeek,
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
  const introText = ArchiveTextGenerator.getNewsIntro(longDateHeader, analysisData, dayOfWeek);
  const todaysDetailText = ArchiveTextGenerator.getTodaysForexDetail(analysisData, dayOfWeek);
  const marketSummaryText = ArchiveTextGenerator.getMarketTrendSummary(analysisData, historicalAnalysis, dayOfWeek);
  const rankingsText = ArchiveTextGenerator.getCurrencyRankingsText(shortDate, allRates, dayOfWeek);


  return (
    <>
      <h1>Nepal Rastra Bank Forex Rates: {formattedDate}</h1>
      
      <p 
        className="text-lg lead text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: introText }}
      />
      
      {/* --- NEW SECTION --- */}
      <div dangerouslySetInnerHTML={{ __html: todaysDetailText }} />

      <SimplifiedRateTable rates={allRates} date={shortDate} />

      <section>
        <h2>Daily Market Commentary & Summary</h2>
        <div dangerouslySetInnerHTML={{ __html: marketSummaryText }} />
      </section>

      {/* --- Pass dayOfWeek to generator --- */}
      <CurrencyRankings 
        topHigh={top10High} 
        topLow={top12Low} 
        date={shortDate} 
        allRates={allRates} 
        dayOfWeek={dayOfWeek} 
      />

      <HistoricalAnalysisTabs 
        analysis={historicalAnalysis} 
        isLoading={isHistoricalLoading}
        activeTab={activeTab} 
        onTabChange={onTabChange} 
        dayOfWeek={dayOfWeek}
      />
    </>
  );
};

export default ArchiveDetail;
