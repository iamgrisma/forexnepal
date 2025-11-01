import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchForexRatesByDate, fetchPreviousDayRates, formatDateLong, getFlagEmoji } from '@/services/forexService';
import { format, parseISO, subDays, subWeeks, subMonths, subYears } from 'date-fns';

const ArchiveDetail = () => {
  const { date } = useParams<{ date: string }>();
  
  // Parse date from URL format forex-for-YYYY-MM-DD
  const dateMatch = date?.match(/forex-for-(\d{4}-\d{2}-\d{2})/);
  const targetDateStr = dateMatch ? dateMatch[1] : null;
  const targetDate = targetDateStr ? parseISO(targetDateStr) : new Date();

  const { data: currentData, isLoading: currentLoading } = useQuery({
    queryKey: ['forex-archive', targetDateStr],
    queryFn: () => fetchForexRatesByDate(targetDate),
    enabled: !!targetDateStr,
  });

  const { data: previousData } = useQuery({
    queryKey: ['forex-previous', targetDateStr],
    queryFn: () => fetchPreviousDayRates(targetDate),
    enabled: !!targetDateStr,
  });

  if (!targetDateStr) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Invalid date format</p>
            <Button asChild className="mt-4">
              <Link to="/archive">Back to Archives</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentRates = currentData?.data?.payload?.[0]?.rates || [];
  const previousRates = previousData?.data?.payload?.[0]?.rates || [];

  // Calculate changes
  const ratesWithChanges = currentRates.map(rate => {
    const prevRate = previousRates.find(pr => pr.currency.iso3 === rate.currency.iso3);
    const buyChange = prevRate ? rate.buy - prevRate.buy : 0;
    const sellChange = prevRate ? rate.sell - prevRate.sell : 0;
    
    return {
      ...rate,
      buyChange,
      sellChange,
    };
  });

  // Sort by selling rate (descending) for rankings
  const sortedRates = [...ratesWithChanges].sort((a, b) => b.sell - a.sell);

  // Find currency with highest change
  const highestGainer = [...ratesWithChanges].sort((a, b) => 
    Math.abs(b.buyChange) - Math.abs(a.buyChange)
  )[0];

  const formattedDate = formatDateLong(targetDate);
  const shortDate = format(targetDate, 'yyyy-MM-dd');

  // Set page title
  useEffect(() => {
    document.title = `Foreign Exchange Rate for ${shortDate} | Nepal Rastra Bank`;
  }, [shortDate]);

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Button variant="outline" asChild className="mb-4">
            <Link to="/archive" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Archives
            </Link>
          </Button>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Foreign Exchange Rate on {shortDate}
            </h1>
            <p className="text-lg text-muted-foreground">
              As per Nepal Rastra Bank
            </p>
          </div>

          {currentLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Loading exchange rates...</p>
              </CardContent>
            </Card>
          ) : currentRates.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  No exchange rate data available for {shortDate}. This may be a weekend or public holiday.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Introduction */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <p className="text-base leading-relaxed mb-4">
                    The Nepal Rastra Bank, the central bank of Nepal, has published the foreign exchange rate for Nepali rupees for {formattedDate}.
                  </p>
                  
                  {/* Highlight major currencies */}
                  {ratesWithChanges.filter(r => ['USD', 'EUR', 'GBP', 'INR'].includes(r.currency.iso3)).map(rate => (
                    <p key={rate.currency.iso3} className="mb-2">
                      As per the rate published by NRB, the buying rate of the {rate.currency.name} ({rate.currency.iso3}) is set at Rs. {rate.buy.toFixed(2)}
                      {rate.buyChange !== 0 && (
                        <span className={rate.buyChange > 0 ? 'text-green-600' : 'text-red-600'}>
                          , {rate.buyChange > 0 ? 'an increase' : 'a decrease'} of {Math.abs(rate.buyChange).toFixed(2)} rupees from the previous day's Rs. {(rate.buy - rate.buyChange).toFixed(2)}
                        </span>
                      )}
                      . The selling rate is Rs. {rate.sell.toFixed(2)}
                      {rate.sellChange !== 0 && (
                        <span className={rate.sellChange > 0 ? 'text-green-600' : 'text-red-600'}>
                          , {rate.sellChange > 0 ? 'an increase' : 'a decrease'} of {Math.abs(rate.sellChange).toFixed(2)} from the previous day's Rs. {(rate.sell - rate.sellChange).toFixed(2)}
                        </span>
                      )}.
                    </p>
                  ))}
                </CardContent>
              </Card>

              {/* Middle East Currencies Section */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Middle East Currencies</CardTitle>
                </CardHeader>
                <CardContent>
                  {ratesWithChanges.filter(r => ['KWD', 'BHD', 'OMR', 'SAR', 'QAR', 'AED'].includes(r.currency.iso3)).map(rate => (
                    <p key={rate.currency.iso3} className="mb-2">
                      The {rate.currency.name} ({rate.currency.iso3}) buying rate is Rs. {rate.buy.toFixed(2)}
                      {rate.buyChange !== 0 && (
                        <span className={rate.buyChange > 0 ? 'text-green-600' : 'text-red-600'}>
                          , {rate.buyChange > 0 ? 'an increase' : 'a decrease'} of {Math.abs(rate.buyChange).toFixed(2)} from the previous day
                        </span>
                      )}
                      . The selling rate is Rs. {rate.sell.toFixed(2)}.
                    </p>
                  ))}
                </CardContent>
              </Card>

              {/* Currency Rankings */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Currency Rankings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">
                    Based on the selling rates for {shortDate}, here are the strongest currencies in Nepal:
                  </p>
                  <ol className="list-decimal list-inside space-y-1">
                    {sortedRates.slice(0, 10).map((rate, index) => (
                      <li key={rate.currency.iso3}>
                        {getFlagEmoji(rate.currency.iso3)} {rate.currency.name} ({rate.currency.iso3}): Rs. {rate.sell.toFixed(2)}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              {/* Exchange Rates Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Foreign Exchange Rates for {shortDate}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">SN</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead className="text-center">Unit</TableHead>
                          <TableHead className="text-right">Buying Rate</TableHead>
                          <TableHead className="text-right">Selling Rate</TableHead>
                          <TableHead className="text-center">Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ratesWithChanges.map((rate, index) => (
                          <TableRow key={rate.currency.iso3}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              {getFlagEmoji(rate.currency.iso3)} {rate.currency.name} ({rate.currency.iso3})
                            </TableCell>
                            <TableCell className="text-center">{rate.currency.unit}</TableCell>
                            <TableCell className="text-right">{rate.buy.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{rate.sell.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              {rate.buyChange !== 0 && (
                                <span className={`flex items-center justify-center gap-1 ${rate.buyChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {rate.buyChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {Math.abs(rate.buyChange).toFixed(2)}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Disclaimer:</strong> Under open market operations, the forex rates set by banks and forex traders can vary from NRB rates. 
                      Please use this information for general purposes only; it should not be used as investment or financial advice.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
  );
};

export default ArchiveDetail;
