// src/components/admin/DataUpdateControl.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CalendarIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type UpdateMode = 'today' | 'yesterday' | 'custom' | 'range';
type UpdateAction = 'update' | 'replace' | 'cancel';

const DataUpdateControl = () => {
  const [mode, setMode] = useState<UpdateMode>('today');
  const [customDate, setCustomDate] = useState<Date>();
  const [rangeFrom, setRangeFrom] = useState<Date>();
  const [rangeTo, setRangeTo] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async (action: UpdateAction) => {
    if (action === 'cancel') {
      setMode('today');
      setCustomDate(undefined);
      setRangeFrom(undefined);
      setRangeTo(undefined);
      return;
    }

    let fromDate: string;
    let toDate: string;
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

    switch (mode) {
      case 'today':
        fromDate = toDate = today;
        break;
      case 'yesterday':
        fromDate = toDate = yesterday;
        break;
      case 'custom':
        if (!customDate) {
          toast({ title: "Error", description: "Please select a date", variant: "destructive" });
          return;
        }
        fromDate = toDate = format(customDate, 'yyyy-MM-dd');
        break;
      case 'range':
        if (!rangeFrom || !rangeTo) {
          toast({ title: "Error", description: "Please select both dates", variant: "destructive" });
          return;
        }
        fromDate = format(rangeFrom, 'yyyy-MM-dd');
        toDate = format(rangeTo, 'yyyy-MM-dd');
        break;
      default:
        return;
    }

    setIsLoading(true);
    const token = localStorage.getItem('authToken');

    try {
      // --- FIX: Changed URL from /api/fetch-and-store to /api/admin/fetch-nrb ---
      const response = await fetch(`/api/admin/fetch-nrb?from=${fromDate}&to=${toDate}`, { // <-- FIXED URL
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }), // Pass the action in the body
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: `Action '${action}' completed. Stored/updated ${data.stored} record(s) from ${fromDate} to ${toDate}`,
        });
      } else {
        throw new Error(data.error || 'Update failed');
      }
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update database',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Update Database from API
        </CardTitle>
        <CardDescription>
          Fetch data from NRB API and update the database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Update Mode</label>
          <Select value={mode} onValueChange={(value) => setMode(value as UpdateMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="custom">Custom Date</SelectItem>
              <SelectItem value="range">Date Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === 'custom' && (
          <div>
            <label className="text-sm font-medium mb-2 block">Select Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !customDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDate ? format(customDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={setCustomDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {mode === 'range' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !rangeFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rangeFrom ? format(rangeFrom, 'PPP') : 'Pick start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeFrom}
                    onSelect={setRangeFrom}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !rangeTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rangeTo ? format(rangeTo, 'PPP') : 'Pick end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeTo}
                    onSelect={setRangeTo}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => handleUpdate('update')}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Empty
          </Button>
          <Button
            onClick={() => handleUpdate('replace')}
            disabled={isLoading}
            variant="secondary"
            className="flex-1"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Replace
          </Button>
          <Button
            onClick={() => handleUpdate('cancel')}
            disabled={isLoading}
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataUpdateControl;
