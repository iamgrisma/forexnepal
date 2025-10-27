import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Calculator, ArrowRight, TrendingUp, Loader2 } from 'lucide-react'; // Added Loader2
// Remove unused imports from forexService
// import { fetchForexRates, fetchHistoricalRates, formatDate } from '@/services/forexService';
import { formatDate } from '@/services/forexService'; // Keep formatDate
// Import the new service function
import { fetchRatesForDateWithCache } from '@/services/d1ForexService';
import { Rate, RatesData } from '@/types/forex'; // Ensure RatesData is imported
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import AdSense from '@/components/AdSense';
import ForexTicker from '@/components/ForexTicker';
import DateInput from '@/components/DateInput';
import ConverterProfitCalculator from './ConverterProfitCalculator'; // Assuming this uses 'rates' prop

const Converter = () => {
  const { toast } = useToast();
  const [conversionType, setConversionType] = useState('toNpr');
  const [amount, setAmount] = useState<number>(1);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('NPR');
  const [result, setResult] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [ratesData, setRatesData] = useState<RatesData | null>(null); // State to hold fetched rates data

  // Profit/Loss Calculator states remain the same

  // --- MODIFIED useQuery ---
  const { isLoading, error, data: queryData, isFetching } = useQuery<RatesData | null>({ // Added isFetching
    queryKey: ['forexRatesForDate', selectedDate], // Unique key including the date
    queryFn: async () => {
      // Call the new service function that uses D1 cache
      // Pass null for onProgress if not needed here, or implement a handler
      const data = await fetchRatesForDateWithCache(selectedDate, null);
      return data;
    },
    enabled: !!selectedDate && selectedDate.length === 10, // Only run if date is valid
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
  // --- END MODIFIED useQuery ---

  // Update local ratesData state when query data changes
  useEffect(() => {
    if (queryData) {
      setRatesData(queryData);
      // Reset result when date changes
      setResult(null);
    } else if (!isLoading && selectedDate.length === 10) {
        // If query finished and returned null (e.g., error or no data), clear rates
        setRatesData(null);
        setResult(null);
        toast({ title: "No Data", description: `Could not load rates for ${selectedDate}.`, variant: "destructive", duration: 2000 });
    }
  }, [queryData, isLoading, selectedDate, toast]);

  // Derive rates array from ratesData state
  const rates = ratesData?.rates || [];

  // Add NPR manually to the list for selection in specific contexts
   const allSelectableRates = [
     { currency: { iso3: 'NPR', name: 'Nepalese Rupee', unit: 1 }, buy: 1, sell: 1 },
     ...rates
   ];

  // --- useEffect for resetting form (remains the same) ---
  useEffect(() => {
    // Reset defaults when conversion type changes
    if (conversionType === 'toNpr') {
      setFromCurrency('USD'); // Default foreign currency
      setToCurrency('NPR');
    } else if (conversionType === 'fromNpr') {
      setFromCurrency('NPR');
      setToCurrency('USD'); // Default foreign currency
    } else if (conversionType === 'anyToAny') {
      // Ensure default 'anyToAny' currencies exist in the fetched rates
      const defaultFrom = rates.some(r => r.currency.iso3 === 'USD') ? 'USD' : (rates[0]?.currency.iso3);
      const defaultTo = rates.some(r => r.currency.iso3 === 'EUR') ? 'EUR' : (rates[1]?.currency.iso3 || rates[0]?.currency.iso3);
       // Check if defaults exist, otherwise set null or first available
      setFromCurrency(defaultFrom || '');
      setToCurrency(defaultTo || '');
    }
    setAmount(1);
    setResult(null);
  }, [conversionType, rates]); // Rerun when rates load too to set defaults


  // --- findRate function (use allSelectableRates which includes NPR) ---
  const findRate = (currencyCode: string): Rate | undefined => {
    return allSelectableRates.find(rate => rate.currency.iso3 === currencyCode);
  };

  // --- convert function (updated checks) ---
  const convert = () => {
      // Check if rates are still fetching for the selected date
      if (isLoading || isFetching) {
          toast({ title: "Loading...", description: "Rates are still loading for the selected date.", variant: "default", duration: 2000 });
          return;
      }
       // Check if rates data failed to load or is empty
       if (!ratesData || rates.length === 0) {
           toast({ title: "No Rates Available", description: `Cannot convert. No exchange rates found for ${selectedDate}. It might be a holiday or weekend.`, variant: "destructive" });
           setResult(null);
           return;
       }

       try {
         if (!amount || amount <= 0 || isNaN(amount)) { // Added NaN check
           toast({ title: "Invalid amount", description: "Please enter a positive number", variant: "destructive" });
           setResult(null); // Clear previous result on error
           return;
         }

         let calculatedResult = 0;
         const fromRate = findRate(fromCurrency);
         const toRate = findRate(toCurrency);

         // Ensure selected currencies exist for the date
         if (!fromRate || !toRate) {
           toast({ title: "Conversion error", description: `Rates for ${fromCurrency} or ${toCurrency} not available on ${selectedDate}`, variant: "destructive" });
           setResult(null);
           return;
         }
          // Avoid division by zero or invalid rates
         if ((conversionType === 'fromNpr' || conversionType === 'anyToAny') && (!toRate.buy || Number(toRate.buy) === 0)) {
            toast({ title: "Conversion error", description: `Buying rate for ${toCurrency} is invalid or zero.`, variant: "destructive" });
            setResult(null);
            return;
         }
         if ((conversionType === 'toNpr' || conversionType === 'anyToAny') && (!fromRate.sell || Number(fromRate.sell) === 0)) {
            toast({ title: "Conversion error", description: `Selling rate for ${fromCurrency} is invalid or zero.`, variant: "destructive" });
            setResult(null);
            return;
         }


         // Perform conversion based on type
         if (conversionType === 'toNpr') { // Foreign -> NPR (Use Selling rate of Foreign)
           calculatedResult = (amount * Number(fromRate.sell)) / fromRate.currency.unit;
         } else if (conversionType === 'fromNpr') { // NPR -> Foreign (Use Buying rate of Foreign)
           calculatedResult = (amount * toRate.currency.unit) / Number(toRate.buy);
         } else { // Foreign -> Foreign (Use Selling rate of From, Buying rate of To)
           const amountInNpr = (amount * Number(fromRate.sell)) / fromRate.currency.unit;
           calculatedResult = (amountInNpr * toRate.currency.unit) / Number(toRate.buy);
         }

         setResult(calculatedResult);
       } catch (err) {
         console.error('Conversion error:', err);
         toast({ title: "Calculation error", description: "An unexpected error occurred during calculation.", variant: "destructive" });
         setResult(null);
       }
  };


   // --- Loading and Error states ---
   // Simplified loading indicator (isFetching covers initial load and background refresh)
   const showLoadingIndicator = isLoading || isFetching;

   if (error) { // Show error if initial query fails
       return (
         <Layout>
            <div className="py-8 px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto text-center text-destructive">
                 Error loading initial forex rates. Please check your connection and try again later.
              </div>
            </div>
         </Layout>
       );
   }

  // --- JSX (Main structure) ---
  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <<div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Calculator className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold mb-2">Currency Converter</h1>
            <p className="text-muted-foreground">Convert currencies using rates from {selectedDate}</p>
          </div>

          {/* Ticker - Pass the rates derived from state */}
          <ForexTicker rates={rates} isLoading={showLoadingIndicator} />

          {/* Main Card */}
          <Card className="w-full max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Forex Converter
              </CardTitle>
            </CardHeader>

            <CardContent>
               {/* Date Input */}
               <div className="mb-6 space-y-2">
                   <label htmlFor="conversionDate" className="text-sm font-semibold text-gray-700">Conversion Date</label>
                   <DateInput
                     id="conversionDate"
                     value={selectedDate}
                     onChange={setSelectedDate}
                     className="border-2 py-3 text-base rounded-xl"
                     max={formatDate(new Date())} // Prevent future dates
                   />
                   {/* Display message if no rates found after loading */}
                   {!showLoadingIndicator && (!ratesData || rates.length === 0) && selectedDate.length === 10 && (
                     <p className="text-sm text-orange-600 mt-1">
                       No exchange rates found for {selectedDate}. Data might not be published for this day (e.g., holiday/weekend).
                     </p>
                   )}
               </div>

              {/* Tabs */}
              <Tabs value={conversionType} onValueChange={setConversionType} className="w-full">
                <TabsList className="grid grid-cols-4 mb-6">
                   <TabsTrigger value="toNpr">Foreign → NPR</TabsTrigger>
                   <TabsTrigger value="fromNpr">NPR → Foreign</TabsTrigger>
                   <TabsTrigger value="anyToAny">Foreign → Foreign</TabsTrigger>
                   <TabsTrigger value="profitLoss">Profit/Loss</TabsTrigger>
                 </TabsList>

                {/* --- Content for 'toNpr' Tab --- */}
                <TabsContent value="toNpr">
                   <div className="grid gap-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                         <div className="space-y-2">
                            <label htmlFor="amountToNpr" className="text-sm font-semibold text-gray-700">Amount</label>
                            <Input id="amountToNpr" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Enter amount" className="border-2 py-3 text-base rounded-xl" disabled={showLoadingIndicator} />
                         </div>
                         <div className="space-y-2">
                            <label htmlFor="fromCurrencyToNpr" className="text-sm font-semibold text-gray-700">From Currency</label>
                            <Select value={fromCurrency} onValueChange={setFromCurrency} disabled={showLoadingIndicator || rates.length === 0}>
                               <SelectTrigger id="fromCurrencyToNpr" className="border-2 py-3 rounded-xl">
                                  <SelectValue placeholder="Select currency" />
                               </SelectTrigger>
                               <SelectContent>
                                  {rates.map((rate: Rate) => (<SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>{rate.currency.iso3} - {rate.currency.name}</SelectItem>))}
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="flex items-center justify-center md:justify-start pb-2">
                            <ArrowRight className="h-6 w-6 text-blue-600" />
                            <span className="ml-2 font-bold text-lg">NPR</span>
                         </div>
                      </div>
                      <Button onClick={convert} disabled={showLoadingIndicator || !ratesData || rates.length === 0} className="mt-4 w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl">
                         {showLoadingIndicator ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Calculator className="mr-2 h-5 w-5" /> }
                         {showLoadingIndicator ? 'Loading Rates...' : 'Calculate'}
                      </Button>
                      {/* Result Display */}
                      {result !== null && (
                         <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md">
                           <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Result (using {selectedDate} rates):</p>
                           <p className="text-3xl font-bold text-gray-900 break-words">
                             {amount.toLocaleString()} {fromCurrency} = {result.toLocaleString('en-US', { maximumFractionDigits: 2 })} NPR
                           </p>
                           {findRate(fromCurrency) && Number(findRate(fromCurrency)?.sell) > 0 && (
                             <p className="text-sm text-gray-600 mt-3 font-medium">
                               Rate: 1 {fromCurrency} = {(Number(findRate(fromCurrency)?.sell) / (findRate(fromCurrency)?.currency.unit || 1)).toLocaleString('en-US', { maximumFractionDigits: 4 })} NPR (Sell Rate)
                             </p>
                           )}
                         </div>
                       )}
                   </div>
                </TabsContent>

                 {/* --- Content for 'fromNpr' Tab --- */}
                <TabsContent value="fromNpr">
                    <div className="grid gap-6">
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                           <div className="space-y-2">
                               <label htmlFor="amountFromNpr" className="text-sm font-semibold text-gray-700">Amount (NPR)</label>
                               <Input id="amountFromNpr" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Enter amount in NPR" className="border-2 py-3 text-base rounded-xl" disabled={showLoadingIndicator} />
                           </div>
                           <div className="flex items-center justify-center md:justify-start pb-2">
                              <span className="mr-2 font-bold text-lg">NPR</span>
                              <ArrowRight className="h-6 w-6 text-blue-600" />
                           </div>
                           <div className="space-y-2">
                               <label htmlFor="toCurrencyFromNpr" className="text-sm font-semibold text-gray-700">To Currency</label>
                               <Select value={toCurrency} onValueChange={setToCurrency} disabled={showLoadingIndicator || rates.length === 0}>
                                   <SelectTrigger id="toCurrencyFromNpr" className="border-2 py-3 rounded-xl"><SelectValue placeholder="Select currency" /></SelectTrigger>
                                   <SelectContent>
                                       {rates.map((rate: Rate) => (<SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>{rate.currency.iso3} - {rate.currency.name}</SelectItem>))}
                                   </SelectContent>
                               </Select>
                           </div>
                       </div>
                       <Button onClick={convert} disabled={showLoadingIndicator || !ratesData || rates.length === 0} className="mt-4 w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl">
                          {showLoadingIndicator ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Calculator className="mr-2 h-5 w-5" /> }
                          {showLoadingIndicator ? 'Loading Rates...' : 'Calculate'}
                       </Button>
                       {/* Result Display */}
                       {result !== null && (
                          <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md">
                             <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Result (using {selectedDate} rates):</p>
                             <p className="text-3xl font-bold text-gray-900 break-words">
                               {amount.toLocaleString()} NPR = {result.toLocaleString('en-US', { maximumFractionDigits: 4 })} {toCurrency}
                             </p>
                             {findRate(toCurrency) && Number(findRate(toCurrency)?.buy) > 0 && (
                               <p className="text-sm text-gray-600 mt-3 font-medium">
                                 Rate: 1 {toCurrency} = {(Number(findRate(toCurrency)?.buy) / (findRate(toCurrency)?.currency.unit || 1)).toLocaleString('en-US', { maximumFractionDigits: 4 })} NPR (Buy Rate)
                               </p>
                             )}
                         </div>
                       )}
                   </div>
                </TabsContent>

                 {/* --- Content for 'anyToAny' Tab --- */}
                 <TabsContent value="anyToAny">
                     <div className="grid gap-6">
                         <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
                             <div className="space-y-2 md:col-span-2">
                                 <label htmlFor="amountAny" className="text-sm font-semibold text-gray-700">Amount</label>
                                 <Input id="amountAny" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Enter amount" className="border-2 py-3 text-base rounded-xl" disabled={showLoadingIndicator} />
                             </div>
                             <div className="space-y-2 md:col-span-1">
                                 <label htmlFor="fromCurrencyAny" className="text-sm font-semibold text-gray-700">From</label>
                                 <Select value={fromCurrency} onValueChange={setFromCurrency} disabled={showLoadingIndicator || rates.length === 0}>
                                     <SelectTrigger id="fromCurrencyAny" className="border-2 py-3 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                                     <SelectContent>
                                         {/* Only foreign currencies */}
                                         {rates.map((rate: Rate) => (<SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>{rate.currency.iso3}</SelectItem>))}
                                     </SelectContent>
                                 </Select>
                             </div>
                             <div className="flex items-center justify-center pb-2">
                                 <ArrowRightLeft className="h-6 w-6 text-blue-600" />
                             </div>
                             <div className="space-y-2 md:col-span-1">
                                 <label htmlFor="toCurrencyAny" className="text-sm font-semibold text-gray-700">To</label>
                                 <Select value={toCurrency} onValueChange={setToCurrency} disabled={showLoadingIndicator || rates.length === 0}>
                                     <SelectTrigger id="toCurrencyAny" className="border-2 py-3 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                                     <SelectContent>
                                         {/* Only foreign currencies */}
                                         {rates.map((rate: Rate) => (<SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>{rate.currency.iso3}</SelectItem>))}
                                     </SelectContent>
                                 </Select>
                             </div>
                         </div>
                         <Button onClick={convert} disabled={showLoadingIndicator || !ratesData || rates.length === 0} className="mt-4 w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl">
                            {showLoadingIndicator ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Calculator className="mr-2 h-5 w-5" /> }
                            {showLoadingIndicator ? 'Loading Rates...' : 'Calculate'}
                         </Button>
                         {/* Result Display */}
                         {result !== null && (
                            <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md">
                               <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Result (using {selectedDate} rates):</p>
                               <p className="text-3xl font-bold text-gray-900 break-words">
                                 {amount.toLocaleString()} {fromCurrency} ≈ {result.toLocaleString('en-US', { maximumFractionDigits: 4 })} {toCurrency}
                               </p>
                               <p className="text-sm text-gray-600 mt-3 font-medium">
                                 Conversion via NPR as intermediate currency using sell ({fromCurrency}) and buy ({toCurrency}) rates.
                               </p>
                           </div>
                         )}
                     </div>
                 </TabsContent>

                {/* --- Content for 'profitLoss' Tab --- */}
                <TabsContent value="profitLoss">
                  {/* Pass the currently loaded rates (for the selected date) */}
                  {/* Note: The profit calculator itself fetches historical rates for its dates */}
                  <ConverterProfitCalculator rates={rates} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* AdSense */}
          <div className="mt-8">
            <AdSense />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Converter;
