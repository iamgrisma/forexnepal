// Filename: src/pages/ArchiveDetail.tsx

import React, { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchForexRatesByDate, fetchHistoricalRates, formatDateLong, getFlagEmoji } from '@/services/forexService';
import { format, parseISO, addDays, subDays, isValid, startOfDay, isBefore, differenceInDays, getDay } from 'date-fns'; // FIXED: Removed extra comma
import Layout from '@/components/Layout';
import ForexTicker from '@/components/ForexTicker';
import { Rate, RatesData } from '@/types/forex';
import {
  ArticleTemplateSunday,
  ArticleTemplateMonday,
  ArticleTemplateTuesday,
  ArticleTemplateWednesday,
  ArticleTemplateThursday,
  ArticleTemplateFriday,
  ArticleTemplateSaturday
} from '@/components/ArchiveArticleTemplates'; // Import the new templates

// --- Types (Exported for Template) ---
export type AnalyzedRate = Rate & {
  normalizedBuy: number;
  normalizedSell: number;
  dailyChange: number;
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
    top11: AnalyzedRate[];
    bottom11: AnalyzedRate[];
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
  formattedDate: string;
  shortDate: string;
  dayOfWeek: number;
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
  const formattedDate = formatDateLong(targetDate);
  const shortDate = format(targetDate, 'yyyy-MM-dd');

  // --- Data Fetching ---
  const { data: currentData, isLoading: currentLoading, isError: isCurrentError } = useQuery({
    queryKey: ['forex-archive', targetDateStr],
    queryFn: () => fetchForexRatesByDate(targetDate), // Fetches target date + previous day
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  // --- Historical Data Queries ---
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

    // 1. Normalize all rates and calc daily change
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
    
    // Filter out INR from analytical lists
    const filteredRates = analyzedRates.filter(r => r.currency.iso3 !== 'INR');

    // 2. Rankings (Top 11 / Bottom 11)
    const sortedRates = [...filteredRates].sort((a, b) => b.normalizedSell - a.normalizedSell);
    const top11 = sortedRates.slice(0, 11);
    const bottom11 = sortedRates.slice(11).sort((a, b) => a.normalizedSell - b.normalizedSell);

    // 3. Daily Summary Stats (Handle edge case where filteredRates is empty)
    const topGainer = [...filteredRates].sort((a, b) => b.dailyChangePercent - a.dailyChangePercent)[0] || analyzedRates[0];
    const topLoser = [...filteredRates].sort((a, b) => a.dailyChangePercent - b.dailyChangePercent)[0] || analyzedRates[0];
    const topCurrency = top11[0] || analyzedRates[0];

    return {
      allRates: analyzedRates, // Includes INR for the main table
      top11,
      bottom11,
      topGainer,
      topLoser,
      topCurrency,
    };
  }, [currentData]);

  /**
   * Helper to process historical data for tabs
   */
  const processHistoricalData = (data: RatesData[] | undefined, allCurrentRates: AnalyzedRate[]): HistoricalChange[] => {
    // FIX: Changed to data.length === 0. < 2 was buggy.
    if (!data || data.length === 0 || !allCurrentRates) return [];
    
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
      .filter((r): r is HistoricalChange => r !== null) 
      .sort((a, b) => b.percent - a.percent); 
  };
  
  /**
   * Helper to get REAL high/low from a full data range
   */
  const getHighLow = (data: RatesData[] | undefined, iso3: string): HighLow | null => {
    if (!data || data.length === 0) return null;

    let lowBuy = Infinity, highBuy = -Infinity, lowSell = Infinity, highSell = -Infinity;
    
    // FIX: Iterate over *all* days in the payload, not just start/end
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

  // --- Memoized Historical & High/Low Data ---
  const historicalAnalysis = useMemo(() => {
    if (!analysisData) return {
      weekly: { data: [], isLoading: true },
      monthly: { data: [], isLoading: true },
      quarterly: { data: [], isLoading: true },
      yearly: { data: [], isLoading: true },
      fiveYear: { data: [], isLoading: true },
      longTerm: { data: [], isLoading: true },
    };
    return {
      weekly: { data: processHistoricalData(weekData?.payload, analysisData.allRates), isLoading: weekLoading },
      monthly: { data: processHistoricalData(monthData?.payload, analysisData.allRates), isLoading: monthLoading },
      quarterly: { data: processHistoricalData(quarterlyData?.payload, analysisData.allRates), isLoading: quarterlyLoading },
      yearly: { data: processHistoricalData(yearData?.payload, analysisData.allRates), isLoading: yearLoading },
      fiveYear: { data: processHistoricalData(fiveYearData?.payload, analysisData.allRates), isLoading: fiveYearLoading },
      longTerm: { data: processHistoricalData(longTermData?.payload, analysisData.allRates), isLoading: longTermLoading },
    };
  }, [
    analysisData, 
    weekData, monthData, quarterlyData, yearData, fiveYearData, longTermData,
    weekLoading, monthLoading, quarterlyLoading, yearLoading, fiveYearLoading, longTermLoading
  ]);

  const highLowData = useMemo(() => {
    if (!yearData?.payload || !analysisData) return { data: [], isLoading: true };
    const majorCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SAR', 'AED', 'QAR'];
    return {
      data: majorCurrencies.map(iso3 => {
        const data = getHighLow(yearData.payload, iso3);
        const name = analysisData?.allRates.find(r => r.currency.iso3 === iso3)?.currency.name || iso3;
        return { iso3, name, ...data };
      }).filter(d => d.lowBuy), // Filter out any that didn't have data
      isLoading: yearLoading
    };
  }, [yearData, yearLoading, analysisData]);

  // --- Render Logic ---
  const isLoading = currentLoading || !analysisData;

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
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-5/6" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-96 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
  
  // --- Article Template Selection ---
  const templates = [
    ArticleTemplateSunday,    // 0
    ArticleTemplateMonday,    // 1
    ArticleTemplateTuesday,   // 2
    ArticleTemplateWednesday, // 3
    ArticleTemplateThursday,  // 4
    ArticleTemplateFriday,    // 5
    ArticleTemplateSaturday   // 6
  ];
  const ArticleTemplate = templates[dayOfWeek];

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

            {/* Render the selected template */}
            {!isLoading && analysisData && analysisData.allRates.length > 0 && (
              <ArticleTemplate 
                analysisData={analysisData}
                historicalAnalysis={historicalAnalysis}
                highLowData={highLowData}
                formattedDate={formattedDate}
                shortDate={shortDate}
                dayOfWeek={dayOfWeek}
              />
            )}

            {/* Disclaimer (Common to all templates) */}
            {!isLoading && analysisData && analysisData.allRates.length > 0 && (
              <div className="not-prose mt-12 p-4 bg-gray-50 rounded-lg border">
                <h3 className="text-base font-semibold mt-0">Important Disclaimer</h3>
                <p className="text-sm text-muted-foreground !mt-2">
                  The foreign exchange rates published by Nepal Rastra Bank are indicative rates. 
                  Under open market operations, actual rates offered by commercial banks, money exchangers, and forex traders may vary from these NRB rates. 
                  This information is provided for general reference purposes only and should not be used as financial, investment, or trading advice. 
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

export default ArchiveDetail;
