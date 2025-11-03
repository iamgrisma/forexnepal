import { Rate } from '../types/forex';
import { getFlagEmoji } from '../services/forexService'; // Assuming getFlagIcon uses this or similar logic for flags
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react'; // Import trend icons
import { cn } from "@/lib/utils"; // Import cn utility
import { memo } from 'react';

interface CurrencyCardProps {
  rate: Rate;
  index: number;
  previousDayRates?: Rate[]; // Add previousDayRates prop
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
  const diff = currentValue - prevValue;
  const percentageChange = prevValue !== 0 ? (diff / prevValue) * 100 : null;


  // Handle division by unit for correct comparison if needed, assuming unit affects rates directly
  const prevValuePerUnit = prevValue / (prevRate.currency.unit || 1);
  const currentValuePerUnit = currentValue / (currentRate.currency.unit || 1);
  const diffPerUnit = currentValuePerUnit - prevValuePerUnit;
   const percentageChangePerUnit = prevValuePerUnit !== 0 ? (diffPerUnit / prevValuePerUnit) * 100 : null;


  return {
    value: Math.abs(diffPerUnit), // Show difference per unit
    isIncrease: diffPerUnit > 0 ? true : diffPerUnit < 0 ? false : null,
    percentage: percentageChangePerUnit // Show percentage change per unit
  };
};


const CurrencyCard = memo(({ rate, index, previousDayRates }: CurrencyCardProps) => {
  const navigate = useNavigate();
  const currency = rate.currency;
  // Use a consistent flag method - assuming getFlagEmoji provides the class or emoji
  const flagClass = `fi fi-${currency.iso3.toLowerCase() === 'eur' ? 'eu' : currency.iso3.substring(0, 2).toLowerCase()}`; // Example using flag-icons class

  const animationDelay = `${index * 50}ms`;

  const handleCardClick = () => {
    navigate(`/historical-data/${currency.iso3}`);
  };

  // Calculate trends
  const buyChange = getRateChange(rate, previousDayRates, 'buy');
  const sellChange = getRateChange(rate, previousDayRates, 'sell');

  return (
    <div
      className={`animated-border bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.03] hover:border-blue-300 cursor-pointer animate-fade-in transform group`}
      style={{ animationDelay }}
      onClick={handleCardClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Use span for flag icons */}
          <span className={`text-3xl ${flagClass}`}></span>
          <div>
            <div className="text-xs font-semibold text-blue-700 px-2 py-0.5 bg-blue-100 rounded-full mb-1 inline-block">
              {currency.iso3}
            </div>
            <h3 className="font-semibold text-base text-gray-800 group-hover:text-blue-600 transition-colors leading-tight">
              {currency.name}
            </h3>
          </div>
        </div>
        <div className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
          Unit: {currency.unit}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Buy Rate */}
        <div className="text-center bg-green-50 rounded-lg p-3 border border-green-100 group-hover:bg-green-100 transition-colors">
          <div className="text-xs font-medium text-green-700 uppercase mb-1">Buy</div>
          <div className="font-bold text-lg text-green-800 mb-1">
            {rate.buy}
          </div>
          {/* Buy Trend */}
          {buyChange.isIncrease !== null && (
            <div className={cn(
                "flex items-center justify-center text-xs",
                buyChange.isIncrease ? 'text-green-600' : 'text-red-600'
             )}>
              {buyChange.isIncrease ? (
                <TrendingUp className="h-3 w-3 mr-0.5" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-0.5" />
              )}
              <span>{buyChange.value.toFixed(2)}</span>
              {buyChange.percentage !== null && (
                 <span className="ml-1">({buyChange.percentage.toFixed(1)}%)</span>
              )}
            </div>
          )}
        </div>

        {/* Sell Rate */}
        <div className="text-center bg-red-50 rounded-lg p-3 border border-red-100 group-hover:bg-red-100 transition-colors">
          <div className="text-xs font-medium text-red-700 uppercase mb-1">Sell</div>
          <div className="font-bold text-lg text-red-800 mb-1">
            {rate.sell}
          </div>
          {/* Sell Trend */}
          {sellChange.isIncrease !== null && (
            <div className={cn(
               "flex items-center justify-center text-xs",
               sellChange.isIncrease ? 'text-green-600' : 'text-red-600'
            )}>
              {sellChange.isIncrease ? (
                <TrendingUp className="h-3 w-3 mr-0.5" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-0.5" />
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
