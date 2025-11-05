import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, parseISO, differenceInDays } from 'date-fns';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Layout from '@/components/Layout';
import { Rate, ChartDataPoint } from '../types/forex';
// --- MODIFIED IMPORTS ---
import { fetchForexRates, getDateRanges, getFlagEmoji, formatDate, fetchHistoricalRates } from '../services/forexService'; // Import fetchHistoricalRates
import { fetchHistoricalRatesWithCache, FetchProgress } from '../services/d1ForexService';
// ---
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, CalendarIcon, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AdSense from '@/components/AdSense';
import { useToast } from '@/components/ui/use-toast';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';
// --- Use the API-First client for the top card's data ---
import { fetchRatesApiFirst } from '@/services/apiClient';

// --- (Helper function from d1ForexService, needed for API fallback) ---
function fillMissingDatesWithPreviousData(
  data: ChartDataPoint[],
  fromDate: string,
  toDate: string
): ChartDataPoint[] {
  if (data.length === 0) return [];
  const filledData: ChartDataPoint[] = [];
  const dataMap = new Map(data.map(d => [d.date, d]));
  const start = new Date(fromDate + 'T00:00:00Z');
  const end = new Date(toDate + 'T00:00:00Z');
  let previousDataPoint: ChartDataPoint | null = data[0]; 

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isNaN(d.getTime())) continue;
    const dateStr = formatDate(d); 
    if (dataMap.has(dateStr)) {
      const currentData = dataMap.get(dateStr)!;
      const pointToAdd: ChartDataPoint = {
          date: dateStr,
          buy: currentData.buy ?? previousDataPoint?.buy ?? 0,
          sell: currentData.sell ?? previousDataPoint?.sell ?? 0
      };
      filledData.push(pointToAdd);
      previousDataPoint = pointToAdd;
    } else if (previousDataPoint) {
      filledData.push({
        date: dateStr,
        buy: previousDataPoint.buy ?? 0,
        sell: previousDataPoint.sell ?? 0
      });
    } else {
        filledData.push({ date: dateStr, buy: 0, sell: 0 });
    }
  }
  return filledData;
}
// --- (End of helper) ---

