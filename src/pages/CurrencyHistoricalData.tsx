import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchHistoricalRates, getFlagEmoji } from '@/services/forexService';
import { Rate, ChartDataPoint } from '@/types/forex';
import { format, subDays, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Layout from '@/components/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ShareButtons from '@/components/ShareButtons'; // Added ShareButtons
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

// --- Currency Info Map ---
const CURRENCY_MAP: { [key: string]: { name: string, unit: number, country: string } } = {
  'INR': { name: 'Indian Rupee', unit: 100, country: 'India' },
  'USD': { name: 'U.S. Dollar', unit: 1, country: 'United States' },
  'EUR': { name: 'European Euro', unit: 1, country: 'European Union' },
  'GBP': { name: 'UK Pound Sterling', unit: 1, country: 'United Kingdom' },
  'CHF': { name: 'Swiss Franc', unit: 1, country: 'Switzerland' },
  'AUD': { name: 'Australian Dollar', unit: 1, country: 'Australia' },
  'CAD': { name: 'Canadian Dollar', unit: 1, country: 'Canada' },
  'SGD': { name: 'Singapore Dollar', unit: 1, country: 'Singapore' },
  'JPY': { name: 'Japanese Yen', unit: 10, country: 'Japan' },
  'CNY': { name: 'Chinese Yuan', unit: 1, country: 'China' },
  'SAR': { name: 'Saudi Arabian Riyal', unit: 1, country: 'Saudi Arabia' },
  'QAR': { name: 'Qatari Riyal', unit: 1, country: 'Qatar' },
  'THB': { name: 'Thai Baht', unit: 1, country: 'Thailand' },
  'AED': { name: 'U.A.E Dirham', unit: 1, country: 'United Arab Emirates' },
  'MYR': { name: 'Malaysian Ringgit', unit: 1, country: 'Malaysia' },
  'KRW': { name: 'South Korean Won', unit: 100, country: 'South Korea' },
  'SEK': { name: 'Swedish Kroner', unit: 1, country: 'Sweden' },
  'DKK': { name: 'Danish Kroner', unit: 1, country: 'Denmark' },
  'HKD': { name: 'Hong Kong Dollar', unit: 1, country: 'Hong Kong' },
  'KWD': { name: 'Kuwaiti Dinar', unit: 1, country: 'Kuwait' },
  'BHD': { name: 'Bahraini Dinar', unit: 1, country: 'Bahrain' },
  'OMR': { name: 'Omani Rial', unit: 1, country: 'Oman' }
};

// --- Date Range Definitions ---
type RangeKey = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX';
const DATE_RANGES: Record<RangeKey, { days: number, label: string }> = {
  '1M': { days: 30, label: '1 Month' },
  '3M': { days: 90, label: '3 Months' },
  '6M': { days: 180, label: '6 Months' },
  '1Y': { days: 365, label: '1 Year' },
  '3Y': { days: 365 * 3, label: '3 Years' },
  '5Y': { days: 365 * 5, label: '5 Years' },
  'MAX': { days: 365 * 25, label: 'Max' }, // Fetch up to 25 years
};

// --- Helper Functions ---

/**
 * Calculates the start date based on the selected range.
 */
const getStartDate = (range: RangeKey): string => {
  const { days } = DATE_RANGES[range];
  if (range === 'MAX') {
    return '2000-01-01'; // Max start date
  }
  return format(subDays(new Date(), days), 'yyyy-MM-dd');
};

/**
 * Processes API data into a clean format for the chart.
 * This is where the data logic is fixed.
 */
const processChartData = (data: Rate[], unit: number): { chartData: ChartDataPoint[], stats: ReturnType<typeof calculateStats> } => {
  if (!data || data.length === 0) {
    return { chartData: [], stats: calculateStats([], unit) };
  }

  const validData: ChartDataPoint[] = data
    .map(rate => {
      const buy = Number(rate.buy);
      const sell = Number(rate.sell);
      
      // Normalize rates per 1 unit
      const normalizedBuy = buy / unit;
      const normalizedSell = sell / unit;

      // Filter out invalid data points
      if (
        !rate.date || 
        isNaN(normalizedBuy) || isNaN(normalizedSell) ||
        normalizedBuy <= 0.001 || normalizedSell <= 0.001 || // Remove 0 or near-0 values
        normalizedBuy > 1000 || normalizedSell > 1000 // Remove absurdly high values (like 375 for USD)
      ) {
        return null;
      }
      
      return {
        date: format(parseISO(rate.date), 'yyyy-MM-dd'),
        buy: normalizedBuy,
        sell: normalizedSell,
      };
    })
    .filter((item): item is ChartDataPoint => item !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Ensure sorted by date

  // Create a gap-filled dataset
  const filledData: ChartDataPoint[] = [];
  if (validData.length > 0) {
    let currentDate = parseISO(validData[0].date);
    const endDate = parseISO(validData[validData.length - 1].date);
    let dataIndex = 0;

    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      if (dataIndex < validData.length && validData[dataIndex].date === dateStr) {
        filledData.push(validData[dataIndex]);
        dataIndex++;
      } else {
        // This creates a gap (null value) for Recharts to render a broken line
        filledData.push({ date: dateStr, buy: null, sell: null });
      }
      currentDate = addDays(currentDate, 1); // Move to the next day
    }
  }

  const stats = calculateStats(validData, unit);
  return { chartData: filledData, stats };
};

/**
 * Calculates high/low/change statistics from the *valid* data.
 */
const calculateStats = (data: ChartDataPoint[], unit: number) => {
  if (data.length === 0) {
    return { high: 0, low: 0, change: 0, changePercent: 0, firstRate: 0, lastRate: 0, unit };
  }

  let high = 0;
  let low = Infinity;
  data.forEach(d => {
    if (d.buy) {
      if (d.buy > high) high = d.buy;
      if (d.buy < low) low = d.buy;
    }
  });

  const firstRate = data[0]?.buy || 0;
  const lastRate = data[data.length - 1]?.buy || 0;
  const change = lastRate - firstRate;
  const changePercent = firstRate > 0 ? (change / firstRate) * 100 : 0;

  return { high, low, change, changePercent, firstRate, lastRate, unit };
};

// --- Custom Chart Components ---
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.buy === null) return null; // Don't show tooltip for gaps

    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-bold text-sm">{format(parseISO(label), 'MMM d, yyyy')}</p>
        <p className="text-blue-500 text-xs">Buy: {data.buy.toFixed(4)}</p>
        <p className="text-green-500 text-xs">Sell: {data.sell.toFixed(4)}</p>
      </div>
    );
  }
  return null;
};

