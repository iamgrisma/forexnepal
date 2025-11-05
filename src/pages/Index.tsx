import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, addDays } from 'date-fns';
import { CalendarIcon, RefreshCw, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Layout from '@/components/Layout';
import ForexTable from '@/components/ForexTable';
import { Rate, RatesData } from '../types/forex';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Link }srom 'react-router-dom';
import ShareButtons from '@/components/ShareButtons';
import ForexTicker from '@/components/ForexTicker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AdSense from '@/components/AdSense';
import { formatDateLong } from '@/services/forexService'; // Keep this
// --- MODIFIED IMPORTS ---
import { fetchRatesApiFirst, fetchPreviousDayRatesApiFirst } from '@/services/apiClient'; // Use new API-First service

const Index = () => {
  const [topRates, setTopRates] = useState<Rate[]>([]);
  const [otherRates, setOtherRates] = useState<Rate[]>([]);
  const [previousDayRates, setPreviousDayRates] = useState<Rate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    toast({
      title: 'Refreshing data...',
      description: 'Fetching the latest rates from NRB.',
    });
    // Invalidate queries to force refetch
    queryClient.invalidateQueries({ queryKey: ['forexRates', format(selectedDate, 'yyyy-MM-dd')] });
    queryClient.invalidateQueries({ queryKey: ['previousDayRates', format(selectedDate, 'yyyy-MM-dd')] });
  };

  // --- MODIFIED QUERY: Use API-First ---
  const {
    data: forexData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['forexRates', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: () => fetchRatesApiFirst(selectedDate), // Use new API-First function
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  // --- MODIFIED QUERY: Use API-First ---
  const {
    data: prevDayData,
    isLoading: isLoadingPrevDay,
  } = useQuery({
    queryKey: ['previousDayRates', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: () => fetchPreviousDayRatesApiFirst(selectedDate), // Use new API-First function
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  useEffect(() => {
    if (isError) {
      toast({
        title: 'Error loading data',
        description: error?.message || 'Failed to fetch forex rates. Displaying cached data if available.',
        variant: 'destructive',
      });
    }
  }, [isError, error, toast]);

  useEffect(() => {
    if (prevDayData?.rates) {
      setPreviousDayRates(prevDayData.rates);
    } else {
      setPreviousDayRates([]);
    }
  }, [prevDayData]);

  useEffect(() => {
    if (forexData?.rates) {
      const allRates = forexData.rates;
      const top = allRates.filter((rate) =>
        ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY'].includes(
          rate.currency.iso3
        )
      );
      const others = allRates.filter(
        (rate) =>
          !['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY'].includes(
            rate.currency.iso3
          )
      );
      setTopRates(top);
      setOtherRates(others);
    } else {
      setTopRates([]);
      setOtherRates([]);
    }
  }, [forexData]);

  // Data from API-First service is RatesData | null
  const rates: Rate[] = forexData?.rates || [];
  const publishedDate = forexData?.published_on
    ? new Date(forexData.published_on)
    : null;
  const dataDate = forexData?.date ? new Date(forexData.date + 'T00:00:00Z') : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 pt-8">
        <div className="max-w-7xl mx-auto">
          <ForexTicker rates={rates} isLoading={isLoading} />
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <Card className="mb-8 shadow-lg bg-white/70 backdrop-blur-sm">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between pb-4">
              <div>
                <CardTitle className="text-2xl md:text-3xl font-bold text-gray-800">
                  Today's Exchange Rates
                </CardTitle>
                <CardDescription className="text-base text-gray-600">
                  {isLoading
                    ? 'Loading...'
                    : `Published by Nepal Rastra Bank for ${
                        dataDate ? formatDateLong(dataDate) : 'today'
                      }`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 mt-4 md:mt-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className="w-[200px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(day) => setSelectedDate(day || new Date())}
                      disabled={(date) =>
                        date > new Date() || date < new Date('2000-01-01')
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="icon"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              )}
              {!isLoading && isError && (
                 <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Could not load live data from NRB API. Please check your connection or try refreshing.
                  </AlertDescription>
                </Alert>
              )}
              {!isLoading && !isError && rates.length === 0 && (
                <Alert variant="default">
                  <AlertTitle>No Data Available</AlertTitle>
                  <AlertDescription>
                    No exchange rate data was found for this date. It might be a weekend or a public holiday.
                  </AlertDescription>
                </Alert>
              )}
              {!isLoading && rates.length > 0 && (
                <>
                  <ForexTable
                    title="Major Currencies"
                    rates={topRates}
                    previousRates={previousDayRates}
                    isLoading={isLoadingPrevDay}
                  />
                  <div className="my-6">
                     <AdSense slot="7506306569" format="fluid" layoutKey="-gw-3+1f-3d+2z" />
                  </div>
                  <ForexTable
                    title="Other Currencies"
                    rates={otherRates}
                    previousRates={previousDayRates}
                    isLoading={isLoadingPrevDay}
                  />
                </>
              )}
              <div className="mt-4 text-xs text-gray-500">
                <p>
                  Published On:{' '}
                  {publishedDate ? (
                    <time dateTime={publishedDate.toISOString()}>
                      {publishedDate.toLocaleString()}
                    </time>
                  ) : (
                    'N/A'
                  )}
                </p>
                <p>
                  Disclaimer: Rates are indicative and may vary in actual
                  transactions.
                </p>
              </div>
            </CardContent>
          </Card>

          <ShareButtons 
            url="https"
            title="Today's Forex Rates in Nepal | Nepal Rastra Bank"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
             <Card className="hover:shadow-md transition-shadow">
               <CardHeader>
                 <CardTitle>Currency Converter</CardTitle>
                 <CardDescription>Calculate conversions based on today's rates.</CardDescription>
               </CardHeader>
               <CardContent>
                 <Button asChild>
                   <Link to="/converter">Go to Converter <ArrowRight className="ml-2 h-4 w-4" /></Link>
                 </Button>
               </CardContent>
             </Card>
             <Card className="hover:shadow-md transition-shadow">
               <CardHeader>
                 <CardTitle>Historical Data</CardTitle>
                 <CardDescription>View historical charts and trends for all currencies.</CardDescription>
               </CardHeader>
               <CardContent>
                 <Button asChild>
                   <Link to="/historical-charts">View Charts <ArrowRight className="ml-2 h-4 w-4" /></Link>
                 </Button>
               </CardContent>
             </Card>
          </div>
          
           <AdSense slot="7506306569" format="fluid" layoutKey="-gw-3+1f-3d+2z" />

        </div>
      </div>
    </Layout>
  );
};

export default Index;
