// src/hooks/use-mobile.tsx
import { useState, useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 768px)';

/**
 * A simple hook to check if the viewport is 'mobile' (<= 768px).
 * @returns {boolean} True if the viewport is mobile, false otherwise.
 */
export const useMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    
    // Set the initial value
    setIsMobile(mediaQuery.matches);

    // Listener function to update state on change
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    // Add listener
    mediaQuery.addEventListener('change', handleChange);

    // Clean up listener on unmount
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isMobile;
};
