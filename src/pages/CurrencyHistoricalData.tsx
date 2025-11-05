import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchForexRates, getDateRanges, getFlagEmoji, formatDate, fetchHistoricalRates as fetchHistoricalRatesFromAPI } from '../services/forexService';
import { fetchHistoricalRatesWithCache, FetchProgress } from '../services/d1ForexService';
import { Rate, ChartDataPoint } from '../types/forex';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';

// --- Helper to determine sampling rate ---
const getSamplingForRange = (fromDate: string, toDate: string): string => {
  try {
    const days = differenceInDays(new Date(toDate), new Date(fromDate));
    if (days <= 90) return 'daily';      // 0-3 months
    if (days <= 730) return 'weekly';     // 3 months - 2 years
    if (days <= 1825) return '15day';   // 2-5 years
    return 'monthly'; // 5+ years
  } catch (e) {
    return 'daily';
  }
};

const CurrencyHistoricalData = () => {
  const { currencyCode } = useParams<{ currencyCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | '3month' | '6month' | 'year' | '5year' | 'custom'>('month');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [currentCurrency, setCurrentCurrency] = useState<Rate | null>(null);
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [currentSampling, setCurrentSampling] = useState('daily');
  const [isFullData, setIsFullData] = useState(true);

  const { data: forexData } = useQuery({
    queryKey: ['forexRates'],
    queryFn: fetchForexRates,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15,
  });

  useEffect(() => {
    if (forexData?.data?.payload?.[0]?.rates && currencyCode) {
      const currency = forexData.data.payload[0].rates.find(
        (r: Rate) => r.currency.iso3 === currencyCode.toUpperCase()
      );
      if (currency) {
        setCurrentCurrency(currency);
      } else {
        navigate('/404');
      }
    }
  }, [forexData, currencyCode, navigate]);
  
  const getDatesForPeriod = () => {
      const dateRanges = getDateRanges();
      let fromDate, toDate;

      switch (selectedPeriod) {
        case 'week':
          fromDate = dateRanges.week.from;
          toDate = dateRanges.week.to;
          break;
        case 'month':
          fromDate = dateRanges.month.from;
          toDate = dateRanges.month.to;
          break;
        case '3month':
          fromDate = dateRanges.threeMonth.from;
          toDate = dateRanges.threeMonth.to;
          break;
        case '6month':
          fromDate = dateRanges.sixMonth.from;
          toDate = dateRanges.sixMonth.to;
          break;
        case 'year':
          fromDate = dateRanges.year.from;
          toDate = dateRanges.year.to;
          break;
        case '5year':
          fromDate = dateRanges.fiveYear.from;
          toDate = dateRanges.fiveYear.to;
          break;
        case 'custom':
           if (customDateRange.from && customDateRange.to) {
                fromDate = formatDate(customDateRange.from);
                toDate = formatDate(customDateRange.to);
                break;
           }
           // else fall through to default (month) if custom isn't set
        default:
          fromDate = dateRanges.month.from;
          toDate = dateRanges.month.to;
          break;
      }
      return { fromDate, toDate };
  }

  const loadHistoricalData = async (forceFullDaily: boolean = false) => {
    if (!currencyCode) return;
    
    setIsLoadingChart(true);
    setProgress(null);
    setChartData([]);
    
    try {
      const { fromDate, toDate } = getDatesForPeriod();
      
      let data: ChartDataPoint[] = [];
      
      if (forceFullDaily) {
          // --- TASK 3: API FALLBACK ---
          toast({ title: "Fetching Full Data", description: "Loading full daily data from NRB API..." });
          const apiData = await fetchHistoricalRatesFromAPI(fromDate, toDate);
          
          if (apiData.status.code === 200 && apiData.payload.length > 0) {
              data = apiData.payload.map(dayData => {
                  const rate = dayData.rates.find(r => r.currency.iso3 === currencyCode);
                  return {
                      date: dayData.date,
                      buy: rate ? Number(rate.buy) : 0,
                      sell: rate ? Number(rate.sell) : 0,
                  };
              }).filter(d => d.buy > 0 || d.sell > 0);
          }
          setIsFullData(true);
          setCurrentSampling('daily');
          // --- END TASK 3 ---
      } else {
          // --- TASK 2: SAMPLING ---
          const sampling = getSamplingForRange(fromDate, toDate);
          setCurrentSampling(sampling);
          setIsFullData(sampling === 'daily');

          data = await fetchHistoricalRatesWithCache(
            currencyCode,
            fromDate,
            toDate,
            (p) => setProgress(p),
            sampling // Pass sampling rate
          );
          // --- END TASK 2 ---
      }
      
      if (data.length > 0) {
        data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setChartData(data);
      } else {
         toast({ title: "No data available", description: "There is no historical data for this period.", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error loading historical data:', error);
       toast({ title: "Error", description: "Failed to fetch historical data.", variant: "destructive" });
    } finally {
      setIsLoadingChart(false);
      setTimeout(() => setProgress(null), 3000);
    }
  };
  
  // Reload data when period or currency changes
  useEffect(() => {
    if (selectedPeriod !== 'custom') {
      loadHistoricalData();
    }
  }, [selectedPeriod, currencyCode]);

  const handleCustomDateApply = () => {
    if (customDateRange.from && customDateRange.to) {
        loadHistoricalData(); // This will now use the custom dates
    } else {
        toast({ title: "Invalid Range", description: "Please select both a start and end date.", variant: "destructive" });
    }
  };

  const downloadChartAsSVG = async () => {
    const downloadElement = document.getElementById('download-container');
    if (downloadElement) {
      const canvas = await html2canvas(downloadElement, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `${currencyCode}_historical_chart.png`;
      link.click();
    }
  };

  const downloadChartAsPDF = async () => {
    const downloadElement = document.getElementById('download-container');
    if (downloadElement) {
      const canvas = await html2canvas(downloadElement, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${currencyCode}_historical_chart.pdf`);
    }
  };

  if (!currentCurrency) {
    return (
      <Layout>
        <div className="py-12 px-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/historical-charts')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Currency List
          </Button>

          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-5xl">{getFlagEmoji(currentCurrency.currency.iso3)}</span>
              <h1 className="text-4xl font-bold text-gray-900">
                {currentCurrency.currency.name} ({currentCurrency.currency.iso3})
              </h1>
            </div>
            <p className="text-xl text-gray-600">
              Historical Forex Data for {currentCurrency.currency.unit} {currentCurrency.currency.iso3}
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Exchange Rate Chart</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadChartAsSVG}>
                  <Download className="h-4 w-4 mr-2" />
                  PNG
                </Button>
                <Button variant="outline" size="sm" onClick={downloadChartAsPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>

            <div id="download-container" className="bg-white p-4 md:p-8">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-4xl">{getFlagEmoji(currentCurrency.currency.iso3)}</span>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {currentCurrency.currency.name} ({currentCurrency.currency.iso3})
                  </h3>
                </div>
                <p className="text-base text-gray-700">
                  Historical data of {currentCurrency.currency.name} against NPR for{' '}
                  {selectedPeriod === 'custom' && customDateRange.from && customDateRange.to
                    ? `${format(customDateRange.from, 'PPP')} to ${format(customDateRange.to, 'PPP')}`
                    : selectedPeriod === 'week'
                    ? 'last 7 days'
                    : selectedPeriod === 'month'
                    ? 'last 30 days'
                    : selectedPeriod === '3month'
                    ? 'last 3 months'
                    : selectedPeriod === '6month'
                    ? 'last 6 months'
                    : selectedPeriod === 'year'
                    ? 'last year'
                    : 'last 5 years'}
                </p>
              </div>

            <Tabs value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as any)} className="mb-6">
              <div className="overflow-x-auto scrollbar-hide">
                <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full min-w-[500px]">
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="3month">3 Months</TabsTrigger>
                  <TabsTrigger value="6month">6 Months</TabsTrigger>
                  <TabsTrigger value="year">Year</TabsTrigger>
                  <TabsTrigger value="5year">5 Years</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                </TabsList>
              </div>
            </Tabs>

            {selectedPeriod === 'custom' && (
              <div className="flex flex-wrap gap-4 mb-6 items-end">
                <div>
                  <label className="block text-sm font-medium mb-2">From Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !customDateRange.from && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.from ? format(customDateRange.from, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange.from}
                        onSelect={(date) => setCustomDateRange({ ...customDateRange, from: date })}
                        initialFocus
                        disabled={{ after: new Date() }}
                        className="pointer-events-auto"
                        captionLayout="dropdown-buttons"
                        fromYear={2000}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">To Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !customDateRange.to && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.to ? format(customDateRange.to, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange.to}
                        onSelect={(date) => setCustomDateRange({ ...customDateRange, to: date })}
                        initialFocus
                        disabled={{ after: new Date() }}
                        className="pointer-events-auto"
                        captionLayout="dropdown-buttons"
                        fromYear={2000}
                        toYear={new Date().getFullYear()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button onClick={handleCustomDateApply} disabled={!customDateRange.from || !customDateRange.to}>
                  Apply
                </Button>
              </div>
              )}

              {/* Progress indicator */}
              {progress && (
                <Alert className="mb-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    <div className="font-medium">{progress.message}</div>
                    {progress.chunkInfo && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Chunk {progress.chunkInfo.current} of {progress.chunkInfo.total}: {progress.chunkInfo.fromDate} to {progress.chunkInfo.toDate}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* --- TASK 5: Mobile Chart Responsiveness --- */}
              <div className="w-full overflow-x-auto">
                <div className="w-full h-[400px] mb-6" style={{ minWidth: 700 }}>
                  {isLoadingChart ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="text-muted-foreground">Loading chart data...</p>
                    </div>
                  ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(date) => format(new Date(date + 'T00:00:00Z'), 'MMM dd, yy')} // Handle UTC date
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          domain={['dataMin - 0.5', 'dataMax + 0.5']}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => value.toFixed(2)}
                        />
                        <Tooltip 
                          labelFormatter={(date) => format(new Date(date + 'T00:00:00Z'), 'PPP')} // Handle UTC date
                          formatter={(value: number, name: string) => [
                            `NPR ${value.toFixed(4)}`,
                            name === 'buy' ? 'Buying Price' : 'Selling Price'
                          ]}
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '12px'
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="line"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="buy" 
                          name="Buying Price" 
                          stroke="#10b981" 
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 2 }}
                          animationDuration={800}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="sell" 
                          name="Selling Price" 
                          stroke="#ef4444" 
                          strokeWidth={2.5}
                          strokeDasharray="5 5"
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 2 }}
                          animationDuration={800}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No data available for selected period</p>
                    </div>
                  )}
                </div>
              </div>
              {/* --- END TASK 5 --- */}

              {/* --- TASK 3: API FALLBACK BUTTON --- */}
              {!isFullData && !isLoadingChart && (
                <div className="mt-4 text-center">
                   <p className="text-xs text-muted-foreground mb-2">
                      Showing sampled data ({currentSampling}) for faster loading.
                   </p>
                   <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadHistoricalData(true)}
                      disabled={isLoadingChart}
                   >
                     <RefreshCw className="h-4 w-4 mr-2" />
                     Load Full Daily Data (Slower)
                   </Button>
                </div>
              )}
              {/* --- END TASK 3 --- */}

              <div className="border-t pt-4 text-center space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Source:</strong> Nepal Rastra Bank API & D1 Database Cache
                </p>
                <p className="text-sm text-gray-600">
                  Last updated: {new Date().toLocaleString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                  })}
                </p>
                <p className="text-sm text-gray-600 italic">
                  Data extraction and presentation designed by Grisma Bhandari
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CurrencyHistoricalData;
