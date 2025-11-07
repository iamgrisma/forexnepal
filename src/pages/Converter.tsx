import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Calculator, ArrowRight, Loader2 } from 'lucide-react';
import { formatDate } from '@/services/forexService';
// --- TASK 4: Import DB-First Service ---
import { fetchRatesForDateWithCache } from '@/services/d1ForexService';
// --- END TASK 4 ---
import type { Rate, RatesData } from '@/types/forex';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import AdSense from '@/components/AdSense';
import ForexTicker from '@/components/ForexTicker';
import DateInput from '@/components/DateInput';
import ConverterProfitCalculator from './ConverterProfitCalculator';
import { cn } from "@/lib/utils";

const Converter = () => {
  const { toast } = useToast();
  const [conversionType, setConversionType] = useState('toNpr');
  const [amount, setAmount] = useState<number>(1);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('NPR');
  const [result, setResult] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [ratesData, setRatesData] = useState<RatesData | null>(null);

  // --- TASK 4: Fetch rates for the selected date using D1 Cache Service ---
  const { isLoading, error, data: queryData, isFetching } = useQuery<RatesData | null>({
    queryKey: ['forexRatesForDate', selectedDate],
    queryFn: async () => {
      // Pass null for onProgress if not needed here
      const data = await fetchRatesForDateWithCache(selectedDate, null);
      return data;
    },
    enabled: !!selectedDate && selectedDate.length === 10, // Only run if date is valid format
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
  // --- END TASK 4 ---

  // Update local ratesData state and handle potential errors/no data
  useEffect(() => {
    if (queryData) {
      setRatesData(queryData);
      setResult(null); // Reset result when date changes
    } else if (!isLoading && !isFetching && selectedDate.length === 10) {
        setRatesData(null);
        setResult(null);
        console.warn(`No rates data loaded for ${selectedDate}. It might be a holiday or weekend.`);
    }
     if (error) { // Handle explicit query errors
       console.error("Error fetching rates:", error);
       setRatesData(null);
       setResult(null);
       toast({ title: "Error Loading Rates", description: `Failed to fetch rates for ${selectedDate}. Please try again.`, variant: "destructive"});
     }
  }, [queryData, isLoading, isFetching, selectedDate, error, toast]);

  // Derive rates array, add NPR manually for selection where needed
  const rates = ratesData?.rates || [];
  const allSelectableRates = [
     { currency: { iso3: 'NPR', name: 'Nepalese Rupee', unit: 1 }, buy: 1, sell: 1 },
     ...rates
   ];

  // Reset defaults when conversion type or rates change
  useEffect(() => {
    let defaultFrom = 'USD';
    let defaultTo = 'NPR';

    if (conversionType === 'toNpr') {
      defaultFrom = rates.some(r => r.currency.iso3 === 'USD') ? 'USD' : (rates[0]?.currency.iso3 || '');
      defaultTo = 'NPR';
    } else if (conversionType === 'fromNpr') {
      defaultFrom = 'NPR';
      defaultTo = rates.some(r => r.currency.iso3 === 'USD') ? 'USD' : (rates[0]?.currency.iso3 || '');
    } else if (conversionType === 'anyToAny') {
      defaultFrom = rates.some(r => r.currency.iso3 === 'USD') ? 'USD' : (rates[0]?.currency.iso3 || '');
      defaultTo = rates.some(r => r.currency.iso3 === 'EUR') ? 'EUR' : (rates[1]?.currency.iso3 || rates[0]?.currency.iso3 || '');
    }

    setFromCurrency(defaultFrom);
    setToCurrency(defaultTo);
    setAmount(1);
    setResult(null);
  }, [conversionType, ratesData]); // Depend on ratesData to re-evaluate defaults when data loads

  // Helper to find rate info (includes NPR)
  const findRate = (currencyCode: string): Rate | undefined => {
    return allSelectableRates.find(rate => rate.currency.iso3 === currencyCode);
  };

  // Conversion logic
  const convert = () => {
      if (isLoading || isFetching) {
          toast({ title: "Loading...", description: "Rates are still loading.", duration: 1500 });
          return;
      }
       if (!ratesData || rates.length === 0) {
           toast({ title: "No Rates Available", description: `Cannot convert. No rates found for ${selectedDate}.`, variant: "destructive" });
           setResult(null);
           return;
       }
       if (!amount || amount <= 0 || isNaN(amount)) {
           toast({ title: "Invalid amount", description: "Please enter a positive number.", variant: "destructive" });
           setResult(null);
           return;
       }

       let calculatedResult = 0;
       const fromRate = findRate(fromCurrency);
       const toRate = findRate(toCurrency);

       if (!fromRate || !toRate) {
           toast({ title: "Currency Error", description: `Could not find rate data for ${fromCurrency} or ${toCurrency} on ${selectedDate}.`, variant: "destructive" });
           setResult(null);
           return;
       }

       // Use Number() for explicit conversion and check for zero rates
       const fromSellRate = Number(fromRate.sell);
       const fromUnit = fromRate.currency.unit || 1;
       const toBuyRate = Number(toRate.buy);
       const toUnit = toRate.currency.unit || 1;

       try {
           if (conversionType === 'toNpr') { // Foreign -> NPR
               if (fromSellRate <= 0) throw new Error(`Invalid sell rate for ${fromCurrency}`);
               calculatedResult = (amount * fromSellRate) / fromUnit;
           } else if (conversionType === 'fromNpr') { // NPR -> Foreign
               if (toBuyRate <= 0) throw new Error(`Invalid buy rate for ${toCurrency}`);
               calculatedResult = (amount * toUnit) / toBuyRate;
           } else { // Foreign -> Foreign
               if (fromSellRate <= 0) throw new Error(`Invalid sell rate for ${fromCurrency}`);
               if (toBuyRate <= 0) throw new Error(`Invalid buy rate for ${toCurrency}`);
               const amountInNpr = (amount * fromSellRate) / fromUnit;
               calculatedResult = (amountInNpr * toUnit) / toBuyRate;
           }
           setResult(calculatedResult);

       } catch (err: any) {
           console.error('Conversion calculation error:', err);
           toast({ title: "Calculation Error", description: err.message || "Could not perform conversion.", variant: "destructive" });
           setResult(null);
       }
  };

   // --- Loading/Error states derived from useQuery ---
   const showLoadingIndicator = isLoading || isFetching;

   // Display error message if the initial fetch fails
   if (error && !ratesData) {
       return (
         <Layout>
            <div className="py-8 px-4 sm:px-6 lg:px-8">
              <div className="max-w-7xl mx-auto text-center text-destructive">
                 Error loading initial forex rates: {error.message}. Please check your connection or try refreshing.
              </div>
            </div>
         </Layout>
       );
   }

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        {/* Corrected layout width */}
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Calculator className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold mb-2">Currency Converter</h1>
            <p className="text-muted-foreground">Convert currencies using rates from {selectedDate}</p>
          </div>

          {/* Ticker */}
          <ForexTicker rates={rates} previousDayRates={[]} isLoading={isLoading} />

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
                   {/* Display message if no rates found AFTER loading attempt */}
                   {!showLoadingIndicator && (!ratesData || rates.length === 0) && selectedDate.length === 10 && (
                     <p className="text-sm text-orange-600 mt-1">
                       No exchange rates published for {selectedDate} (e.g., holiday/weekend).
                     </p>
                   )}
               </div>

               {/* Tabs */}
              <Tabs value={conversionType} onValueChange={setConversionType} className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6 h-auto p-1.5 gap-1 bg-gradient-to-br from-slate-100 to-blue-50">
                   <TabsTrigger value="toNpr" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 py-2.5 font-semibold">Foreign → NPR</TabsTrigger>
                   <TabsTrigger value="fromNpr" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 py-2.5 font-semibold">NPR → Foreign</TabsTrigger>
                   <TabsTrigger value="anyToAny" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 py-2.5 font-semibold">Foreign → Foreign</TabsTrigger>
                   <TabsTrigger value="profitLoss" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 py-2.5 font-semibold">Profit/Loss</TabsTrigger>
                 </TabsList>

                {/* --- Content for 'toNpr' Tab --- */}
                <TabsContent value="toNpr">
                   <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                         <div className="space-y-1">
                            <label htmlFor="amountToNpr" className="text-xs font-medium text-gray-600">Amount</label>
                            <Input id="amountToNpr" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Enter amount" className="border-2 py-3 text-base rounded-xl" disabled={showLoadingIndicator} />
                         </div>
                         <div className="space-y-1">
                            <label htmlFor="fromCurrencyToNpr" className="text-xs font-medium text-gray-600">From Currency</label>
                            <Select value={fromCurrency} onValueChange={setFromCurrency} disabled={showLoadingIndicator || rates.length === 0}>
                               <SelectTrigger id="fromCurrencyToNpr" className="border-2 py-3 rounded-xl">
                                  <SelectValue placeholder="Select currency" />
                               </SelectTrigger>
                               <SelectContent>
                                  {rates.map((rate: Rate) => (<SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>{rate.currency.iso3} - {rate.currency.name}</SelectItem>))}
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="flex items-center justify-center md:justify-start pb-3 md:pb-3.5"> {/* Adjusted padding */}
                            <ArrowRight className="h-5 w-5 text-gray-500" />
                            <span className="ml-2 font-bold text-lg text-gray-700">NPR</span>
                         </div>
                      </div>
                      <Button onClick={convert} disabled={showLoadingIndicator || !ratesData || rates.length === 0} className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl">
                         {showLoadingIndicator ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Calculator className="mr-2 h-5 w-5" /> }
                         {showLoadingIndicator ? 'Loading Rates...' : 'Calculate'}
                      </Button>
                      {/* Result Display */}
                      {result !== null && (
                         <div className="mt-4 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md">
                           <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Result ({selectedDate}):</p>
                           <p className="text-3xl font-bold text-gray-900 break-words">
                             {amount.toLocaleString()} {fromCurrency} = {result.toLocaleString('en-US', { maximumFractionDigits: 2 })} NPR
                           </p>
                           {findRate(fromCurrency) && Number(findRate(fromCurrency)?.sell) > 0 && (
                             <p className="text-sm text-gray-600 mt-3 font-medium">
                               Rate: 1 {fromCurrency} = {(Number(findRate(fromCurrency)?.sell) / (findRate(fromCurrency)?.currency.unit || 1)).toLocaleString('en-US', { maximumFractionDigits: 4 })} NPR (NRB Sell Rate)
                             </p>
                           )}
                         </div>
                       )}
                   </div>
                </TabsContent>

                 {/* --- Content for 'fromNpr' Tab --- */}
                <TabsContent value="fromNpr">
                    <div className="space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                           <div className="space-y-1">
                               <label htmlFor="amountFromNpr" className="text-xs font-medium text-gray-600">Amount (NPR)</label>
                               <Input id="amountFromNpr" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Enter amount in NPR" className="border-2 py-3 text-base rounded-xl" disabled={showLoadingIndicator} />
                           </div>
                           <div className="flex items-center justify-center md:justify-start pb-3 md:pb-3.5">
                              <span className="mr-2 font-bold text-lg text-gray-700">NPR</span>
                              <ArrowRight className="h-5 w-5 text-gray-500" />
                           </div>
                           <div className="space-y-1">
                               <label htmlFor="toCurrencyFromNpr" className="text-xs font-medium text-gray-600">To Currency</label>
                               <Select value={toCurrency} onValueChange={setToCurrency} disabled={showLoadingIndicator || rates.length === 0}>
                                   <SelectTrigger id="toCurrencyFromNpr" className="border-2 py-3 rounded-xl"><SelectValue placeholder="Select currency" /></SelectTrigger>
                                   <SelectContent>
                                       {rates.map((rate: Rate) => (<SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>{rate.currency.iso3} - {rate.currency.name}</SelectItem>))}
                                   </SelectContent>
                               </Select>
                           </div>
                       </div>
                       <Button onClick={convert} disabled={showLoadingIndicator || !ratesData || rates.length === 0} className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl">
                          {showLoadingIndicator ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Calculator className="mr-2 h-5 w-5" /> }
                          {showLoadingIndicator ? 'Loading Rates...' : 'Calculate'}
                       </Button>
                       {result !== null && (
                          <div className="mt-4 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md">
                             <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Result ({selectedDate}):</p>
                             <p className="text-3xl font-bold text-gray-900 break-words">
                               {amount.toLocaleString()} NPR = {result.toLocaleString('en-US', { maximumFractionDigits: 4 })} {toCurrency}
                             </p>
                             {findRate(toCurrency) && Number(findRate(toCurrency)?.buy) > 0 && (
                               <p className="text-sm text-gray-600 mt-3 font-medium">
                                 Rate: 1 {toCurrency} = {(Number(findRate(toCurrency)?.buy) / (findRate(toCurrency)?.currency.unit || 1)).toLocaleString('en-US', { maximumFractionDigits: 4 })} NPR (NRB Buy Rate)
                               </p>
                             )}
                         </div>
                       )}
                   </div>
                </TabsContent>

                 {/* --- Content for 'anyToAny' Tab --- */}
                 <TabsContent value="anyToAny">
                     <div className="space-y-6">
                         <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6 items-end">
                             <div className="space-y-1 md:col-span-2">
                                 <label htmlFor="amountAny" className="text-xs font-medium text-gray-600">Amount</label>
                                 <Input id="amountAny" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Enter amount" className="border-2 py-3 text-base rounded-xl" disabled={showLoadingIndicator} />
                             </div>
                             <div className="space-y-1 md:col-span-1">
                                 <label htmlFor="fromCurrencyAny" className="text-xs font-medium text-gray-600">From</label>
                                 <Select value={fromCurrency} onValueChange={setFromCurrency} disabled={showLoadingIndicator || rates.length === 0}>
                                     <SelectTrigger id="fromCurrencyAny" className="border-2 py-3 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                                     <SelectContent>
                                         {rates.map((rate: Rate) => (<SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>{rate.currency.iso3}</SelectItem>))}
                                     </SelectContent>
                                 </Select>
                             </div>
                             <div className="flex items-center justify-center pb-3 md:pb-3.5">
                                 <ArrowRightLeft className="h-5 w-5 text-gray-500" />
                             </div>
                             <div className="space-y-1 md:col-span-1">
                                 <label htmlFor="toCurrencyAny" className="text-xs font-medium text-gray-600">To</label>
                                 <Select value={toCurrency} onValueChange={setToCurrency} disabled={showLoadingIndicator || rates.length === 0}>
                                     <SelectTrigger id="toCurrencyAny" className="border-2 py-3 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                                     <SelectContent>
                                         {rates.map((rate: Rate) => (<SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>{rate.currency.iso3}</SelectItem>))}
                                     </SelectContent>
                                 </Select>
                             </div>
                         </div>
                         <Button onClick={convert} disabled={showLoadingIndicator || !ratesData || rates.length === 0} className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl">
                            {showLoadingIndicator ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Calculator className="mr-2 h-5 w-5" /> }
                            {showLoadingIndicator ? 'Loading Rates...' : 'Calculate'}
                         </Button>
                         {result !== null && (
                            <div className="mt-4 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md">
                               <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Result ({selectedDate}):</p>
                               <p className="text-3xl font-bold text-gray-900 break-words">
                                 {amount.toLocaleString()} {fromCurrency} ≈ {result.toLocaleString('en-US', { maximumFractionDigits: 4 })} {toCurrency}
                               </p>
                               <p className="text-xs text-gray-600 mt-3">
                                 (Converted via NPR using NRB sell rate for {fromCurrency} and buy rate for {toCurrency})
                               </p>
                           </div>
                         )}
                     </div>
                 </TabsContent>

                {/* --- Content for 'profitLoss' Tab --- */}
                <TabsContent value="profitLoss">
                  <ConverterProfitCalculator rates={rates} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* AdSense */}
          <div className="mt-8">
            <AdSense client="ca-pub-XXXXXXXXXXXXXXXX" slot="XXXXXXXXXX" />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Converter;