const CurrencyHistoricalData = () => {
  const { currencyCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentCurrency, setCurrentCurrency] = useState<Rate | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | '3month' | '6month' | 'year' | '5year' | 'custom'>('month');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  
  // --- NEW STATE for API Fallback ---
  const [apiData, setApiData] = useState<ChartDataPoint[] | null>(null); // For daily data fallback
  const [isDailyDataLoaded, setIsDailyDataLoaded] = useState(false);
  const [currentSampling, setCurrentSampling] = useState<'daily' | 'weekly' | '15day' | 'monthly'>('daily');

  // --- MODIFIED: Fetch latest rates using API-First ---
  const { data: forexData, isLoading: isLoadingForex } = useQuery({
    queryKey: ['forexRates', format(new Date(), 'yyyy-MM-dd')],
    queryFn: () => fetchRatesApiFirst(new Date()), // Use API-First
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15,
  });

  useEffect(() => {
    if (forexData?.rates) {
      const rate = forexData.rates.find(
        (r) => r.currency.iso3 === currencyCode
      );
      if (rate) {
        setCurrentCurrency(rate);
      } else if (currencyCode === 'NPR') {
        setCurrentCurrency({
          currency: { iso3: 'NPR', name: 'Nepali Rupee', unit: 1 },
          buy: 1,
          sell: 1,
        });
      } else {
        // navigate('/historical-charts'); // Or to a 404 page
      }
    }
  }, [forexData, currencyCode, navigate]);

  const getSamplingForPeriod = (period: typeof selectedPeriod, range: {from: Date, to: Date} | undefined) => {
    if (period === 'custom' && range?.from && range?.to) {
        const days = differenceInDays(range.to, range.from);
        if (days > 365 * 2) return 'monthly';
        if (days > 365) return '15day';
        if (days > 90) return 'weekly';
        return 'daily';
    }
    
    switch (period) {
      case 'week':
      case 'month':
      case '3month':
        return 'daily';
      case '6month':
      case 'year':
        return 'weekly';
      case '5year':
        return 'monthly'; // More aggressive sampling
      default:
        return 'daily';
    }
  };

  const loadHistoricalData = async (forceApi = false) => {
    if (!currencyCode || currencyCode === 'NPR') return;

    // If daily data is already loaded and we aren't forcing a new API call, use it
    if (apiData && !forceApi) {
      setChartData(apiData);
      return;
    }
    
    setIsLoadingChart(true);
    setProgress(null);
    setChartData([]);
    
    try {
      const dateRanges = getDateRanges();
      let fromDate, toDate;
      let fromDateObj, toDateObj;
      let sampling: 'daily' | 'weekly' | '15day' | 'monthly' = 'daily';

      switch (selectedPeriod) {
        case 'week':
          fromDate = dateRanges.week.from; toDate = dateRanges.week.to;
          fromDateObj = parseISO(fromDate); toDateObj = parseISO(toDate);
          break;
        case 'month':
          fromDate = dateRanges.month.from; toDate = dateRanges.month.to;
          fromDateObj = parseISO(fromDate); toDateObj = parseISO(toDate);
          break;
        case '3month':
          fromDate = dateRanges.threeMonth.from; toDate = dateRanges.threeMonth.to;
          fromDateObj = parseISO(fromDate); toDateObj = parseISO(toDate);
          break;
        case '6month':
          fromDate = dateRanges.sixMonth.from; toDate = dateRanges.sixMonth.to;
          fromDateObj = parseISO(fromDate); toDateObj = parseISO(toDate);
          break;
        case 'year':
          fromDate = dateRanges.year.from; toDate = dateRanges.year.to;
          fromDateObj = parseISO(fromDate); toDateObj = parseISO(toDate);
          break;
        case '5year':
          fromDate = dateRanges.fiveYear.from; toDate = dateRanges.fiveYear.to;
          fromDateObj = parseISO(fromDate); toDateObj = parseISO(toDate);
          break;
        case 'custom':
          if (customDateRange?.from && customDateRange?.to) {
            fromDateObj = customDateRange.from; toDateObj = customDateRange.to;
            fromDate = formatDate(fromDateObj); toDate = formatDate(toDateObj);
          } else {
            setIsLoadingChart(false);
            return; // Don't load if custom range is invalid
          }
          break;
        default:
          setIsLoadingChart(false);
          return;
      }

      sampling = getSamplingForPeriod(selectedPeriod, {from: fromDateObj, to: toDateObj});
      setCurrentSampling(sampling); // Store current sampling rate

      let data: ChartDataPoint[] = [];

      if (forceApi) {
        // --- NEW: Force fetch from NRB API (chunked) ---
        setProgress({ stage: 'fetching', message: 'Fetching daily data from NRB API (this may take a moment)...' });
        setIsDailyDataLoaded(true);
        
        const apiResponse = await fetchHistoricalRates(fromDate, toDate); // This is the chunked fetcher
        
        const dailyData = apiResponse.payload.map(day => {
          const rate = day.rates.find(r => r.currency.iso3 === currencyCode);
          return {
            date: day.date,
            buy: rate ? parseFloat(rate.buy.toString()) : 0,
            sell: rate ? parseFloat(rate.sell.toString()) : 0
          };
        }).filter(d => d.buy > 0 || d.sell > 0);
        
        data = fillMissingDatesWithPreviousData(dailyData, fromDate, toDate);
        setApiData(data); // Cache API data in state
      } else {
        // --- MODIFIED: Fetch from D1 Cache with sampling ---
        setIsDailyDataLoaded(false);
        setApiData(null); // Clear old API data

        data = await fetchHistoricalRatesWithCache(
          currencyCode,
          fromDate,
          toDate,
          (p) => setProgress(p),
          sampling // Pass the sampling rate
        );
      }
      
      if (data.length > 0) {
        data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setChartData(data);
      }
    } catch (error) {
      console.error('Error loading historical data:', error);
      toast({
        title: "Error",
        description: "Failed to load chart data.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingChart(false);
      setTimeout(() => setProgress(null), 3000);
    }
  };

  // Reload data when period changes (but not for custom)
  useEffect(() => {
    if (selectedPeriod !== 'custom') {
      loadHistoricalData(false);
    }
  }, [selectedPeriod, currencyCode]);

  // Handle custom date apply
  const handleCustomDateApply = () => {
    if (customDateRange?.from && customDateRange?.to) {
      loadHistoricalData(false);
    } else {
      toast({
        title: "Invalid Range",
        description: "Please select a 'from' and 'to' date.",
        variant: "destructive"
      });
    }
  };

  // --- (Download functions - unchanged) ---
  const downloadChart = (format: 'png') => {
    const container = document.getElementById('download-container');
    if (!container) {
      toast({ title: "Error", description: "Could not find chart container.", variant: "destructive" });
      return;
    }
    
    toast({ title: "Downloading...", description: `Generating ${format.toUpperCase()} file.` });

    const options = {
      backgroundColor: '#ffffff',
      style: {
        // Temporarily remove backdrop blur for export
        backdropFilter: 'none',
        '-webkit-backdrop-filter': 'none',
      },
    };

    toPng(container, options)
      .then((dataUrl) => {
        saveAs(dataUrl, `forexnepal-chart-${currencyCode}-${formatDate(new Date())}.${format}`);
      })
      .catch((error) => {
        console.error('Chart download error:', error);
        toast({ title: "Error", description: "Failed to generate chart image.", variant: "destructive" });
      });
  };

  if (isLoadingForex || !currentCurrency) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-1/2 mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <Button variant="outline" asChild className="mb-6">
            <Link to="/historical-charts">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Currencies
            </Link>
          </Button>

          <Card className="shadow-lg bg-white/70 backdrop-blur-sm">
            <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-3xl font-bold flex items-center gap-3">
                  <span className="text-4xl">{getFlagEmoji(currentCurrency.currency.iso3)}</span>
                  {currentCurrency.currency.name} ({currentCurrency.currency.iso3})
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  1 {currentCurrency.currency.iso3} = {currentCurrency.buy.toFixed(2)} NPR (Buy) / {currentCurrency.sell.toFixed(2)} NPR (Sell)
                </CardDescription>
              </div>
              <div className="flex gap-2 mt-4 md:mt-0">
                <Button variant="outline" size="sm" onClick={() => downloadChart('png')}>
                  <Download className="mr-2 h-4 w-4" /> Download PNG
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div id="download-container" className="bg-white p-4 md:p-8 rounded-lg">
                <div className="md:hidden text-center mb-4">
                  <h3 className="text-xl font-semibold">
                    {currentCurrency.currency.name} ({currentCurrency.currency.iso3})
                  </h3>
                  <p className="text-sm text-muted-foreground">Historical Chart</p>
                </div>

                <Tabs value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as any)} className="mb-6">
                  <div className="overflow-x-auto scrollbar-hide">
                    <TabsList>
                      <TabsTrigger value="week">1 Week</TabsTrigger>
                      <TabsTrigger value="month">1 Month</TabsTrigger>
                      <TabsTrigger value="3month">3 Months</TabsTrigger>
                      <TabsTrigger value="6month">6 Months</TabsTrigger>
                      <TabsTrigger value="year">1 Year</TabsTrigger>
                      <TabsTrigger value="5year">5 Years</TabsTrigger>
                      <TabsTrigger value="custom">Custom</TabsTrigger>
                    </TabsList>
                  </div>
                </Tabs>

                {selectedPeriod === 'custom' && (
                  <div className="flex flex-col md:flex-row gap-4 items-center mb-6 p-4 bg-gray-50 rounded-lg">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={'outline'}
                          className="w-full md:w-[300px] justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateRange?.from ? (
                            customDateRange.to ? (
                              <>
                                {format(customDateRange.from, 'LLL dd, y')} -{' '}
                                {format(customDateRange.to, 'LLL dd, y')}
                              </>
                            ) : (
                              format(customDateRange.from, 'LLL dd, y')
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={customDateRange?.from}
                          selected={customDateRange}
                          onSelect={setCustomDateRange}
                          numberOfMonths={2}
                          disabled={(date) =>
                            date > new Date() || date < new Date('2000-01-01')
                          }
                        />
                      </PopoverContent>
                    </Popover>
                    <Button onClick={handleCustomDateApply} disabled={isLoadingChart}>
                      {isLoadingChart ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Apply Range
                    </Button>
                  </div>
                )}

                {progress && (
                  <Alert className="mb-4 bg-blue-50 border-blue-200">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>
                      {progress.message}
                      {progress.chunkInfo && ` (Chunk ${progress.chunkInfo.current} of ${progress.chunkInfo.total})`}
                    </AlertDescription>
                  </Alert>
                )}

                {/* --- MODIFIED: Chart container with scrolling --- */}
                <div className="w-full h-[400px] mb-6 overflow-x-auto">
                  {isLoadingChart ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={700}>
                      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="buy" stroke="#006400" dot={false} name="Buy Rate" />
                        <Line type="monotone" dataKey="sell" stroke="#8B0000" dot={false} name="Sell Rate" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available for this period.
                    </div>
                  )}
                </div>

                {/* --- NEW: Load Daily Data Button --- */}
                {!isDailyDataLoaded && !isLoadingChart && currentSampling !== 'daily' && (
                  <div className="text-center mb-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Showing sampled data ({currentSampling}).
                    </p>
                    <Button variant="outline" size="sm" onClick={() => loadHistoricalData(true)}>
                      Load Full Daily Data (Slower)
                    </Button>
                  </div>
                )}
                {isDailyDataLoaded && (
                  <p className="text-sm text-center text-green-600 mb-4">
                      Full daily data loaded from NRB API.
                    </p>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  Chart data is indicative. Actual rates may vary.
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="my-8">
            <AdSense slot="7506306569" format="fluid" layoutKey="-gw-3+1f-3d+2z" />
          </div>

        </div>
      </div>
    </Layout>
  );
};

export default CurrencyHistoricalData;
