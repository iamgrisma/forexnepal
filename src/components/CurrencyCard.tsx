
import { useState } from 'react';
import { Rate } from '../types/forex';
import { getFlagEmoji } from '../services/forexService';

interface CurrencyCardProps {
  rate: Rate;
  index: number;
}

const CurrencyCard = ({ rate, index }: CurrencyCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const currency = rate.currency;
  const flagEmoji = getFlagEmoji(currency.iso3);
  
  const animationDelay = `${index * 50}ms`;

  return (
    <div 
      className={`animated-border glassmorphism rounded-xl p-5 transition-all duration-300 
        hover:shadow-lg hover:translate-y-[-2px] cursor-pointer animate-fade-in transform`}
      style={{ animationDelay }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-3xl mr-3">{flagEmoji}</span>
          <div>
            <div className="text-xs font-medium text-forex-blue px-2 py-1 bg-blue-50 rounded-full mb-1 inline-block">
              {currency.iso3}
            </div>
            <h3 className="font-medium text-base">{currency.name}</h3>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {currency.unit} {currency.unit > 1 ? 'units' : 'unit'}
        </div>
      </div>
      
      <div className="mt-4 flex justify-between">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase mb-1">Buy</div>
          <div className={`font-semibold text-lg ${isHovered ? 'text-forex-green' : ''} transition-colors duration-300`}>
            {rate.buy}
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase mb-1">Sell</div>
          <div className={`font-semibold text-lg ${isHovered ? 'text-forex-red' : ''} transition-colors duration-300`}>
            {rate.sell}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrencyCard;
