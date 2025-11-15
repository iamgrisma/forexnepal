import React from 'react';
import { cn } from "@/lib/utils";

const iso3ToIso2Map: { [key: string]: string } = {
  "USD": "us", "EUR": "eu", "GBP": "gb", "CHF": "ch", "AUD": "au",
  "CAD": "ca", "SGD": "sg", "JPY": "jp", "CNY": "cn", "SAR": "sa",
  "QAR": "qa", "THB": "th", "AED": "ae", "MYR": "my", "KRW": "kr",
  "SEK": "se", "DKK": "dk", "HKD": "hk", "KWD": "kw", "BHD": "bh",
  "OMR": "om", "INR": "in",
};

interface FlagIconProps {
  iso3: string;
  className?: string;
}

/**
 * Renders a flag icon using the 'flag-icon-css' library.
 * Converts 3-letter ISO currency code to 2-letter ISO country code.
 */
const FlagIcon: React.FC<FlagIconProps> = ({ iso3, className }) => {
  const iso2 = iso3ToIso2Map[iso3?.toUpperCase()] || null;

  if (!iso2) {
    return <span className={cn("fi fi-xx", className)}></span>; // 'xx' is a generic flag
  }

  return (
    <span className={cn(`fi fi-${iso2}`, className)}></span>
  );
};

export default FlagIcon;
