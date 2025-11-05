import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DatabaseZap, Info } from 'lucide-react';
import DateInput from '@/components/DateInput';
import { formatDate } from '@/services/forexService'; // Import the helper
import { addDays, differenceInDays, parseISO } from 'date-fns';

// Helper function to split date range into chunks
const splitDateRange = (startDate: string, endDate: string, maxDaysChunk = 90) => {
  const dateRanges: { from: string; to: string }[] = [];
  let currentStart = parseISO(startDate);
  const finalEnd = parseISO(endDate);

  while (currentStart <= finalEnd) {
    let currentEnd = addDays(currentStart, maxDaysChunk - 1);
    if (currentEnd > finalEnd) {
      currentEnd = finalEnd;
    }
    dateRanges.push({
      from: formatDate(currentStart),
      to: formatDate(currentEnd),
    });
    currentStart = addDays(currentEnd, 1);
  }
  return dateRanges;
};

const BackfillManager = () => {
  const [fromDate, setFromDate] = useState('2023-01-01');
  const [toDate, setToDate] = useState(formatDate(new Date()));
  const [isLoading, setIsLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const { toast } = useToast();

  const handleBackfill = async () => {
    setIsLoading(true);
    setLog([]);

    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({ title: "Error", description: "Authentication expired.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    setLog(prev => [...prev, `Starting backfill from ${fromDate} to ${toDate}...`]);
    
    // Split the date range into 90-day chunks
    const chunks = splitDateRange(fromDate, toDate, 90);
    setLog(prev => [...prev, `Splitting into ${chunks.length} chunk(s).`]);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      setLog(prev => [...prev, `[Chunk ${i + 1}/${chunks.length}] Fetching data from ${chunk.from} to ${chunk.to}...`]);

      try {
        const response = await fetch(`/api/fetch-and-store?from=${chunk.from}&to=${chunk.to}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (response.ok && data.success) {
          setLog(prev => [...prev, `[Chunk ${i + 1}/${chunks.length}] Success. Stored ${data.stored} day(s) of data.`]);
        } else {
          throw new Error(data.error || `Failed to fetch chunk ${i + 1}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setLog(prev => [...prev, `[Chunk ${i + 1}/${chunks.length}] FAILED: ${errorMsg}`]);
        toast({ title: "Backfill Error", description: `Failed on chunk ${i + 1}: ${errorMsg}`, variant: "destructive" });
        setIsLoading(false);
        return; // Stop on error
      }
    }

    setLog(prev => [...prev, "✅ Backfill Complete!"]);
    toast({ title: "Success", description: "Historical data backfill has completed." });
    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Database Backfill Manager</CardTitle>
        <CardDescription>
          Manually fetch historical data from the NRB API and store it in your D1 database.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>How this works</AlertTitle>
          <AlertDescription>
            This tool calls the NRB API in 90-day chunks for the selected date range. It populates *both* the daily (`forex_rates`) and historical (`forex_rates_historical`) tables. This is perfect for the one-time data population.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block" htmlFor="from-date">From Date</label>
            <DateInput
              id="from-date"
              value={fromDate}
              onChange={setFromDate}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" htmlFor="to-date">To Date</label>
            <DateInput
              id="to-date"
              value={toDate}
              onChange={setToDate}
              disabled={isLoading}
            />
          </div>
        </div>

        <Button onClick={handleBackfill} disabled={isLoading || !fromDate || !toDate}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DatabaseZap className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'Backfilling...' : 'Start Backfill'}
        </Button>

        {log.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-semibold">Log:</h4>
            <pre className="p-4 bg-muted rounded-md text-xs overflow-auto h-64">
              {log.join('\n')}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BackfillManager;
