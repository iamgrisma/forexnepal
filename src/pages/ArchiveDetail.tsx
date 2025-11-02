import React, { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchForexRatesByDate, fetchHistoricalRates, formatDateLong, getFlagEmoji, getDateRanges } from '@/services/forexService';
import { format, parseISO, addDays, subDays, isValid, differenceInDays } from 'date-fns';
import Layout from '@/components/Layout';
import ForexTicker from '@/components/ForexTicker';
import { Rate } from '@/types/forex';

const ArchiveDetail = () => {
  const { date } = useParams<{ date: string }>();
  
  // Date string comes directly from the route param (YYYY-MM-DD)
  const targetDateStr = date ?? null;
  
  // Validate the parsed date
  let targetDate = new Date();
  let isValidDate = false;
  
  if (targetDateStr) {
    try {
      const parsedDate = parseISO(targetDateStr);
      if (isValid(parsedDate)) {
        targetDate = parsedDate;
        isValidDate = true;
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
  }

  const { data: currentData, isLoading: currentLoading } = useQuery({
    queryKey: ['forex-archive', targetDateStr],
    queryFn: () => fetchForexRatesByDate(targetDate),
    enabled: isValidDate,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
  });

  // Fetch week data
  const weekAgo = subDays(targetDate, 7);
  const { data: weekData } = useQuery({
    queryKey: ['forex-week', targetDateStr],
    queryFn: () => fetchHistoricalRates(format(weekAgo, 'yyyy-MM-dd'), targetDateStr!),
    enabled: isValidDate && !!targetDateStr,
    staleTime: 1000 * 60 * 60,
  });

  // Fetch month data
  const monthAgo = subDays(targetDate, 30);
  const { data: monthData } = useQuery({
    queryKey: ['forex-month', targetDateStr],
    queryFn: () => fetchHistoricalRates(format(monthAgo, 'yyyy-MM-dd'), targetDateStr!),
    enabled: isValidDate && !!targetDateStr,
    staleTime: 1000 * 60 * 60,
  });

  // Fetch year data for 52-week analysis
  const yearAgo = subDays(targetDate, 365);
  const { data: yearData } = useQuery({
    queryKey: ['forex-year', targetDateStr],
    queryFn: () => fetchHistoricalRates(format(yearAgo, 'yyyy-MM-dd'), targetDateStr!),
    enabled: isValidDate && !!targetDateStr,
    staleTime: 1000 * 60 * 60,
  });

  // Fetch 25-year data (or from 2000)
  const startDate2000 = new Date(2000, 0, 1);
  const effectiveStartDate = targetDate > startDate2000 ? startDate2000 : subDays(targetDate, 365 * 25);
  const { data: longTermData } = useQuery({
    queryKey: ['forex-longterm', targetDateStr],
    queryFn: () => fetchHistoricalRates(format(effectiveStartDate, 'yyyy-MM-dd'), targetDateStr!),
    enabled: isValidDate && !!targetDateStr,
    staleTime: 1000 * 60 * 60,
  });

  if (!isValidDate) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Invalid date format. Please use the format: forex-for-YYYY-MM-DD</p>
              <Button asChild className="mt-4">
                <Link to="/archive">Back to Archives</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const currentRates = currentData?.data?.payload?.[0]?.rates || [];
  
  // Get previous day data
  const previousDayData = useMemo(() => {
    const allPayloads = currentData?.data?.payload || [];
    if (allPayloads.length >= 2) {
      return allPayloads[1].rates;
    }
    return [];
  }, [currentData]);

  // Calculate analysis data
  const analysisData = useMemo(() => {
    if (!currentRates.length) return null;

    // Normalize rates to per-unit for ranking
    const normalizedRates = currentRates.map(rate => {
      const buy = Number(rate.buy);
      const sell = Number(rate.sell);
      const unit = rate.currency.unit;
      return {
        ...rate,
        buy,
        sell,
        normalizedBuy: buy / unit,
        normalizedSell: sell / unit,
      };
    });

    // Sort by normalized selling rate
    const sortedRates = [...normalizedRates].sort((a, b) => b.normalizedSell - a.normalizedSell);

    // Calculate previous day changes
    const ratesWithChanges = normalizedRates.map(rate => {
      const prevRate = previousDayData.find(pr => pr.currency.iso3 === rate.currency.iso3);
      const prevBuy = prevRate ? Number(prevRate.buy) : 0;
      const prevSell = prevRate ? Number(prevRate.sell) : 0;
      return {
        ...rate,
        buyChange: prevRate ? rate.buy - prevBuy : 0,
        sellChange: prevRate ? rate.sell - prevSell : 0,
        buyChangePercent: prevRate && prevBuy > 0 ? ((rate.buy - prevBuy) / prevBuy) * 100 : 0,
      };
    });

    // Weekly analysis
    const weekRates = weekData?.payload || [];
    const weeklyAnalysis = normalizedRates.map(rate => {
      const weekOldRate = weekRates.find(wr => 
        wr.rates.some(r => r.currency.iso3 === rate.currency.iso3)
      )?.rates.find(r => r.currency.iso3 === rate.currency.iso3);
      
      if (weekOldRate) {
        const oldBuy = Number(weekOldRate.buy);
        const change = rate.buy - oldBuy;
        const changePercent = oldBuy > 0 ? (change / oldBuy) * 100 : 0;
        return { ...rate, weekChange: change, weekChangePercent: changePercent, oldWeekBuy: oldBuy };
      }
      return { ...rate, weekChange: 0, weekChangePercent: 0, oldWeekBuy: rate.buy };
    });

    // Monthly analysis
    const monthRates = monthData?.payload || [];
    const monthlyAnalysis = normalizedRates.map(rate => {
      const monthOldRate = monthRates.find(mr => 
        mr.rates.some(r => r.currency.iso3 === rate.currency.iso3)
      )?.rates.find(r => r.currency.iso3 === rate.currency.iso3);
      
      if (monthOldRate) {
        const oldBuy = Number(monthOldRate.buy);
        const change = rate.buy - oldBuy;
        const changePercent = oldBuy > 0 ? (change / oldBuy) * 100 : 0;
        return { ...rate, monthChange: change, monthChangePercent: changePercent, oldMonthBuy: oldBuy };
      }
      return { ...rate, monthChange: 0, monthChangePercent: 0, oldMonthBuy: rate.buy };
    });

    // 52-week high/low
    const yearRates = yearData?.payload || [];
    const yearlyAnalysis = normalizedRates.map(rate => {
      const allYearRates = yearRates
        .flatMap(yr => yr.rates)
        .filter(r => r.currency.iso3 === rate.currency.iso3)
        .map(r => ({ buy: Number(r.buy), sell: Number(r.sell) }));
      
      const highestBuy = allYearRates.length > 0 ? Math.max(...allYearRates.map(r => r.buy)) : rate.buy;
      const lowestBuy = allYearRates.length > 0 ? Math.min(...allYearRates.map(r => r.buy)) : rate.buy;
      const highestSell = allYearRates.length > 0 ? Math.max(...allYearRates.map(r => r.sell)) : rate.sell;
      const lowestSell = allYearRates.length > 0 ? Math.min(...allYearRates.map(r => r.sell)) : rate.sell;
      
      return { ...rate, week52High: highestBuy, week52Low: lowestBuy, week52HighSell: highestSell, week52LowSell: lowestSell };
    });

    // Long-term (from 2000 or 25 years)
    const longRates = longTermData?.payload || [];
    const longTermAnalysis = normalizedRates.map(rate => {
      const oldestRate = longRates[0]?.rates.find(r => r.currency.iso3 === rate.currency.iso3);
      
      if (oldestRate) {
        const oldBuy = Number(oldestRate.buy);
        const change = rate.buy - oldBuy;
        const changePercent = oldBuy > 0 ? (change / oldBuy) * 100 : 0;
        const years = differenceInDays(targetDate, effectiveStartDate) / 365.25;
        return { ...rate, longTermChange: change, longTermChangePercent: changePercent, longTermYears: years, oldLongTermBuy: oldBuy };
      }
      return { ...rate, longTermChange: 0, longTermChangePercent: 0, longTermYears: 0, oldLongTermBuy: rate.buy };
    });

    // Find best performers
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

  // Navigation dates
  const previousDate = format(subDays(targetDate, 1), 'yyyy-MM-dd');
  const nextDate = format(addDays(targetDate, 1), 'yyyy-MM-dd');
  const today = new Date();
  const canGoNext = targetDate < today;

  // Set page title
  useEffect(() => {
    document.title = `Foreign Exchange Rate for ${shortDate} | Nepal Rastra Bank`;
  }, [shortDate]);

  // Get major currencies for detailed analysis
  const majorCurrencies = useMemo(() => {
    if (!analysisData) return [];
    return analysisData.ratesWithChanges.filter(r => ['USD', 'EUR', 'GBP', 'INR'].includes(r.currency.iso3));
  }, [analysisData]);

  // Get Middle East currencies
  const middleEastCurrencies = useMemo(() => {
    if (!analysisData) return [];
    return analysisData.ratesWithChanges.filter(r => ['KWD', 'BHD', 'OMR', 'SAR', 'QAR', 'AED'].includes(r.currency.iso3));
  }, [analysisData]);

  return (
    <Layout>
      {/* Ticker component */}
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
                <Link to={`/archive/forex-for-${previousDate}`} className="flex items-center gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Previous Day
                </Link>
              </Button>
              {canGoNext && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/archive/forex-for-${nextDate}`} className="flex items-center gap-1">
                    Next Day
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Header */}
          <article className="prose prose-lg max-w-none">
            <header className="mb-8 not-prose">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Foreign Exchange Rate for {shortDate}
              </h1>
              <p className="text-lg text-muted-foreground">
                As published by Nepal Rastra Bank
              </p>
            </header>

          {currentLoading ? (
            <div className="not-prose">
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Loading exchange rates...</p>
                </CardContent>
              </Card>
            </div>
          ) : currentRates.length === 0 ? (
            <div className="not-prose">
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No exchange rate data available for {shortDate}. This may be a weekend or public holiday.
                  </p>
                  <Button asChild className="mt-4">
                    <Link to="/">View Today's Rates</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : analysisData ? (
            <>
              {/* Introduction Paragraph */}
              <section className="mb-8">
                <p className="text-lg leading-relaxed">
                  The Nepal Rastra Bank, the central bank of Nepal, has officially published the foreign exchange rates for Nepali rupees on {formattedDate}. 
                  {majorCurrencies.length > 0 && (() => {
                    const usd = majorCurrencies.find(r => r.currency.iso3 === 'USD');
                    const eur = majorCurrencies.find(r => r.currency.iso3 === 'EUR');
                    const gbp = majorCurrencies.find(r => r.currency.iso3 === 'GBP');
                    const inr = majorCurrencies.find(r => r.currency.iso3 === 'INR');
                    
                    return (
                      <>
                        {usd && ` The U.S. Dollar is trading at Rs. ${usd.buy.toFixed(2)} for buying and Rs. ${usd.sell.toFixed(2)} for selling${usd.buyChange !== 0 ? `, showing ${usd.buyChange > 0 ? 'an increase' : 'a decrease'} of Rs. ${Math.abs(usd.buyChange).toFixed(2)} from the previous day` : ''}.`}
                        {eur && ` The European Euro stands at Rs. ${eur.buy.toFixed(2)} (buying) and Rs. ${eur.sell.toFixed(2)} (selling)${eur.buyChange !== 0 ? `, ${eur.buyChange > 0 ? 'up' : 'down'} by Rs. ${Math.abs(eur.buyChange).toFixed(2)}` : ''}.`}
                        {gbp && ` The British Pound Sterling is valued at Rs. ${gbp.buy.toFixed(2)} for buying and Rs. ${gbp.sell.toFixed(2)} for selling${gbp.buyChange !== 0 ? `, ${gbp.buyChange > 0 ? 'gaining' : 'losing'} Rs. ${Math.abs(gbp.buyChange).toFixed(2)} compared to yesterday` : ''}.`}
                        {inr && ` The Indian Rupee, which is pegged and stable, maintains its position at Rs. ${inr.buy.toFixed(2)} (buying) and Rs. ${inr.sell.toFixed(2)} (selling) per 100 INR.`}
                      </>
                    );
                  })()}
                  {' '}These rates are crucial for businesses, travelers, and individuals engaged in <Link to="/converter" className="text-blue-600 hover:underline">currency conversion</Link>, 
                  international trade, and remittance transfers.
                </p>
              </section>

              {/* Middle East Currencies Analysis */}
              {middleEastCurrencies.length > 0 && (
                <section className="mb-8 not-prose">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-2xl">Middle East Currencies Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base leading-relaxed mb-4">
                        Currencies from the Middle East region continue to show strong performance against the Nepali Rupee. 
                        {middleEastCurrencies.map((rate, idx) => {
                          const changeText = rate.buyChange !== 0 
                            ? ` ${rate.buyChange > 0 ? 'registering an increase' : 'showing a decrease'} of Rs. ${Math.abs(rate.buyChange).toFixed(2)} from the previous trading day`
                            : ' remaining stable';
                          
                          return idx === 0 
                            ? ` The ${rate.currency.name} (${rate.currency.iso3}) leads with a buying rate of Rs. ${rate.buy.toFixed(2)} and selling rate of Rs. ${rate.sell.toFixed(2)}${changeText}.`
                            : ` The ${rate.currency.name} (${rate.currency.iso3}) is trading at Rs. ${rate.buy.toFixed(2)} (buying) and Rs. ${rate.sell.toFixed(2)} (selling)${changeText}.`;
                        })}
                        {' '}These rates are particularly important for Nepalese workers and businesses operating in Gulf countries. 
                        You can track these changes over time using our <Link to="/historical-charts" className="text-blue-600 hover:underline">historical charts</Link>.
                      </p>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Weekly Analysis */}
              {analysisData.topWeeklyGainer && (
                <section className="mb-8 not-prose">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-2xl">Weekly Market Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base leading-relaxed">
                        Over the past seven days, the foreign exchange market has witnessed notable fluctuations. 
                        The {analysisData.topWeeklyGainer.currency.name} ({analysisData.topWeeklyGainer.currency.iso3}) has shown the 
                        {analysisData.topWeeklyGainer.weekChangePercent > 0 ? ' strongest growth' : ' most significant decline'}, with 
                        {analysisData.topWeeklyGainer.weekChangePercent > 0 ? ' an increase' : ' a decrease'} of {Math.abs(analysisData.topWeeklyGainer.weekChangePercent).toFixed(2)}%, 
                        moving from Rs. {analysisData.topWeeklyGainer.oldWeekBuy?.toFixed(2)} to Rs. {analysisData.topWeeklyGainer.buy.toFixed(2)}. 
                        This represents a change of Rs. {Math.abs(analysisData.topWeeklyGainer.weekChange || 0).toFixed(2)} in absolute terms.
                        {' '}For detailed week-by-week comparisons, visit our <Link to="/historical-charts" className="text-blue-600 hover:underline">currency charts page</Link>.
                      </p>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Monthly Analysis */}
              {analysisData.topMonthlyGainer && (
                <section className="mb-8 not-prose">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-2xl">Monthly Performance Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base leading-relaxed">
                        Analyzing the thirty-day period ending on {shortDate}, the {analysisData.topMonthlyGainer.currency.name} ({analysisData.topMonthlyGainer.currency.iso3}) 
                        has emerged as the {analysisData.topMonthlyGainer.monthChangePercent > 0 ? 'best performer' : 'most volatile currency'}, 
                        recording {analysisData.topMonthlyGainer.monthChangePercent > 0 ? 'gains' : 'losses'} of {Math.abs(analysisData.topMonthlyGainer.monthChangePercent).toFixed(2)}%. 
                        The currency moved from Rs. {analysisData.topMonthlyGainer.oldMonthBuy?.toFixed(2)} to Rs. {analysisData.topMonthlyGainer.buy.toFixed(2)}, 
                        a change of Rs. {Math.abs(analysisData.topMonthlyGainer.monthChange || 0).toFixed(2)}.
                        {' '}This monthly trend data is valuable for businesses planning international transactions. 
                        Use our <Link to="/converter" className="text-blue-600 hover:underline">currency converter</Link> to calculate amounts based on these rates.
                      </p>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* 52-Week High/Low Analysis */}
              <section className="mb-8 not-prose">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">52-Week Trading Range</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed mb-4">
                      Looking at the annual perspective, here are the 52-week highest and lowest rates for major currencies as of {shortDate}:
                    </p>
                    <div className="space-y-3">
                      {analysisData.yearlyAnalysis.filter(r => ['USD', 'EUR', 'GBP', 'KWD', 'BHD'].includes(r.currency.iso3)).map(rate => (
                        <div key={rate.currency.iso3} className="border-l-4 border-blue-500 pl-4">
                          <p className="font-semibold">{rate.currency.name} ({rate.currency.iso3})</p>
                          <p className="text-sm text-muted-foreground">
                            52-week High: Rs. {rate.week52High.toFixed(2)} (buying) / Rs. {rate.week52HighSell.toFixed(2)} (selling) | 
                            52-week Low: Rs. {rate.week52Low.toFixed(2)} (buying) / Rs. {rate.week52LowSell.toFixed(2)} (selling)
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Long-term Analysis (25 years / from 2000) */}
              {analysisData.topLongTermGainer && analysisData.topLongTermGainer.longTermYears > 1 && (
                <section className="mb-8 not-prose">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-2xl">Long-Term Investment Perspective</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base leading-relaxed">
                        Examining the long-term trajectory over approximately {Math.floor(analysisData.topLongTermGainer.longTermYears)} years 
                        (since {format(effectiveStartDate, 'yyyy')}), the {analysisData.topLongTermGainer.currency.name} ({analysisData.topLongTermGainer.currency.iso3}) 
                        has demonstrated {analysisData.topLongTermGainer.longTermChangePercent > 0 ? 'remarkable appreciation' : 'significant depreciation'} 
                        of {Math.abs(analysisData.topLongTermGainer.longTermChangePercent).toFixed(2)}% against the Nepali Rupee. 
                        Starting from Rs. {analysisData.topLongTermGainer.oldLongTermBuy?.toFixed(2)}, the currency now stands at Rs. {analysisData.topLongTermGainer.buy.toFixed(2)}, 
                        representing {analysisData.topLongTermGainer.longTermChangePercent > 0 ? 'a gain' : 'a loss'} of Rs. {Math.abs(analysisData.topLongTermGainer.longTermChange || 0).toFixed(2)} 
                        per unit over this extended period. 
                        This historical data underscores the importance of understanding currency trends for long-term financial planning and investment decisions.
                      </p>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Currency Rankings */}
              <section className="mb-8 not-prose">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">Currency Strength Rankings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed mb-4">
                      Based on the normalized per-unit selling rates for {shortDate}, here is the ranking of the strongest currencies traded against the Nepali Rupee. 
                      This ranking accounts for currency units, providing an accurate comparison on a per-unit basis:
                    </p>
                    <ol className="list-decimal list-inside space-y-2">
                      {analysisData.sortedRates.slice(0, 10).map((rate, index) => (
                        <li key={rate.currency.iso3} className="text-base">
                          {getFlagEmoji(rate.currency.iso3)} <strong>{rate.currency.name} ({rate.currency.iso3})</strong>: 
                          Rs. {rate.normalizedSell.toFixed(2)} per unit 
                          <span className="text-sm text-muted-foreground"> (trading at Rs. {rate.sell.toFixed(2)} for {rate.currency.unit} {rate.currency.unit > 1 ? 'units' : 'unit'})</span>
                        </li>
                      ))}
                    </ol>
                    <p className="text-sm text-muted-foreground mt-4">
                      Note: Rankings are normalized to per-unit basis for accurate comparison. 
                      Calculate conversion amounts using our <Link to="/converter" className="text-blue-600 hover:underline">currency converter tool</Link>.
                    </p>
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
                        This information is provided for general reference purposes only and should not be construed as financial, investment, or trading advice. 
                        Always verify current rates with authorized financial institutions before conducting any foreign exchange transactions.
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
                          <Link to="/converter-profit-calculator">Profit Calculator</Link>
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
          ) : null}
          </article>
        </div>
      </div>
    </Layout>
  );
};

export default ArchiveDetail;
