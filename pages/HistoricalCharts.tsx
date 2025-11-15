import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchForexRates, formatDate } from '../services/forexService';
import { Rate, RatesData } from '../types/forex';
import { Input } from '@/components/ui/input';
import { Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';
import CurrencyCard from '@/components/CurrencyCard';
import ForexTicker from '@/components/ForexTicker';
import ShareButtons from '@/components/ShareButtons';
import FlagIcon from './FlagIcon';
// FIX: Import d1 service and date-fns
import { fetchRatesForDateWithCache } from '../services/d1ForexService';
// FIX: Added 'format' to the import
import { subDays, format } from 'date-fns';

const HistoricalCharts = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [previousDayRates, setPreviousDayRates] = useState<Rate[]>([]);
  const navigate = useNavigate();

  // FIX: Use 'format' from date-fns for consistency
  const todayString = format(new Date(), 'yyyy-MM-dd');
  const previousDateString = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const { data: forexData, isLoading } = useQuery({
    queryKey: ['forexRates', todayString],
    queryFn: () => fetchRatesForDateWithCache(todayString, null), // Use caching service
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15,
  });

  // FIX: Add query for previous day's rates
  const {
    data: prevDayData,
    isLoading: isLoadingPrevDay,
  } = useQuery({
    queryKey: ['previousDayRates', todayString],
    queryFn: () => fetchRatesForDateWithCache(previousDateString, null),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60,
  });

  // FIX: Set previous day rates from the new query
  useEffect(() => {
    if (prevDayData?.rates) {
      setPreviousDayRates(prevDayData.rates);
    } else {
      setPreviousDayRates([]);
    }
  }, [prevDayData]);


  const rates: Rate[] = forexData?.rates || [];
  
  const filteredRates = rates.filter(rate => 
    rate.currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rate.currency.iso3.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCurrencyClick = (rate: Rate) => {
    navigate(`/historical-data/${rate.currency.iso3}`);
  };

  // FIX: Combine loading states
  const isTickerLoading = isLoading || isLoadingPrevDay;

  return (
    <Layout>
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Historical Forex Data</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              View historical exchange rate trends and download charts for any currency.
            </p>
          </div>

          {/* Ticker component - FIX: Pass previousDayRates and combined loading state */}
          <ForexTicker
            rates={rates}
            previousDayRates={previousDayRates}
            isLoading={isTickerLoading}
          />

          {/* Share Buttons */}
          <div className="flex justify-center my-6"> {/* Added my-6 for spacing */}
            <ShareButtons 
              title="Historical Forex Data - Nepal Rastra Bank"
              className="flex-nowrap"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                type="text"
                placeholder="Search currency..."
                className="pl-10 pr-4 py-2 bg-white/90 backdrop-blur-sm border-gray-200 focus:ring-blue-500 rounded-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isLoading ? (
              Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
              ))
            ) : filteredRates.length > 0 ? (
              filteredRates.map((rate, index) => (
                <div key={rate.currency.iso3} onClick={() => handleCurrencyClick(rate)} className="cursor-pointer">
                  {/* FIX: Pass previousDayRates to CurrencyCard as well */}
                  <CurrencyCard
                    rate={rate}
                    index={index}
                    previousDayRates={previousDayRates}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">No currencies found matching your search</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HistoricalCharts;
