// src/components/AdSense.tsx

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom'; // <-- IMPORT useLocation

// --- UPDATED: Settings interface ---
interface AdSettings {
  adsense_enabled: boolean;
  adsense_exclusions: string;
}

const AdSense: React.FC<{
  adClient: string;
  adSlot: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
  style?: React.CSSProperties;
  className?: string;
}> = ({
  adClient,
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
  style = { display: 'block' },
  className = '',
}) => {
  // --- NEW: State for settings and location ---
  const [settings, setSettings] = useState<AdSettings | null>(null);
  const location = useLocation();
  // --- END NEW ---

  useEffect(() => {
    // --- NEW: Fetch public settings ---
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings'); // Public endpoint
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        } else {
          // Fail-safe: don't show ads if settings can't be fetched
          setSettings({ adsense_enabled: false, adsense_exclusions: '' });
        }
      } catch (error) {
        console.error('Failed to fetch ad settings:', error);
        setSettings({ adsense_enabled: false, adsense_exclusions: '' });
      }
    };
    fetchSettings();
  }, []);
  // --- END NEW ---

  useEffect(() => {
    // This effect runs the ad script.
    // We only want to run it if settings are loaded and ads are enabled
    // and the page is not excluded.
    
    if (!settings || !settings.adsense_enabled) {
      return; // Don't run if ads are disabled in settings
    }

    // --- NEW: Check exclusion logic ---
    const excludedPaths = (settings.adsense_exclusions || '')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean); // Remove empty strings
      
    const isExcluded = excludedPaths.some(path => location.pathname.startsWith(path));

    if (isExcluded) {
      return; // Don't run if this path is excluded
    }
    // --- END NEW ---

    // If we are here, ads are enabled and page is not excluded
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (e) {
      console.error('AdSense push error:', e);
    }
  }, [adSlot, settings, location.pathname]); // Re-run if path or settings change

  // --- UPDATED: Render logic ---
  if (!settings) {
    return null; // Don't render anything while settings are loading
  }

  if (!settings.adsense_enabled) {
    return null; // Ads are disabled globally
  }

  const excludedPaths = (settings.adsense_exclusions || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
    
  const isExcluded = excludedPaths.some(path => location.pathname.startsWith(path));

  if (isExcluded) {
    return null; // This path is excluded
  }
  // --- END UPDATE ---

  // If we reach here, show the ad
  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={style}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive.toString()}
      ></ins>
    </div>
  );
};

export default AdSense;
