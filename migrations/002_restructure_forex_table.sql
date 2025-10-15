-- Drop the old table structure
DROP TABLE IF EXISTS forex_rates;

-- Create new forex_rates table with one row per date
-- Each currency has buy/sell columns
CREATE TABLE forex_rates (
  date TEXT PRIMARY KEY NOT NULL,
  INR_buy REAL,
  INR_sell REAL,
  USD_buy REAL,
  USD_sell REAL,
  EUR_buy REAL,
  EUR_sell REAL,
  GBP_buy REAL,
  GBP_sell REAL,
  CHF_buy REAL,
  CHF_sell REAL,
  AUD_buy REAL,
  AUD_sell REAL,
  CAD_buy REAL,
  CAD_sell REAL,
  SGD_buy REAL,
  SGD_sell REAL,
  JPY_buy REAL,
  JPY_sell REAL,
  CNY_buy REAL,
  CNY_sell REAL,
  SAR_buy REAL,
  SAR_sell REAL,
  QAR_buy REAL,
  QAR_sell REAL,
  THB_buy REAL,
  THB_sell REAL,
  AED_buy REAL,
  AED_sell REAL,
  MYR_buy REAL,
  MYR_sell REAL,
  KRW_buy REAL,
  KRW_sell REAL,
  SEK_buy REAL,
  SEK_sell REAL,
  DKK_buy REAL,
  DKK_sell REAL,
  HKD_buy REAL,
  HKD_sell REAL,
  KWD_buy REAL,
  KWD_sell REAL,
  BHD_buy REAL,
  BHD_sell REAL,
  OMR_buy REAL,
  OMR_sell REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create index for faster date queries
CREATE INDEX idx_date ON forex_rates(date);
