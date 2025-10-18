-- Migration: Create admin users and posts tables
-- This migration creates tables for admin authentication and blog posts management

-- Create admin users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create user recovery table (empty means password is default)
CREATE TABLE IF NOT EXISTS user_recovery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recovery_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create login attempts table (for rate limiting)
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  session_id TEXT NOT NULL,
  username TEXT NOT NULL,
  attempt_time TEXT NOT NULL DEFAULT (datetime('now')),
  success INTEGER NOT NULL DEFAULT 0
);

-- Create index on login attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_session
ON login_attempts(ip_address, session_id, attempt_time);

-- Create posts table
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

-- Create index on posts slug
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

-- Create site settings table for header tags
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default admin user (username: ForexAdmin, password: Administrator)
-- Password hash is bcrypt hash of "Administrator"
INSERT OR IGNORE INTO users (username, password_hash)
VALUES ('ForexAdmin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

-- Insert default header tags setting
INSERT OR IGNORE INTO site_settings (setting_key, setting_value)
VALUES ('header_tags', '');
