import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchForexRates, fetchPreviousDayRates, formatDateLong } from '../services/forexService';
import { Rate, RatesData } from '../types/forex';
import ForexTable from '../components/ForexTable';
import ForexTicker from '../components/ForexTicker';
import CurrencyCard from '../components/CurrencyCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Gitlab, TrendingUp, List, Grid3X3 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Layout from '@/components/Layout';

const Index = () => {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [popularCurrencies, setPopularCurrencies] = useState<Rate[]>([]);
  const [asianCurrencies, setAsianCurrencies] = useState<Rate[]>([]);
  const [europeanCurrencies, setEuropeanCurrencies] = useState<Rate[]>([]);
  const [middleEastCurrencies, setMiddleEastCurrencies] = useState<Rate[]>([]);
  const [otherCurrencies, setOtherCurrencies] = useState<Rate[]>([]);
  const [previousDayRates, setPreviousDayRates] = useState<Rate[]>([]);
  const { toast } = useToast();
  
  const { 
    data: forexData, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['forexRates'],
    queryFn: fetchForexRates,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const { 
    data: prevDayData,
    isLoading: isPrevDayLoading,
  } = useQuery({
    queryKey: ['previousDayRates'],
    queryFn: fetchPreviousDayRates,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  useEffect(() => {
    if (isError && error instanceof Error) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);
  
  useEffect(() => {
    if (prevDayData?.data?.payload?.[0]?.rates) {
      setPreviousDayRates(prevDayData.data.payload[0].rates);
    }
  }, [prevDayData]);
  
  useEffect(() => {
    if (forexData?.data?.payload?.[0]?.rates) {
      const allRates = forexData.data.payload[0].rates;
      
      // Define currency categories
      const popularCodes = ['USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CHF'];
      const asianCodes = ['JPY', 'CNY', 'SGD', 'HKD', 'MYR', 'KRW', 'THB', 'INR'];
      const europeanCodes = ['EUR', 'GBP', 'CHF', 'SEK', 'DKK'];
      const middleEastCodes = ['SAR', 'QAR', 'AED', 'KWD', 'BHD', 'OMR'];
      
      // Filter rates to get categorized currencies
      const popular = allRates.filter(rate => popularCodes.includes(rate.currency.iso3));
      const asian = allRates.filter(rate => asianCodes.includes(rate.currency.iso3));
      const european = allRates.filter(rate => europeanCodes.includes(rate.currency.iso3));
      const middleEast = allRates.filter(rate => middleEastCodes.includes(rate.currency.iso3));
      
      // Other currencies (not in any other category)
      const allCategorizedCodes = [...new Set([...popularCodes, ...asianCodes, ...europeanCodes, ...middleEastCodes])];
      const others = allRates.filter(rate => !allCategorizedCodes.includes(rate.currency.iso3));
      
      setPopularCurrencies(popular);
      setAsianCurrencies(asian);
      setEuropeanCurrencies(european);
      setMiddleEastCurrencies(middleEast);
      setOtherCurrencies(others);
    }
  }, [forexData]);

  const handleRefresh = async () => {
    toast({
      title: "Refreshing data",
      description: "Fetching the latest forex rates...",
    });
    await refetch();
  };

  const ratesData: RatesData | undefined = forexData?.data?.payload?.[0];
  const rates: Rate[] = ratesData?.rates || [];
  
  let title = "Foreign Exchange Rates";
  if (ratesData?.date) {
    const headerDate = new Date(ratesData.date);
    title = `Foreign Exchange Rates as Per Nepal Rastra Bank for ${formatDateLong(headerDate)}`;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8 transition-all duration-500">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center justify-center bg-blue-100 text-forex-blue px-3 py-1 rounded-full text-sm font-medium mb-4">
              <Gitlab className="h-4 w-4 mr-1" />
              <span>Live Forex Data</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Nepal Rastra Bank</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Track real-time foreign exchange rates with beautiful visualizations and seamless updates.
            </p>
          </div>
          
          <div className="flex justify-end mb-6">
            <Button 
              onClick={handleRefresh} 
              variant="outline"
              className="flex items-center gap-2 mr-4 text-forex-blue hover:text-white hover:bg-forex-blue transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-1 flex">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="rounded-md"
              >
                <List className="h-4 w-4 mr-1" />
                Table
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-md"
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Grid
              </Button>
            </div>
          </div>
          
          {/* Ticker component */}
          <ForexTicker rates={rates} isLoading={isLoading} />
          
          <Tabs defaultValue="all" className="mb-12">
            <TabsList className="mb-8 w-full lg:w-auto bg-white/80 backdrop-blur-sm border border-gray-100">
              <TabsTrigger value="all">All Currencies</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="asian">Asian</TabsTrigger>
              <TabsTrigger value="european">European</TabsTrigger>
              <TabsTrigger value="middle-east">Middle East</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable 
                  rates={rates} 
                  isLoading={isLoading} 
                  title={title} 
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {isLoading ? (
                    Array.from({ length: 9 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    rates.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="popular" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable 
                  rates={popularCurrencies} 
                  isLoading={isLoading} 
                  title="Popular Foreign Currencies" 
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    popularCurrencies.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="asian" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable 
                  rates={asianCurrencies} 
                  isLoading={isLoading} 
                  title="Asian Currencies" 
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    asianCurrencies.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="european" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable 
                  rates={europeanCurrencies} 
                  isLoading={isLoading} 
                  title="European Currencies" 
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    europeanCurrencies.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="middle-east" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable 
                  rates={middleEastCurrencies} 
                  isLoading={isLoading} 
                  title="Middle East Currencies" 
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    middleEastCurrencies.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="other" className="animate-fade-in">
              {viewMode === 'table' ? (
                <ForexTable 
                  rates={otherCurrencies} 
                  isLoading={isLoading} 
                  title="Other Currencies" 
                  previousDayRates={previousDayRates}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))
                  ) : (
                    otherCurrencies.map((rate, index) => (
                      <CurrencyCard key={rate.currency.iso3} rate={rate} index={index} />
                    ))
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <footer className="text-center text-gray-500 text-sm mt-12 pt-6 border-t border-gray-100">
            <p>Data provided by Nepal Rastra Bank API</p>
            <p className="mt-2">© {new Date().getFullYear()} Forex Tracker</p>
          </footer>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
