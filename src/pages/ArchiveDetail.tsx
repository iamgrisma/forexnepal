import React, { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchForexRatesByDate, fetchHistoricalRates, formatDateLong, getFlagEmoji } from '@/services/forexService';
import { format, parseISO, addDays, subDays, isValid, differenceInDays, isAfter, startOfDay } from 'date-fns';
import Layout from '@/components/Layout';
import ForexTicker from '@/components/ForexTicker';
import { Rate } from '@/types/forex';

// Helper type for combined analysis
type AnalyzedRate = Rate & {
  buy: number;
  sell: number;
  normalizedBuy: number;
  normalizedSell: number;
  buyChange?: number;
  sellChange?: number;
  buyChangePercent?: number;
  weekChange?: number;
  weekChangePercent?: number;
  oldWeekBuy?: number;
  monthChange?: number;
  monthChangePercent?: number;
  oldMonthBuy?: number;
  week52High?: number;
  week52Low?: number;
  week52HighSell?: number;
  week52LowSell?: number;
  longTermChange?: number;
  longTermChangePercent?: number;
  longTermYears?: number;
  oldLongTermBuy?: number;
};

const ArchiveDetail = () => {
  const { date } = useParams<{ date: string }>();
  
  const targetDateStr = date ?? null;
  
  // --- Date Validation ---
  let targetDate = new Date();
  let isValidDate = false;
  if (targetDateStr) {
    try {
      const parsedDate = parseISO(targetDateStr); // YYYY-MM-DD
      if (isValid(parsedDate)) {
        targetDate = startOfDay(parsedDate); // Use start of day for consistent comparison
        isValidDate = true;
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
  }

  // --- Data Fetching ---
  const { data: currentData, isLoading: currentLoading, isError: isCurrentError } = useQuery({
    queryKey: ['forex-archive', targetDateStr],
    queryFn: () => fetchForexRatesByDate(targetDate), // Fetches target date + previous day
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });

  const weekAgo = subDays(targetDate, 7);
  const { data: weekData, isLoading: weekLoading } = useQuery({
    queryKey: ['forex-week', targetDateStr],
    queryFn: () => fetchHistoricalRates(format(weekAgo, 'yyyy-MM-dd'), targetDateStr!),
    enabled: isValidDate && !!targetDateStr,
    staleTime: 1000 * 60 * 60,
  });

  const monthAgo = subDays(targetDate, 30);
  const { data: monthData, isLoading: monthLoading } = useQuery({
    queryKey: ['forex-month', targetDateStr],
    queryFn: () => fetchHistoricalRates(format(monthAgo, 'yyyy-MM-dd'), targetDateStr!),
    enabled: isValidDate && !!targetDateStr,
    staleTime: 1000 * 60 * 60,
  });

  const yearAgo = subDays(targetDate, 365);
  const { data: yearData, isLoading: yearLoading } = useQuery({
    queryKey: ['forex-year', targetDateStr],
    queryFn: () => fetchHistoricalRates(format(yearAgo, 'yyyy-MM-dd'), targetDateStr!),
    enabled: isValidDate && !!targetDateStr,
    staleTime: 1000 * 60 * 60,
  });

  const startDate2000 = new Date(2000, 0, 1);
  const effectiveStartDate = isAfter(targetDate, startDate2000) ? startDate2000 : subDays(targetDate, 365 * 25);
  const { data: longTermData, isLoading: longTermLoading } = useQuery({
    queryKey: ['forex-longterm', targetDateStr],
    queryFn: () => fetchHistoricalRates(format(effectiveStartDate, 'yyyy-MM-dd'), targetDateStr!),
    enabled: isValidDate && !!targetDateStr,
    staleTime: 1000 * 60 * 60,
  });

  const currentRates = currentData?.data?.payload?.[0]?.rates || [];
  
  const previousDayData = useMemo(() => {
    // forexService's fetchForexRatesByDate already tries to find the *last* available day.
    // The worker's /api/historical-rates?from=...&to=... is what we should use instead for the *previous* day.
    // Let's rely on the `fetchPreviousDayRates` logic from `forexService.ts` which is what `Index.tsx` uses.
    // Ah, `currentData` from `fetchForexRatesByDate` *should* contain the previous day in its payload if available.
    const allPayloads = currentData?.data?.payload || [];
    if (allPayloads.length >= 2) {
      return allPayloads[1].rates; // Assuming payload[1] is the previous day
    }
    // If not, let's look at the `weekData`
    if (weekData && weekData.payload.length > 0) {
       // Get the second to last day from the weekly payload
       const sortedPayloads = [...weekData.payload].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
       if (sortedPayloads[1]) {
           return sortedPayloads[1].rates;
       }
    }
    return [];
  }, [currentData, weekData]);


  // --- Data Analysis ---
  const analysisData = useMemo(() => {
    if (!currentRates.length) return null;

    const normalizedRates: AnalyzedRate[] = currentRates.map(rate => {
      const buy = Number(rate.buy);
      const sell = Number(rate.sell);
      const unit = rate.currency.unit || 1;
      return {
        ...rate,
        buy,
        sell,
        normalizedBuy: buy / unit,
        normalizedSell: sell / unit,
      };
    });

    const sortedRates = [...normalizedRates].sort((a, b) => b.normalizedSell - a.normalizedSell);

    const ratesWithChanges: AnalyzedRate[] = normalizedRates.map(rate => {
      const prevRate = previousDayData.find(pr => pr.currency.iso3 === rate.currency.iso3);
      const prevBuy = prevRate ? Number(prevRate.buy) / (prevRate.currency.unit || 1) : 0;
      const prevSell = prevRate ? Number(prevRate.sell) / (prevRate.currency.unit || 1) : 0;
      return {
        ...rate,
        buyChange: prevRate ? rate.normalizedBuy - prevBuy : 0,
        sellChange: prevRate ? rate.normalizedSell - prevSell : 0,
        buyChangePercent: prevRate && prevBuy > 0 ? ((rate.normalizedBuy - prevBuy) / prevBuy) * 100 : 0,
      };
    });

    const weekRates = weekData?.payload || [];
    const weeklyAnalysis: AnalyzedRate[] = ratesWithChanges.map(rate => {
      const weekOldPayload = weekRates.length > 0 ? weekRates[0] : null; // Oldest data in range
      const weekOldRate = weekOldPayload?.rates.find(r => r.currency.iso3 === rate.currency.iso3);
      if (weekOldRate) {
        const oldBuy = Number(weekOldRate.buy) / (weekOldRate.currency.unit || 1);
        const change = rate.normalizedBuy - oldBuy;
        const changePercent = oldBuy > 0 ? (change / oldBuy) * 100 : 0;
        return { ...rate, weekChange: change, weekChangePercent: changePercent, oldWeekBuy: oldBuy };
      }
      return { ...rate, weekChange: 0, weekChangePercent: 0, oldWeekBuy: rate.normalizedBuy };
    });

    const monthRates = monthData?.payload || [];
    const monthlyAnalysis: AnalyzedRate[] = ratesWithChanges.map(rate => {
      const monthOldPayload = monthRates.length > 0 ? monthRates[0] : null; // Oldest data in range
      const monthOldRate = monthOldPayload?.rates.find(r => r.currency.iso3 === rate.currency.iso3);
      if (monthOldRate) {
        const oldBuy = Number(monthOldRate.buy) / (monthOldRate.currency.unit || 1);
        const change = rate.normalizedBuy - oldBuy;
        const changePercent = oldBuy > 0 ? (change / oldBuy) * 100 : 0;
        return { ...rate, monthChange: change, monthChangePercent: changePercent, oldMonthBuy: oldBuy };
      }
      return { ...rate, monthChange: 0, monthChangePercent: 0, oldMonthBuy: rate.normalizedBuy };
    });

    const yearRates = yearData?.payload || [];
    const yearlyAnalysis: AnalyzedRate[] = ratesWithChanges.map(rate => {
      const allYearRates = yearRates
        .flatMap(yr => yr.rates)
        .filter(r => r.currency.iso3 === rate.currency.iso3)
        .map(r => ({ 
            buy: Number(r.buy) / (r.currency.unit || 1), 
            sell: Number(r.sell) / (r.currency.unit || 1) 
        }));
      allYearRates.push(rate); // Include current rate
      
      const highestBuy = allYearRates.length > 0 ? Math.max(...allYearRates.map(r => r.buy)) : rate.normalizedBuy;
      const lowestBuy = allYearRates.length > 0 ? Math.min(...allYearRates.map(r => r.buy)) : rate.normalizedBuy;
      const highestSell = allYearRates.length > 0 ? Math.max(...allYearRates.map(r => r.sell)) : rate.normalizedSell;
      const lowestSell = allYearRates.length > 0 ? Math.min(...allYearRates.map(r => r.sell)) : rate.normalizedSell;
      
      return { ...rate, week52High: highestBuy, week52Low: lowestBuy, week52HighSell: highestSell, week52LowSell: lowestSell };
    });

    const longRates = longTermData?.payload || [];
    const longTermAnalysis: AnalyzedRate[] = ratesWithChanges.map(rate => {
      const oldestPayload = longRates.length > 0 ? longRates[0] : null;
      const oldestRate = oldestPayload?.rates.find(r => r.currency.iso3 === rate.currency.iso3);
      
      if (oldestRate) {
        const oldBuy = Number(oldestRate.buy) / (oldestRate.currency.unit || 1);
        const change = rate.normalizedBuy - oldBuy;
        const changePercent = oldBuy > 0 ? (change / oldBuy) * 100 : 0;
        const years = differenceInDays(targetDate, effectiveStartDate) / 365.25;
        return { ...rate, longTermChange: change, longTermChangePercent: changePercent, longTermYears: years, oldLongTermBuy: oldBuy };
      }
      return { ...rate, longTermChange: 0, longTermChangePercent: 0, longTermYears: 0, oldLongTermBuy: rate.normalizedBuy };
    });

    const topWeeklyGainer = [...weeklyAnalysis].sort((a, b) => (b.weekChangePercent || 0) - (a.weekChangePercent || 0))[0];
    const topMonthlyGainer = [...monthlyAnalysis].sort((a, b) => (b.monthChangePercent || 0) - (a.monthChangePercent || 0))[0];
    const topLongTermGainer = [...longTermAnalysis].sort((a, b) => (b.longTermChangePercent || 0) - (a.longTermChangePercent || 0))[0];

    return {
      sortedRates,
      ratesWithChanges,
      weeklyAnalysis,
      monthlyAnalysis,
      yearlyAnalysis,
      longTermAnalysis,
      topWeeklyGainer,
      topMonthlyGainer,
      topLongTermGainer,
    };
  }, [currentRates, previousDayData, weekData, monthData, yearData, longTermData, targetDate, effectiveStartDate]);

  const formattedDate = formatDateLong(targetDate);
  const shortDate = format(targetDate, 'yyyy-MM-dd');
  const isLoading = currentLoading || weekLoading || monthLoading || yearLoading || longTermLoading;

  // --- Navigation Dates ---
  const previousDate = format(subDays(targetDate, 1), 'yyyy-MM-dd');
  const nextDate = format(addDays(targetDate, 1), 'yyyy-MM-dd');
  const today = startOfDay(new Date()); // Compare start of day
  const canGoNext = isBefore(targetDate, today); // Can go next as long as it's not today or future

  useEffect(() => {
    document.title = `Foreign Exchange Rate for ${shortDate} | Nepal Rastra Bank`;
  }, [shortDate]);

  // --- Helper Components for Loading ---
  const AnalysisSkeleton = () => <Skeleton className="h-24 w-full" />;
  const TextSkeleton = ({ className = "w-full" } : { className?: string }) => <Skeleton className={`h-4 ${className} mb-2`} />;
  const ParagraphSkeleton = () => (
    <div className="space-y-2">
      <TextSkeleton className="w-full" />
      <TextSkeleton className="w-full" />
      <TextSkeleton className="w-5/6" />
      <TextSkeleton className="w-3/4" />
    </div>
  );
  
  if (!isValidDate) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Invalid date format in URL.</p>
              <p className="text-sm text-muted-foreground">Please use the format: .../daily-update/forex-for-YYYY-MM-DD</p>
              <Button asChild className="mt-4">
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
      <div className="container mx-auto px-4 pt-8">
        <div className="max-w-7xl mx-auto">
          <ForexTicker rates={currentRates} isLoading={currentLoading} />
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Navigation */}
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
          <article className="prose prose-lg max-w-none">
            <header className="mb-8 not-prose">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Foreign Exchange Rate for {shortDate}
              </h1>
              <p className="text-lg text-muted-foreground">
                As published by Nepal Rastra Bank
              </p>
            </header>

          {isCurrentError && (
            <div className="not-prose">
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-destructive">Error loading exchange rates for this date.</p>
                  <p className="text-muted-foreground text-sm">Please try again later or check another date.</p>
                </CardContent>
              </Card>
            </div>
          )}

          {currentLoading && (
            <div className="space-y-8">
              <ParagraphSkeleton />
              <AnalysisSkeleton />
              <AnalysisSkeleton />
              <AnalysisSkeleton />
              <Skeleton className="h-96 w-full" />
            </div>
          )}

          {!currentLoading && !isCurrentError && currentRates.length === 0 && (
            <div className="not-prose">
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No exchange rate data was published by NRB for {shortDate}.
                  </p>
                  <p className="text-sm text-muted-foreground">This may be a weekend or public holiday.</p>
                  <Button asChild className="mt-4">
                    <Link to="/">View Today's Rates</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {!currentLoading && currentRates.length > 0 && analysisData && (
            <>
              {/* Introduction Paragraph */}
              <section className="mb-8">
                <p className="text-lg leading-relaxed">
                  The Nepal Rastra Bank, the central bank of Nepal, has published the foreign exchange rates for Nepali rupees on <strong>{formattedDate}</strong>. 
                  {' '}{(() => {
                    const usd = analysisData.ratesWithChanges.find(r => r.currency.iso3 === 'USD');
                    const eur = analysisData.ratesWithChanges.find(r => r.currency.iso3 === 'EUR');
                    const gbp = analysisData.ratesWithChanges.find(r => r.currency.iso3 === 'GBP');
                    const inr = analysisData.ratesWithChanges.find(r => r.currency.iso3 === 'INR');
                    
                    let sentences = [];
                    if (usd) sentences.push(`The U.S. Dollar is trading at Rs. ${usd.buy.toFixed(2)} for buying and Rs. ${usd.sell.toFixed(2)} for selling${usd.buyChange !== 0 ? `, a ${usd.buyChange > 0 ? 'gain' : 'loss'} of Rs. ${Math.abs(usd.buyChange || 0).toFixed(2)} from the previous day` : ' (stable)'}.`);
                    if (eur) sentences.push(`The European Euro stands at Rs. ${eur.buy.toFixed(2)} (buying) and Rs. ${eur.sell.toFixed(2)} (selling)${eur.buyChange !== 0 ? `, ${eur.buyChange > 0 ? 'up' : 'down'} by Rs. ${Math.abs(eur.buyChange || 0).toFixed(2)}` : ''}.`);
                    if (gbp) sentences.push(`The British Pound Sterling is valued at Rs. ${gbp.buy.toFixed(2)} for buying and Rs. ${gbp.sell.toFixed(2)} for selling.`);
                    if (inr) sentences.push(`The Indian Rupee, which is pegged, maintains its rate at Rs. ${inr.buy.toFixed(2)} (buying) and Rs. ${inr.sell.toFixed(2)} (selling) per 100 INR.`);
                    
                    return sentences.join(' ');
                  })()}
                  {' '}These rates are crucial for businesses, travelers, and individuals engaged in <Link to="/converter" className="text-blue-600 hover:underline">currency conversion</Link>, 
                  international trade, and remittance transfers.
                </p>
              </section>

              {/* Middle East Currencies Analysis */}
              <section className="mb-8 not-prose">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">Middle East Currencies Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? <ParagraphSkeleton /> : (
                      <p className="text-base leading-relaxed mb-4">
                        Currencies from the Middle East region continue to show strong performance. 
                        {analysisData.ratesWithChanges
                          .filter(r => ['KWD', 'BHD', 'OMR', 'SAR', 'QAR', 'AED'].includes(r.currency.iso3))
                          .map((rate, idx) => {
                            const changeText = rate.buyChange !== 0 
                              ? ` ${rate.buyChange > 0 ? 'registering an increase' : 'showing a decrease'} of Rs. ${Math.abs(rate.buyChange || 0).toFixed(2)} from the previous trading day`
                              : ' remaining stable';
                            return ` The ${rate.currency.name} (${rate.currency.iso3}) is trading at Rs. ${rate.buy.toFixed(2)} (buying) and Rs. ${rate.sell.toFixed(2)} (selling)${changeText}.`;
                          }).join(' ')}
                        {' '}These rates are particularly important for Nepalese workers and businesses.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* Weekly Analysis */}
              <section className="mb-8 not-prose">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">Weekly Market Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {weekLoading ? <ParagraphSkeleton /> : (
                      <p className="text-base leading-relaxed">
                        Over the past seven days, the {analysisData.topWeeklyGainer.currency.name} ({analysisData.topWeeklyGainer.currency.iso3}) has shown the
                        {analysisData.topWeeklyGainer.weekChangePercent! > 0 ? ' strongest growth' : ' most significant decline'}, with
                        {analysisData.topWeeklyGainer.weekChangePercent! > 0 ? ' an increase' : ' a decrease'} of <strong>{Math.abs(analysisData.topWeeklyGainer.weekChangePercent || 0).toFixed(2)}%</strong>. 
                        The currency's normalized buying rate moved from Rs. {analysisData.topWeeklyGainer.oldWeekBuy?.toFixed(2)} to Rs. {analysisData.topWeeklyGainer.normalizedBuy.toFixed(2)}, 
                        a change of Rs. {Math.abs(analysisData.topWeeklyGainer.weekChange || 0).toFixed(2)} per unit.
                        {' '}For detailed week-by-week comparisons, visit our <Link to="/historical-charts" className="text-blue-600 hover:underline">currency charts page</Link>.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* Monthly Analysis */}
              <section className="mb-8 not-prose">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">Monthly Performance Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {monthLoading ? <ParagraphSkeleton /> : (
                      <p className="text-base leading-relaxed">
                        Analyzing the thirty-day period ending on {shortDate}, the {analysisData.topMonthlyGainer.currency.name} ({analysisData.topMonthlyGainer.currency.iso3}) 
                        has emerged as the {analysisData.topMonthlyGainer.monthChangePercent! > 0 ? 'best performer' : 'most volatile currency'}, 
                        recording {analysisData.topMonthlyGainer.monthChangePercent! > 0 ? 'gains' : 'losses'} of <strong>{Math.abs(analysisData.topMonthlyGainer.monthChangePercent || 0).toFixed(2)}%</strong>. 
                        The normalized rate moved from Rs. {analysisData.topMonthlyGainer.oldMonthBuy?.toFixed(2)} to Rs. {analysisData.topMonthlyGainer.normalizedBuy.toFixed(2)}.
                        {' '}This monthly trend data is valuable for businesses. 
                        Use our <Link to="/converter" className="text-blue-600 hover:underline">currency converter</Link> to calculate amounts.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* 52-Week High/Low Analysis */}
              <section className="mb-8 not-prose">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">52-Week Trading Range</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {yearLoading ? <ParagraphSkeleton /> : (
                      <>
                        <p className="text-base leading-relaxed mb-4">
                          Looking at the annual perspective, here are the 52-week highest and lowest normalized (per unit) rates for major currencies as of {shortDate}:
                        </p>
                        <div className="space-y-3">
                          {analysisData.yearlyAnalysis.filter(r => ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'KWD', 'SAR'].includes(r.currency.iso3)).map(rate => (
                            <div key={rate.currency.iso3} className="border-l-4 border-blue-500 pl-4">
                              <p className="font-semibold">{rate.currency.name} ({rate.currency.iso3})</p>
                              <p className="text-sm text-muted-foreground">
                                52W High: <strong>Rs. {rate.week52High!.toFixed(2)}</strong> | 
                                52W Low: <strong>Rs. {rate.week52Low!.toFixed(2)}</strong> (Per Unit Buy Rate)
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* Long-term Analysis */}
              {analysisData.topLongTermGainer && analysisData.topLongTermGainer.longTermYears! > 1 && (
                <section className="mb-8 not-prose">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-2xl">Long-Term Investment Perspective</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {longTermLoading ? <ParagraphSkeleton /> : (
                        <p className="text-base leading-relaxed">
                          Examining the long-term trajectory over {Math.floor(analysisData.topLongTermGainer.longTermYears || 0)} years 
                          (since {format(effectiveStartDate, 'yyyy')}), the {analysisData.topLongTermGainer.currency.name} ({analysisData.topLongTermGainer.currency.iso3}) 
                          has demonstrated {analysisData.topLongTermGainer.longTermChangePercent! > 0 ? 'remarkable appreciation' : 'significant depreciation'} 
                          of <strong>{Math.abs(analysisData.topLongTermGainer.longTermChangePercent || 0).toFixed(2)}%</strong> against the Nepali Rupee. 
                          The normalized rate started from Rs. {analysisData.topLongTermGainer.oldLongTermBuy?.toFixed(2)} and now stands at Rs. {analysisData.topLongTermGainer.normalizedBuy.toFixed(2)}.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Currency Rankings */}
              <section className="mb-8 not-prose">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">Currency Strength Rankings (Per Unit)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed mb-4">
                      Based on the normalized per-unit selling rates for {shortDate}, here is the ranking of the strongest currencies. This provides an accurate comparison by adjusting for units (e.g., JPY 10, KRW 100).
                    </p>
                    <ol className="list-decimal list-inside space-y-2">
                      {analysisData.sortedRates.slice(0, 10).map((rate) => (
                        <li key={rate.currency.iso3} className="text-base">
                          {getFlagEmoji(rate.currency.iso3)} <strong>{rate.currency.name} ({rate.currency.iso3})</strong>: 
                          <strong> Rs. {rate.normalizedSell.toFixed(2)} per 1 Unit</strong>
                          <span className="text-sm text-muted-foreground"> (Listed as {rate.sell.toFixed(2)} per {rate.currency.unit})</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </section>

              {/* Exchange Rates Table */}
              <section className="not-prose">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">Complete Exchange Rate Table for {shortDate}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">SN</TableHead>
                            <TableHead>Currency</TableHead>
                            <TableHead className="text-center">Unit</TableHead>
                            <TableHead className="text-right">Buying Rate (NPR)</TableHead>
                            <TableHead className="text-right">Selling Rate (NPR)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analysisData.ratesWithChanges.map((rate, index) => (
                            <TableRow key={rate.currency.iso3}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">
                                {getFlagEmoji(rate.currency.iso3)} {rate.currency.name} ({rate.currency.iso3})
                              </TableCell>
                              <TableCell className="text-center">{rate.currency.unit}</TableCell>
                              <TableCell className="text-right">Rs. {rate.buy.toFixed(2)}</TableCell>
                              <TableCell className="text-right">Rs. {rate.sell.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>Important Disclaimer:</strong> The foreign exchange rates published by Nepal Rastra Bank are indicative rates. 
                        Under open market operations, actual rates offered by commercial banks, money exchangers, and forex traders may vary from these NRB rates. 
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This information is provided for general reference purposes only and should not be used as financial, investment, or trading advice. 
                        Always verify current rates with authorized financial institutions.
                      </p>
                    </div>

                    {/* Internal Links for SEO */}
                    <div className="mt-6 pt-6 border-t">
                      <p className="text-sm font-semibold mb-3">Related Tools & Resources:</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/">Today's Rates</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/converter">Currency Converter</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/historical-charts">Historical Charts</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/posts">Blog Posts</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/archive">View All Archives</Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </>
          )}
          </article>
        </div>
      </div>
    </Layout>
  );
};

export default ArchiveDetail;
