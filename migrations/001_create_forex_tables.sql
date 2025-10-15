-- Create forex_rates table for caching historical data
CREATE TABLE IF NOT EXISTS forex_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency_code TEXT NOT NULL,
  currency_name TEXT NOT NULL,
  date TEXT NOT NULL,
  buy_rate REAL NOT NULL,
  sell_rate REAL NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(currency_code, date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_currency_date ON forex_rates(currency_code, date);
CREATE INDEX IF NOT EXISTS idx_date ON forex_rates(date);
