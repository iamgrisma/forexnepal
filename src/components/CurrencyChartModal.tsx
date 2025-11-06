import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';
import { CalendarIcon, RefreshCw, Loader2 } from 'lucide-react';
import { Rate, ChartDataPoint } from '../types/forex';
import { getDateRanges, fetchHistoricalRates as fetchHistoricalRatesFromAPI } from '../services/forexService'; // Import API fetcher
import { getFlagEmoji } from '../services/forexService';
import { useToast } from '@/components/ui/use-toast';
import { isValidDateString, isValidDateRange, sanitizeDateInput } from '../lib/validation';
import { Input } from '@/components/ui/input';
import { fetchHistoricalRatesWithCache, FetchProgress } from '../services/d1ForexService'; // Import D1 fetcher
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CurrencyChartModalProps {
  currency: Rate;
  isOpen: boolean;
  onClose: () => void;
}

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

const CurrencyChartModal = ({ currency, isOpen, onClose }: CurrencyChartModalProps) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('month');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [currentSampling, setCurrentSampling] = useState('daily');
  const [isFullData, setIsFullData] = useState(true);
  const { toast } = useToast();

  const getDatesForPeriod = () => {
      const ranges = getDateRanges();
      let fromDate, toDate;
      
      if (selectedTab === 'custom') {
          if (dateRange.from && dateRange.to) {
              fromDate = format(dateRange.from, 'yyyy-MM-dd');
              toDate = format(dateRange.to, 'yyyy-MM-dd');
          } else if (isValidDateString(customFromDate) && isValidDateString(customToDate) && isValidDateRange(customFromDate, customToDate)) {
              fromDate = customFromDate;
              toDate = customToDate;
          } else {
              // Fallback to default if custom is selected but invalid
              fromDate = ranges.month.from;
              toDate = ranges.month.to;
          }
      } else {
         fromDate = ranges[selectedTab as keyof typeof ranges].from;
         toDate = ranges[selectedTab as keyof typeof ranges].to;
      }
      return { fromDate, toDate };
  }

  const loadHistoricalData = async (forceFullDaily: boolean = false) => {
    if (!isOpen || !currency?.currency?.iso3) return;
    
    setIsLoading(true);
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
                  const rate = dayData.rates.find(r => r.currency.iso3 === currency.currency.iso3);
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
            currency.currency.iso3,
            fromDate,
            toDate,
            (progress) => { setProgress(progress); },
            sampling // Pass sampling rate
          );
          // --- END TASK 2 ---
      }
      
      if (data.length > 0) {
        data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setChartData(data);
      } else {
        toast({
          title: "No data available",
          description: "There is no historical data available for the selected period.",
          variant: "destructive",
        });
        setChartData([]);
      }
    } catch (error) {
      console.error("Failed to fetch historical data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch historical data. Please try again later.",
        variant: "destructive",
      });
      setChartData([]);
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(null), 3000);
    }
  };

  useEffect(() => {
    if (isOpen) {
        // Load data for the default tab ('month') on open
        handleTabChange(selectedTab);
    }
  }, [isOpen]);

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
    if (value !== 'custom') {
      const ranges = getDateRanges();
      const { from: fromDate, to: toDate } = ranges[value as keyof typeof ranges];
      const sampling = getSamplingForRange(fromDate, toDate);
      setCurrentSampling(sampling);
      setIsFullData(sampling === 'daily');

      loadHistoricalData();
    }
  };

  // Re-run loadHistoricalData if the tab *is* 'custom' and the dates change
  // This is handled by the "Apply" buttons now.


  const handleCustomDateApply = () => {
    let fromFormatted: string | undefined = undefined;
    let toFormatted: string | undefined = undefined;

    if (dateRange.from && dateRange.to) {
      fromFormatted = format(dateRange.from, 'yyyy-MM-dd');
      toFormatted = format(dateRange.to, 'yyyy-MM-dd');
    } else if (customFromDate && customToDate) {
      if (!isValidDateString(customFromDate) || !isValidDateString(customToDate)) {
        toast({ title: "Invalid date format", description: "Please use YYYY-MM-DD format.", variant: "destructive" });
        return;
      }
      if (!isValidDateRange(customFromDate, customToDate)) {
        toast({ title: "Invalid date range", description: "Start date must be before end date.", variant: "destructive" });
        return;
      }
      fromFormatted = customFromDate;
      toFormatted = customToDate;
    } else {
      toast({ title: "Date selection required", description: "Please select both start and end dates.", variant: "destructive" });
      return;
    }
    
    if(fromFormatted && toFormatted) {
        const sampling = getSamplingForRange(fromFormatted, toFormatted);
        setCurrentSampling(sampling);
        setIsFullData(sampling === 'daily');
        loadHistoricalData();
        setCalendarOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <span className="text-2xl mr-2">{getFlagEmoji(currency.currency.iso3)}</span>
            {currency.currency.name} ({currency.currency.iso3}) Exchange Rate History
          </DialogTitle>
          <DialogDescription>
            View historical exchange rates for {currency.currency.unit} {currency.currency.unit > 1 ? 'units' : 'unit'} of {currency.currency.iso3}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        {progress && (
          <Alert className="mb-4">
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

        <Tabs value={selectedTab} onValueChange={handleTabChange}>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
             <div className="overflow-x-auto scrollbar-hide">
                <TabsList className="w-max">
                  <TabsTrigger value="week">Last Week</TabsTrigger>
                  <TabsTrigger value="month">Last Month</TabsTrigger>
                  <TabsTrigger value="threeMonth">Last 3 Months</TabsTrigger>
                  <TabsTrigger value="sixMonth">Last 6 Months</TabsTrigger>
                  <TabsTrigger value="year">Last Year</TabsTrigger>
                  <TabsTrigger value="fiveYear">Last 5 Years</TabsTrigger>
                  <TabsTrigger value="custom">Custom Range</TabsTrigger>
                </TabsList>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => loadHistoricalData()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
           {selectedTab === 'custom' && (
              <div className="flex flex-wrap items-end gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      <span>
                        {dateRange.from ? format(dateRange.from, 'PP') : 'Select'} - 
                        {dateRange.to ? format(dateRange.to, 'PP') : 'Select'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => setDateRange(range as { from: Date | undefined; to: Date | undefined })}
                      initialFocus
                      disabled={{ after: new Date() }}
                      className="pointer-events-auto"
                      captionLayout="dropdown-buttons"
                      fromYear={2000}
                      toYear={new Date().getFullYear()}
                    />
                    <div className="p-3 border-t border-border">
                      <Button size="sm" onClick={handleCustomDateApply} className="w-full">
                        Apply Range
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <div className="flex items-end gap-2">
                  <div className="flex flex-col">
                    <label className="text-xs mb-1">From (YYYY-MM-DD)</label>
                    <Input
                      type="text"
                      placeholder="YYYY-MM-DD"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(sanitizeDateInput(e.target.value))}
                      className="w-32 h-9"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs mb-1">To (YYYY-MM-DD)</label>
                    <Input
                      type="text"
                      placeholder="YYYY-MM-DD"
                      value={customToDate}
                      onChange={(e) => setCustomToDate(sanitizeDateInput(e.target.value))}
                      className="w-32 h-9"
                    />
                  </div>
                  <Button onClick={handleCustomDateApply} size="sm">
                    Apply
                  </Button>
                </div>
              </div>
            )}

          <TabsContent value={selectedTab} className="mt-4">
             <ChartDisplay 
                data={chartData} 
                isLoading={isLoading} 
                currencyCode={currency.currency.iso3} 
                isFullData={isFullData}
                currentSampling={currentSampling}
                onLoadFullData={() => loadHistoricalData(true)}
              />
          </TabsContent>
          {/* Add empty TabsContent for each tab value to prevent layout shifts */}
          <TabsContent value="week" className={selectedTab !== 'week' ? 'hidden' : 'mt-4'}>
             <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} isFullData={isFullData} currentSampling={currentSampling} onLoadFullData={() => loadHistoricalData(true)} />
          </TabsContent>
           <TabsContent value="month" className={selectedTab !== 'month' ? 'hidden' : 'mt-4'}>
             <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} isFullData={isFullData} currentSampling={currentSampling} onLoadFullData={() => loadHistoricalData(true)} />
          </TabsContent>
           <TabsContent value="threeMonth" className={selectedTab !== 'threeMonth' ? 'hidden' : 'mt-4'}>
             <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} isFullData={isFullData} currentSampling={currentSampling} onLoadFullData={() => loadHistoricalData(true)} />
          </TabsContent>
           <TabsContent value="sixMonth" className={selectedTab !== 'sixMonth' ? 'hidden' : 'mt-4'}>
             <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} isFullData={isFullData} currentSampling={currentSampling} onLoadFullData={() => loadHistoricalData(true)} />
          </TabsContent>
           <TabsContent value="year" className={selectedTab !== 'year' ? 'hidden' : 'mt-4'}>
             <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} isFullData={isFullData} currentSampling={currentSampling} onLoadFullData={() => loadHistoricalData(true)} />
          </TabsContent>
           <TabsContent value="fiveYear" className={selectedTab !== 'fiveYear' ? 'hidden' : 'mt-4'}>
             <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} isFullData={isFullData} currentSampling={currentSampling} onLoadFullData={() => loadHistoricalData(true)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

interface ChartDisplayProps {
  data: ChartDataPoint[];
  isLoading: boolean;
  currencyCode: string;
  isFullData: boolean;
  currentSampling: string;
  onLoadFullData: () => void;
}

const ChartDisplay = ({ data, isLoading, currencyCode, isFullData, currentSampling, onLoadFullData }: ChartDisplayProps) => {
  if (isLoading) {
    return (
      <div className="h-[400px] w-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading chart data...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg">No historical data available for this period</p>
          <p className="text-sm">Try selecting a different date range</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* --- TASK 5: Mobile Chart Responsiveness --- */}
      <div className="w-full overflow-x-auto">
        <div className="h-[400px] w-full" style={{ minWidth: 700 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => {
                  try {
                    return format(parseISO(date), 'MMM dd, yy');
                  } catch(e) { return date; }
                }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => Number(value).toFixed(2)}
              />
              <Tooltip
                formatter={(value, name) => {
                  return [`NPR ${Number(value).toFixed(4)}`, name === 'buy' ? 'Buy Rate' : 'Sell Rate'];
                }}
                labelFormatter={(label) => {
                   try {
                     return format(parseISO(label), 'MMMM d, yyyy');
                   } catch(e) { return label; }
                }}
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
                name={`Buy Rate (${currencyCode})`}
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2 }}
                animationDuration={800}
              />
              <Line
                type="monotone"
                dataKey="sell"
                name={`Sell Rate (${currencyCode})`}
                stroke="#ef4444"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2 }}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* --- END TASK 5 --- */}

      {/* --- TASK 3: API FALLBACK BUTTON --- */}
      {!isFullData && !isLoading && (
        <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Showing sampled data ({currentSampling}) for faster loading.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadFullData}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Load Full Daily Data (Slower)
            </Button>
        </div>
      )}
      {/* --- END TASK 3 --- */}
    </div>
  );
};

export default CurrencyChartModal;
