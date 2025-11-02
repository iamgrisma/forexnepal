import React, { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchForexRatesByDate, fetchHistoricalRates, formatDateLong, getFlagEmoji } from '@/services/forexService';
import { format, parseISO, addDays, subDays, isValid, startOfDay, isBefore, differenceInDays, getDay } from 'date-fns';
import Layout from '@/components/Layout';
import ForexTicker from '@/components/ForexTicker';
import { Rate, RatesData } from '@/types/forex';
import { cn } from '@/lib/utils';

// --- Types ---

// The main analysis object for a single rate
type AnalyzedRate = Rate & {
  normalizedBuy: number;
  normalizedSell: number;
  dailyChange: number;
  dailyChangePercent: number;
};

// Analysis for a historical period
type HistoricalChange = {
  iso3: string;
  name: string;
  unit: number;
  change: number;
  percent: number;
  oldRate: number;
  newRate: number;
};

// High/low values for a period
type HighLow = {
  highBuy: number;
  lowBuy: number;
  highSell: number;
  lowSell: number;
};

// --- Text Variations for Dynamic Content ---

const textVariations = {
  // 7 variations, one for each day of the week (getDay() -> 0-6)
  intro: [
    // Sunday (0)
    "Here is the official foreign exchange rate report for {date}, as published by Nepal Rastra Bank. These rates are foundational for trade and remittance activities at the start of the week.",
    // Monday (1)
    "Today, {date}, Nepal Rastra Bank has released the updated currency exchange rates. This report details the value of the Nepali Rupee against major world currencies, which is essential for businesses and individuals alike.",
    // Tuesday (2)
    "This report outlines the foreign exchange rates for {date}. Tracking these daily movements is crucial for anyone involved in international transactions. For precise calculations, you can always use our <a href='/#/converter' class='text-blue-600 hover:underline font-medium'>currency converter</a>.",
    // Wednesday (3)
    "Mid-week currency exchange rates for {date} have been set by Nepal Rastra Bank. Below, we provide a detailed analysis of today's figures, including key risers and fallers in the market.",
    // Thursday (4)
    "As we approach the end of the week, here are the official exchange rates for {date}. These figures dictate the terms for foreign currency exchange across Nepal's financial institutions.",
    // Friday (5)
    "This is the final currency exchange rate bulletin for the week, covering {date}. See how the Nepali Rupee stands against other currencies before the weekend break. You can explore long-term trends on our <a href='/#/historical-charts' class='text-blue-600 hover:underline font-medium'>historical charts page</a>.",
    // Saturday (6)
    "Welcome to the weekend report for {date}. While rates are typically set by Nepal Rastra Bank on working days, this archive provides the effective rates for today, reflecting the most recent official data."
  ],
  dailySummary: [
    // Sunday (0)
    "The market opens this week with notable shifts. The {topGainer.name} saw the most significant rise, while the {topLoser.name} faced a downturn. The {topCurrency.name} remains the strongest currency against the NPR, valued at {topCurrency.rate}.",
    // Monday (1)
    "Today's currency market shows mixed results. Key movements include a gain for the {topGainer.name} and a drop for the {topLoser.name}. Meanwhile, the {topCurrency.name} continues to hold its position as the most valuable foreign currency at {topCurrency.rate}.",
    // Tuesday (2)
    "Market volatility is evident in today's report. The {topGainer.name} has appreciated, emerging as the day's top gainer. In contrast, the {topLoser.name} depreciated the most. The {topCurrency.name} remains at the top of the value list at {topCurrency.rate}.",
    // Wednesday (3)
    "Mid-week analysis shows the {topGainer.name} leading the gains, whereas the {topLoser.name} saw the largest decline. The {topCurrency.name} is still the highest-valued currency at {topCurrency.rate}. For a broader view, check out the <a href='/#/historical-charts' class='text-blue-600 hover:underline font-medium'>historical data charts</a>.",
    // Thursday (4)
    "In today's trading, the {topGainer.name} posted the strongest performance, while the {topLoser.name} recorded the biggest loss. The {topCurrency.name} continues to lead the pack, trading at {topCurrency.rate} per unit.",
    // Friday (5)
    "Closing the week, the {topGainer.name} has gained significant value, while the {topLoser.name} has fallen. The {topCurrency.name} remains the most expensive currency at {topCurrency.rate}, a key benchmark for international trade.",
    // Saturday (6)
    "Reflecting on the last available data, the {topGainer.name} was the week's notable gainer, with the {topLoser.name} experiencing the sharpest drop. The {topCurrency.name} holds its status as the premium currency at {topCurrency.rate}. Need to calculate a conversion? Try our <a href='/#/converter' class='text-blue-600 hover:underline font-medium'>conversion tool</a>."
  ],
  highLowSummary: [
    // Sunday (0)
    "Looking at the 52-week performance, the {currency} has seen significant fluctuation. Its highest buy rate was {highBuy}, while it dropped to a low of {lowBuy}. This range is critical for long-term financial planning.",
    // Monday (1)
    "Over the past year, the {currency} reached a peak buying rate of {highBuy} and a floor of {lowBuy}. For sellers, the range was between {highSell} and {lowSell}. These figures highlight the currency's annual volatility.",
    // Tuesday (2)
    "A review of the last 52 weeks shows the {currency}'s buy rate peaked at {highBuy} and hit a low of {lowBuy}. This historical data is vital for understanding market trends. See more on our <a href='/#/historical-charts' class='text-blue-600 hover:underline font-medium'>charts page</a>.",
    // Wednesday (3)
    "The annual trading range for the {currency} shows a high of {highBuy} (Buy) and a low of {lowBuy} (Buy). The selling rate varied from a high of {highSell} to a low of {lowSell}, information importers and exporters track closely.",
    // Thursday (4)
    "Analyzing the 52-week data, the {currency} has traded as high as {highBuy} and as low as {lowBuy} (Buy Rate). This volatility is a key factor for investors and those remitting funds.",
    // Friday (5)
    "The {currency}'s 52-week trading history shows a buy-rate high of {highBuy} and a low of {lowBuy}. Sellers saw rates between {highSell} and {lowSell}. Plan your conversions with our <a href='/#/converter' class='text-blue-600 hover:underline font-medium'>currency converter</a>.",
    // Saturday (6)
    "Reflecting on the past year, the {currency} (Buy) hit a maximum of {highBuy} and a minimum of {lowBuy}. The sell-side saw a high of {highSell} and a low of {lowSell}. This data provides context for the currency's current standing."
  ]
};

