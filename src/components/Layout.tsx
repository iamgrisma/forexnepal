import React, { createContext, useContext } from 'react';
import Navigation from './Navigation';
import Footer from './Footer';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

// Types for settings
type SiteSettings = {
  ticker_enabled: boolean;
  adsense_enabled: boolean;
};

// Context for settings
const SettingsContext = createContext<SiteSettings>({
  ticker_enabled: true,
  adsense_enabled: false,
});

// Hook to use settings
export const useSiteSettings = () => useContext(SettingsContext);

// API function
const fetchSiteSettings = async (): Promise<SiteSettings> => {
  try {
    const { data } = await apiClient.get('/settings');
    return data || { ticker_enabled: true, adsense_enabled: false };
  } catch (e) {
    console.warn("Failed to fetch site settings, using defaults.");
    return { ticker_enabled: true, adsense_enabled: false };
  }
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Fetch settings globally here
  const { data: settings } = useQuery({
    queryKey: ['publicSiteSettings'], // Use a public key
    queryFn: fetchSiteSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const settingsValue = settings || { ticker_enabled: true, adsense_enabled: false };
  
  return (
    <SettingsContext.Provider value={settingsValue}>
      <div className="flex flex-col min-h-screen">
        <Navigation />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </div>
    </SettingsContext.Provider>
  );
};

export default Layout;
