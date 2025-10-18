import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp } from 'lucide-react';
import DateInput from '@/components/DateInput';
import { formatDate, fetchHistoricalRates } from '@/services/forexService';

interface ProfitCalculatorProps {
  rates: any[];
}

const ConverterProfitCalculator = ({ rates }: ProfitCalculatorProps) => {
  const { toast } = useToast();
  const [investAmount, setInvestAmount] = useState<number>(100);
  const [investCurrency, setInvestCurrency] = useState<string>('USD');
  const [purchaseDate, setPurchaseDate] = useState<string>(formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [sellDate, setSellDate] = useState<string>(formatDate(new Date()));
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculateProfitLoss = async () => {
    setLoading(true);
    try {
      const purchaseData = await fetchHistoricalRates(purchaseDate, purchaseDate);
      const sellData = await fetchHistoricalRates(sellDate, sellDate);

      const purchaseRates = purchaseData.payload?.[0]?.rates || [];
      const sellRates = sellData.payload?.[0]?.rates || [];

      const purchaseRate = purchaseRates.find((r: any) => r.currency.iso3 === investCurrency);
      const sellRate = sellRates.find((r: any) => r.currency.iso3 === investCurrency);

      if (!purchaseRate || !sellRate) {
        toast({
          title: "Error",
          description: "Could not fetch rates for selected dates",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const purchaseValue = (investAmount * Number(purchaseRate.sell)) / purchaseRate.currency.unit;
      const sellValue = (investAmount * Number(sellRate.sell)) / sellRate.currency.unit;
      const profit = sellValue - purchaseValue;
      const profitPercent = (profit / purchaseValue) * 100;

      const daysDiff = Math.floor((new Date(sellDate).getTime() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
      const annualReturn = (profitPercent / daysDiff) * 365;

      setResult({
        purchaseValue,
        sellValue,
        profit,
        profitPercent,
        annualReturn,
        daysDiff
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to calculate profit/loss",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Profit/Loss Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Investment Amount</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={investAmount}
              onChange={(e) => setInvestAmount(Number(e.target.value))}
              className="border-2 py-3 text-base rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Currency</label>
            <Select value={investCurrency} onValueChange={setInvestCurrency}>
              <SelectTrigger className="border-2 py-3 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rates.map((rate: any) => (
                  <SelectItem key={rate.currency.iso3} value={rate.currency.iso3}>
                    {rate.currency.iso3} - {rate.currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Purchase Date</label>
            <DateInput
              value={purchaseDate}
              onChange={setPurchaseDate}
              className="border-2 py-3 text-base rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Sell Date</label>
            <DateInput
              value={sellDate}
              onChange={setSellDate}
              className="border-2 py-3 text-base rounded-xl"
            />
          </div>
        </div>

        <Button 
          onClick={calculateProfitLoss} 
          className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all rounded-xl"
          disabled={loading}
        >
          <TrendingUp className="mr-2 h-5 w-5" /> 
          {loading ? 'Calculating...' : 'Calculate Profit/Loss'}
        </Button>

        {result && (
          <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md space-y-3">
            <h3 className="text-lg font-bold text-gray-900">Results:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Purchase Value (NPR)</p>
                <p className="text-xl font-bold">{result.purchaseValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Sell Value (NPR)</p>
                <p className="text-xl font-bold">{result.sellValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Profit/Loss</p>
                <p className={`text-xl font-bold ${result.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {result.profit >= 0 ? '+' : ''}{result.profit.toLocaleString('en-US', { maximumFractionDigits: 2 })} NPR
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Profit %</p>
                <p className={`text-xl font-bold ${result.profitPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {result.profitPercent >= 0 ? '+' : ''}{result.profitPercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Annual Return Rate</p>
                <p className="text-xl font-bold">{result.annualReturn.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Days Held</p>
                <p className="text-xl font-bold">{result.daysDiff} days</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConverterProfitCalculator;