// --- Helper Functions ---

/**
 * Formats a number for display, adding a sign
 */
const formatChange = (change: number, decimals = 2) => {
  const fixed = change.toFixed(decimals);
  return change > 0 ? `+${fixed}` : fixed;
};

/**
 * Gets a color class based on the value
 */
const getChangeColor = (change: number) => {
  if (change > 0) return 'text-green-600';
  if (change < 0) return 'text-red-600';
  return 'text-gray-500';
};

/**
 * Renders a change value with color and arrow
 */
const ChangeIndicator: React.FC<{ value: number, decimals?: number, unit?: 'Rs.' | '%' }> = ({ value, decimals = 2, unit = 'Rs.' }) => {
  const color = getChangeColor(value);
  const formattedValue = formatChange(value, decimals);
  
  return (
    <span className={cn('font-medium inline-flex items-center', color)}>
      {value > 0 && <TrendingUp className="h-4 w-4 mr-1" />}
      {value < 0 && <TrendingDown className="h-4 w-4 mr-1" />}
      {value === 0 && <Minus className="h-4 w-4 mr-1" />}
      {formattedValue}{unit === '%' ? '%' : ''}
    </span>
  );
};

// --- Main Component ---

const ArchiveDetail = () => {
  const params = useParams();
  const date = params["*"]; // Get date from splat
  
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
    } catch (e) {
      console.error('Error parsing date:', e);
    }
  }
  
  const dayOfWeek = getDay(targetDate); // 0 (Sun) - 6 (Sat)

  // --- Data Fetching ---
  const { data: currentData, isLoading: currentLoading, isError: isCurrentError } = useQuery({
    queryKey: ['forex-archive', targetDateStr],
    queryFn: () => fetchForexRatesByDate(targetDate), // Fetches target date + previous day
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });

  // --- Historical Data Queries ---
  // Note: fetchHistoricalRates fetches the *entire range*
  
  const fetchRange = (days: number) => {
    const from = format(subDays(targetDate, days - 1), 'yyyy-MM-dd');
    const to = format(targetDate, 'yyyy-MM-dd');
    return fetchHistoricalRates(from, to);
  }
  
  const fetchLongRange = (startDate: string) => {
    const from = startDate;
    const to = format(targetDate, 'yyyy-MM-dd');
    return fetchHistoricalRates(from, to);
  }

  const { data: weekData, isLoading: weekLoading } = useQuery({
    queryKey: ['forex-7-day', targetDateStr],
    queryFn: () => fetchRange(7),
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60,
  });

  const { data: monthData, isLoading: monthLoading } = useQuery({
    queryKey: ['forex-30-day', targetDateStr],
    queryFn: () => fetchRange(30),
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60,
  });
  
  const { data: quarterlyData, isLoading: quarterlyLoading } = useQuery({
    queryKey: ['forex-90-day', targetDateStr],
    queryFn: () => fetchRange(90),
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60,
  });

  const { data: yearData, isLoading: yearLoading } = useQuery({
    queryKey: ['forex-365-day', targetDateStr],
    queryFn: () => fetchRange(365),
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60,
  });
  
  const { data: fiveYearData, isLoading: fiveYearLoading } = useQuery({
    queryKey: ['forex-5-year', targetDateStr],
    queryFn: () => fetchRange(365 * 5),
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60,
  });

  const { data: longTermData, isLoading: longTermLoading } = useQuery({
    queryKey: ['forex-long-term', targetDateStr],
    queryFn: () => fetchLongRange('2000-01-01'),
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60,
  });

  // --- Data Analysis (Memoized) ---
  const analysisData = useMemo(() => {
    if (!currentData?.data?.payload?.[0]?.rates) return null;

    const currentRates = currentData.data.payload[0].rates;
    const prevDayRates = currentData.data.payload[1]?.rates || [];

    // 1. Normalize all rates to per-unit and calculate daily change
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
    
    // Filter out INR from all analysis
    const filteredRates = analyzedRates.filter(r => r.currency.iso3 !== 'INR');

    // 2. Rankings
    const sortedRates = [...filteredRates].sort((a, b) => b.normalizedSell - a.normalizedSell);
    const top11 = sortedRates.slice(0, 11);
    const bottom12 = sortedRates.slice(11).sort((a, b) => a.normalizedSell - b.normalizedSell);

    // 3. Daily Summary Stats
    const topGainer = [...filteredRates].sort((a, b) => b.dailyChangePercent - a.dailyChangePercent)[0];
    const topLoser = [...filteredRates].sort((a, b) => a.dailyChangePercent - b.dailyChangePercent)[0];
    const topCurrency = top11[0]; // Already sorted

    return {
      allRates: analyzedRates, // Includes INR for the main table
      top11,
      bottom12,
      topGainer,
      topLoser,
      topCurrency,
    };
  }, [currentData]);

  /**
   * Helper function to process historical data for tabs
   */
  const processHistoricalData = (data: RatesData[] | undefined, allCurrentRates: AnalyzedRate[]): HistoricalChange[] => {
    if (!data || data.length < 2 || !allCurrentRates) return [];
    
    const oldestDay = data[0]; // API returns ascending, so [0] is oldest
    const latestDay = data[data.length - 1]; // This is today's data

    return allCurrentRates
      .filter(r => r.currency.iso3 !== 'INR') // Exclude INR
      .map(currentRate => {
        const oldRateData = oldestDay.rates.find(r => r.currency.iso3 === currentRate.currency.iso3);
        const latestRateData = latestDay.rates.find(r => r.currency.iso3 === currentRate.currency.iso3);

        if (!oldRateData || !latestRateData) return null;

        const oldRate = Number(oldRateData.buy) / (oldRateData.currency.unit || 1);
        const newRate = Number(latestRateData.buy) / (latestRateData.currency.unit || 1);

        if (oldRate === 0) return null; // Avoid divide by zero

        const change = newRate - oldRate;
        const percent = (change / oldRate) * 100;

        return {
          iso3: currentRate.currency.iso3,
          name: currentRate.currency.name,
          unit: currentRate.currency.unit,
          change,
          percent,
          oldRate,
          newRate,
        };
      })
      .filter((r): r is HistoricalChange => r !== null) // Type guard to filter out nulls
      .sort((a, b) => b.percent - a.percent); // Sort by percentage change
  };
  
  /**
   * Helper function to get REAL high/low from a full data range
   */
  const getHighLow = (data: RatesData[] | undefined, iso3: string): HighLow | null => {
    if (!data || data.length === 0) return null;

    let lowBuy = Infinity, highBuy = -Infinity, lowSell = Infinity, highSell = -Infinity;
    
    data.forEach(day => {
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

    if (lowBuy === Infinity) return null; // No data found

    return { lowBuy, highBuy, lowSell, highSell };
  }

  // --- Memoized Historical Analysis for Tabs ---
  const historicalAnalysis = useMemo(() => {
    if (!analysisData) return null;
    return {
      weekly: processHistoricalData(weekData?.payload, analysisData.allRates),
      monthly: processHistoricalData(monthData?.payload, analysisData.allRates),
      quarterly: processHistoricalData(quarterlyData?.payload, analysisData.allRates),
      yearly: processHistoricalData(yearData?.payload, analysisData.allRates),
      fiveYear: processHistoricalData(fiveYearData?.payload, analysisData.allRates),
      longTerm: processHistoricalData(longTermData?.payload, analysisData.allRates),
    };
  }, [
    analysisData, 
    weekData, 
    monthData, 
    quarterlyData, 
    yearData, 
    fiveYearData, 
    longTermData
  ]);

  // --- Memoized High/Low Data ---
  const highLowData = useMemo(() => {
    if (!yearData?.payload) return null;
    const majorCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SAR', 'AED', 'QAR'];
    return majorCurrencies.map(iso3 => {
      const data = getHighLow(yearData.payload, iso3);
      const name = analysisData?.allRates.find(r => r.currency.iso3 === iso3)?.currency.name || iso3;
      return { iso3, name, ...data };
    }).filter(d => d.lowBuy); // Filter out any that didn't have data
  }, [yearData, analysisData]);


  // --- Render Logic ---

  const formattedDate = formatDateLong(targetDate);
  const shortDate = format(targetDate, 'yyyy-MM-dd');
  const isLoading = currentLoading || weekLoading || monthLoading || quarterlyLoading || yearLoading || fiveYearLoading || longTermLoading;

  const previousDate = format(subDays(targetDate, 1), 'yyyy-MM-dd');
  const nextDate = format(addDays(targetDate, 1), 'yyyy-MM-dd');
  const today = startOfDay(new Date());
  const canGoNext = isBefore(targetDate, today);

  useEffect(() => {
    document.title = `Foreign Exchange Rate for ${shortDate} | Nepal Rastra Bank`;
  }, [shortDate]);

  // --- Skeletons ---
  const PageSkeleton = () => (
    <div className="max-w-6xl mx-auto space-y-8">
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-5/6" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-96 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (!isValidDate) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 text-center">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-destructive">Invalid Date</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">The date format in the URL is invalid.</p>
              <p className="text-sm text-muted-foreground mt-2">Please use the format: .../daily-update/forex-for-YYYY-MM-DD</p>
              <Button asChild className="mt-6">
                <Link to="/archive">Back to Archives</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Ticker */}
      <div className="container mx-auto px-4 pt-8">
        <div className="max-w-7xl mx-auto">
          <ForexTicker rates={analysisData?.allRates || []} isLoading={currentLoading} />
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" asChild>
              <Link to="/archive" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Archives
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/daily-update/forex-for-${previousDate}`} className="flex items-center gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Previous Day
                </Link>
              </Button>
              {canGoNext && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/daily-update/forex-for-${nextDate}`} className="flex items-center gap-1">
                    Next Day
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Article */}
          <article className="prose prose-lg max-w-none prose-h1:text-3xl md:prose-h1:text-4xl prose-h2:text-2xl prose-h2:border-b prose-h2:pb-2 prose-h2:mt-10 prose-h3:text-xl">
            {isLoading && <PageSkeleton />}
            
            {!isLoading && isCurrentError && (
              <Card className="not-prose bg-red-50 border-red-200">
                <CardHeader>
                  <CardTitle className="text-destructive">Error Loading Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">There was an error loading the exchange rates for this date. Please try another date or check back later.</p>
                </CardContent>
              </Card>
            )}

            {!isLoading && !isCurrentError && (!analysisData || analysisData.allRates.length === 0) && (
              <Card className="not-prose bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle>No Data Published</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">No exchange rate data was published by Nepal Rastra Bank for {shortDate}. This may be a weekend or public holiday.</p>
                  <Button asChild className="mt-4">
                    <Link to="/">View Today's Rates</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {!isLoading && analysisData && analysisData.allRates.length > 0 && (
              <>
                {/* Introduction */}
                <h1>Foreign Exchange Rates for {formattedDate}</h1>
                <p 
                  className="text-lg lead text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: textVariations.intro[dayOfWeek % textVariations.intro.length].replace('{date}', `<strong>${formattedDate}</strong>`) }} 
                />

                {/* Daily Summary */}
                <h2>Daily Market Summary</h2>
                <p dangerouslySetInnerHTML={{ __html: textVariations.dailySummary[dayOfWeek % textVariations.dailySummary.length]
                  .replace('{topGainer.name}', `<strong class="text-green-600">${analysisData.topGainer.currency.name}</strong>`)
                  .replace('{topLoser.name}', `<strong class="text-red-600">${analysisData.topLoser.currency.name}</strong>`)
                  .replace('{topCurrency.name}', `<strong>${analysisData.topCurrency.currency.name}</strong>`)
                  .replace('{topCurrency.rate}', `<strong>Rs. ${analysisData.topCurrency.normalizedSell.toFixed(2)}</strong>`)
                }} />
                
                {/* Daily Table */}
                <h2 className="!mb-6">Official Rate Table ({shortDate})</h2>
                <div className="not-prose overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Currency</TableHead>
                        <TableHead className="text-center">Unit</TableHead>
                        <TableHead className="text-right">Buy Rate (NPR)</TableHead>
                        <TableHead className="text-right">Sell Rate (NPR)</TableHead>
                        <TableHead className="text-right">Change (Buy)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisData.allRates.map((rate) => (
                        <TableRow key={rate.currency.iso3}>
                          <TableCell className="font-medium">
                            {getFlagEmoji(rate.currency.iso3)} {rate.currency.name} ({rate.currency.iso3})
                          </TableCell>
                          <TableCell className="text-center">{rate.currency.unit}</TableCell>
                          <TableCell className="text-right">Rs. {rate.buy.toFixed(2)}</TableCell>
                          <TableCell className="text-right">Rs. {rate.sell.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <ChangeIndicator value={rate.dailyChange * rate.currency.unit} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Rankings */}
                <h2>Currency Rankings (per 1 Unit)</h2>
                <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Top 11 Strongest Currencies</CardTitle>
                      <CardDescription>Ranked by per-unit sell rate. (INR excluded)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="list-decimal list-inside space-y-2">
                        {analysisData.top11.map((rate) => (
                          <li key={rate.currency.iso3} className="text-sm">
                            <span className="font-medium">{getFlagEmoji(rate.currency.iso3)} {rate.currency.name}</span>
                            <span className="text-muted-foreground ml-2">Rs. {rate.normalizedSell.toFixed(2)}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Bottom 12 Currencies</CardTitle>
                      <CardDescription>Ranked by per-unit sell rate. (INR excluded)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="list-decimal list-inside space-y-2" start={12}>
                        {analysisData.bottom12.map((rate) => (
                          <li key={rate.currency.iso3} className="text-sm">
                            <span className="font-medium">{getFlagEmoji(rate.currency.iso3)} {rate.currency.name}</span>
                            <span className="text-muted-foreground ml-2">Rs. {rate.normalizedSell.toFixed(2)}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                </div>

                {/* Historical Analysis Tabs */}
                <h2>Historical Performance Analysis</h2>
                <div className="not-prose">
                  <Tabs defaultValue="7day">
                    <div className="overflow-x-auto scrollbar-hide border-b">
                      <TabsList className="w-max">
                        <TabsTrigger value="7day">7 Days</TabsTrigger>
                        <TabsTrigger value="30day">30 Days</TabsTrigger>
                        <TabsTrigger value="90day">Quarterly</TabsTrigger>
                        <TabsTrigger value="1year">Yearly</TabsTrigger>
                        <TabsTrigger value="5year">5 Years</TabsTrigger>
                        <TabsTrigger value="alltime">Since 2000</TabsTrigger>
                      </TabsList>
                    </div>
                    
                    <HistoricalTabContent data={historicalAnalysis?.weekly} isLoading={weekLoading} />
                    <HistoricalTabContent data={historicalAnalysis?.monthly} isLoading={monthLoading} value="30day" />
                    <HistoricalTabContent data={historicalAnalysis?.quarterly} isLoading={quarterlyLoading} value="90day" />
                    <HistoricalTabContent data={historicalAnalysis?.yearly} isLoading={yearLoading} value="1year" />
                    <HistoricalTabContent data={historicalAnalysis?.fiveYear} isLoading={fiveYearLoading} value="5year" />
                    <HistoricalTabContent data={historicalAnalysis?.longTerm} isLoading={longTermLoading} value="alltime" />
                  </Tabs>
                </div>

                {/* 52-Week High/Low */}
                <h2>52-Week High & Low Analysis</h2>
                <p dangerouslySetInnerHTML={{ __html: (highLowData && highLowData.length > 0) ?
                    textVariations.highLowSummary[dayOfWeek % textVariations.highLowSummary.length]
                      .replace('{currency}', `<strong>${highLowData[0].name} (${highLowData[0].iso3})</strong>`)
                      .replace('{highBuy}', `<strong>Rs. ${highLowData[0].highBuy.toFixed(2)}</strong>`)
                      .replace('{lowBuy}', `<strong>Rs. ${highLowData[0].lowBuy.toFixed(2)}</strong>`)
                      .replace('{highSell}', `<strong>Rs. ${highLowData[0].highSell.toFixed(2)}</strong>`)
                      .replace('{lowSell}', `<strong>Rs. ${highLowData[0].lowSell.toFixed(2)}</strong>`)
                    : "Analyzing the 52-week data provides insights into annual currency performance."
                  }}
                />
                <div className="not-prose grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {yearLoading && Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
                  {highLowData && highLowData.map((item) => (
                    <Card key={item.iso3} className="shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium">{getFlagEmoji(item.iso3)} {item.name} ({item.iso3})</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <div>
                          <span className="text-muted-foreground">Buy Range:</span>
                          <div className="flex justify-between font-medium">
                            <span>Low: <span className="text-red-600">Rs. {item.lowBuy.toFixed(2)}</span></span>
                            <span>High: <span className="text-green-600">Rs. {item.highBuy.toFixed(2)}</span></span>
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sell Range:</span>
                          <div className="flex justify-between font-medium">
                            <span>Low: <span className="text-red-600">Rs. {item.lowSell.toFixed(2)}</span></span>
                            <span>High: <span className="text-green-600">Rs. {item.highSell.toFixed(2)}</span></span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Disclaimer */}
                <div className="not-prose mt-12 p-4 bg-gray-50 rounded-lg border">
                  <h3 className="text-base font-semibold mt-0">Important Disclaimer</h3>
                  <p className="text-sm text-muted-foreground !mt-2">
                    The foreign exchange rates published by Nepal Rastra Bank are indicative rates. 
                    Under open market operations, actual rates offered by commercial banks, money exchangers, and forex traders may vary from these NRB rates. 
                    This information is provided for general reference purposes only and should not be used as financial, investment, or trading advice. 
                    Always verify current rates with authorized financial institutions before conducting transactions.
                  </p>
                </div>
              </>
            )}
          </article>
        </div>
      </div>
    </Layout>
  );
};

// --- Sub-component for Historical Tab Content ---

interface HistoricalTabContentProps {
  data: HistoricalChange[] | undefined;
  isLoading: boolean;
  value?: string; // value for TabsContent, default is "7day"
}

const HistoricalTabContent: React.FC<HistoricalTabContentProps> = ({ data, isLoading, value = "7day" }) => {
  if (isLoading) {
    return (
      <TabsContent value={value}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          {Array(22).fill(0).map((_, i) => (
            <div key={i} className="flex justify-between py-3 border-b">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
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
            <span className="font-medium text-sm">{getFlagEmoji(item.iso3)} {item.name}</span>
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

export default ArchiveDetail;

