import { Rate } from '../types/forex';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'; 
import { cn } from "@/lib/utils"; 
import { memo } from 'react';
import FlagIcon from '@/pages/FlagIcon'; // Import the FlagIcon component

interface CurrencyCardProps {
  rate: Rate;
  index: number;
  previousDayRates?: Rate[]; 
}

// Function to get rate change from previous day (can be moved to utils if needed elsewhere)
const getRateChange = (currentRate: Rate, previousDayRates: Rate[] | undefined, type: 'buy' | 'sell'): { value: number, isIncrease: boolean | null, percentage: number | null } => {
  if (!previousDayRates || previousDayRates.length === 0) {
    return { value: 0, isIncrease: null, percentage: null };
  }

  const prevRate = previousDayRates.find(
    rate => rate.currency.iso3 === currentRate.currency.iso3
  );

  if (!prevRate) {
    return { value: 0, isIncrease: null, percentage: null };
  }

  const prevValue = parseFloat(prevRate[type].toString());
  const currentValue = parseFloat(currentRate[type].toString());

  // Handle division by unit for correct comparison
  const prevValuePerUnit = prevValue / (prevRate.currency.unit || 1);
  const currentValuePerUnit = currentValue / (currentRate.currency.unit || 1);
  const diffPerUnit = currentValuePerUnit - prevValuePerUnit;
  const percentageChangePerUnit = prevValuePerUnit !== 0 ? (diffPerUnit / prevValuePerUnit) * 100 : null;

  // Use a small epsilon to avoid floating point issues with zero
  const epsilon = 0.00001;

  return {
    value: Math.abs(diffPerUnit), // Show difference per unit
    isIncrease: diffPerUnit > epsilon ? true : diffPerUnit < -epsilon ? false : null,
    percentage: percentageChangePerUnit // Show percentage change per unit
  };
};


const CurrencyCard = memo(({ rate, index, previousDayRates }: CurrencyCardProps) => {
  const navigate = useNavigate();
  const currency = rate.currency;
  
  const animationDelay = `${index * 50}ms`;

  const handleCardClick = () => {
    navigate(`/historical-data/${currency.iso3}`);
  };

  // Calculate trends
  const buyChange = getRateChange(rate, previousDayRates, 'buy');
  const sellChange = getRateChange(rate, previousDayRates, 'sell');

  return (
    <div
      // --- UPDATED: Added h-52 and flex classes for uniform height ---
      className={cn(
        `animated-border bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.03] hover:border-blue-300 cursor-pointer animate-fade-in transform group`,
        "h-52 flex flex-col justify-between" // Enforce uniform height
      )}
      style={{ animationDelay }}
      onClick={handleCardClick}
    >
      {/* --- UPDATED: Card Header Layout --- */}
      <div className="flex items-center gap-3">
        <FlagIcon iso3={currency.iso3} className="text-3xl" />
        <div className="flex-1 min-w-0"> {/* Wrapper to allow truncation */}
          <h3 className="font-semibold text-base text-gray-800 group-hover:text-blue-600 transition-colors leading-tight truncate">
            {currency.name}
          </h3>
          <div className="text-sm font-medium text-gray-600">
            {currency.iso3} {currency.unit}
          </div>
        </div>
      </div>
      {/* --- END UPDATED HEADER --- */}


      <div className="grid grid-cols-2 gap-3">
        {/* Buy Rate - UPDATED: Larger padding and fonts */}
        <div className="text-center bg-green-100 rounded-lg p-4 border border-green-200 group-hover:bg-green-200/60 transition-colors">
          <div className="text-sm font-medium text-green-800 uppercase mb-1">Buy</div>
          <div className="font-bold text-xl text-green-900 mb-1">
            {rate.buy}
          </div>
          {/* Buy Trend */}
          {buyChange.isIncrease !== null && (
            <div className={cn(
                "flex items-center justify-center text-sm", // text-xs -> text-sm
                buyChange.isIncrease ? 'text-green-700' : 'text-red-700'
             )}>
              {buyChange.isIncrease ? (
                <TrendingUp className="h-4 w-4 mr-0.5" /> // h-3/w-3 -> h-4/w-4
              ) : (
                <TrendingDown className="h-4 w-4 mr-0.5" />
              )}
              <span>{buyChange.value.toFixed(2)}</span>
              {buyChange.percentage !== null && (
                 <span className="ml-1">({buyChange.percentage.toFixed(1)}%)</span>
              )}
            </div>
          )}
        </div>

        {/* Sell Rate - UPDATED: Larger padding and fonts */}
        <div className="text-center bg-red-100 rounded-lg p-4 border border-red-200 group-hover:bg-red-200/60 transition-colors">
          <div className="text-sm font-medium text-red-800 uppercase mb-1">Sell</div>
          <div className="font-bold text-xl text-red-900 mb-1">
            {rate.sell}
          </div>
          {/* Sell Trend */}
          {sellChange.isIncrease !== null && (
            <div className={cn(
               "flex items-center justify-center text-sm", // text-xs -> text-sm
               sellChange.isIncrease ? 'text-green-700' : 'text-red-700'
            )}>
              {sellChange.isIncrease ? (
                <TrendingUp className="h-4 w-4 mr-0.5" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-0.5" />
              )}
              <span>{sellChange.value.toFixed(2)}</span>
               {sellChange.percentage !== null && (
                 <span className="ml-1">({sellChange.percentage.toFixed(1)}%)</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

CurrencyCard.displayName = 'CurrencyCard';

export default CurrencyCard;
