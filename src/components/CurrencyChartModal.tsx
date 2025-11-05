import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';
import { CalendarIcon, RefreshCw, Loader2 } from 'lucide-react';
import { Rate, ChartDataPoint } from '../types/forex';
// --- MODIFIED IMPORTS ---
import { getDateRanges, fetchHistoricalRates, formatDate } from '../services/forexService'; // Import chunked fetcher
import { getFlagEmoji } from '../services/forexService';
import { useToast } from '@/components/ui/use-toast';
import { isValidDateString, isValidDateRange, sanitizeDateInput } from '../lib/validation';
import { Input } from '@/components/ui/input';
import { fetchHistoricalRatesWithCache, FetchProgress } from '../services/d1ForexService'; // Import d1 service
// ---
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { DateRange } from 'react-day-picker';

interface CurrencyChartModalProps {
  currency: Rate | null;
  isOpen: boolean;
  onClose: () => void;
}

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

const CurrencyChartModal = ({ currency, isOpen, onClose }: CurrencyChartModalProps) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('month');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  // Keep text inputs for validation fallback
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const { toast } = useToast();

  // --- NEW STATE for API Fallback ---
  const [apiData, setApiData] = useState<ChartDataPoint[] | null>(null); // For daily data fallback
  const [isDailyDataLoaded, setIsDailyDataLoaded] = useState(false);
  const [currentSampling, setCurrentSampling] = useState<'daily' | 'weekly' | '15day' | 'monthly'>('daily');

  const getSamplingForPeriod = (period: typeof selectedTab, range: {from: Date, to: Date} | undefined) => {
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
        return 'daily';
      case 'threeMonth':
      case 'sixMonth':
      case 'year':
        return 'weekly';
      case 'fiveYear':
        return 'monthly'; // More aggressive sampling
      default:
        return 'daily';
    }
  };

  const loadHistoricalData = async (fromDate: string, toDate: string, forceApi = false) => {
    if (!isOpen || !currency) return;

    if (apiData && !forceApi) {
        setChartData(apiData);
        return;
    }
    
    setIsLoading(true);
    setProgress(null);
    setChartData([]);
    
    try {
      let data: ChartDataPoint[] = [];
      const sampling = getSamplingForPeriod(selectedTab as any, {from: parseISO(fromDate), to: parseISO(toDate)});
      setCurrentSampling(sampling);

      if (forceApi) {
        // --- NEW: Force fetch from NRB API (chunked) ---
        setProgress({ stage: 'fetching', message: 'Fetching daily data from NRB API...' });
        setIsDailyDataLoaded(true);
        const apiResponse = await fetchHistoricalRates(fromDate, toDate); // Chunked fetcher
        const dailyData = apiResponse.payload.map(day => {
          const rate = day.rates.find(r => r.currency.iso3 === currency.currency.iso3);
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
          currency.currency.iso3,
          fromDate,
          toDate,
          (progress) => setProgress(progress),
          sampling // Pass sampling
        );
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
      console.error('Error loading chart data:', error);
      toast({ title: "Error", description: "Could not load chart data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(null), 3000);
    }
  };

  const getDatesForTab = (tab: string) => {
      const ranges = getDateRanges();
      switch (tab) {
          case 'week': return ranges.week;
          case 'month': return ranges.month;
          case 'threeMonth': return ranges.threeMonth;
          case 'sixMonth': return ranges.sixMonth;
          case 'year': return ranges.year;
          case 'fiveYear': return ranges.fiveYear;
          default: return ranges.month;
      }
  }

  // Load data on open or tab change
  useEffect(() => {
    if (isOpen && selectedTab !== 'custom') {
      const { from, to } = getDatesForTab(selectedTab);
      loadHistoricalData(from, to, false);
    }
  }, [isOpen, selectedTab, currency]);

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
    // Let useEffect handle the data load
  };

  const handleCustomDateApply = () => {
    let from: string | undefined, to: string | undefined;

    if (customDateRange?.from && customDateRange.to) {
        from = formatDate(customDateRange.from);
        to = formatDate(customDateRange.to);
    } else {
        // Fallback to text inputs if they are valid
        const saneFrom = sanitizeDateInput(customFromDate);
        const saneTo = sanitizeDateInput(customToDate);
        if (isValidDateString(saneFrom) && isValidDateString(saneTo) && isValidDateRange(saneFrom, saneTo)) {
            from = saneFrom;
            to = saneTo;
        } else {
            toast({
                title: "Invalid Date Range",
                description: "Please select a valid 'from' and 'to' date. The 'from' date must be before the 'to' date.",
                variant: "destructive"
            });
            return;
        }
    }
    
    loadHistoricalData(from, to, false);
  };

  if (!currency) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-3">
            <span className="text-3xl">{getFlagEmoji(currency.currency.iso3)}</span>
            {currency.currency.name} ({currency.currency.iso3})
          </DialogTitle>
          <DialogDescription>
            Historical exchange rate chart against NPR.
          </DialogDescription>
        </DialogHeader>
        
        {progress && (
          <Alert className="bg-blue-50 border-blue-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              {progress.message}
              {progress.chunkInfo && ` (Chunk ${progress.chunkInfo.current} of ${progress.chunkInfo.total})`}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={selectedTab} onValueChange={handleTabChange}>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="overflow-x-auto scrollbar-hide">
              <TabsList>
                <TabsTrigger value="week">1 Week</TabsTrigger>
                <TabsTrigger value="month">1 Month</TabsTrigger>
                <TabsTrigger value="threeMonth">3 Months</TabsTrigger>
                <TabsTrigger value="sixMonth">6 Months</TabsTrigger>
                <TabsTrigger value="year">1 Year</TabsTrigger>
                <TabsTrigger value="fiveYear">5 Years</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                let from, to;
                if (selectedTab === 'custom') {
                  if (customDateRange?.from && customDateRange.to) {
                    from = formatDate(customDateRange.from);
                    to = formatDate(customDateRange.to);
                  } else {
                    toast({ title: "Error", description: "Please select a custom date range to refresh.", variant: "destructive" });
                    return;
                  }
                } else {
                  const dates = getDatesForTab(selectedTab);
                  from = dates.from; to = dates.to;
                }
                loadHistoricalData(from, to, false);
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {selectedTab === 'custom' && (
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
                <Button onClick={handleCustomDateApply} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Apply Range
                </Button>
              </div>
          )}
          
          {/* --- NEW: Load Daily Data Button --- */}
          {!isDailyDataLoaded && !isLoading && currentSampling !== 'daily' && (
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Showing sampled data ({currentSampling}).
                </T>
                <Button variant="outline" size="sm" onClick={() => {
                    let from, to;
                    if (selectedTab === 'custom') {
                        if (customDateRange?.from && customDateRange.to) {
                            from = formatDate(customDateRange.from);
                            to = formatDate(customDateRange.to);
                        } else {
                            toast({ title: "Error", description: "Please select a custom date range.", variant: "destructive" });
                            return;
                        }
                    } else {
                        const dates = getDatesForTab(selectedTab);
                        from = dates.from; to = dates.to;
                    }
                    loadHistoricalData(from, to, true);
                }}>
                  Load Full Daily Data (Slower)
                </Button>
              </div>
            )}
            
          {isDailyDataLoaded && (
            <p className="text-sm text-center text-green-600 mb-4">
              Full daily data loaded from NRB API.
            </p>
          )}

          {/* This TabsContent wrapper is just for layout, ChartDisplay is shown for all tabs */}
          <TabsContent value={selectedTab}>
            <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} />
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
}

const ChartDisplay = ({ data, isLoading, currencyCode }: ChartDisplayProps) => {
  if (isLoading) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <p className="text-muted-foreground">No chart data available for this period.</p>
      </div>
    );
  }

  return (
    // --- MODIFIED: Add scrolling container ---
    <div className="h-[400px] w-full overflow-x-auto">
      {/* --- MODIFIED: Add minWidth --- */}
      <ResponsiveContainer width="100%" height="100%" minWidth={700}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={['auto', 'auto']} />
