
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, differenceInMonths, addMonths, isAfter, isBefore, parseISO } from 'date-fns';
import { CalendarIcon, RefreshCw } from 'lucide-react';
import { Rate, ChartDataPoint, HistoricalRates, RatesData } from '../types/forex';
import { fetchHistoricalRates, getDateRanges, splitDateRangeForRequests } from '../services/forexService';
import { getFlagEmoji } from '../services/forexService';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';

interface CurrencyChartModalProps {
  currency: Rate;
  isOpen: boolean;
  onClose: () => void;
}

const CurrencyChartModal = ({ currency, isOpen, onClose }: CurrencyChartModalProps) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('week');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');
  const { toast } = useToast();

  const loadHistoricalData = async (fromDate: string, toDate: string) => {
    if (!isOpen) return;
    
    setIsLoading(true);
    try {
      // Parse the dates
      const fromDateObj = parseISO(fromDate);
      const toDateObj = parseISO(toDate);
      
      // Split the date range if needed
      const dateRanges = splitDateRangeForRequests(fromDateObj, toDateObj);
      
      // Create an array to store all the data
      let allData: ChartDataPoint[] = [];
      
      // Fetch data for each date range
      for (const range of dateRanges) {
        const histData: HistoricalRates = await fetchHistoricalRates(range.from, range.to);
        
        if (histData.status.code === 200 && histData.payload.length > 0) {
          // Process the historical data
          histData.payload.forEach((dayData: RatesData) => {
            const currencyRate = dayData.rates.find(
              (rate) => rate.currency.iso3 === currency.currency.iso3
            );
            
            if (currencyRate) {
              allData.push({
                date: dayData.date,
                buy: parseFloat(currencyRate.buy.toString()),
                sell: parseFloat(currencyRate.sell.toString()),
              });
            }
          });
        }
      }
      
      if (allData.length > 0) {
        // Sort by date chronologically
        allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setChartData(allData);
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
    }
  };

  useEffect(() => {
    if (isOpen) {
      const ranges = getDateRanges();
      loadHistoricalData(ranges[selectedTab as keyof typeof ranges].from, ranges[selectedTab as keyof typeof ranges].to);
    }
  }, [isOpen, selectedTab]);

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
    if (value !== 'custom') {
      const ranges = getDateRanges();
      loadHistoricalData(ranges[value as keyof typeof ranges].from, ranges[value as keyof typeof ranges].to);
    }
  };

  const validateDateString = (dateStr: string): boolean => {
    // Basic regex for YYYY-MM-DD format
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    // Check if it's a valid date
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  };

  const handleCustomDateApply = () => {
    if (dateRange.from && dateRange.to) {
      const fromFormatted = format(dateRange.from, 'yyyy-MM-dd');
      const toFormatted = format(dateRange.to, 'yyyy-MM-dd');
      loadHistoricalData(fromFormatted, toFormatted);
      setCalendarOpen(false);
    } else if (customFromDate && customToDate) {
      if (!validateDateString(customFromDate) || !validateDateString(customToDate)) {
        toast({
          title: "Invalid date format",
          description: "Please use YYYY-MM-DD format for custom dates.",
          variant: "destructive",
        });
        return;
      }
      
      const fromDate = new Date(customFromDate);
      const toDate = new Date(customToDate);
      
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        toast({
          title: "Invalid dates",
          description: "Please enter valid dates.",
          variant: "destructive",
        });
        return;
      }
      
      if (fromDate > toDate) {
        toast({
          title: "Invalid date range",
          description: "Start date must be before end date.",
          variant: "destructive",
        });
        return;
      }
      
      if (toDate > new Date()) {
        toast({
          title: "Future dates not allowed",
          description: "End date cannot be in the future.",
          variant: "destructive",
        });
        return;
      }
      
      loadHistoricalData(customFromDate, customToDate);
    } else {
      toast({
        title: "Date selection required",
        description: "Please select both start and end dates.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <span className="text-2xl mr-2" dangerouslySetInnerHTML={{ __html: getFlagEmoji(currency.currency.iso3) }} />
            {currency.currency.name} ({currency.currency.iso3}) Exchange Rate History
          </DialogTitle>
          <DialogDescription>
            View historical exchange rates for {currency.currency.unit} {currency.currency.unit > 1 ? 'units' : 'unit'} of {currency.currency.iso3}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={handleTabChange}>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="week">Last Week</TabsTrigger>
              <TabsTrigger value="month">Last Month</TabsTrigger>
              <TabsTrigger value="threeMonth">Last 3 Months</TabsTrigger>
              <TabsTrigger value="sixMonth">Last 6 Months</TabsTrigger>
              <TabsTrigger value="year">Last Year</TabsTrigger>
              <TabsTrigger value="fiveYear">Last 5 Years</TabsTrigger>
              <TabsTrigger value="custom">Custom Range</TabsTrigger>
            </TabsList>
            
            {selectedTab === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
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
                    />
                    <div className="p-3 border-t border-border">
                      <Button size="sm" onClick={handleCustomDateApply} className="w-full">
                        Apply Range
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <label className="text-xs mb-1">From (YYYY-MM-DD)</label>
                    <Input
                      type="text"
                      placeholder="YYYY-MM-DD"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs mb-1">To (YYYY-MM-DD)</label>
                    <Input
                      type="text"
                      placeholder="YYYY-MM-DD"
                      value={customToDate}
                      onChange={(e) => setCustomToDate(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <Button onClick={handleCustomDateApply} size="sm" className="mt-6">
                    Apply
                  </Button>
                </div>
              </div>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                if (selectedTab === 'custom') {
                  if (dateRange.from && dateRange.to) {
                    const fromFormatted = format(dateRange.from, 'yyyy-MM-dd');
                    const toFormatted = format(dateRange.to, 'yyyy-MM-dd');
                    loadHistoricalData(fromFormatted, toFormatted);
                  } else if (customFromDate && customToDate) {
                    loadHistoricalData(customFromDate, customToDate);
                  }
                } else {
                  const ranges = getDateRanges();
                  loadHistoricalData(ranges[selectedTab as keyof typeof ranges].from, ranges[selectedTab as keyof typeof ranges].to);
                }
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <TabsContent value="week" className="mt-4">
            <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} />
          </TabsContent>
          
          <TabsContent value="month" className="mt-4">
            <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} />
          </TabsContent>
          
          <TabsContent value="threeMonth" className="mt-4">
            <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} />
          </TabsContent>
          
          <TabsContent value="sixMonth" className="mt-4">
            <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} />
          </TabsContent>
          
          <TabsContent value="year" className="mt-4">
            <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} />
          </TabsContent>
          
          <TabsContent value="fiveYear" className="mt-4">
            <ChartDisplay data={chartData} isLoading={isLoading} currencyCode={currency.currency.iso3} />
          </TabsContent>
          
          <TabsContent value="custom" className="mt-4">
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
        <RefreshCw className="h-12 w-12 animate-spin text-forex-blue opacity-30" />
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
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis 
            dataKey="date" 
            tickFormatter={(date) => {
              const d = new Date(date);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
          />
          <YAxis domain={['auto', 'auto']} />
          <Tooltip
            formatter={(value, name) => {
              return [`${value} NPR`, name === 'buy' ? 'Buy Rate' : 'Sell Rate'];
            }}
            labelFormatter={(label) => {
              const date = new Date(label);
              return format(date, 'MMMM d, yyyy');
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="buy"
            name={`Buy Rate (${currencyCode})`}
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="sell"
            name={`Sell Rate (${currencyCode})`}
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CurrencyChartModal;
