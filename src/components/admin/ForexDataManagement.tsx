import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Edit, Save, RefreshCw } from 'lucide-react';
import DateInput from '@/components/DateInput'; // Assuming you have this component
import { formatDate } from '@/services/forexService'; // Import formatDate

// Define a simplified structure for the form/display
interface ForexRateData {
    date: string;
    [key: string]: string | number | null; // For currency rates like USD_buy, USD_sell
}

const CURRENCIES = [ // Match the list in worker.ts
  'INR', 'USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD', 'SGD',
  'JPY', 'CNY', 'SAR', 'QAR', 'THB', 'AED', 'MYR', 'KRW',
  'SEK', 'DKK', 'HKD', 'KWD', 'BHD', 'OMR'
];


const ForexDataManagement = () => {
  const [forexData, setForexData] = useState<ForexRateData[]>([]);
  const [editingData, setEditingData] = useState<ForexRateData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchForexData = async (date?: string) => {
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError("Authentication token not found.");
      setIsLoading(false);
      return;
    }

    const endpoint = date ? `/api/admin/forex-data?date=${date}` : '/api/admin/forex-data';

    try {
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      if (data.success) {
         if (date && data.data) {
             setEditingData({ date: date, ...data.data }); // Set for editing
             setForexData([]); // Clear list view when editing single date
         } else if (!date && Array.isArray(data.data)) {
             setForexData(data.data); // Set for list view
             setEditingData(null); // Clear editing view
         } else if (date && !data.data) {
              // Date not found, prepare for adding new data
              const newData: ForexRateData = { date };
              CURRENCIES.forEach(c => {
                 newData[`${c}_buy`] = null; // Initialize with null
                 newData[`${c}_sell`] = null;
              });
              setEditingData(newData);
              setForexData([]);
              toast({ title: "Info", description: `No data found for ${date}. You can add new rates.`});
         }
         else {
            setForexData([]);
            setEditingData(null);
         }
      } else {
        throw new Error(data.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch forex data');
      setForexData([]);
      setEditingData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchForexData(); // Fetch recent data on initial load
  }, []);

   const handleDateChange = (date: string) => {
       setSelectedDate(date);
       // Immediately fetch data for the selected date to edit/view
       if (date && date.length === 10) { // Basic validation
           fetchForexData(date);
       } else if (!date) {
            // If date is cleared, fetch recent list again
           fetchForexData();
       }
   };

   const handleEditValueChange = (currency: string, type: 'buy' | 'sell', value: string) => {
       if (!editingData) return;
       // Allow empty string or valid number input
       const numValue = value === '' ? null : parseFloat(value);
       if (value === '' || (!isNaN(numValue!) && numValue! >= 0)) {
           setEditingData({
               ...editingData,
               [`${currency}_${type}`]: numValue
           });
       }
   };


  const handleSave = async () => {
    if (!editingData) return;
    setIsSaving(true);
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({ title: "Error", description: "Authentication expired.", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    // Prepare payload, converting nulls or empty strings as needed by backend (worker expects numbers or will skip)
    const payload: { [key: string]: any } = { date: editingData.date };
     CURRENCIES.forEach(c => {
         const buyKey = `${c}_buy`;
         const sellKey = `${c}_sell`;
         // Send only if the value is a valid number
         const buyVal = editingData[buyKey];
         const sellVal = editingData[sellKey];
         if (typeof buyVal === 'number' && !isNaN(buyVal)) payload[buyKey] = buyVal;
         if (typeof sellVal === 'number' && !isNaN(sellVal)) payload[sellKey] = sellVal;
     });


    try {
      const response = await fetch('/api/admin/forex-data', {
        method: 'POST', // API uses POST for create/update
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: "Success", description: `Forex data for ${editingData.date} saved.` });
        // Optionally refetch the list view after saving
        fetchForexData();
      } else {
        throw new Error(data.error || "Failed to save data");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Could not save data.', variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Forex Data</CardTitle>
        <CardDescription>View recent entries or select a date to add/edit rates.</CardDescription>
        <div className="flex items-end gap-2 pt-4">
           <div className="flex-grow max-w-xs">
              <label htmlFor="forex-date" className="block text-sm font-medium mb-1">Select Date (YYYY-MM-DD)</label>
              <DateInput
                  id="forex-date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  placeholder="YYYY-MM-DD"
                  className="w-full"
              />
           </div>
           <Button variant="outline" size="sm" onClick={() => fetchForexData()} disabled={isLoading}>
              <RefreshCw className="h-4 w-4 mr-2"/>
              Show Recent
           </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="mb-4">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Editing/Adding View */}
        {!isLoading && !error && editingData && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Editing Rates for {editingData.date}</h3>
             <Alert variant="default">
                <Info className="h-4 w-4" />
                <AlertDescription>
                    Enter Buy and Sell rates. Leave fields blank if no rate is available for that currency on this date. Only valid numbers will be saved.
                </AlertDescription>
             </Alert>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {CURRENCIES.map((currency) => (
                <div key={currency} className="p-3 border rounded-md bg-muted/20">
                  <p className="font-semibold mb-2 text-sm">{currency}</p>
                  <div className="space-y-2">
                     <div>
                       <label htmlFor={`${currency}_buy`} className="text-xs text-muted-foreground">Buy</label>
                       <Input
                         id={`${currency}_buy`}
                         type="number"
                         step="any"
                         min="0"
                         value={editingData[`${currency}_buy`] ?? ''}
                         onChange={(e) => handleEditValueChange(currency, 'buy', e.target.value)}
                         placeholder="Buy rate"
                         className="h-8 text-sm"
                         disabled={isSaving}
                       />
                     </div>
                     <div>
                       <label htmlFor={`${currency}_sell`} className="text-xs text-muted-foreground">Sell</label>
                        <Input
                          id={`${currency}_sell`}
                          type="number"
                          step="any"
                          min="0"
                          value={editingData[`${currency}_sell`] ?? ''}
                          onChange={(e) => handleEditValueChange(currency, 'sell', e.target.value)}
                          placeholder="Sell rate"
                          className="h-8 text-sm"
                          disabled={isSaving}
                        />
                     </div>
                  </div>
                </div>
              ))}
            </div>
             <Button onClick={handleSave} disabled={isSaving}>
               {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               {isSaving ? 'Saving...' : 'Save Rates'}
             </Button>
          </div>
        )}

        {/* Recent Data List View */}
        {!isLoading && !error && !editingData && forexData.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No recent forex data found.</p>
        )}
        {!isLoading && !error && !editingData && forexData.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>USD Buy</TableHead>
                <TableHead>USD Sell</TableHead>
                <TableHead>EUR Buy</TableHead>
                <TableHead>EUR Sell</TableHead>
                 {/* Add more common currencies if needed */}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forexData.map((data) => (
                <TableRow key={data.date}>
                  <TableCell className="font-medium">{data.date}</TableCell>
                  <TableCell>{data.USD_buy ?? '-'}</TableCell>
                  <TableCell>{data.USD_sell ?? '-'}</TableCell>
                   <TableCell>{data.EUR_buy ?? '-'}</TableCell>
                  <TableCell>{data.EUR_sell ?? '-'}</TableCell>
                  {/* Add more cells */}
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDateChange(data.date)} // Trigger edit view
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ForexDataManagement;
