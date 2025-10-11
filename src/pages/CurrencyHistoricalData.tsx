import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchForexRates, fetchHistoricalRates, getDateRanges, splitDateRangeForRequests, getFlagEmoji, formatDate } from '../services/forexService';
import { Rate, ChartDataPoint } from '../types/forex';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const CurrencyHistoricalData = () => {
  const { currencyCode } = useParams<{ currencyCode: string }>();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | '3month' | '6month' | 'year' | '5year' | 'custom'>('month');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [currentCurrency, setCurrentCurrency] = useState<Rate | null>(null);
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [isLoadingChart, setIsLoadingChart] = useState(false);

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

  useEffect(() => {
    if (selectedPeriod !== 'custom') {
      loadHistoricalData();
    }
  }, [selectedPeriod, currencyCode]);

  const loadHistoricalData = async () => {
    if (!currencyCode) return;
    
    setIsLoadingChart(true);
    try {
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
        default:
          return;
      }

      await fetchAndProcessData(new Date(fromDate), new Date(toDate));
    } catch (error) {
      console.error('Error loading historical data:', error);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const fetchAndProcessData = async (fromDate: Date, toDate: Date) => {
    const dateRangeRequests = splitDateRangeForRequests(fromDate, toDate);
    const allData: ChartDataPoint[] = [];

    for (const range of dateRangeRequests) {
      try {
        const data = await fetchHistoricalRates(range.from, range.to);
        if (data.payload) {
          data.payload.forEach(dayData => {
            const rate = dayData.rates.find(r => r.currency.iso3 === currencyCode?.toUpperCase());
            if (rate) {
              allData.push({
                date: dayData.date,
                buy: parseFloat(rate.buy.toString()),
                sell: parseFloat(rate.sell.toString()),
              });
            }
          });
        }
      } catch (error) {
        console.error(`Error fetching data for range ${range.from} to ${range.to}:`, error);
      }
    }

    allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setChartData(allData);
  };

  const handleCustomDateApply = async () => {
    if (customDateRange.from && customDateRange.to) {
      setIsLoadingChart(true);
      try {
        await fetchAndProcessData(customDateRange.from, customDateRange.to);
      } catch (error) {
        console.error('Error loading custom date range:', error);
      } finally {
        setIsLoadingChart(false);
      }
    }
  };

  const downloadChartAsSVG = () => {
    const svgElement = document.querySelector('.recharts-wrapper svg');
    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currencyCode}_historical_chart.svg`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const downloadChartAsPDF = async () => {
    const chartElement = document.getElementById('chart-container');
    if (chartElement) {
      const canvas = await html2canvas(chartElement);
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
          <p className="text-gray-500">Loading...</p>
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
                  SVG
                </Button>
                <Button variant="outline" size="sm" onClick={downloadChartAsPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>

            <Tabs value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as any)} className="mb-6">
              <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full">
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="3month">3 Months</TabsTrigger>
                <TabsTrigger value="6month">6 Months</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
                <TabsTrigger value="5year">5 Years</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
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
                        className="pointer-events-auto"
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
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button onClick={handleCustomDateApply} disabled={!customDateRange.from || !customDateRange.to}>
                  Apply
                </Button>
              </div>
            )}

            <div id="chart-container" className="w-full h-[400px]">
              {isLoadingChart ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Loading chart data...</p>
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => format(new Date(date), 'PPP')}
                      formatter={(value: number) => value.toFixed(2)}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="buy" stroke="#10b981" name="Buy Rate" strokeWidth={2} />
                    <Line type="monotone" dataKey="sell" stroke="#ef4444" name="Sell Rate" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No data available for selected period</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CurrencyHistoricalData;
