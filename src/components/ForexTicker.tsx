import { useEffect, useRef, memo } from 'react';
import { Rate } from '../types/forex';
import { getFlagEmoji } from '../services/forexService';

interface ForexTickerProps {
  rates: Rate[];
  isLoading: boolean;
}

const ForexTicker = memo(({ rates, isLoading }: ForexTickerProps) => {
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tickerRef.current && rates.length > 0) {
      // Clone the ticker content for seamless looping
      const originalContent = tickerRef.current.innerHTML;
      tickerRef.current.innerHTML = originalContent + originalContent;
    }
  }, [rates]);

  if (isLoading) {
    return (
      <div className="h-12 w-full bg-gradient-to-r from-gray-100 to-gray-200 animate-shimmer rounded-lg">
        <div className="h-full shimmer-effect rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden glassmorphism rounded-xl animate-scale-in mb-6">
      <div className="overflow-hidden relative h-12">
        <div 
          ref={tickerRef}
          className="whitespace-nowrap animate-ticker-scroll flex items-center h-full text-base font-medium px-4"
        >
          {rates.map((rate, index) => (
            <span key={index} className="inline-flex items-center mx-4">
              <span className="text-lg mr-1">{getFlagEmoji(rate.currency.iso3)}</span>
              <span className="text-forex-indigo font-semibold">{rate.currency.iso3}:</span>
              <span className="ml-1">
                <span className="text-forex-green">{rate.buy}</span>
                <span className="mx-1">/</span>
                <span className="text-forex-red">{rate.sell}</span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

ForexTicker.displayName = 'ForexTicker';

export default ForexTicker;
