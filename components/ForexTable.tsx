import { useState, useMemo, memo, useCallback } from 'react';
import { Rate } from '../types/forex';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import FlagIcon from '@/pages/FlagIcon'; // Import the FlagIcon component

interface ForexTableProps {
  rates: Rate[];
  isLoading: boolean;
  title: string;
  previousDayRates?: Rate[];
}

const ForexTable = memo(({ rates, isLoading, title, previousDayRates = [] }: ForexTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'ascending' | 'descending';
  } | null>(null);
  const navigate = useNavigate();

  // Filter the rates based on search term - memoized
  const filteredRates = useMemo(() => 
    rates.filter(rate => 
      rate.currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rate.currency.iso3.toLowerCase().includes(searchTerm.toLowerCase())
    ), [rates, searchTerm]
  );

  // Sorting logic - memoized
  const sortedRates = useMemo(() => {
    return [...filteredRates].sort((a, b) => {
      if (!sortConfig) return 0;
      
      let valueA, valueB;
      
      switch (sortConfig.key) {
        case 'name':
          valueA = a.currency.name;
          valueB = b.currency.name;
          break;
        case 'unit':
          valueA = a.currency.unit;
          valueB = b.currency.unit;
          break;
        case 'buy':
          valueA = a.buy;
          valueB = b.buy;
          break;
        case 'sell':
          valueA = a.sell;
          valueB = b.sell;
          break;
        default:
          valueA = a.currency.iso3;
          valueB = b.currency.iso3;
      }
      
      if (valueA < valueB) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (valueA > valueB) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredRates, sortConfig]);

  const requestSort = useCallback((key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  const getSortIndicator = useCallback((key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  }, [sortConfig]);

  const handleCurrencyClick = useCallback((rate: Rate) => {
    navigate(`/historical-data/${rate.currency.iso3}`);
  }, [navigate]);

  // Function to get rate change from previous day - memoized
  const getRateChange = useCallback((currentRate: Rate, type: 'buy' | 'sell'): { difference: number, percentChange: number, trend: 'increase' | 'decrease' | 'stable' } | null => {
    if (!previousDayRates || previousDayRates.length === 0) {
      return null;
    }
    
    const prevRate = previousDayRates.find(
      rate => rate.currency.iso3 === currentRate.currency.iso3
    );
    
    if (!prevRate) {
      return null;
    }
    
    // --- UPDATED: Normalize by unit for calculation ---
    const prevValue = parseFloat(prevRate[type].toString()) / (prevRate.currency.unit || 1);
    const currentValue = parseFloat(currentRate[type].toString()) / (currentRate.currency.unit || 1);
    
    // --- Difference per unit ---
    const difference = Number((currentValue - prevValue).toFixed(4)); 
    
    const percentChange = (prevValue > 0) ? (difference / prevValue) * 100 : 0;
    
    return {
      difference, // This is per-unit difference
      percentChange,
      trend: difference > 0.0001 ? 'increase' : difference < -0.0001 ? 'decrease' : 'stable'
    };
  }, [previousDayRates]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 min-h-[500px]">
        <div className="h-10 bg-gray-200 rounded w-3/4 mx-auto"></div>
        <div className="h-12 bg-gray-200 rounded"></div>
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-scale-in">
      <h3 className="text-2xl font-semibold text-center mb-6 text-primary">{title}</h3>
      
      <div className="relative mb-6">
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
      
      <div className="overflow-x-auto glassmorphism rounded-xl animate-blur-in">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-300">
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                SN
              </th>
              <th
                className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => requestSort('name')}
              >
                Currency Name (ISO3){getSortIndicator('name')}
              </th>
              <th
                className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => requestSort('unit')}
              >
                Unit{getSortIndicator('unit')}
              </th>
              <th
                className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => requestSort('buy')}
              >
                Buying Rate{getSortIndicator('buy')}
              </th>
              <th
                className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => requestSort('sell')}
              >
                Selling Rate{getSortIndicator('sell')}
              </th>
              {previousDayRates && previousDayRates.length > 0 && (
                <>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Buy Trend (Per Unit)
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
                    Sell Trend (Per Unit)
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white/60 backdrop-blur-sm">
            {sortedRates.length > 0 ? (
              sortedRates.map((rate, index) => {
                const buyChange = getRateChange(rate, 'buy');
                const sellChange = getRateChange(rate, 'sell');
                
                return (
                  <tr 
                    key={rate.currency.iso3} 
                    className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-700">
                      <button 
                        onClick={() => handleCurrencyClick(rate)}
                        className="flex items-center hover:text-primary transition-colors focus:outline-none"
                      >
                        {/* --- CORRECT: Uses FlagIcon component --- */}
                        <FlagIcon iso3={rate.currency.iso3} className="text-xl mr-3" />
                        <span className="font-medium">{rate.currency.name} ({rate.currency.iso3})</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-700">
                      {rate.currency.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-forex-green">
                      {rate.buy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-forex-red">
                      {rate.sell}
                    </td>
                    {previousDayRates && previousDayRates.length > 0 && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-base">
                          {buyChange ? (
                            <div className="flex items-center">
                              {buyChange.trend === 'increase' ? (
                                <TrendingUp className="h-4 w-4 text-forex-green mr-1" />
                              ) : buyChange.trend === 'decrease' ? (
                                <TrendingDown className="h-4 w-4 text-forex-red mr-1" />
                              ) : (
                                <Minus className="h-4 w-4 text-gray-400 mr-1" />
                              )}
                              <span className={cn(
                                buyChange.trend === 'increase' && 'text-forex-green',
                                buyChange.trend === 'decrease' && 'text-forex-red',
                                buyChange.trend === 'stable' && 'text-gray-400'
                              )}>
                                {/* --- UPDATED: Show per-unit diff --- */}
                                {buyChange.difference > 0 ? '+' : ''}{buyChange.difference.toFixed(2)} 
                                ({buyChange.percentChange > 0 ? '+' : ''}{buyChange.percentChange.toFixed(2)}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base">
                          {sellChange ? (
                            <div className="flex items-center">
                              {sellChange.trend === 'increase' ? (
                                <TrendingUp className="h-4 w-4 text-forex-green mr-1" />
                              ) : sellChange.trend === 'decrease' ? (
                                <TrendingDown className="h-4 w-4 text-forex-red mr-1" />
                              ) : (
                                <Minus className="h-4 w-4 text-gray-400 mr-1" />
                              )}
                              <span className={cn(
                                sellChange.trend === 'increase' && 'text-forex-green',
                                sellChange.trend === 'decrease' && 'text-forex-red',
                                sellChange.trend === 'stable' && 'text-gray-400'
                              )}>
                                {/* --- UPDATED: Show per-unit diff --- */}
                                {sellChange.difference > 0 ? '+' : ''}{sellChange.difference.toFixed(2)} 
                                ({sellChange.percentChange > 0 ? '+' : ''}{sellChange.percentChange.toFixed(2)}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={previousDayRates && previousDayRates.length > 0 ? 7 : 5} className="px-6 py-4 text-center text-sm text-gray-500">
                  No currencies found matching your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

ForexTable.displayName = 'ForexTable';

export default ForexTable;
