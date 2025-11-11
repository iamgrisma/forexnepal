-- migration: 012_create_api_settings.sql
-- Creates tables for API access control, rate limiting, and quota management.

-- Table to store the rules for each API endpoint
CREATE TABLE IF NOT EXISTS api_access_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE NOT NULL, -- e.g., '/api/latest-rates', '/api/historical-rates'
  access_level TEXT NOT NULL DEFAULT 'public', -- 'public', 'disabled', 'restricted'
  
  -- JSON array of allowed IPs or domains for 'restricted' level
  -- Example: ["192.168.1.1", "forex.grisma.com.np", "*.example.com"]
  allowed_rules TEXT DEFAULT '[]',
  
  -- Requests per hour. -1 means unlimited.
  quota_per_hour INTEGER DEFAULT -1,
  
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default rules for all known public endpoints
INSERT OR IGNORE INTO api_access_settings (endpoint, access_level, quota_per_hour)
VALUES
  ('/api/settings', 'public', -1),
  ('/api/latest-rates', 'public', -1),
  ('/api/historical-rates', 'public', -1),
  ('/api/posts', 'public', -1),
  ('/api/posts/:slug', 'public', -1), -- Use a convention for dynamic routes
  ('/api/rates/date/:date', 'public', -1),
  ('/api/image/latest-rates', 'public', -1),  -- New Image API
  ('/api/archive/list', 'public', -1),         -- New Archive List API
  ('/api/archive/detail/:date', 'public', -1); -- New Archive Detail API

-- Table to log API requests for quota tracking
-- This table will be pruned periodically
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL, -- This will be an IP address or a domain
  endpoint TEXT NOT NULL,
  request_time TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index to quickly query usage by identifier, endpoint, and time
CREATE INDEX IF NOT EXISTS idx_api_usage 
ON api_usage_logs(identifier, endpoint, request_time);

-- Index to quickly prune old logs
CREATE INDEX IF NOT EXISTS idx_api_usage_time
ON api_usage_logs(request_time);
