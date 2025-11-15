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

// Session storage key
const SETTINGS_STORAGE_KEY = 'site_settings_cache';
const AUTH_STATE_KEY = 'authToken';

// API function with session storage caching
const fetchSiteSettings = async (): Promise<SiteSettings> => {
  // Check session storage first
  const cached = sessionStorage.getItem(SETTINGS_STORAGE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      sessionStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  }

  // Fetch from server
  try {
    const response = await fetch('/api/settings');
    if (!response.ok) throw new Error('Failed to fetch');
    const data = await response.json();
    const settings = data || { ticker_enabled: true, adsense_enabled: false };
    
    // Cache in session storage
    sessionStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return settings;
  } catch (e) {
    console.warn("Failed to fetch site settings, using defaults.");
    const defaults = { ticker_enabled: true, adsense_enabled: false };
    sessionStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
};

// Clear settings cache (call on auth state change)
export const clearSettingsCache = () => {
  sessionStorage.removeItem(SETTINGS_STORAGE_KEY);
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Track auth state to clear cache on login/logout
  React.useEffect(() => {
    const checkAuthChange = () => {
      const currentAuth = localStorage.getItem(AUTH_STATE_KEY);
      const prevAuth = sessionStorage.getItem('prev_auth_state');
      
      if (currentAuth !== prevAuth) {
        clearSettingsCache();
        sessionStorage.setItem('prev_auth_state', currentAuth || '');
      }
    };
    
    checkAuthChange();
    window.addEventListener('storage', checkAuthChange);
    return () => window.removeEventListener('storage', checkAuthChange);
  }, []);

  // Fetch settings with session storage caching
  const { data: settings } = useQuery({
    queryKey: ['publicSiteSettings'],
    queryFn: fetchSiteSettings,
    staleTime: Infinity, // Use session storage for caching
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
