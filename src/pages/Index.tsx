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

// --- NEW: Add FlagIcon map for image generation ---
const iso3ToIso2Map: { [key: string]: string } = {
  "USD": "us", "EUR": "eu", "GBP": "gb", "CHF": "ch", "AUD": "au",
  "CAD": "ca", "SGD": "sg", "JPY": "jp", "CNY": "cn", "SAR": "sa",
  "QAR": "qa", "THB": "th", "AED": "ae", "MYR": "my", "KRW": "kr",
  "SEK": "se", "DKK": "dk", "HKD": "hk", "KWD": "kw", "BHD": "bh",
  "OMR": "om", "INR": "in",
};
const getFlagClass = (iso3: string): string => {
  return iso3ToIso2Map[iso3?.toUpperCase()] || 'xx'; // 'xx' for unknown
};


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

  // --- THIS IS THE KEY FIX ---
  // Determine which data to display.
  // Use today's data (forexData) if it's available and has rates.
  // Otherwise, fall back to the previous day's data (prevDayData).
  const displayData: RatesData | undefined = 
    (forexData?.rates && forexData.rates.length > 0) 
    ? forexData 
    : prevDayData;
  // --- END OF FIX ---

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
  
  // --- UPDATE: Use displayData to populate rates ---
  const rates: Rate[] = displayData?.rates || [];
  // --- UPDATE: Check if the data being shown is from the fallback ---
  const isShowingFallback = (!forexData || forexData.rates.length === 0) && (prevDayData?.rates && prevDayData.rates.length > 0);


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
  // --- COMPLETELY REDESIGNED FUNCTION ---
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

    // --- NEW: Fetch flag-icon-css stylesheet ---
    let flagCss = '';
    try {
      flagCss = await fetch('https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/7.2.2/css/flag-icons.min.css')
        .then(res => res.text());
    } catch (e) {
      console.error("Could not fetch flag CSS", e);
      toast({
        title: "Warning",
        description: "Could not load flag icons for download. Image will be generated without them.",
      });
    }
    // --- END NEW ---

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
    // --- UPDATED: Set width to 2400px ---
    wrapper.style.width = '2400px'; 
    wrapper.style.padding = '40px';
    wrapper.style.backgroundColor = '#FFFFFF'; // Solid white background
    wrapper.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.boxSizing = 'border-box';

    // --- NEW: Inject fetched flag CSS ---
    if (flagCss) {
      const styleTag = document.createElement('style');
      styleTag.textContent = flagCss;
      wrapper.appendChild(styleTag);
    }
    // --- END NEW ---

    // 3. Add High-Contrast Title
    const titleEl = document.createElement('h1');
    titleEl.style.textAlign = 'center';
    titleEl.style.fontSize = '80px'; // Larger font for 2400px width
    titleEl.style.fontWeight = '700';
    titleEl.style.marginBottom = '40px';
    titleEl.style.color = '#111827'; // Dark text
    titleEl.style.lineHeight = '1.2';
    const displayDate = displayData ? new Date(displayData.date) : selectedDate;
    titleEl.innerHTML = `Foreign Exchange Rates<br/>As Per Nepal Rastra Bank<br/>for ${formatDateLong(displayDate)}`;
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
          th.style.padding = '16px';
          th.style.fontSize = '18px'; // Bigger font
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
          // --- UPDATED: Use flag-icon-css classes ---
          const flagClass = getFlagClass(rate.currency.iso3);
          tdCurrency.innerHTML = `<span style="font-size: 24px; margin-right: 12px; vertical-align: middle;"><span class="fi fi-${flagClass}"></span></span> <span style="vertical-align: middle;">${rate.currency.name} (${rate.currency.iso3})</span>`;
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
              td.style.padding = '14px 16px';
              td.style.borderBottom = '1px solid #E5E7EB';
              td.style.fontSize = '18px'; // Bigger font
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
      gridContainer.style.display = 'grid';
      gridContainer.style.gap = '24px';
      gridContainer.style.width = '100%';
      gridContainer.style.boxSizing = 'border-box';

      // --- Helper to build a single card ---
      const buildGridCard = (rate: Rate) => {
        const card = document.createElement('div');
        card.style.border = '2px solid #E5E7EB';
        card.style.borderRadius = '12px';
        card.style.padding = '16px';
        card.style.backgroundColor = '#FFFFFF';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '12px';
        card.style.boxSizing = 'border-box';

        // Card Header
        const cardHeader = document.createElement('div');
        cardHeader.style.display = 'flex';
        cardHeader.style.alignItems = 'center';
        cardHeader.style.gap = '12px';
        cardHeader.style.height = '60px';
        // --- UPDATED: Use flag-icon-css classes ---
        const flagClass = getFlagClass(rate.currency.iso3);
        cardHeader.innerHTML = `
          <span style="font-size: 32px; vertical-align: middle;"><span class="fi fi-${flagClass}"></span></span>
          <div style="display: flex; flex-direction: column; justify-content: center; flex: 1;">
            <div style="font-size: 14px; font-weight: 600; color: #1D4ED8; background: #DBEAFE; padding: 2px 8px; border-radius: 99px; display: inline-block; margin-bottom: 4px; width: fit-content;">${rate.currency.iso3}</div>
            <h3 style="font-weight: 700; font-size: 20px; color: #000000; line-height: 1.2; margin: 0;">${rate.currency.name}</h3>
          </div>
          <span style="font-size: 14px; font-weight: 500; color: #4B5563; background: #F3F4F6; padding: 4px 8px; border-radius: 6px; margin-left: auto; align-self: flex-start;">Unit: ${rate.currency.unit}</span>
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
          <div style="font-size: 14px; font-weight: 600; color: #166534; margin-bottom: 4px;">BUY</div>
          <div style="font-size: 22px; font-weight: 700; color: #15803D; margin-bottom: 4px;">${rate.buy.toFixed(2)}</div>
          <div style="font-size: 14px; font-weight: 600; color: ${buyTrend.trend === 'increase' ? '#16A34A' : buyTrend.trend === 'decrease' ? '#DC2626' : '#6B7280'};">
            ${buyTrend.trend === 'increase' ? `▲ ${buyTrend.diff.toFixed(2)}` : buyTrend.trend === 'decrease' ? `▼ ${buyTrend.diff.toFixed(2)}` : '—'}
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
          <div style="font-size: 14px; font-weight: 600; color: #991B1B; margin-bottom: 4px;">SELL</div>
          <div style="font-size: 22px; font-weight: 700; color: #B91C1C; margin-bottom: 4px;">${rate.sell.toFixed(2)}</div>
          <div style="font-size: 14px; font-weight: 600; color: ${sellTrend.trend === 'increase' ? '#16A34A' : sellTrend.trend === 'decrease' ? '#DC2626' : '#6B7280'};">
            ${sellTrend.trend === 'increase' ? `▲ ${sellTrend.diff.toFixed(2)}` : sellTrend.trend === 'decrease' ? `▼ ${sellTrend.diff.toFixed(2)}` : '—'}
          </div>
        `;
        
        cardBody.appendChild(buyBox);
        cardBody.appendChild(sellBox);
        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        return card;
      };
      
      // --- Build the custom 8-6-8 grid ---
      // Row 1 (8 items)
      const row1 = document.createElement('div');
      row1.style.display = 'grid';
      row1.style.gridTemplateColumns = 'repeat(4, 1fr) 40px repeat(4, 1fr)';
      row1.style.gap = '24px';
      row1.style.alignItems = 'stretch';
      ratesToRender.slice(0, 4).forEach(rate => row1.appendChild(buildGridCard(rate)));
      row1.appendChild(document.createElement('div')); // Spacer
      ratesToRender.slice(4, 8).forEach(rate => row1.appendChild(buildGridCard(rate)));
      gridContainer.appendChild(row1);

      // Row 2 (6 items + info box)
      const row2 = document.createElement('div');
      row2.style.display = 'grid';
      row2.style.gridTemplateColumns = 'repeat(3, 1fr) 2fr repeat(3, 1fr)'; // 3 cards, 1 info box (2fr wide), 3 cards
      row2.style.gap = '24px';
      row2.style.alignItems = 'center'; // Center items vertically
      ratesToRender.slice(8, 11).forEach(rate => row2.appendChild(buildGridCard(rate)));
      
      // Info Box
      const infoBox = document.createElement('div');
      infoBox.style.padding = '20px';
      infoBox.style.backgroundColor = '#F9FAFB';
      infoBox.style.border = '2px solid #E5E7EB';
      infoBox.style.borderRadius = '12px';
      infoBox.style.textAlign = 'center';
      infoBox.style.fontSize = '20px'; // Larger text
      infoBox.style.color = '#374151';
      infoBox.style.lineHeight = '1.6';
      infoBox.style.height = '100%';
      infoBox.style.display = 'flex';
      infoBox.style.flexDirection = 'column';
      infoBox.style.justifyContent = 'center';
      infoBox.style.alignItems = 'center';
      infoBox.style.boxSizing = 'border-box';
      infoBox.innerHTML = `
        <p style="font-weight: 600; margin: 0;">Forex Data from forex.grisma.com.np</p>
        <p style="font-size: 16px; margin: 8px 0;">using NRB API</p>
        <p style="font-size: 14px; color: #6B7280; margin: 0;">Generated and designed by Grisma.</p>
      `;
      row2.appendChild(infoBox);
      
      ratesToRender.slice(11, 14).forEach(rate => row2.appendChild(buildGridCard(rate)));
      gridContainer.appendChild(row2);

      // Row 3 (8 items)
      const row3 = document.createElement('div');
      row3.style.display = 'grid';
      row3.style.gridTemplateColumns = 'repeat(4, 1fr) 40px repeat(4, 1fr)';
      row3.style.gap = '24px';
      row3.style.alignItems = 'stretch';
      ratesToRender.slice(14, 18).forEach(rate => row3.appendChild(buildGridCard(rate)));
      row3.appendChild(document.createElement('div')); // Spacer
      ratesToRender.slice(18, 22).forEach(rate => row3.appendChild(buildGridCard(rate)));
      gridContainer.appendChild(row3);

      wrapper.appendChild(gridContainer);
    }

    // 5. Add a high-contrast footer
    const footer = document.createElement('div');
    footer.style.marginTop = '40px';
    footer.style.textAlign = 'center';
    footer.style.fontSize = '20px'; // Bigger font
    footer.style.color = '#374151'; // Darker text
    footer.style.width = '100%';

    const source = document.createElement('p');
    source.style.marginBottom = '12px';
    source.style.fontWeight = '600';
    const genDate = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    source.textContent = `Source: Nepal Rastra Bank (NRB) | Generated: ${genDate}`;
    footer.appendChild(source);

    const designer = document.createElement('p');
    designer.style.fontStyle = 'italic';
    designer.style.fontSize = '18px';
    designer.style.marginTop = '8px';
    designer.textContent = 'forex.grisma.com.np';
    footer.appendChild(designer);

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
        // --- UPDATED: Use scale 1 for 2400px width ---
        scale: 1, 
        backgroundColor: '#ffffff', // Explicit white background
        width: wrapper.offsetWidth,
        height: wrapper.offsetHeight,
        useCORS: true, // For loading external flag icons
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
        description: `Failed to download ${viewMode === 'table' ? 'table' : 'grid'} as image.`,
        variant: "destructive",
      });
    } finally {
      document.body.removeChild(wrapper); // 8. Clean up
    }
  };
  // --- END OF REDESIGNED FUNCTION ---


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
            {/* --- UPDATED: Title font size reduced --- */}
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 truncate">
              Foreign Exchange Rates by NRB for {formatDateLong(displayData ? new Date(displayData.date) : selectedDate)}
            </h2>

            {/* --- NEW: Show fallback message --- */}
            {isShowingFallback && (
              <div className="text-sm text-orange-600 font-medium animate-fade-in">
                No data found for {formatDateLong(selectedDate)}. Showing data for {formatDateLong(subDays(selectedDate, 1))}.
              </div>
            )}
            {/* --- END NEW --- */}

            <div className="flex items-center justify-center gap-2 h-10 mt-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDate('prev')}
                title="Previous Day"
                className="group relative"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
                <span className="absolute hidden group-hover:block -top-8 px-2 py-1 bg-gray-700 text-white text-xs rounded-md whitespace-nowrap">
                  Previous Day
                </span>
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-auto px-4 justify-center text-left font-normal group relative", // w-[240px] removed
                      !selectedDate && "text-muted-foreground",
                      // --- NEW: Highlight if showing fallback ---
                      isShowingFallback && "border-orange-300 bg-orange-50 hover:bg-orange-100"
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
                url="/"
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

           <AdSense client="ca-pub-XXXXXXXXXXXXXXXX" slot="XXXXXXXXXX" />

        </div>
      </div>
    </Layout>
  );
};

export default Index;
