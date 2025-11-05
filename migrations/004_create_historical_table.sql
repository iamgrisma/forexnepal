-- Migration 004: Create a "long" table for efficient historical lookups
-- This table is optimized for finding MIN/MAX rates over date ranges

-- 1. Create the new "long" table
CREATE TABLE IF NOT EXISTS forex_rates_historical (
  date          TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  buy_rate      REAL, -- Per-unit buy rate
  sell_rate     REAL, -- Per-unit sell rate
  PRIMARY KEY (date, currency_code)
) WITHOUT ROWID;

-- 2. Create indexes for MIN/MAX (statistic) queries
-- These are "covering indexes" which are extremely fast for this task.
-- D1 can find the MIN/MAX for a currency *without ever reading the table*.

CREATE INDEX IF NOT EXISTS idx_historical_code_buy_rate_date
  ON forex_rates_historical (currency_code, buy_rate, date);
  
CREATE INDEX IF NOT EXISTS idx_historical_code_sell_rate_date
  ON forex_rates_historical (currency_code, sell_rate, date);

-- 3. Create an index just for date (for cleanup or other potential queries)
CREATE INDEX IF NOT EXISTS idx_historical_date
  ON forex_rates_historical (date);
