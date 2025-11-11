import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateLong } from '../services/forexService'; // Keep helpers
import { Rate, RatesData } from '../types/forex';
import ForexTable from '../components/ForexTable';
import CurrencyCard from '../components/CurrencyCard';
import ForexTicker from '../components/ForexTicker';
import ShareButtons from '@/components/ShareButtons';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Gitlab, List, Grid3X3, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Layout from '@/components/Layout';
import AdSense from '@/components/AdSense';
import html2canvas from 'html2canvas';
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, addDays } from 'date-fns';
// --- TASK 4: Import DB-First Service ---
import { fetchRatesForDateWithCache } from '../services/d1ForexService'; 
// --- END TASK 4 ---

// --- NEW: Import getFlagEmoji ---
import { getFlagEmoji } from '../services/forexService';

const Index = () => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [popularCurrencies, setPopularCurrencies] = useState<Rate[]>([]);
  const [asianCurrencies, setAsianCurrencies] = useState<Rate[]>([]);
  const [europeanCurrencies, setEuropeanCurrencies] = useState<Rate[]>([]);
  const [middleEastCurrencies, setMiddleEastCurrencies] = useState<Rate[]>([]);
  const [otherCurrencies, setOtherCurrencies] = useState<Rate[]>([]);
  const [previousDayRates, setPreviousDayRates] = useState<Rate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();

  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const previousDateString = format(subDays(selectedDate, 1), 'yyyy-MM-dd');

  // --- TASK 4: Use fetchRatesForDateWithCache (DB-First) ---
  const {
    data: forexData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['forexRates', selectedDateString],
    queryFn: () => fetchRatesForDateWithCache(selectedDateString, null), // Use DB-First service
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  // --- TASK 4: Use fetchRatesForDateWithCache for Prev Day (DB-First) ---
  const {
    data: prevDayData,
    isLoading: isLoadingPrevDay,
  } = useQuery({
    queryKey: ['previousDayRates', selectedDateString], // Keyed to selectedDate to refetch together
    queryFn: () => fetchRatesForDateWithCache(previousDateString, null), // Use DB-First service
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
  // --- END TASK 4 ---

  useEffect(() => {
    if (isError && error instanceof Error) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);

  // Update previousDayRates state when data loads
  useEffect(() => {
    if (prevDayData?.rates) {
      setPreviousDayRates(prevDayData.rates);
    } else {
      setPreviousDayRates([]); // Clear if no data
    }
  }, [prevDayData]);

  // Use forexData if available
  const displayData: RatesData | undefined = forexData;

  useEffect(() => {
    // --- UPDATE: Use displayData ---
    if (displayData?.rates) {
      const allRates = displayData.rates;

      const popularCodes = ['USD', 'EUR', 'GBP', 'AUD', 'JPY', 'CHF'];
      const asianCodes = ['JPY', 'CNY', 'SGD', 'HKD', 'MYR', 'KRW', 'THB', 'INR'];
      const europeanCodes = ['EUR', 'GBP', 'CHF', 'SEK', 'DKK'];
      const middleEastCodes = ['SAR', 'QAR', 'AED', 'KWD', 'BHD', 'OMR'];

      const popular = allRates.filter(rate => popularCodes.includes(rate.currency.iso3));
      const asian = allRates.filter(rate => asianCodes.includes(rate.currency.iso3));
      const european = allRates.filter(rate => europeanCodes.includes(rate.currency.iso3));
      const middleEast = allRates.filter(rate => middleEastCodes.includes(rate.currency.iso3));

      const allCategorizedCodes = [...new Set([...popularCodes, ...asianCodes, ...europeanCodes, ...middleEastCodes])];
      const others = allRates.filter(rate => !allCategorizedCodes.includes(rate.currency.iso3));

      setPopularCurrencies(popular);
      setAsianCurrencies(asian);
      setEuropeanCurrencies(european);
      setMiddleEastCurrencies(middleEast);
      setOtherCurrencies(others);
    } else {
        setPopularCurrencies([]);
        setAsianCurrencies([]);
        setEuropeanCurrencies([]);
        setMiddleEastCurrencies([]);
        setOtherCurrencies([]);
    }
  }, [displayData]); // --- UPDATE: Depend on displayData ---

  const handleRefresh = async () => {
    toast({
      title: "Refreshing data",
      description: "Fetching the latest forex rates...",
    });
    // Invalidate and refetch queries for the current selected date
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['forexRates', selectedDateString] }),
      queryClient.invalidateQueries({ queryKey: ['previousDayRates', selectedDateString] })
    ]);
  };
  
  const rates: Rate[] = displayData?.rates || [];
  const hasNoData = !isLoading && (!rates || rates.length === 0);


  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedDate(subDays(selectedDate, 1));
    } else {
      const nextDate = addDays(selectedDate, 1);
      // Prevent navigating past today's date
      if (nextDate <= new Date()) {
        setSelectedDate(nextDate);
      }
    }
  };

  // --- 
  // --- 
  // --- START: CORRECTED FUNCTION ---
  // --- 
  // --- 
  const downloadContentAsImage = async () => {
    // 1. Determine which rates to render
    const ratesToRender: Rate[] = rates; // Use all 22 rates

    if (!ratesToRender || ratesToRender.length === 0) {
      toast({
        title: "Error",
        description: "No data to download.",
        variant: "destructive",
      });
      return;
    }

    // --- Helper function to get trend data ---
    const getTrend = (currentRate: Rate, type: 'buy' | 'sell'): { diff: number, trend: 'increase' | 'decrease' | 'stable' } => {
      const prevRate = previousDayRates.find(r => r.currency.iso3 === currentRate.currency.iso3);
      if (!prevRate) { // Return stable with 0 diff if no prev rate
        return { diff: 0, trend: 'stable' }; 
      }
      
      const prevValue = parseFloat(prevRate[type].toString()) / (prevRate.currency.unit || 1);
      const currentValue = parseFloat(currentRate[type].toString()) / (currentRate.currency.unit || 1);
      const diff = currentValue - prevValue;
      
      const trend = diff > 0.0001 ? 'increase' : (diff < -0.0001 ? 'decrease' : 'stable');
      return { diff, trend };
    };

    // 2. Create a wrapper for the image content
    const wrapper = document.createElement('div');
    // --- FIX: Set explicit width for wrapper in BOTH modes ---
    wrapper.style.width = '2400px'; 
    wrapper.style.padding = '40px';
    wrapper.style.backgroundColor = '#FFFFFF'; // Solid white background
    wrapper.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.boxSizing = 'border-box';


    // 3. Add High-Contrast Title
    const titleEl = document.createElement('h1');
    titleEl.style.textAlign = 'center';
    titleEl.style.fontSize = '60px'; 
    titleEl.style.fontWeight = '700';
    titleEl.style.marginBottom = '40px';
    titleEl.style.color = '#111827'; // Dark text
    titleEl.style.lineHeight = '1.2';
    const displayDate = displayData ? new Date(displayData.date) : selectedDate;
    titleEl.innerHTML = `Foreign Exchange Rate by NRB for ${formatDateLong(displayDate)}`;
    wrapper.appendChild(titleEl);

    // 4. Re-build content based on viewMode
    if (viewMode === 'table') {
      // Split rates into two columns (11 rates each)
      const midpoint = Math.ceil(ratesToRender.length / 2); // 22 -> 11
      const column1Rates = ratesToRender.slice(0, midpoint);
      const column2Rates = ratesToRender.slice(midpoint);

      const tableContainer = document.createElement('div');
      tableContainer.style.display = 'flex';
      tableContainer.style.flexDirection = 'row';
      tableContainer.style.gap = '20px';
      tableContainer.style.width = '100%';

      const buildTable = (ratesList: Rate[], snOffset: number) => {
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontFamily = 'sans-serif';

        // Create Table Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.backgroundColor = '#F3F4F6'; // Solid light gray
        const headers = ['SN', 'Currency', 'Unit', 'Buying Rate', 'Selling Rate', 'Buy Trend', 'Sell Trend'];
        headers.forEach(headerText => {
          const th = document.createElement('th');
          th.textContent = headerText;
          th.style.padding = '20px';
          th.style.fontSize = '22px';
          th.style.fontWeight = '600';
          th.style.textAlign = 'left';
          th.style.color = '#1F2937'; // Dark text
          th.style.borderBottom = '2px solid #D1D5DB';
          if (['Unit', 'Buying Rate', 'Selling Rate', 'Buy Trend', 'Sell Trend'].includes(headerText)) {
              th.style.textAlign = 'right';
          }
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create Table Body
        const tbody = document.createElement('tbody');
        ratesList.forEach((rate, index) => {
          const tr = document.createElement('tr');
          if (index % 2 === 1) tr.style.backgroundColor = '#F9FAFB'; // Zebra striping

          // SN
          const tdSn = document.createElement('td');
          tdSn.textContent = (index + 1 + snOffset).toString();
          
          // Currency
          const tdCurrency = document.createElement('td');
          tdCurrency.innerHTML = `<span style="font-size: 32px; margin-right: 16px; vertical-align: middle;">${getFlagEmoji(rate.currency.iso3)}</span> <span style="vertical-align: middle;">${rate.currency.name} (${rate.currency.iso3})</span>`;
          tdCurrency.style.fontWeight = '600';
          tdCurrency.style.color = '#111827';
          
          // Unit
          const tdUnit = document.createElement('td');
          tdUnit.textContent = rate.currency.unit.toString();
          tdUnit.style.textAlign = 'right';

          // Buy Rate
          const tdBuy = document.createElement('td');
          tdBuy.textContent = rate.buy.toFixed(2);
          tdBuy.style.color = '#15803D'; // Dark green
          tdBuy.style.fontWeight = '700';
          tdBuy.style.textAlign = 'right';
          
          // Sell Rate
          const tdSell = document.createElement('td');
          tdSell.textContent = rate.sell.toFixed(2);
          tdSell.style.color = '#B91C1C'; // Dark red
          tdSell.style.fontWeight = '700';
          tdSell.style.textAlign = 'right';

          // Trends
          const buyTrend = getTrend(rate, 'buy');
          const sellTrend = getTrend(rate, 'sell');
          
          const tdBuyTrend = document.createElement('td');
          const tdSellTrend = document.createElement('td');
          
          [tdBuyTrend, tdSellTrend].forEach((td, i) => {
              const trendData = i === 0 ? buyTrend : sellTrend;
              if (trendData.trend === 'increase') {
                  td.innerHTML = `<span style="color: #16A34A;">▲ ${trendData.diff.toFixed(2)}</span>`;
              } else if (trendData.trend === 'decrease') {
                  td.innerHTML = `<span style="color: #DC2626;">▼ ${trendData.diff.toFixed(2)}</span>`;
              } else {
                  td.innerHTML = `<span style="color: #6B7280;">—</span>`;
              }
              td.style.fontWeight = '600';
              td.style.textAlign = 'right';
          });

          [tdSn, tdCurrency, tdUnit, tdBuy, tdSell, tdBuyTrend, tdSellTrend].forEach(td => {
              td.style.padding = '18px 20px';
              td.style.borderBottom = '1px solid #E5E7EB';
              td.style.fontSize = '22px';
              td.style.verticalAlign = 'middle';
              tr.appendChild(td);
          });
          
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
      };

      tableContainer.appendChild(buildTable(column1Rates, 0));
      tableContainer.appendChild(buildTable(column2Rates, column1Rates.length));
      wrapper.appendChild(tableContainer);

    } else { // viewMode === 'grid'
      const gridContainer = document.createElement('div');
      gridContainer.style.display = 'flex'; // Use flex column to stack rows
      gridContainer.style.flexDirection = 'column';
      gridContainer.style.gap = '24px';
      gridContainer.style.width = '100%'; // Will be 100% of 2400px wrapper
      gridContainer.style.boxSizing = 'border-box';
      
      const numColumns = 6;
      const gap = 24;
      // --- FIX: Calculate explicit pixel width based on 2400px wrapper ---
      const totalGapWidth = gap * (numColumns - 1); // 24 * 5 = 120
      const cardWidthPx = (2400 - totalGapWidth) / numColumns; // (2400 - 120) / 6 = 380px
      // ---

      // --- Helper to build a single card ---
      const buildGridCard = (rate: Rate) => {
        const card = document.createElement('div');
        card.style.border = '2px solid #E5E7EB';
        card.style.borderRadius = '16px'; 
        card.style.padding = '24px'; 
        card.style.backgroundColor = '#FFFFFF';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '20px'; 
        card.style.boxSizing = 'border-box';
        card.style.height = '280px'; 
        card.style.justifyContent = 'space-between'; 
        // --- FIX: Use explicit pixel width ---
        card.style.flexBasis = `${cardWidthPx}px`;
        card.style.flexGrow = '0';
        card.style.flexShrink = '0';
        // ---

        // Card Header
        const cardHeader = document.createElement('div');
        cardHeader.style.display = 'flex';
        cardHeader.style.alignItems = 'center';
        cardHeader.style.gap = '12px'; 
        
        cardHeader.innerHTML = `
          <span style="font-size: 48px; vertical-align: middle;">${getFlagEmoji(rate.currency.iso3)}</span>
          <div style="display: flex; flex-direction: column; justify-content: center; flex: 1; min-width: 0;">
            <h3 style="font-weight: 700; font-size: 22px; color: #000000; line-height: 1.3; margin: 0; word-wrap: break-word;">${rate.currency.name}</h3>
            <div style="font-size: 18px; font-weight: 600; color: #1D4ED8; margin-top: 4px;">
              ${rate.currency.iso3} (${rate.currency.unit})
            </div>
          </div>
        `;
        
        // Card Body (Buy/Sell)
        const cardBody = document.createElement('div');
        cardBody.style.display = 'grid';
        cardBody.style.gridTemplateColumns = '1fr 1fr';
        cardBody.style.gap = '12px';
        
        const buyTrend = getTrend(rate, 'buy');
        const sellTrend = getTrend(rate, 'sell');

        // Buy Box
        const buyBox = document.createElement('div');
        buyBox.style.backgroundColor = '#F0FDF4';
        buyBox.style.border = '1px solid #BBF7D0';
        buyBox.style.borderRadius = '8px';
        buyBox.style.padding = '12px';
        buyBox.style.textAlign = 'center';
        buyBox.innerHTML = `
          <div style="font-size: 16px; font-weight: 600; color: #166534; margin-bottom: 4px;">BUY</div>
          <div style="font-size: 26px; font-weight: 700; color: #15803D; margin-bottom: 4px;">${rate.buy.toFixed(2)}</div>
          <div style="font-size: 16px; font-weight: 600; color: ${buyTrend.trend === 'increase' ? '#16A34A' : buyTrend.trend === 'decrease' ? '#DC2626' : '#6B7280'};">
            ${buyTrend.trend === 'increase' ? `▲ +${buyTrend.diff.toFixed(2)}` : buyTrend.trend === 'decrease' ? `▼ ${buyTrend.diff.toFixed(2)}` : '—'}
          </div>
        `;

        // Sell Box
        const sellBox = document.createElement('div');
        sellBox.style.backgroundColor = '#FEF2F2';
        sellBox.style.border = '1px solid #FECACA';
        sellBox.style.borderRadius = '8px';
        sellBox.style.padding = '12px';
        sellBox.style.textAlign = 'center';
        sellBox.innerHTML = `
          <div style="font-size: 16px; font-weight: 600; color: #991B1B; margin-bottom: 4px;">SELL</div>
          <div style="font-size: 26px; font-weight: 700; color: #B91C1C; margin-bottom: 4px;">${rate.sell.toFixed(2)}</div>
          <div style="font-size: 16px; font-weight: 600; color: ${sellTrend.trend === 'increase' ? '#16A34A' : sellTrend.trend === 'decrease' ? '#DC2626' : '#6B7280'};">
            ${sellTrend.trend === 'increase' ? `▲ +${sellTrend.diff.toFixed(2)}` : sellTrend.trend === 'decrease' ? `▼ ${sellTrend.diff.toFixed(2)}` : '—'}
          </div>
        `;
        
        cardBody.appendChild(buyBox);
        cardBody.appendChild(sellBox);
        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        return card;
      };
      
      // --- Build the custom 6-6-6-4 grid ---
      
      // Helper for rows of 6 cards
      const buildCardRow = (ratesSlice: Rate[]) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '24px';
        row.style.width = '100%';
        row.style.flexWrap = 'nowrap'; // Ensure they stay in one row
        ratesSlice.forEach(rate => row.appendChild(buildGridCard(rate)));
        return row;
      };

      // Row 1 (6 items)
      gridContainer.appendChild(buildCardRow(ratesToRender.slice(0, 6)));

      // Row 2 (6 items)
      gridContainer.appendChild(buildCardRow(ratesToRender.slice(6, 12)));

      // Row 3 (6 items)
      gridContainer.appendChild(buildCardRow(ratesToRender.slice(12, 18)));
      
      // Row 4 (2 cards, 1 info box, 2 cards)
      const row4 = document.createElement('div');
      row4.style.display = 'flex';
      row4.style.gap = '24px';
      row4.style.width = '100%';
      row4.style.flexWrap = 'nowrap';
      row4.style.alignItems = 'stretch'; // Make items equal height

      // First 2 cards
      ratesToRender.slice(18, 20).forEach(rate => row4.appendChild(buildGridCard(rate)));
      
      // Info Box (occupying 2 spots)
      const infoBox = document.createElement('div');
      infoBox.style.padding = '30px';
      infoBox.style.backgroundColor = '#F0F4F8'; // Light Blue/Gray
      infoBox.style.border = '2px solid #D1D5DB';
      infoBox.style.borderRadius = '16px';
      infoBox.style.textAlign = 'center';
      infoBox.style.color = '#374151';
      infoBox.style.lineHeight = '1.6';
      infoBox.style.height = '280px'; // --- Match card height ---
      infoBox.style.boxSizing = 'border-box';
      // --- FIX: Calculate explicit pixel width for info box ---
      const infoBoxWidthPx = (cardWidthPx * 2) + gap; // (380 * 2) + 24 = 784px
      infoBox.style.flexBasis = `${infoBoxWidthPx}px`;
      infoBox.style.flexShrink = '0';
      // ---
      
      infoBox.style.display = 'flex';
      infoBox.style.flexDirection = 'column';
      infoBox.style.justifyContent = 'center';
      infoBox.style.alignItems = 'center';
      
      infoBox.innerHTML = `
        <p style="font-weight: 700; font-size: 26px; margin: 0; color: #111827; line-height: 1.3;">Foreign Exchange Rate for Nepal Published by Nepal Rastra Bank for ${formatDateLong(displayDate)}</p>
        <p style="font-size: 18px; margin: 12px 0 0 0; color: #4B5563; line-height: 1.5;">This data is generated using Nepal Rastra Bank ForexAPI. Data presentation, extraction and designed by Grisma | visit forex.grisma.com.np for more information.</p>
      `;
      row4.appendChild(infoBox);

      // Last 2 cards
      ratesToRender.slice(20, 22).forEach(rate => row4.appendChild(buildGridCard(rate)));
      
      gridContainer.appendChild(row4);
      wrapper.appendChild(gridContainer);
    }

    // 5. Add a high-contrast footer
    const footer = document.createElement('div');
    footer.style.marginTop = '40px';
    footer.style.textAlign = 'center';
    footer.style.width = '100%';
    footer.style.boxSizing = 'border-box';
    footer.style.padding = '20px';
    footer.style.borderTop = '2px solid #E5E7EB';

    const line1 = document.createElement('p');
    line1.style.fontWeight = '700';
    line1.style.fontSize = '26px';
    line1.style.margin = '0';
    line1.style.color = '#111827';
    line1.style.lineHeight = '1.3';
    line1.textContent = `Foreign Exchange Rate for Nepal Published by Nepal Rastra Bank for ${formatDateLong(displayDate)}`;
    footer.appendChild(line1);

    const line2 = document.createElement('p');
    line2.style.fontSize = '20px'; 
    line2.style.margin = '12px 0 0 0';
    line2.style.color = '#4B5563';
    line2.style.lineHeight = '1.5';
    line2.textContent = `This data is generated using Nepal Rastra Bank ForexAPI. Data presentation, extraction and designed by Grisma | visit forex.grisma.com.np for more information.`;
    footer.appendChild(line2);
    
    wrapper.appendChild(footer);

    // 6. Append to DOM (hidden) for rendering
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    document.body.appendChild(wrapper);

    // 7. Generate canvas and download as PNG
    try {
      toast({
        title: "Generating Image...",
        description: "This may take a few seconds for high resolution.",
      });

      const canvas = await html2canvas(wrapper, {
        // --- FIX: Use explicit 2400px width and remove height ---
        scale: 1, 
        backgroundColor: '#ffffff', 
        width: 2400,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `forex-rates-${viewMode}-${format(displayDate, 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png'); // Use PNG
      link.click();

      toast({
        title: "Success",
        description: `${viewMode === 'table' ? 'Table' : 'Grid'} downloaded as PNG image.`,
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Error",
        description: `Failed to download ${viewMode === 'table' ? 'Table' : 'grid'} as image.`,
        variant: "destructive",
      });
    } finally {
      document.body.removeChild(wrapper); // 8. Clean up
    }
  };
  // --- 
  // --- 
  // --- END: CORRECTED FUNCTION ---
  // --- 
  // --- 


  // Helper function to render grid cards
  const renderGridCards = (currencyList: Rate[]) => (
    <div id="forex-grid-container" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {isLoading || isLoadingPrevDay ? ( // Indicate loading for prev day rates too
        Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
        ))
      ) : (
        currencyList.map((rate, index) => (
          <CurrencyCard
            key={rate.currency.iso3}
            rate={rate}
            index={index}
            previousDayRates={previousDayRates} // Pass previous rates here
          />
        ))
      )}
    </div>
  );

  return (
    <Layout>
      <div className="py-12 px-4 sm:px-6 lg:px-8 transition-all duration-500">
        <div className="max-w-7xl mx-auto">
          {/* Header section - Fixed heights */}
          <div className="text-center mb-12 animate-fade-in min-h-[140px]">
            <div className="inline-flex items-center justify-center bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-4 h-8">
              <Gitlab className="h-4 w-4 mr-1" />
              <span>Live Forex Data</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Nepal Rastra Bank</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Track real-time foreign exchange rates with beautiful visualizations and seamless updates.
            </p>
          </div>

          {/* Main Title with Date Navigation - Fixed heights */}
          <div className="text-center mb-8 min-h-[100px]">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 truncate">
              Foreign Exchange Rates by NRB for {formatDateLong(displayData ? new Date(displayData.date) : selectedDate)}
            </h2>

            <div className="flex items-center justify-center gap-2 h-10 mt-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDate('prev')}
                title="Previous Day"
                className="group relative"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
                <span className="absolute hidden group-hover:block -top-8 px-2 py-1 bg-gray-700 text-white text-xs rounded-md whitespace-nowDrap">
                  Previous Day
                </span>
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-auto px-4 justify-center text-left font-normal group relative",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    {/* --- UPDATED: Removed formatting, just show date --- */}
                    <span className="text-lg font-semibold text-gray-700">
                      {format(displayData ? new Date(displayData.date) : selectedDate, 'MMMM d, yyyy')}
                    </span>
                    <span className="absolute hidden group-hover:block -top-8 px-2 py-1 bg-gray-700 text-white text-xs rounded-md whitespace-nowrap">
                      Click to change date
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateChange}
                    initialFocus
                    captionLayout="dropdown-buttons" // For month/year dropdowns
                    fromYear={2000} // Start year
                    toYear={new Date().getFullYear()} // End year
                    disabled={(date) => date > new Date()} // Disable future dates
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDate('next')}
                title="Next Day"
                className="group relative"
                disabled={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')} // Disable if already today
              >
                <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
                <span className="absolute hidden group-hover:block -top-8 px-2 py-1 bg-gray-700 text-white text-xs rounded-md whitespace-nowrap">
                  Next Day
                </span>
              </Button>
            </div>
          </div>


          {/* Action buttons (Share, Download, Refresh, View Mode) - Fixed positioning */}
          <div className="flex flex-wrap justify-end items-center mb-6 gap-2 min-h-[40px]">
            <div className="overflow-x-auto flex-shrink-0">
              <ShareButtons 
                title={`Nepal Rastra Bank Forex Rates for ${formatDateLong(displayData ? new Date(displayData.date) : selectedDate)}`}
                className="flex-nowrap"
              />
            </div>
            <Button
              onClick={downloadContentAsImage}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-primary hover:text-primary-foreground hover:bg-primary transition-colors h-10"
              disabled={isLoading || rates.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download Image</span>
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-primary hover:text-primary-foreground hover:bg-primary transition-colors h-10"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-1 flex shadow-sm h-10">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="rounded-md h-8"
              >
                <List className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Table</span>
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-md h-8"
              >
                <Grid3X3 className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Grid</span>
              </Button>
            </div>
          </div>


          {/* Ticker component */}
          <ForexTicker rates={rates} previousDayRates={previousDayRates} isLoading={isLoading || isLoadingPrevDay} />

          <Tabs defaultValue="all" className="mb-12">
            {/* Scrollable TabsList */}
            <div className="w-full overflow-x-auto pb-2 mb-8 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <TabsList className={cn(
                  "mb-0 w-max bg-white/80 backdrop-blur-sm border border-gray-100",
                  "sm:w-full sm:inline-flex"
                )}>
                <TabsTrigger value="all">All Currencies</TabsTrigger>
                <TabsTrigger value="popular">Popular</TabsTrigger>
                <TabsTrigger value="asian">Asian</TabsTrigger>
                <TabsTrigger value="european">European</TabsTrigger>
                <TabsTrigger value="middle-east">Middle East</TabsTrigger>
                <TabsTrigger value="other">Other</TabsTrigger>
              </TabsList>
            </div>


            {/* TabsContent sections */}
            <TabsContent value="all" className="animate-fade-in">
              {viewMode === 'table' ? (
                <div id="forex-table-container">
                  <ForexTable rates={rates} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
                </div>
              ) : (
                renderGridCards(rates)
              )}
            </TabsContent>

            <TabsContent value="popular" className="animate-fade-in">
              {viewMode === 'table' ? (
                <div id="forex-table-container">
                  <ForexTable rates={popularCurrencies} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
                </div>
              ) : (
                renderGridCards(popularCurrencies)
              )}
            </TabsContent>

            <TabsContent value="asian" className="animate-fade-in">
              {viewMode === 'table' ? (
                <div id="forex-table-container">
                  <ForexTable rates={asianCurrencies} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
                </div>
              ) : (
                 renderGridCards(asianCurrencies)
              )}
            </TabsContent>

            <TabsContent value="european" className="animate-fade-in">
              {viewMode === 'table' ? (
                <div id="forex-table-container">
                  <ForexTable rates={europeanCurrencies} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
                </div>
              ) : (
                 renderGridCards(europeanCurrencies)
              )}
            </TabsContent>

            <TabsContent value="middle-east" className="animate-fade-in">
              {viewMode === 'table' ? (
                <div id="forex-table-container">
                  <ForexTable rates={middleEastCurrencies} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
                </div>
              ) : (
                 renderGridCards(middleEastCurrencies)
              )}
            </TabsContent>

             <TabsContent value="other" className="animate-fade-in">
               {viewMode === 'table' ? (
                 <div id="forex-table-container">
                   <ForexTable rates={otherCurrencies} isLoading={isLoading || isLoadingPrevDay} title="" previousDayRates={previousDayRates} />
                 </div>
               ) : (
                  renderGridCards(otherCurrencies)
               )}
             </TabsContent>
          </Tabs>

          {/* Info and AdSense sections */}
           <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 mb-8 border border-gray-100">
             <h2 className="text-xl font-semibold mb-3 text-gray-900">About Nepal's Foreign Exchange Rates</h2>
             <p className="text-gray-600 leading-relaxed">
               The foreign exchange rates displayed here are the official rates published by Nepal Rastra Bank (NRB),
               Nepal's central bank. These rates are primarily influenced by Nepal's trade relationships, remittance flows,
               and the country's foreign exchange reserves. The Nepalese Rupee (NPR) is pegged to the Indian Rupee (INR)
               at a fixed rate, while other currency rates fluctuate based on international market conditions and Nepal's
               economic fundamentals. These rates are used by banks, financial institutions, and money exchangers across Nepal
               for foreign currency transactions.
             </p>
           </div>

           <AdSense client="ca-pub-5410507143596599" slot="2194448645" />

        </div>
      </div>
    </Layout>
  );
};

export default Index;
