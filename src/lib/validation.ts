/**
 * Security utilities for input validation and sanitization
 */

/**
 * Validates if a date string is in the correct format (YYYY-MM-DD) and within reasonable bounds
 */
export const isValidDateString = (dateString: string): boolean => {
  if (!dateString) return false;
  
  // Check format using regex
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  // Parse the date and check if it's valid
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  
  // Check if the date is within reasonable bounds (not too far in past/future)
  const currentYear = new Date().getFullYear();
  const minYear = 2000; // NRB data likely doesn't go back before 2000
  const maxYear = currentYear + 1; // Allow up to next year
  
  const year = date.getFullYear();
  return year >= minYear && year <= maxYear;
};

/**
 * Sanitizes a date string by removing any non-date characters
 */
export const sanitizeDateInput = (input: string): string => {
  // Remove any characters that aren't digits or hyphens
  return input.replace(/[^\d-]/g, '');
};

/**
 * Validates if a date range is logical (from date is before or equal to to date)
 */
export const isValidDateRange = (fromDate: string, toDate: string): boolean => {
  if (!isValidDateString(fromDate) || !isValidDateString(toDate)) {
    return false;
  }
  
  const from = new Date(fromDate);
  const to = new Date(toDate);
  
  return from <= to;
};