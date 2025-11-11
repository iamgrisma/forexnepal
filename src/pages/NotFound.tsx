import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateLong } from '../services/forexService'; // Keep helpers
import { Rate, RatesData } from '../types/forex';
import ForexTable from '../components/ForexTable';
import CurrencyCard from '../components/CurrencyCard';
import ForexTicker from '../components/ForexTicker';
import ShareButtons from '@/components/ShareButtons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Gitlab, List, Grid3X3, Download, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Layout from '@/components/Layout';
import AdSense from '@/components/AdSense';
import html2canvas from 'html2canvas';
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, addDays } from 'date-fns';
import { Link } from 'react-router-dom';
// --- TASK 4: Import DB-First Service ---
import { fetchRatesForDateWithCache } from '../services/d1ForexService'; 
// --- END TASK 4 ---

// NOTE: This component is a 404 page that ALSO renders the Index page content as a fallback.
// This is an unusual pattern, but we will apply the optimization here as well.

const NotFound = () => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [popularCurrencies, setPopularCurrencies] = useState<Rate[]>([]);
  const [asianCurrencies, setAsianCurrencies] = useState<Rate[]>([]);
  const [europeanCurrencies, setEuropeanCurrencies] = useState<Rate[]>([]);
  const [middleEastCurrencies, setMiddleEastCurrencies] = useState<Rate[]>([]);
  const [otherCurrencies, setOtherCurrencies] = useState<Rate[]>([]);
  const [previousDayRates, setPreviousDayRates] = useState<Rate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();

  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const previousDateString = format(subDays(selectedDate, 1), 'yyyy-MM-dd');

  // --- TASK 4: Use fetchRatesForDateWithCache (DB-First) ---
  const {
    data: forexData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['forexRates', selectedDateString],
    queryFn: () => fetchRatesForDateWithCache(selectedDateString, null), // Use DB-First service
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  // --- TASK 4: Use fetchRatesForDateWithCache for Prev Day (DB-First) ---
  const {
    data: prevDayData,
    isLoading: isLoadingPrevDay,
  } = useQuery({
    queryKey: ['previousDayRates', selectedDateString], // Keyed to selectedDate to refetch together
    queryFn: () => fetchRatesForDateWithCache(previousDateString, null), // Use DB-First service
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
  // --- END TASK 4 ---

  useEffect(() => {
    if (isError && error instanceof Error) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);

  // Update previousDayRates state when data loads
  useEffect(() => {
    if (prevDayData?.rates) {
      setPreviousDayRates(prevDayData.rates);
    } else {
      setPreviousDayRates([]); // Clear if no data
    }
  }, [prevDayData]);

  useEffect(() => {
    if (forexData?.rates) {
      const allRates = forexData.rates;

      const popularCodes = ['USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CHF'];
      const asianCodes = ['JPY', 'CNY', 'SGD', 'HKD', 'MYR', 'KRW', 'THB', 'INR'];
      const europeanCodes = ['EUR', 'GBP', 'CHF', 'SEK', 'DKK'];
      const middleEastCodes = ['SAR', 'QAR', 'AED', 'KWD', 'BHD', 'OMR'];

      const popular = allRates.filter(rate => popularCodes.includes(rate.currency.iso3));
      const asian = allRates.filter(rate => asianCodes.includes(rate.currency.iso3));
      const european = allRates.filter(rate => europeanCodes.includes(rate.currency.iso3));
      const middleEast = allRates.filter(rate => middleEastCodes.includes(rate.currency.iso3));

      const allCategorizedCodes = [...new Set([...popularCodes, ...asianCodes, ...europeanCodes, ...middleEastCodes])];
      const others = allRates.filter(rate => !allCategorizedCodes.includes(rate.currency.iso3));

      setPopularCurrencies(popular);
      setAsianCurrencies(asian);
      setEuropeanCurrencies(european);
      setMiddleEastCurrencies(middleEast);
      setOtherCurrencies(others);
    } else {
        setPopularCurrencies([]);
        setAsianCurrencies([]);
        setEuropeanCurrencies([]);
        setMiddleEastCurrencies([]);
        setOtherCurrencies([]);
    }
  }, [forexData]);

  const handleRefresh = async () => {
    toast({
      title: "Refreshing data",
      description: "Fetching the latest forex rates...",
    });
    // Invalidate and refetch queries for the current selected date
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['forexRates', selectedDateString] }),
      queryClient.invalidateQueries({ queryKey: ['previousDayRates', selectedDateString] })
    ]);
  };

  const ratesData: RatesData | undefined = forexData;
  const rates: Rate[] = ratesData?.rates || [];

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedDate(subDays(selectedDate, 1));
    } else {
      const nextDate = addDays(selectedDate, 1);
      // Prevent navigating past today's date
      if (nextDate <= new Date()) {
        setSelectedDate(nextDate);
      }
    }
  };

  const downloadContentAsImage = async () => {
    const targetElementId = viewMode === 'table' ? 'forex-table-container' : 'forex-grid-container';
    const targetElement = document.getElementById(targetElementId);

    if (!targetElement) {
        toast({
            title: "Error",
            description: "Content for download not found.",
            variant: "destructive",
        });
        return;
    }

    // Create a temporary wrapper to include the title and footer for both views
    const wrapper = document.createElement('div');
    wrapper.style.width = 'fit-content'; // Adjust width based on content
    wrapper.style.padding = '40px';
    wrapper.style.backgroundColor = 'white';
    wrapper.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center'; // Center the content

    // Title for the image
    const titleEl = document.createElement('h1');
    titleEl.style.textAlign = 'center';
    titleEl.style.fontSize = '32px';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.marginBottom = '30px';
    titleEl.style.color = '#1f2937';
    titleEl.style.whiteSpace = 'pre-wrap'; // Allows line breaks
    titleEl.innerHTML = `Foreign Exchange Rates as Per Nepal Rastra Bank\nfor ${formatDateLong(selectedDate)}`;
    wrapper.appendChild(titleEl);

    // Clone the actual content (table or grid)
    const contentClone = targetElement.cloneNode(true) as HTMLElement;
    contentClone.style.fontSize = '16px'; // Standardize font size for image
    // Ensure grid layout works well for image by potentially adjusting column count if too wide
    if (viewMode === 'grid') {
        contentClone.style.display = 'grid';
        contentClone.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))'; // Adjust as needed
        contentClone.style.gap = '20px'; // Adjust gap
        contentClone.style.width = '1200px'; // Fixed width for consistent image output
        contentClone.style.padding = '20px';
    } else {
        contentClone.style.width = '1200px'; // Fixed width for table
        contentClone.style.padding = '20px';
    }
    wrapper.appendChild(contentClone);

    // Footer
    const footer = document.createElement('div');
    footer.style.marginTop = '30px';
    footer.style.textAlign = 'center';
    footer.style.fontSize = '14px';
    footer.style.color = '#6b7280';
    footer.style.width = '100%'; // Ensure footer stretches if needed

    const source = document.createElement('p');
    source.style.marginBottom = '10px';
    source.style.fontWeight = '600';
    const lastUpdated = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    source.textContent = `Source: Nepal Rastra Bank (NRB) | Last updated: ${lastUpdated}`;
    footer.appendChild(source);

    const disclaimer = document.createElement('p');
    disclaimer.style.fontStyle = 'italic';
    disclaimer.style.fontSize = '12px';
    disclaimer.textContent = 'Rates are subject to change. Please verify with your financial institution before conducting transactions.';
    footer.appendChild(disclaimer);

    const designer = document.createElement('p');
    designer.style.fontStyle = 'italic';
    designer.style.fontSize = '12px';
    designer.style.marginTop = '10px';
    designer.style.color = '#4b5563';
    designer.textContent = 'Data extraction and presentation designed by Grisma Bhandari';
    footer.appendChild(designer);

    wrapper.appendChild(footer);

    // Temporarily add to DOM to render for html2canvas
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(wrapper, {
        scale: 2, // High resolution
        backgroundColor: '#ffffff',
        width: wrapper.offsetWidth, // Use wrapper's actual rendered width
        height: wrapper.offsetHeight // Use wrapper's actual rendered height
      });

      const link = document.createElement('a');
      link.download = `forex-rates-${viewMode}-${format(selectedDate, 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({
        title: "Success",
        description: `${viewMode === 'table' ? 'Table' : 'Grid'} downloaded as image.`,
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Error",
        description: `Failed to download ${viewMode === 'table' ? 'table' : 'grid'} as image.`,
        variant: "destructive",
      });
    } finally {
      document.body.removeChild(wrapper); // Clean up
    }
  };


  // Helper function to render grid cards
  const renderGridCards = (currencyList: Rate[]) => (
    <div id="forex-grid-container" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {isLoading || isLoadingPrevDay ? ( // Indicate loading for prev day rates too
        Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
        ))
      ) : (
        currencyList.map((rate, index) => (
          <CurrencyCard
            key={rate.currency.iso3}
            rate={rate}
            index={index}
            previousDayRates={previousDayRates} // Pass previous rates here
          />
        ))
      )}
    </div>
  );

  return (
    <Layout>
      <div className="py-12 px-4 sm:px-6 lg:px-8 transition-all duration-500">
        <div className="max-w-7xl mx-auto">
          {/* 404 Header */}
           <div className="text-center mb-12 animate-fade-in p-8 bg-red-50 border border-red-200 rounded-lg">
             <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
             <h1 className="text-4xl font-bold text-destructive mb-4">Page Not Found (404)</h1>
             <p className="text-xl text-red-700 max-w-3xl mx-auto mb-6">
                We couldn't find the page you were looking for.
             </p>
             <Button asChild>
                <Link to="/">Go to Homepage</Link>
             </Button>
           </div>
          
           {/* Separator */}
           <div className="relative my-12">
             <div className="absolute inset-0 flex items-center" aria-hidden="true">
               <div className="w-full border-t border-gray-300" />
             </div>
             <div className="relative flex justify-center">
               <span className="bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 px-4 text-sm text-gray-500">
                 Or see today's rates below
               </span>
             </div>
           </div>

          {/* Main Title with Date Navigation - Fixed heights */}
          <div className="text-center mb-8 min-h-[100px]">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              Foreign Exchange Rates as Per Nepal Rastra Bank
            </h2>
            <div className="flex items-center justify-center gap-2 h-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDate('prev')}
                title="Previous Day"
                className="group relative"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
                <span className="absolute hidden group-hover:block -top-8 px-2 py-1 bg-gray-700 text-white text-xs rounded-md whitespace-nowrap">
                  Previous Day
                </span>
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-center text-left font-normal group relative",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <span className="text-lg font-semibold text-gray-700">
                      {formatDateLong(selectedDate)}
                    </span>
                    <span className="absolute hidden group-hover:block -top-8 px-2 py-1 bg-gray-700 text-white text-xs rounded-md whitespace-nowrap">
                      Click to change date
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateChange}
                    initialFocus
                    captionLayout="dropdown-buttons" // For month/year dropdowns
                    fromYear={2000} // Start year
                    toYear={new Date().getFullYear()} // End year
                    disabled={(date) => date > new Date()} // Disable future dates
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDate('next')}
                title="Next Day"
                className="group relative"
                disabled={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')} // Disable if already today
              >
                <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
                <span className="absolute hidden group-hover:block -top-8 px-2 py-1 bg-gray-700 text-white text-xs rounded-md whitespace-nowrap">
                  Next Day
                </span>
              </Button>
            </div>
          </div>


          {/* Action buttons (Share, Download, Refresh, View Mode) - Fixed positioning */}
          <div className="flex flex-wrap justify-end items-center mb-6 gap-2 min-h-[40px]">
            <div className="overflow-x-auto flex-shrink-0">
              <ShareButtons 
                title={`Nepal Rastra Bank Forex Rates for ${formatDateLong(selectedDate)}`}
                className="flex-nowrap"
              />
            </div>
            <Button
              onClick={downloadContentAsImage}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-primary hover:text-primary-foreground hover:bg-primary transition-colors h-10"
              disabled={isLoading || rates.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download Image</span>
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-primary hover:text-primary-foreground hover:bg-primary transition-colors h-10"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-1 flex shadow-sm h-10">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="rounded-md h-8"
              >
                <List className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Table</span>
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-md h-8"
              >
                <Grid3X3 className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Grid</span>
              </Button>
            </div>
          </div>


          {/* Ticker component */}
          <ForexTicker rates={rates} previousDayRates={previousDayRates} isLoading={isLoading || isLoadingPrevDay} />

          <Tabs defaultValue="all" className="mb-12">
            {/* Scrollable TabsList */}
            <div className="w-full overflow-x-auto pb-2 mb-8 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <TabsList className={cn(
                  "mb-0 w-max bg-white/80 backdrop-blur-sm border border-gray-100",
                  "sm:w-full sm:inline-flex"
                )}>
                <TabsTrigger value="all">All Currencies</TabsTrigger>
                <TabsTrigger value="popular">Popular</TabsTrigger>
                <TabsTrigger value="asian">Asian</TabsTrigger>
                <TabsTrigger value="european">European</TabsTrigger>
                <TabsTrigger value="middle-east">Middle East</TabsTrigger>
                <TabsTrigger value="other">Other</TabsTrigger>
              </TabsList>
            </div>


            {/* TabsContent sections */}
            <TabsContent value="all" className="animate-fade-in">
              {viewMode === 'table' ? (
                <div id="forex-table-container">
                  <ForexTable rates={rates} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
                </div>
              ) : (
                renderGridCards(rates)
              )}
            </TabsContent>

            <TabsContent value="popular" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable rates={popularCurrencies} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
              ) : (
                renderGridCards(popularCurrencies)
              )}
            </TabsContent>

            <TabsContent value="asian" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable rates={asianCurrencies} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
              ) : (
                 renderGridCards(asianCurrencies)
              )}
            </TabsContent>

            <TabsContent value="european" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable rates={europeanCurrencies} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
              ) : (
                 renderGridCards(europeanCurrencies)
              )}
            </TabsContent>

            <TabsContent value="middle-east" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable rates={middleEastCurrencies} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
              ) : (
                 renderGridCards(middleEastCurrencies)
              )}
            </TabsContent>

             <TabsContent value="other" className="animate-fade-in">
               {viewMode === 'table' ? (
                 <ForexTable rates={otherCurrencies} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
               ) : (
                  renderGridCards(otherCurrencies)
               )}
             </TabsContent>
          </Tabs>

          {/* Info and AdSense sections */}
           <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 mb-8 border border-gray-100">
             <h2 className="text-xl font-semibold mb-3 text-gray-900">About Nepal's Foreign Exchange Rates</h2>
             <p className="text-gray-600 leading-relaxed">
               The foreign exchange rates displayed here are the official rates published by Nepal Rastra Bank (NRB),
               Nepal's central bank. These rates are primarily influenced by Nepal's trade relationships, remittance flows,
               and the country's foreign exchange reserves. The Nepalese Rupee (NPR) is pegged to the Indian Rupee (INR)
               at a fixed rate, while other currency rates fluctuate based on international market conditions and Nepal's
               economic fundamentals. These rates are used by banks, financial institutions, and money exchangers across Nepal
               for foreign currency transactions.
             </p>
           </div>

           <AdSense client="ca-pub-XXXXXXXXXXXXXXXX" slot="XXXXXXXXXX" />

        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
