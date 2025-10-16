
import { Rate } from '../types/forex';
import { getFlagEmoji } from '../services/forexService';
import { useNavigate } from 'react-router-dom';

interface CurrencyCardProps {
  rate: Rate;
  index: number;
  previousDayRates?: Rate[];
}

const CurrencyCard = ({ rate, index, previousDayRates }: CurrencyCardProps) => {
  const navigate = useNavigate();
  const currency = rate.currency;
  const flagEmoji = getFlagEmoji(currency.iso3);
  
  const animationDelay = `${index * 50}ms`;

  const handleCardClick = () => {
    navigate(`/historical-data/${currency.iso3}`);
  };

  const getRateChange = (type: 'buy' | 'sell') => {
    if (!previousDayRates) return null;
    
    const prevRate = previousDayRates.find(r => r.currency.iso3 === currency.iso3);
    if (!prevRate) return null;
    
    const currentValue = typeof rate[type] === 'number' ? rate[type] : parseFloat(rate[type]);
    const previousValue = typeof prevRate[type] === 'number' ? prevRate[type] : parseFloat(prevRate[type]);
    const diff = currentValue - previousValue;
    
    if (diff === 0) return null;
    
    const trend = diff > 0 ? '📈' : '📉';
    const changeColor = diff > 0 ? 'text-green-600' : 'text-red-600';
    
    return (
      <span className={`text-xs ${changeColor} ml-1`}>
        {trend} {Math.abs(diff).toFixed(4)}
      </span>
    );
  };

  return (
    <div
      className={`animated-border bg-white/90 backdrop-blur-md border-2 border-gray-200 rounded-2xl p-6 transition-all duration-300
        hover:shadow-2xl hover:scale-105 hover:border-blue-400 cursor-pointer animate-fade-in transform group`}
      style={{ animationDelay }}
      onClick={handleCardClick}
    >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-3xl mr-3">
              <span className={`fi fi-${currency.iso3.toLowerCase() === 'eur' ? 'eu' : currency.iso3.substring(0, 2).toLowerCase()}`}></span>
            </span>
            <div>
              <div className="text-xs font-semibold text-blue-700 px-3 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-full mb-2 inline-block shadow-sm">
                {currency.iso3}
              </div>
              <h3 className="font-semibold text-base text-gray-900 group-hover:text-blue-600 transition-colors">{currency.name}</h3>
            </div>
          </div>
          <div className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-lg">
            {currency.unit} {currency.unit > 1 ? 'units' : 'unit'}
          </div>
        </div>
        
        <div className="mt-6 flex justify-between gap-4">
          <div className="flex-1 text-center bg-green-50 rounded-xl p-3 border border-green-200 group-hover:bg-green-100 transition-colors">
            <div className="text-xs font-semibold text-green-700 uppercase mb-1 tracking-wide">Buy</div>
            <div className="font-bold text-xl text-green-700">
              {rate.buy}
              {getRateChange('buy')}
            </div>
          </div>

          <div className="flex-1 text-center bg-red-50 rounded-xl p-3 border border-red-200 group-hover:bg-red-100 transition-colors">
            <div className="text-xs font-semibold text-red-700 uppercase mb-1 tracking-wide">Sell</div>
            <div className="font-bold text-xl text-red-700">
              {rate.sell}
              {getRateChange('sell')}
            </div>
          </div>
        </div>
    </div>
  );
};

export default CurrencyCard;
