-- === CONSOLIDATED & FIXED MIGRATIONS ===
-- This single file represents the final, combined schema without using ALTER statements.

-- Table: forex_rates
CREATE TABLE IF NOT EXISTS forex_rates (
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
CREATE INDEX IF NOT EXISTS idx_date ON forex_rates(date);

-- Table: users (Final combined schema)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  email TEXT UNIQUE,
  is_active INTEGER DEFAULT 1 NOT NULL,
  role TEXT DEFAULT 'admin' NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  full_name TEXT,
  mobile_number TEXT,
  profile_pic_url TEXT
);
-- Insert default admin (username: admin, password: admin)
INSERT OR IGNORE INTO users (username, password_hash, full_name)
VALUES ('admin', '0000000000000000000000000000000000000000000000000000000000000000', 'Default Admin');

-- Table: user_recovery
CREATE TABLE IF NOT EXISTS user_recovery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recovery_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Table: login_attempts
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  session_id TEXT NOT NULL,
  username TEXT NOT NULL,
  attempt_time TEXT NOT NULL DEFAULT (datetime('now')),
  success INTEGER NOT NULL DEFAULT 0,
  type TEXT
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_session
ON login_attempts(ip_address, session_id, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_type_time
ON login_attempts(username, type, attempt_time);

-- Table: posts
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image_url TEXT,
  author_name TEXT,
  author_url TEXT DEFAULT 'https://grisma.com.np/about',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

-- Table: site_settings
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT
);
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('ticker_enabled', 'true');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('adsense_enabled', 'false');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('adsense_exclusions', '/admin,/login');

-- Table: password_reset_tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_username ON password_reset_tokens(username);

-- Table: api_access_settings
CREATE TABLE IF NOT EXISTS api_access_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'public',
  allowed_rules TEXT DEFAULT '[]',
  quota_per_hour INTEGER DEFAULT -1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO api_access_settings (endpoint, access_level, quota_per_hour)
VALUES
  ('/api/settings', 'public', -1),
  ('/api/latest-rates', 'public', -1),
  ('/api/historical-rates', 'public', -1),
  ('/api/posts', 'public', -1),
  ('/api/posts/:slug', 'public', -1),
  ('/api/rates/date/:date', 'public', -1),
  ('/api/image/latest-rates', 'public', -1),
  ('/api/archive/list', 'public', -1),
  ('/api/archive/detail/:date', 'public', -1);

-- Table: api_usage_logs
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_time TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_api_usage 
ON api_usage_logs(identifier, endpoint, request_time);
CREATE INDEX IF NOT EXISTS idx_api_usage_time
ON api_usage_logs(request_time);

-- Table: email_verification_tokens (from the second file)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    new_email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (username) REFERENCES users (username) ON DELETE CASCADE
);
-- Create an index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens (token);
