import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Rate } from '../types/forex';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRightLeft, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { getFlagEmoji, formatDateLong } from '@/services/forexService';
import ShareButtons from '@/components/ShareButtons';
import { Link } from 'react-router-dom';
import AdSense from '@/components/AdSense';
// --- MODIFIED IMPORTS ---
import { fetchRatesApiFirst } from '@/services/apiClient'; // Use new API-First service

const Converter = () => {
  const [amount, setAmount] = useState<number | string>(100);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('NPR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // --- MODIFIED QUERY: Use API-First ---
  const {
    data: forexData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['forexRates', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: () => fetchRatesApiFirst(selectedDate), // Use new API-First function
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const rates = useMemo(() => {
    const rateMap = new Map<string, Rate>();
    if (forexData?.rates) {
      forexData.rates.forEach((rate) => {
        rateMap.set(rate.currency.iso3, rate);
      });
    }
    // Add NPR
    rateMap.set('NPR', {
      currency: { iso3: 'NPR', name: 'Nepali Rupee', unit: 1 },
      buy: 1,
      sell: 1,
    });
    return rateMap;
  }, [forexData]);

  const currencyList = useMemo(() => {
    return Array.from(rates.values()).sort((a, b) =>
      a.currency.name.localeCompare(b.currency.name)
    );
  }, [rates]);

  useEffect(() => {
    if (rates.size > 0) {
      handleConversion();
    }
  }, [amount, fromCurrency, toCurrency, rates]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || value === '-') {
      setAmount(value);
      setConvertedAmount(null);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setAmount(numValue);
      }
    }
  };

  const handleConversion = () => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount) || rates.size === 0) {
      setConvertedAmount(null);
      return;
    }

    const fromRate = rates.get(fromCurrency);
    const toRate = rates.get(toCurrency);

    if (!fromRate || !toRate) {
      setConvertedAmount(null);
      return;
    }

    // Standard formula: Convert 'from' to NPR first, then 'to' currency
    // We use the 'sell' rate when converting *from* foreign currency (bank is buying)
    // We use the 'buy' rate when converting *to* foreign currency (bank is selling)
    
    let nprAmount = 0;
    if (fromCurrency === 'NPR') {
      nprAmount = numericAmount;
    } else {
      // Convert foreign currency to NPR. Use 'buy' rate (bank buys from you)
      nprAmount = (numericAmount / fromRate.currency.unit) * fromRate.buy;
    }

    if (toCurrency === 'NPR') {
      setConvertedAmount(nprAmount);
    } else {
      // Convert NPR to foreign currency. Use 'sell' rate (bank sells to you)
      const finalAmount = (nprAmount / toRate.sell) * toRate.currency.unit;
      setConvertedAmount(finalAmount);
    }
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const dataDate = forexData?.date ? new Date(forexData.date + 'T00:00:00Z') : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl md:text-3xl font-bold text-center">
                Currency Converter
              </CardTitle>
              <CardDescription className="text-center">
                {isLoading
                  ? 'Loading latest rates...'
                  : `Using NRB rates for ${
                      dataDate ? formatDateLong(dataDate) : 'today'
                    }`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              )}
              {isError && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    Could not load conversion rates. Please try again later.
                  </AlertDescription>
                </Alert>
              )}
              {!isLoading && !isError && rates.size > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <div className="md:col-span-2">
                      <label htmlFor="amount" className="block text-sm font-medium mb-1">
                        Amount
                      </label>
                      <Input
                        id="amount"
                        type="number"
                        value={amount}
                        onChange={handleAmountChange}
                        className="text-lg"
                        placeholder="Enter amount"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="from" className="block text-sm font-medium mb-1">
                        From
                      </label>
                      <Select value={fromCurrency} onValueChange={setFromCurrency}>
                        <SelectTrigger className="text-lg">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencyList.map((rate) => (
                            <SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>
                              {getFlagEmoji(rate.currency.iso3)} {rate.currency.name} ({rate.currency.iso3})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-center items-end h-full">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={swapCurrencies}
                        className="mt-1 md:mt-6"
                        aria-label="Swap currencies"
                      >
                        <ArrowRightLeft className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <div className="md:col-span-2">
                      <label htmlFor="convertedAmount" className="block text-sm font-medium mb-1">
                        Converted Amount
                      </label>
                      <Input
                        id="convertedAmount"
                        type="text"
                        value={
                          convertedAmount !== null
                            ? convertedAmount.toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })
                            : '...'
                        }
                        readOnly
                        className="text-lg font-bold bg-gray-50"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="to" className="block text-sm font-medium mb-1">
                        To
                      </label>
                      <Select value={toCurrency} onValueChange={setToCurrency}>
                        <SelectTrigger className="text-lg">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencyList.map((rate) => (
                            <SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>
                              {getFlagEmoji(rate.currency.iso3)} {rate.currency.name} ({rate.currency.iso3})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={'outline'}
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(selectedDate, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(day) => setSelectedDate(day || new Date())}
                          disabled={(date) =>
                            date > new Date() || date < new Date('2000-01-01')
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <ShareButtons 
            url="https"
            title="Nepal Forex Currency Converter | NRB Rates"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
             <Card className="hover:shadow-md transition-shadow">
               <CardHeader>
                 <CardTitle>View Today's Rates</CardTitle>
                 <CardDescription>See the full table of today's exchange rates.</CardDescription>
               </CardHeader>
               <CardContent>
                 <Button asChild>
                   <Link to="/">View Rates <ArrowRight className="ml-2 h-4 w-4" /></Link>
                 </Button>
               </CardContent>
             </Card>
             <Card className="hover:shadow-md transition-shadow">
               <CardHeader>
                 <CardTitle>Historical Charts</CardTitle>
                 <CardDescription>Analyze historical trends with interactive charts.</CardDescription>
               </CardHeader>
               <CardContent>
                 <Button asChild>
                   <Link to="/historical-charts">View Charts <ArrowRight className="ml-2 h-4 w-4" /></Link>
                 </Button>
               </CardContent>
             </Card>
          </div>

          <AdSense slot="7506306569" format="fluid" layoutKey="-gw-3+1f-3d+2z" />

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>How Conversion is Calculated</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm">
              <p>
                This converter uses the official 'Buy' and 'Sell' rates published by Nepal Rastra Bank.
              </p>
              <ul>
                <li>
                  <strong>Converting Foreign Currency to NPR (e.g., USD to NPR):</strong> The 'Buy' rate is used. This is the price at which banks *buy* foreign currency from you, in exchange for NPR.
                  <br />
                  <code className="text-xs">NPR = (Amount in USD / Unit) * Buy Rate</code>
                </li>
                <li>
                  <strong>Converting NPR to Foreign Currency (e.g., NPR to USD):</strong> The 'Sell' rate is used. This is the price at which banks *sell* foreign currency to you.
                  <br />
                  <code className="text-xs">USD = (Amount in NPR / Sell Rate) * Unit</code>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                <strong>Disclaimer:</strong> These are the official indicative rates. Actual rates offered by commercial banks and money exchangers may differ.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Converter;
