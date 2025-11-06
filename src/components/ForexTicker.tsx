import React, { useMemo } from 'react';
import { Rate } from '../types/forex';
import { Skeleton } from '@/components/ui/skeleton';
import { getFlagEmoji } from '@/services/forexService';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSiteSettings } from './Layout';
import { cn } from "@/lib/utils";

interface ForexTickerProps {
  rates: Rate[];
  previousDayRates: Rate[]; // Now required
  isLoading: boolean;
}

/**
 * A small component to render the change indicator (arrow + amount)
 */
const TrendIndicator: React.FC<{ change: number }> = ({ change }) => {
  // Use a small epsilon for floating point comparison
  const epsilon = 0.0001;
  const color = change > epsilon ? 'text-green-600' : change < -epsilon ? 'text-red-600' : 'text-gray-500';
  const Icon = change > epsilon ? TrendingUp : change < -epsilon ? TrendingDown : Minus;
  
  // Don't show number if change is effectively zero
  if (change < epsilon && change > -epsilon) {
    return (
      <span className={cn("flex items-center text-xs", color)}>
        <Icon className="h-3 w-3" />
      </span>
    );
  }

  return (
    <span className={cn("flex items-center text-xs", color)}>
      <Icon className="h-3 w-3 mr-0.5" />
      {change.toFixed(2)}
    </span>
  );
};


/**
 * The individual item in the ticker, now with the new design.
 */
const TickerItem: React.FC<{ rate: Rate, prevRate?: Rate }> = React.memo(({ rate, prevRate }) => {
  const unit = rate.currency.unit || 1;
  const buy = Number(rate.buy);
  const sell = Number(rate.sell);
  
  const prevBuy = prevRate ? Number(prevRate.buy) : 0;
  const prevSell = prevRate ? Number(prevRate.sell) : 0;
  const prevUnit = prevRate?.currency.unit || 1;

  // Calculate change *per unit*
  const buyChange = prevRate ? (buy / unit) - (prevBuy / prevUnit) : 0;
  const sellChange = prevRate ? (sell / unit) - (prevSell / prevUnit) : 0;

  return (
    <div className="flex items-center space-x-3 flex-shrink-0 px-4 py-2">
      <span className="text-2xl">{getFlagEmoji(rate.currency.iso3)}</span>
      <div className="flex flex-col items-start">
        <span className="text-sm font-semibold text-foreground">
          {rate.currency.iso3} 
          <span className="text-xs font-normal text-muted-foreground ml-1">
            (Unit {unit})
          </span>
        </span>
        <div className="flex items-baseline space-x-3">
          {/* Buy Rate */}
          <div className="flex items-baseline">
            <span className="text-xs text-muted-foreground mr-1">Buy:</span>
            <span className="text-sm font-medium text-green-700">{buy.toFixed(2)}</span>
            {/* Show trend indicator only if prevRate was available */}
            {prevRate && <span className="ml-1"><TrendIndicator change={buyChange} /></span>}
          </div>
          {/* Sell Rate */}
          <div className="flex items-baseline">
            <span className="text-xs text-muted-foreground mr-1">Sell:</span>
            <span className="text-sm font-medium text-red-700">{sell.toFixed(2)}</span>
            {prevRate && <span className="ml-1"><TrendIndicator change={sellChange} /></span>}
          </div>
        </div>
      </div>
    </div>
  );
});

const ForexTicker: React.FC<ForexTickerProps> = ({ rates, previousDayRates, isLoading }) => {
  const { ticker_enabled } = useSiteSettings(); // Get the setting

  // Create maps for today's and previous day's rates for fast lookups
  const rateMap = useMemo(() => {
    return new Map(rates.map(rate => [rate.currency.iso3, rate]));
  }, [rates]);
  
  const prevRateMap = useMemo(() => {
    return new Map(previousDayRates.map(rate => [rate.currency.iso3, rate]));
  }, [previousDayRates]);

  // Define major currencies for the ticker
  const tickerCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SAR', 'AED', 'QAR', 'JPY', 'MYR', 'KRW'];

  // Build the list of rates to display, including previous rates
  const tickerRates = useMemo(() => {
    return tickerCurrencies
      .map(iso3 => {
        const rate = rateMap.get(iso3);
        const prevRate = prevRateMap.get(iso3);
        if (!rate) return null;
        return { rate, prevRate };
      })
      .filter((item): item is { rate: Rate, prevRate?: Rate } => !!item);
  }, [rateMap, prevRateMap, tickerCurrencies]);


  // Always render the container to prevent CLS
  return (
    // Parent is 'flex' and 'overflow-hidden'. Height is h-16 to fit two lines.
    <div className="w-full bg-card border-b relative overflow-hidden h-16 flex items-center group">
      
      {/* Show skeleton inside if loading and enabled */}
      {isLoading && ticker_enabled && (
        <Skeleton className="h-16 w-full" />
      )}
      
      {/* Show ticker content if not loading, enabled, and rates exist */}
      {!isLoading && ticker_enabled && rates && rates.length > 0 && (
        // FIX: This single parent div gets the animation
        <div className="flex animate-ticker-scroll group-hover:[animation-play-state:paused]">
          {/* Child 1: The first set of rates */}
          <div className="flex-shrink-0 flex items-center">
            {tickerRates.map(({ rate, prevRate }) => (
              <TickerItem key={rate.currency.iso3} rate={rate} prevRate={prevRate} />
            ))}
          </div>
          {/* Child 2: The duplicate set for a seamless loop */}
          <div className="flex-shrink-0 flex items-center" aria-hidden="true">
            {tickerRates.map(({ rate, prevRate }) => (
              <TickerItem key={`${rate.currency.iso3}-dup`} rate={rate} prevRate={prevRate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ForexTicker;
