import React, { useMemo } from 'react';
import { Rate } from '../types/forex';
import { Skeleton } from '@/components/ui/skeleton';
import { getFlagEmoji } from '@/services/forexService';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSiteSettings } from './Layout'; // Import the hook

interface ForexTickerProps {
  rates: Rate[];
  isLoading: boolean;
}

const TickerItem: React.FC<{ rate: Rate, prevRate?: Rate }> = React.memo(({ rate, prevRate }) => {
  const unit = rate.currency.unit || 1;
  const buy = Number(rate.buy) / unit;
  const prevBuy = prevRate ? (Number(prevRate.buy) / (prevRate.currency.unit || 1)) : 0;
  const change = prevRate ? buy - prevBuy : 0;

  const color = change > 0.001 ? 'text-green-500' : change < -0.001 ? 'text-red-500' : 'text-gray-500';
  const Icon = change > 0.001 ? TrendingUp : change < -0.001 ? TrendingDown : Minus;

  return (
    // FIX: Add padding to space out items
    <div className="flex items-center space-x-2 flex-shrink-0 px-4">
      <span className="text-lg">{getFlagEmoji(rate.currency.iso3)}</span>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">
          {rate.currency.iso3}
        </span>
        <span className="text-xs text-muted-foreground">
          {buy.toFixed(2)}
        </span>
      </div>
      <div className={`flex items-center text-xs ${color}`}>
        <Icon className="h-4 w-4 mr-0.5" />
        {change.toFixed(2)}
      </div>
    </div>
  );
});

const ForexTicker: React.FC<ForexTickerProps> = ({ rates, isLoading }) => {
  const { ticker_enabled } = useSiteSettings(); // Get the setting

  // Use a map for quick lookups
  const rateMap = useMemo(() => {
    return new Map(rates.map(rate => [rate.currency.iso3, rate]));
  }, [rates]);

  // Define major currencies for the ticker
  const tickerCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SAR', 'AED', 'QAR', 'JPY', 'MYR', 'KRW', 'INR'];

  const tickerRates = useMemo(() => {
    return tickerCurrencies
      .map(iso3 => rateMap.get(iso3))
      .filter((rate): rate is Rate => !!rate);
  }, [rateMap, tickerCurrencies]);

  // --- CLS FIX & ANIMATION FIX ---
  // Always render the container to prevent CLS
  return (
    // FIX: Parent is 'flex' and 'overflow-hidden'
    <div className="w-full bg-card border-b relative overflow-hidden h-12 flex items-center group">
      
      {/* Show skeleton inside if loading and enabled */}
      {isLoading && ticker_enabled && (
        <Skeleton className="h-12 w-full" />
      )}
      
      {/* Show ticker content if not loading, enabled, and rates exist */}
      {!isLoading && ticker_enabled && rates && rates.length > 0 && (
        <>
          {/* FIX: Both children get the animation.
            'min-w-full' makes sure each child tries to be 100% width.
            'flex-shrink-0' stops them from shrinking to fit.
            'justify-around' spaces the items out within the full width.
            'group-hover:[animation-play-state:paused]' is the correct class to pause on hover.
          */}
          <div className="animate-ticker-scroll group-hover:[animation-play-state:paused] flex-shrink-0 flex items-center justify-around min-w-full">
            {tickerRates.map(rate => (
              <TickerItem key={rate.currency.iso3} rate={rate} prevRate={undefined} />
            ))}
          </div>
          {/* Duplicate for seamless scroll */}
          <div className="animate-ticker-scroll group-hover:[animation-play-state:paused] flex-shrink-0 flex items-center justify-around min-w-full" aria-hidden="true">
            {tickerRates.map(rate => (
              <TickerItem key={`${rate.currency.iso3}-dup`} rate={rate} prevRate={undefined} />
            ))}
          </div>
        </>
      )}
      {/* If disabled or no rates, the h-12 container still renders, but it's empty, preventing layout shift. */}
    </div>
  );
  // --- END OF FIXES ---
};

export default ForexTicker;
