import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Calculator, ArrowRight } from 'lucide-react';
import { fetchForexRates } from '@/services/forexService';
import { Rate } from '@/types/forex';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';

const Converter = () => {
  const { toast } = useToast();
  const [conversionType, setConversionType] = useState('toNpr');
  const [amount, setAmount] = useState<number>(1);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('NPR');
  const [result, setResult] = useState<number | null>(null);

  const { data: forexData, isLoading, error } = useQuery({
    queryKey: ['forexRates'],
    queryFn: fetchForexRates,
  });

  const rates = forexData?.data?.payload?.[0]?.rates || [];
  
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
      <div className="container mx-auto p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Currency Converter</h1>
        
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
              <TabsList className="grid grid-cols-3 mb-6">
                <TabsTrigger value="toNpr">Foreign → NPR</TabsTrigger>
                <TabsTrigger value="fromNpr">NPR → Foreign</TabsTrigger>
                <TabsTrigger value="anyToAny">Foreign → Foreign</TabsTrigger>
              </TabsList>
              
              <TabsContent value="toNpr">
                <div className="grid gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="space-y-2">
                      <label htmlFor="amount" className="text-sm font-medium">Amount</label>
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        placeholder="Enter amount"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="fromCurrency" className="text-sm font-medium">From Currency</label>
                      <Select value={fromCurrency} onValueChange={setFromCurrency}>
                        <SelectTrigger id="fromCurrency">
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
                      <ArrowRight className="h-6 w-6 text-muted-foreground" />
                      <span className="ml-2">NPR</span>
                    </div>
                  </div>
                  
                  <Button onClick={convert} className="mt-2 w-full">
                    <Calculator className="mr-2 h-4 w-4" /> Calculate
                  </Button>
                  
                  {result !== null && (
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-lg font-medium">Result:</p>
                      <p className="text-2xl font-bold">
                        {amount.toLocaleString()} {fromCurrency} = {result.toLocaleString('en-US', { maximumFractionDigits: 2 })} NPR
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Exchange Rate: 1 {fromCurrency} = {(Number(findRate(fromCurrency)?.sell) / findRate(fromCurrency)?.currency.unit).toLocaleString('en-US', { maximumFractionDigits: 4 })} NPR
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="fromNpr">
                <div className="grid gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="space-y-2">
                      <label htmlFor="amount" className="text-sm font-medium">Amount (NPR)</label>
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        placeholder="Enter amount in NPR"
                      />
                    </div>
                    
                    <div className="flex items-center justify-center md:justify-start">
                      <span className="mr-2">NPR</span>
                      <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="toCurrency" className="text-sm font-medium">To Currency</label>
                      <Select value={toCurrency} onValueChange={setToCurrency}>
                        <SelectTrigger id="toCurrency">
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
                  
                  <Button onClick={convert} className="mt-2 w-full">
                    <Calculator className="mr-2 h-4 w-4" /> Calculate
                  </Button>
                  
                  {result !== null && (
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-lg font-medium">Result:</p>
                      <p className="text-2xl font-bold">
                        {amount.toLocaleString()} NPR = {result.toLocaleString('en-US', { maximumFractionDigits: 4 })} {toCurrency}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Exchange Rate: 1 NPR = {((findRate(toCurrency)?.currency.unit) / Number(findRate(toCurrency)?.buy)).toLocaleString('en-US', { maximumFractionDigits: 6 })} {toCurrency}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="anyToAny">
                <div className="grid gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <div className="space-y-2 md:col-span-2">
                      <label htmlFor="amount" className="text-sm font-medium">Amount</label>
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        placeholder="Enter amount"
                      />
                    </div>
                    
                    <div className="space-y-2 md:col-span-1">
                      <label htmlFor="fromCurrency" className="text-sm font-medium">From</label>
                      <Select value={fromCurrency} onValueChange={setFromCurrency}>
                        <SelectTrigger id="fromCurrency">
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
                      <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
                    </div>
                    
                    <div className="space-y-2 md:col-span-1">
                      <label htmlFor="toCurrency" className="text-sm font-medium">To</label>
                      <Select value={toCurrency} onValueChange={setToCurrency}>
                        <SelectTrigger id="toCurrency">
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
                  
                  <Button onClick={convert} className="mt-2 w-full">
                    <Calculator className="mr-2 h-4 w-4" /> Calculate
                  </Button>
                  
                  {result !== null && (
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-lg font-medium">Result:</p>
                      <p className="text-2xl font-bold">
                        {amount.toLocaleString()} {fromCurrency} = {result.toLocaleString('en-US', { maximumFractionDigits: 4 })} {toCurrency}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Conversion via NPR as intermediate currency
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Converter;
