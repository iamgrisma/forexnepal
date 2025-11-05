import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, parseISO } from 'date-fns';
import { CalendarIcon, RefreshCw, Loader2, ArrowRight, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Layout from '@/components/Layout';
import ForexTable from '@/components/ForexTable';
import { Rate, RatesData, Post } from '../types/forex';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Link } from 'react-router-dom';
import ShareButtons from '@/components/ShareButtons';
import ForexTicker from '@/components/ForexTicker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AdSense from '@/components/AdSense';
import { formatDateLong, getFlagEmoji } from '@/services/forexService';
// --- MODIFIED IMPORTS ---
import { fetchRatesApiFirst, fetchPreviousDayRatesApiFirst } from '@/services/apiClient'; // Use new API-First service
import { cn } from '@/lib/utils';

// --- (Helper components from original Index.tsx) ---
type AnalyzedRate = Rate & {
  normalizedBuy: number;
  normalizedSell: number;
  dailyChange: number; // Normalized (per-unit) change vs. previous day
  dailyChangePercent: number;
};

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
// --- (End of helper components) ---


const NotFound = () => {
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
    queryClient.invalidateQueries({ queryKey: ['publicPosts'] }); // Also refresh posts
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

  // --- (Blog Posts Query - Unchanged) ---
  const { data: postsData, isLoading: isLoadingPosts } = useQuery<{ posts: Post[] }>({
    queryKey: ['publicPosts'],
    queryFn: async () => {
      const res = await fetch('/api/posts');
      if (!res.ok) throw new Error('Failed to fetch posts');
      const data = await res.json();
      return data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
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
        ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY', 'SAR', 'AED', 'QAR'].includes(
          rate.currency.iso3
        )
      );
      const others = allRates.filter(
        (rate) =>
          !['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY', 'SAR', 'AED', 'QAR'].includes(
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

  // --- (Memoized Analysis Data - from original Index.tsx) ---
  const analysisData = useMemo(() => {
    if (!forexData?.rates || !prevDayData?.rates) return null;

    const currentRates = forexData.rates;
    const prevRates = prevDayData.rates;

    const analyzedRates: AnalyzedRate[] = currentRates.map(rate => {
      const buy = Number(rate.buy);
      const sell = Number(rate.sell);
      const unit = rate.currency.unit || 1;
      const normalizedBuy = buy / unit;
      const normalizedSell = sell / unit;

      const prevRate = prevRates.find(pr => pr.currency.iso3 === rate.currency.iso3);
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
    
    const topGainer = [...safeFilteredRates].sort((a, b) => b.dailyChangePercent - a.dailyChangePercent)[0];
    const topLoser = [...safeFilteredRates].sort((a, b) => a.dailyChangePercent - b.dailyChangePercent)[0];

    const majorMovers = ['USD', 'EUR', 'GBP', 'AUD', 'SAR', 'AED', 'QAR']
      .map(iso3 => analyzedRates.find(r => r.currency.iso3 === iso3))
      .filter((r): r is AnalyzedRate => r !== undefined);

    return {
      allRates: analyzedRates,
      topGainer,
      topLoser,
      majorMovers,
    };
  }, [forexData, prevDayData]);

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
          
          {/* 404 Message */}
          <Alert variant="destructive" className="mb-8">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xl font-bold">Page Not Found (404)</AlertTitle>
            <AlertDescription>
              We couldn't find the page you were looking for. Please check the URL or enjoy today's exchange rates below.
            </AlertDescription>
          </Alert>

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

          {/* --- (Today's Market Analysis - from original file) --- */}
          {!isLoading && !isLoadingPrevDay && analysisData && (
            <Card className="my-8">
              <CardHeader>
                <CardTitle>Today's Market Analysis</CardTitle>
                <CardDescription>
                  Quick look at the day's biggest movers and key currencies.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card className="bg-green-50/50 border-green-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-green-700">Top Gainer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Link to={`/historical-data/${analysisData.topGainer.currency.iso3}`} className="font-bold text-xl text-green-700 hover:underline">
                        {getFlagEmoji(analysisData.topGainer.currency.iso3)} {analysisData.topGainer.currency.name}
                      </Link>
                      <div className="mt-1">
                        <ChangeIndicator value={analysisData.topGainer.dailyChangePercent} decimals={3} unit="%" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50/50 border-red-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-red-700">Top Loser</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Link to={`/historical-data/${analysisData.topLoser.currency.iso3}`} className="font-bold text-xl text-red-700 hover:underline">
                        {getFlagEmoji(analysisData.topLoser.currency.iso3)} {analysisData.topLoser.currency.name}
                      </Link>
                      <div className="mt-1">
                        <ChangeIndicator value={analysisData.topLoser.dailyChangePercent} decimals={3} unit="%" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Daily Change (Per 1 Unit)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {analysisData.majorMovers.map(rate => (
                        <div key={rate.currency.iso3} className="flex justify-between items-center text-sm">
                          <Link to={`/historical-data/${rate.currency.iso3}`} className="font-medium hover:underline">
                            {getFlagEmoji(rate.currency.iso3)} {rate.currency.iso3}
                          </Link>
                          <ChangeIndicator value={rate.dailyChange} decimals={4} unit="Rs." />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}

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

           {/* --- (Recent Posts - from original file) --- */}
           <section className="mt-12">
            <h2 className="text-3xl font-bold text-center mb-2">Forex News & Analysis</h2>
            <p className="text-center text-muted-foreground mb-8">
              Stay updated with the latest insights and analysis on currency trends.
            </p>
            {isLoadingPosts && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            )}
            {postsData && postsData.posts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {postsData.posts.slice(0, 3).map(post => (
                  <Card key={post.id} className="overflow-hidden flex flex-col">
                    <Link to={`/posts/${post.slug}`} className="block">
                      <img 
                        src={post.featured_image_url || '/placeholder.svg'} 
                        alt={post.title}
                        className="h-48 w-full object-cover"
                        onError={(e) => (e.currentTarget.src = '/placeholder.svg')}
                      />
                    </Link>
                    <CardHeader>
                      <CardTitle className="text-xl">
                        <Link to={`/posts/${post.slug}`} className="hover:text-primary transition-colors">
                          {post.title}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {format(parseISO(post.published_at || post.created_at), 'PPP')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {post.excerpt}
                      </p>
                    </CardContent>
                    <div className="p-6 pt-0">
                      <Button asChild variant="link" className="p-0">
                        <Link to={`/posts/${post.slug}`}>Read More <ArrowRight className="ml-2 h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
             {postsData && postsData.posts.length > 0 && (
                <div className="text-center mt-8">
                  <Button asChild variant="outline">
                    <Link to="/posts">View All Posts</Link>
                  </Button>
                </div>
              )}
           </section>

        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
