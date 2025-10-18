import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Calculator, ArrowRight, TrendingUp } from 'lucide-react';
import { fetchForexRates, fetchHistoricalRates, formatDate } from '@/services/forexService';
import { Rate } from '@/types/forex';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import AdSense from '@/components/AdSense';
import ForexTicker from '@/components/ForexTicker';
import DateInput from '@/components/DateInput';
import ConverterProfitCalculator from './ConverterProfitCalculator';

const Converter = () => {
  const { toast } = useToast();
  const [conversionType, setConversionType] = useState('toNpr');
  const [amount, setAmount] = useState<number>(1);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('NPR');
  const [result, setResult] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  
  // Profit/Loss Calculator states
  const [investAmount, setInvestAmount] = useState<number>(100);
  const [investCurrency, setInvestCurrency] = useState<string>('USD');
  const [purchaseDate, setPurchaseDate] = useState<string>(formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))); // 30 days ago
  const [sellDate, setSellDate] = useState<string>(formatDate(new Date()));
  const [profitLossResult, setProfitLossResult] = useState<any>(null);

  const { data: forexData, isLoading, error } = useQuery({
    queryKey: ['forexRates', selectedDate],
    queryFn: async () => {
      const data = await fetchHistoricalRates(selectedDate, selectedDate);
      return data;
    },
  });

  const rates = forexData?.payload?.[0]?.rates || [];
  
  const allRates = [
    { currency: { iso3: 'NPR', name: 'Nepalese Rupee', unit: 1 }, buy: 1, sell: 1 },
    ...rates
  ];

  useEffect(() => {
    if (conversionType === 'toNpr') {
      setFromCurrency('USD');
      setToCurrency('NPR');
    } else if (conversionType === 'fromNpr') {
      setFromCurrency('NPR');
      setToCurrency('USD');
    } else {
      setFromCurrency('USD');
      setToCurrency('EUR');
    }
    setAmount(1);
    setResult(null);
  }, [conversionType]);

  const findRate = (currencyCode: string): Rate | undefined => {
    return allRates.find(rate => rate.currency.iso3 === currencyCode);
  };

  const convert = () => {
    try {
      if (!amount || amount <= 0) {
        toast({
          title: "Invalid amount",
          description: "Please enter a positive number",
          variant: "destructive"
        });
        return;
      }

      let calculatedResult = 0;
      const fromRate = findRate(fromCurrency);
      const toRate = findRate(toCurrency);

      if (!fromRate || !toRate) {
        toast({
          title: "Conversion error",
          description: "Currency rates not found",
          variant: "destructive"
        });
        return;
      }

      if (conversionType === 'toNpr') {
        calculatedResult = (amount * Number(fromRate.sell)) / fromRate.currency.unit;
      } else if (conversionType === 'fromNpr') {
        calculatedResult = (amount * toRate.currency.unit) / Number(toRate.buy);
      } else {
        const amountInNpr = (amount * Number(fromRate.sell)) / fromRate.currency.unit;
        calculatedResult = (amountInNpr * toRate.currency.unit) / Number(toRate.buy);
      }
      
      setResult(calculatedResult);
    } catch (err) {
      console.error('Conversion error:', err);
      toast({
        title: "Conversion error",
        description: "An error occurred during conversion",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              Error loading forex rates. Please try again later.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Calculator className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold mb-2">Currency Converter</h1>
            <p className="text-muted-foreground">Convert between NPR and foreign currencies with live rates</p>
          </div>
          
          {/* Ticker component */}
          <ForexTicker rates={rates} isLoading={isLoading} />
          
          <Card className="w-full max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Forex Converter
              </CardTitle>
              <CardDescription>
                Convert between NPR and foreign currencies with the latest exchange rates
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Tabs value={conversionType} onValueChange={setConversionType} className="w-full">
                <TabsList className="grid grid-cols-4 mb-6">
                  <TabsTrigger value="toNpr">Foreign → NPR</TabsTrigger>
                  <TabsTrigger value="fromNpr">NPR → Foreign</TabsTrigger>
                  <TabsTrigger value="anyToAny">Foreign → Foreign</TabsTrigger>
                  <TabsTrigger value="profitLoss">Profit/Loss</TabsTrigger>
                </TabsList>
                
                <TabsContent value="toNpr">
                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Select Date</label>
                      <DateInput
                        value={selectedDate}
                        onChange={setSelectedDate}
                        className="border-2 py-3 text-base rounded-xl"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      <div className="space-y-2">
                        <label htmlFor="amount" className="text-sm font-semibold text-gray-700">Amount</label>
                        <Input
                          id="amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value))}
                          placeholder="Enter amount"
                          className="border-2 py-3 text-base rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="fromCurrency" className="text-sm font-semibold text-gray-700">From Currency</label>
                        <Select value={fromCurrency} onValueChange={setFromCurrency}>
                          <SelectTrigger id="fromCurrency" className="border-2 py-3 rounded-xl">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {rates.map((rate: Rate) => (
                              <SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>
                                {rate.currency.iso3} - {rate.currency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-center md:justify-start">
                        <ArrowRight className="h-6 w-6 text-blue-600" />
                        <span className="ml-2 font-bold text-lg">NPR</span>
                      </div>
                    </div>

                    <Button onClick={convert} className="mt-4 w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl">
                      <Calculator className="mr-2 h-5 w-5" /> Calculate
                    </Button>
                    
                    {result !== null && (
                      <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md">
                        <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Result:</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {amount.toLocaleString()} {fromCurrency} = {result.toLocaleString('en-US', { maximumFractionDigits: 2 })} NPR
                        </p>
                        <p className="text-sm text-gray-600 mt-3 font-medium">
                          Exchange Rate: 1 {fromCurrency} = {(Number(findRate(fromCurrency)?.sell) / findRate(fromCurrency)?.currency.unit).toLocaleString('en-US', { maximumFractionDigits: 4 })} NPR
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="fromNpr">
                  <div className="grid gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      <div className="space-y-2">
                        <label htmlFor="amount" className="text-sm font-semibold text-gray-700">Amount (NPR)</label>
                        <Input
                          id="amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value))}
                          placeholder="Enter amount in NPR"
                          className="border-2 py-3 text-base rounded-xl"
                        />
                      </div>

                      <div className="flex items-center justify-center md:justify-start">
                        <span className="mr-2 font-bold text-lg">NPR</span>
                        <ArrowRight className="h-6 w-6 text-blue-600" />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="toCurrency" className="text-sm font-semibold text-gray-700">To Currency</label>
                        <Select value={toCurrency} onValueChange={setToCurrency}>
                          <SelectTrigger id="toCurrency" className="border-2 py-3 rounded-xl">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {rates.map((rate: Rate) => (
                              <SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>
                                {rate.currency.iso3} - {rate.currency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button onClick={convert} className="mt-4 w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl">
                      <Calculator className="mr-2 h-5 w-5" /> Calculate
                    </Button>

                    {result !== null && (
                      <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md">
                        <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Result:</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {amount.toLocaleString()} NPR = {result.toLocaleString('en-US', { maximumFractionDigits: 4 })} {toCurrency}
                        </p>
                        <p className="text-sm text-gray-600 mt-3 font-medium">
                          Exchange Rate: 1 NPR = {((findRate(toCurrency)?.currency.unit) / Number(findRate(toCurrency)?.buy)).toLocaleString('en-US', { maximumFractionDigits: 6 })} {toCurrency}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="anyToAny">
                  <div className="grid gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                      <div className="space-y-2 md:col-span-2">
                        <label htmlFor="amount" className="text-sm font-semibold text-gray-700">Amount</label>
                        <Input
                          id="amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value))}
                          placeholder="Enter amount"
                          className="border-2 py-3 text-base rounded-xl"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-1">
                        <label htmlFor="fromCurrency" className="text-sm font-semibold text-gray-700">From</label>
                        <Select value={fromCurrency} onValueChange={setFromCurrency}>
                          <SelectTrigger id="fromCurrency" className="border-2 py-3 rounded-xl">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {rates.map((rate: Rate) => (
                              <SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>
                                {rate.currency.iso3}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-center">
                        <ArrowRightLeft className="h-6 w-6 text-blue-600" />
                      </div>

                      <div className="space-y-2 md:col-span-1">
                        <label htmlFor="toCurrency" className="text-sm font-semibold text-gray-700">To</label>
                        <Select value={toCurrency} onValueChange={setToCurrency}>
                          <SelectTrigger id="toCurrency" className="border-2 py-3 rounded-xl">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {rates.map((rate: Rate) => (
                              <SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>
                                {rate.currency.iso3}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button onClick={convert} className="mt-4 w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl">
                      <Calculator className="mr-2 h-5 w-5" /> Calculate
                    </Button>

                    {result !== null && (
                      <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md">
                        <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Result:</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {amount.toLocaleString()} {fromCurrency} = {result.toLocaleString('en-US', { maximumFractionDigits: 4 })} {toCurrency}
                        </p>
                        <p className="text-sm text-gray-600 mt-3 font-medium">
                          Conversion via NPR as intermediate currency
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="profitLoss">
                  <ConverterProfitCalculator rates={rates} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          <div className="mt-8">
            <AdSense />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Converter;
