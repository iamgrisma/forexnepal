// src/pages/Archive.tsx

import React from 'react';
import ArchiveDetail from './ArchiveDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

/**
 * Helper function to format a Date object as 'YYYY-MM-DD'
 */
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const Archive = () => {
  // --- NEW DATE LOGIC ---
  // This page now shows a dynamic range from the beginning of the
  // previous month up to the current day.

  const today = new Date();
  
  // 1. End date is today
  const endDate = formatDate(today); // e.g., "2025-11-11"

  // 2. Start date is the first day of the *previous* month
  //    new Date(year, monthIndex, day)
  //    today.getMonth() - 1 gets the previous month index
  const startOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const startDate = formatDate(startOfPreviousMonth); // e.g., "2025-10-01"
  
  // --- END NEW DATE LOGIC ---

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/archive">Archive</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Forex Rates Archive</CardTitle>
          <p className="text-muted-foreground">
            Displaying rates from {startDate} to {endDate}
          </p>
        </CardHeader>
        <CardContent>
          {/* The ArchiveDetail component now receives this dynamic range.
            All pagination logic has been removed.
          */}
          <ArchiveDetail 
            startDate={startDate} 
            endDate={endDate} 
            showTitle={false} 
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Archive;
