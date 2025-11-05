-- Migration 005: Fix the stats index to be hyper-efficient
-- The previous index (currency_code, buy_rate, date) was being ignored
-- by the query planner because of the date range filter.
-- This new, simpler index forces the planner to scan by rate, which is fast.

-- 1. Drop the inefficient indexes from migration 004
DROP INDEX IF EXISTS idx_historical_code_buy_rate_date;
DROP INDEX IF EXISTS idx_historical_code_sell_rate_date;

-- 2. Create the new, correct indexes (without the date column)
CREATE INDEX IF NOT EXISTS idx_historical_code_buy_rate
  ON forex_rates_historical (currency_code, buy_rate);
  
CREATE INDEX IF NOT EXISTS idx_historical_code_sell_rate
  ON forex_rates_historical (currency_code, sell_rate);