const StatCard: React.FC<{ title: string, value: number, prefix?: string, suffix?: string, decimals?: number, colorClass?: string }> = ({
  title,
  value,
  prefix = 'Rs. ',
  suffix = '',
  decimals = 2,
  colorClass = 'text-foreground'
}) => (
  <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg">
    <span className="text-xs text-muted-foreground uppercase">{title}</span>
    <span className={`text-lg font-bold ${colorClass}`}>
      {value > 0 && prefix === 'Rs. ' && '+'}
      {prefix}{value.toFixed(decimals)}{suffix}
    </span>
  </div>
);

// --- Main Page Component ---
const CurrencyHistoricalData: React.FC = () => {
  const { currencyCode } = useParams<{ currencyCode: string }>();
  const [range, setRange] = useState<RangeKey>('1Y');

  const currencyInfo = CURRENCY_MAP[currencyCode?.toUpperCase() || ''] || { name: 'Unknown', unit: 1, country: 'Unknown' };
  const { name, unit, country } = currencyInfo;
  const upperCaseCurrencyCode = currencyCode?.toUpperCase() || 'UNKNOWN';

  const fromDate = getStartDate(range);
  const toDate = format(new Date(), 'yyyy-MM-dd');

  const { data: apiData, isLoading, isError, error } = useQuery({
    queryKey: ['historicalRates', upperCaseCurrencyCode, range],
    queryFn: () => fetchHistoricalRates(upperCaseCurrencyCode!, fromDate, toDate),
    enabled: !!upperCaseCurrencyCode && upperCaseCurrencyCode !== 'UNKNOWN',
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const { chartData, stats } = useMemo(() => {
    return processChartData(apiData?.payload || [], unit);
  }, [apiData, unit]);

  const changeColor = stats.change >= 0 ? 'text-green-600' : 'text-red-600';
  const pageTitle = `Historical Data for ${name} (${upperCaseCurrencyCode})`;
  const pageUrl = `https://forexnepal.com/historical-data/${upperCaseCurrencyCode}`;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/historical-charts" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to All Currencies
            </Link>
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                  {getFlagEmoji(upperCaseCurrencyCode!)}
                  {name} ({upperCaseCurrencyCode})
                </CardTitle>
                <CardDescription>
                  {country} | Official Unit: {unit}
                </CardDescription>
              </div>
              {/* Share Buttons Added Here */}
              <div className="w-full sm:w-auto">
                <ShareButtons url={pageUrl} title={pageTitle} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile Scroll Fixed: Added w-max */}
            <Tabs value={range} onValueChange={(value) => setRange(value as RangeKey)}>
              <div className="overflow-x-auto scrollbar-hide border-b">
                <TabsList className="w-max"> 
                  {Object.entries(DATE_RANGES).map(([key, { label }]) => (
                    <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="mt-6">
                {isLoading && (
                  <Skeleton className="h-[400px] w-full" />
                )}
                
                {isError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Chart</AlertTitle>
                    <AlertDescription>
                      Could not fetch historical data: {error.message}
                    </AlertDescription>
                  </Alert>
                )}

                {!isLoading && !isError && chartData.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Data Available</AlertTitle>
                    <AlertDescription>
                      There is no historical data available for {name} in this date range.
                    </AlertDescription>
                  </Alert>
                )}

                {!isLoading && !isError && chartData.length > 0 && (
                  <>
                    <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard title="Last Rate" value={stats.lastRate} decimals={4} />
                      <StatCard title="Period High" value={stats.high} decimals={4} colorClass="text-green-600" />
                      <StatCard title="Period Low" value={stats.low} decimals={4} colorClass="text-red-600" />
                      <StatCard 
                        title="Period Change" 
                        value={stats.changePercent} 
                        prefix=""
                        suffix="%" 
                        decimals={2} 
                        colorClass={changeColor} 
                      />
                    </div>
                  
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(dateStr) => format(parseISO(dateStr), 'MMM yy')}
                            minTickGap={60}
                            dy={5}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis 
                            domain={['auto', 'auto']}
                            tickFormatter={(val) => val.toFixed(2)}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <ChartTooltip content={<CustomTooltip />} />
                          <Line 
                            type="monotone" 
                            dataKey="buy" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2} 
                            dot={false}
                            connectNulls={false} // This creates the gaps
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Showing per-unit normalized "Buy" rate. Gaps in the line indicate weekends or public holidays.
                    </p>
                  </>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CurrencyHistoricalData;
