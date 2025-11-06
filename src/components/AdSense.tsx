import React, { useEffect } from 'react';
import { useSiteSettings } from './Layout'; // Import the hook

interface AdSenseProps {
  client: string;
  slot: string;
  style?: React.CSSProperties;
  format?: string;
  responsive?: string;
  layout?: string;
  layoutKey?: string;
}

const AdSense: React.FC<AdSenseProps> = ({
  client,
  slot,
  style = { display: 'block' },
  format = 'auto',
  responsive = 'true',
  layout,
  layoutKey
}) => {
  const { adsense_enabled } = useSiteSettings(); // Get the setting

  useEffect(() => {
    if (!adsense_enabled) return; // Don't run if ads are disabled

    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('AdSense error:', e);
    }
  }, [adsense_enabled, slot]); // Re-run if ads are enabled/disabled or slot changes

  // Don't render the ad slot if ads are disabled
  if (!adsense_enabled) {
    return (
      <div 
        className="adsense-placeholder" 
        style={{ ...style, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '12px', minHeight: '90px' }}
      >
        {/* Ad Slot ({slot}) */}
      </div>
    );
  }

  return (
    <ins
      className="adsbygoogle"
      style={style}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive}
      data-ad-layout={layout}
      data-ad-layout-key={layoutKey}
    ></ins>
  );
};

export default AdSense;
