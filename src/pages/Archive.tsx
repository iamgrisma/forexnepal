import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, isBefore, isAfter } from 'date-fns';
import Layout from '@/components/Layout';

const ITEMS_PER_PAGE = 60; // 2 months worth of days

const Archive = () => {
  const { pageNumber } = useParams<{ pageNumber?: string }>();
  const currentPage = pageNumber ? parseInt(pageNumber) : 1;
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Generate year options (from 2000 to current year)
  const years = useMemo(() => {
    const yearList = [];
    for (let year = currentYear; year >= 2000; year--) {
      yearList.push(year.toString());
    }
    return yearList;
  }, [currentYear]);

  // Generate all dates from selected filters
  const allDates = useMemo(() => {
    const dates: Date[] = [];
    const yearNum = parseInt(selectedYear);
    
    if (selectedMonth === 'all') {
      // Generate all days for the entire year
      const maxMonth = yearNum === currentYear ? currentMonth : 12;
      for (let month = 1; month <= maxMonth; month++) {
        const start = new Date(yearNum, month - 1, 1);
        const end = endOfMonth(start);
        const monthDates = eachDayOfInterval({ start, end });
        dates.push(...monthDates.filter(date => !isAfter(date, currentDate)));
      }
    } else {
      // Generate days for selected month
      const monthNum = parseInt(selectedMonth);
      const start = new Date(yearNum, monthNum - 1, 1);
      const end = endOfMonth(start);
      const monthDates = eachDayOfInterval({ start, end });
      dates.push(...monthDates.filter(date => !isAfter(date, currentDate)));
    }
    
    return dates.sort((a, b) => b.getTime() - a.getTime()); // Newest first
  }, [selectedYear, selectedMonth, currentYear, currentMonth, currentDate]);

  // Group dates by month
  const groupedDates = useMemo(() => {
    const groups: { [key: string]: Date[] } = {};
    
    allDates.forEach(date => {
      const monthKey = format(date, 'MMMM yyyy');
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(date);
    });
    
    return groups;
  }, [allDates]);

  // Calculate pagination
  const totalPages = Math.ceil(allDates.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDates = allDates.slice(startIndex, endIndex);

  // Group paginated dates by month
  const paginatedGroupedDates = useMemo(() => {
    const groups: { [key: string]: Date[] } = {};
    
    paginatedDates.forEach(date => {
      const monthKey = format(date, 'MMMM yyyy');
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(date);
    });
    
    return groups;
  }, [paginatedDates]);

  const handleFilterChange = () => {
    // Reset to page 1 when filters change
    window.history.pushState({}, '', '/archive');
  };

  useEffect(() => {
    document.title = `Daily Archive - Page ${currentPage} | Nepal Rastra Bank`;
  }, [currentPage]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Daily Archive
          </h1>
          <p className="text-muted-foreground">
            Browse historical foreign exchange rates published by Nepal Rastra Bank
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filter Archives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Year</label>
                <Select value={selectedYear} onValueChange={(value) => { setSelectedYear(value); handleFilterChange(); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Month</label>
                <Select value={selectedMonth} onValueChange={(value) => { setSelectedMonth(value); handleFilterChange(); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Archive List */}
        <div className="space-y-6">
          {Object.entries(paginatedGroupedDates).map(([monthKey, dates]) => (
            <Card key={monthKey}>
              <CardHeader>
                <CardTitle className="text-2xl">{monthKey}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {dates.map(date => (
                    <li key={date.toISOString()}>
                      {/* --- THIS IS THE UPDATED LINK --- */}
                      <Link
                        to={`/daily-update/forex-for/${format(date, 'yyyy-MM-dd')}`}
                        className="block p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <span className="text-blue-600 hover:text-blue-700 font-medium">
                          Foreign Exchange Rate for {format(date, 'yyyy-MM-dd')} as per NRB
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              asChild={currentPage !== 1}
            >
              {currentPage === 1 ? (
                <span className="flex items-center gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
              ) : (
                <Link to={currentPage === 2 ? '/archive' : `/archive/page/${currentPage - 1}`} className="flex items-center gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              )}
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              asChild={currentPage !== totalPages}
            >
              {currentPage === totalPages ? (
                <span className="flex items-center gap-1">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
              ) : (
                <Link to={`/archive/page/${currentPage + 1}`} className="flex items-center gap-1">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
    </Layout>
  );
};

export default Archive;
