import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Loader2 } from 'lucide-react'; // Import Loader2
import DateInput from '@/components/DateInput';
import { formatDate } from '@/services/forexService'; // Keep formatDate
// --- IMPORT THE CORRECT FUNCTION ---
import { fetchHistoricalRatesWithCache } from '@/services/d1ForexService'; // Use the caching service
import type { Rate } from '../types/forex'; // Keep Rate type

interface ProfitCalculatorProps {
  rates: Rate[]; // Keep rates prop for currency dropdown population
}

const ConverterProfitCalculator = ({ rates }: ProfitCalculatorProps) => {
  const { toast } = useToast();
  const [investAmount, setInvestAmount] = useState<number>(100);
  const [investCurrency, setInvestCurrency] = useState<string>('USD');
  // Initialize dates more robustly
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const [purchaseDate, setPurchaseDate] = useState<string>(formatDate(thirtyDaysAgo));
  const [sellDate, setSellDate] = useState<string>(formatDate(today));

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Helper to find a specific rate from fetched data for a date
  const findRateInData = (data: any[] | null | undefined, date: string, currencyCode: string) => {
      if (!data || data.length === 0) return null;
      // The data from fetchHistoricalRatesWithCache is { date, buy, sell }[]
      // Find the entry matching the specific date (should ideally be just one if fromDate=toDate)
      const rateData = data.find(d => d.date === date);
      return rateData || null; // Return the { date, buy, sell } object or null
  };

  const calculateProfitLoss = async () => {
    // Basic validation
    if (!purchaseDate || !sellDate || purchaseDate.length !== 10 || sellDate.length !== 10) {
        toast({ title: "Error", description: "Please select valid purchase and sell dates.", variant: "destructive"});
        return;
    }
     if (new Date(purchaseDate) >= new Date(sellDate)) {
         toast({ title: "Error", description: "Purchase date must be before sell date.", variant: "destructive"});
        return;
     }
     if (!investAmount || investAmount <= 0 || isNaN(investAmount)) {
          toast({ title: "Error", description: "Please enter a valid positive investment amount.", variant: "destructive"});
        return;
     }
     if (!investCurrency) {
          toast({ title: "Error", description: "Please select a currency.", variant: "destructive"});
          return;
     }

    setLoading(true);
    setResult(null); // Clear previous results

    try {
      // --- USE THE CACHING FUNCTION ---
      // Fetch data for purchase date
      console.log(`Fetching purchase data for ${investCurrency} on ${purchaseDate}...`);
      const purchaseData = await fetchHistoricalRatesWithCache(investCurrency, purchaseDate, purchaseDate); // Pass currencyCode

      // Fetch data for sell date
      console.log(`Fetching sell data for ${investCurrency} on ${sellDate}...`);
      const sellData = await fetchHistoricalRatesWithCache(investCurrency, sellDate, sellDate); // Pass currencyCode

      // Find the specific rate for each date from the potentially gap-filled results
      const purchaseRateData = findRateInData(purchaseData, purchaseDate, investCurrency);
      const sellRateData = findRateInData(sellData, sellDate, investCurrency);

      // Find the currency unit info from the initial 'rates' prop (passed from Converter)
      const currencyInfo = rates.find(r => r.currency.iso3 === investCurrency);
      const unit = currencyInfo?.currency.unit || 1; // Default to 1 if not found

      if (!purchaseRateData || purchaseRateData.sell == null || purchaseRateData.sell <= 0) {
        throw new Error(`Could not find a valid sell rate for ${investCurrency} on purchase date ${purchaseDate}. Check if data exists for this day.`);
      }
      // Use BUY rate for selling the currency back
      if (!sellRateData || sellRateData.buy == null || sellRateData.buy <= 0) {
        throw new Error(`Could not find a valid buy rate for ${investCurrency} on sell date ${sellDate}. Check if data exists for this day.`);
      }

      // --- CALCULATIONS ---
      // When you buy foreign currency with NPR, the bank SELLS it to you (use NRB Sell Rate)
      const purchaseValueNPR = (investAmount * Number(purchaseRateData.sell)) / unit;
      // When you sell the foreign currency back to NPR, the bank BUYS it from you (use NRB Buy Rate)
      const sellValueNPR = (investAmount * Number(sellRateData.buy)) / unit;

      const profitNPR = sellValueNPR - purchaseValueNPR;
      const profitPercent = purchaseValueNPR !== 0 ? (profitNPR / purchaseValueNPR) * 100 : 0;

      // Calculate days difference accurately
      const startDate = new Date(purchaseDate + 'T00:00:00Z'); // Use UTC
      const endDate = new Date(sellDate + 'T00:00:00Z');     // Use UTC
      const daysDiff = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))); // Ensure at least 1 day

      const annualReturn = daysDiff > 0 ? (profitPercent / daysDiff) * 365 : 0; // Avoid division by zero

      setResult({
        purchaseValue: purchaseValueNPR,
        sellValue: sellValueNPR,
        profit: profitNPR,
        profitPercent: profitPercent,
        annualReturn: annualReturn,
        daysDiff: daysDiff
      });

    } catch (error: any) {
        console.error("Profit/Loss calculation error:", error);
      toast({
        title: "Calculation Error",
        description: error.message || "Failed to fetch necessary rates or calculate profit/loss.",
        variant: "destructive",
        duration: 5000,
      });
      setResult(null); // Clear result on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto border-t-4 border-blue-600 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Investment Profit/Loss Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* Inputs Column 1 */}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Investment Amount</label>
              <Input
                type="number"
                min="0"
                step="any" // Allow decimals
                value={investAmount}
                onChange={(e) => setInvestAmount(Number(e.target.value))}
                className="border-2 py-3 text-base rounded-lg"
                placeholder='e.g., 1000'
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Purchase Date</label>
              <DateInput
                value={purchaseDate}
                onChange={setPurchaseDate}
                className="border-2 py-3 text-base rounded-lg"
                max={formatDate(new Date())} // Cannot purchase in future
              />
            </div>
          </div>

          {/* Inputs Column 2 */}
          <div className="space-y-4">
             <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Currency Invested In</label>
                <Select value={investCurrency} onValueChange={setInvestCurrency} disabled={rates.length === 0}>
                  <SelectTrigger className="border-2 py-3 rounded-lg">
                    <SelectValue placeholder="Select Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Populate dropdown from rates passed by parent */}
                    {rates && rates.length > 0 ? (
                        rates.map((rate: Rate) => (
                        <SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>
                            {rate.currency.iso3} - {rate.currency.name}
                        </SelectItem>
                        ))
                    ) : (
                        <SelectItem value="loading" disabled>Loading currencies...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Sell Date</label>
                <DateInput
                  value={sellDate}
                  onChange={setSellDate}
                  className="border-2 py-3 text-base rounded-lg"
                  max={formatDate(new Date())} // Cannot sell in future
                />
              </div>
          </div>
        </div>

        <Button
          onClick={calculateProfitLoss}
          className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl"
          disabled={loading || rates.length === 0}
        >
          {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <TrendingUp className="mr-2 h-5 w-5" /> }
          {loading ? 'Calculating...' : 'Calculate Profit/Loss'}
        </Button>

        {/* Results */}
        {result && (
          <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md space-y-3">
            <h3 className="text-lg font-bold text-gray-900 mb-3 border-b pb-2">Calculation Results:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-gray-500">Initial Investment (NPR)</p>
                <p className="font-semibold text-base">{result.purchaseValue.toLocaleString('en-US', { style: 'currency', currency: 'NPR', minimumFractionDigits: 2 })}</p>
                 <p className="text-xs text-gray-500 mt-0.5">(Based on NRB Sell Rate on {purchaseDate})</p>
              </div>
              <div>
                <p className="text-gray-500">Value When Sold (NPR)</p>
                <p className="font-semibold text-base">{result.sellValue.toLocaleString('en-US', { style: 'currency', currency: 'NPR', minimumFractionDigits: 2 })}</p>
                 <p className="text-xs text-gray-500 mt-0.5">(Based on NRB Buy Rate on {sellDate})</p>
              </div>
              <div className="sm:col-span-2 my-2 border-t pt-3"></div>
              <div>
                <p className="text-gray-500">Total Profit / Loss (NPR)</p>
                <p className={`font-bold text-lg ${result.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {result.profit >= 0 ? '+' : ''}{result.profit.toLocaleString('en-US', { style: 'currency', currency: 'NPR', minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Total Return (%)</p>
                <p className={`font-bold text-lg ${result.profitPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {result.profitPercent >= 0 ? '+' : ''}{result.profitPercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-gray-500">Annualized Return (%)</p>
                <p className={`font-semibold text-base ${result.annualReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {result.annualReturn.toFixed(2)}%
                 </p>
              </div>
              <div>
                <p className="text-gray-500">Investment Duration</p>
                <p className="font-semibold text-base">{result.daysDiff} day{result.daysDiff !== 1 ? 's' : ''}</p>
              </div>
            </div>
             <p className="text-xs text-gray-500 italic mt-4">*Calculations use NRB's official buy/sell rates for the specified dates and do not account for bank/transfer fees or taxes.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConverterProfitCalculator;
