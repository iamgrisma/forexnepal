-- Migration 006: Add back the date index for Chart Pages
--
-- We already have indexes for stats (from migration 005):
--   - (currency_code, buy_rate)
--   - (currency_code, sell_rate)
--
-- We now MUST add an index for filtering by date, which is what the
-- chart pages do.
--
-- This combination of indexes will make *both* pages fast.

CREATE INDEX IF NOT EXISTS idx_historical_code_date
  ON forex_rates_historical (currency_code, date);
