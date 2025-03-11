
import { useState } from 'react';
import { Rate } from '../types/forex';
import { getFlagEmoji } from '../services/forexService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface ForexTableProps {
  rates: Rate[];
  isLoading: boolean;
  title: string;
}

const ForexTable = ({ rates, isLoading, title }: ForexTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'ascending' | 'descending';
  } | null>(null);

  // Filter the rates based on search term
  const filteredRates = rates.filter(rate => 
    rate.currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rate.currency.iso3.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sorting logic
  const sortedRates = [...filteredRates].sort((a, b) => {
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

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
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
      <h3 className="text-2xl font-semibold text-center mb-6 text-forex-blue">{title}</h3>
      
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
            <tr className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                SN
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-forex-blue transition-colors"
                onClick={() => requestSort('name')}
              >
                Currency Name (ISO3){getSortIndicator('name')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-forex-blue transition-colors"
                onClick={() => requestSort('unit')}
              >
                Unit{getSortIndicator('unit')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-forex-blue transition-colors"
                onClick={() => requestSort('buy')}
              >
                Buying Rate{getSortIndicator('buy')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-forex-blue transition-colors"
                onClick={() => requestSort('sell')}
              >
                Selling Rate{getSortIndicator('sell')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white/60 backdrop-blur-sm">
            {sortedRates.length > 0 ? (
              sortedRates.map((rate, index) => (
                <tr 
                  key={rate.currency.iso3} 
                  className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex items-center">
                      <span className="text-xl mr-2">{getFlagEmoji(rate.currency.iso3)}</span>
                      <span>{rate.currency.name} ({rate.currency.iso3})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {rate.currency.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-forex-green">
                    {rate.buy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-forex-red">
                    {rate.sell}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  No currencies found matching your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ForexTable;
