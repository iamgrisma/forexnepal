-- Add one-time login access codes table
CREATE TABLE IF NOT EXISTS one_time_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  code_type TEXT NOT NULL CHECK (code_type IN ('login', 'password_reset'))
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_access_code ON one_time_access(access_code);
CREATE INDEX IF NOT EXISTS idx_access_username ON one_time_access(username);

-- Remove plaintext_password column from users table
-- First copy any remaining plaintext to hash
UPDATE users SET password_hash = 
  CASE 
    WHEN password_hash IS NULL AND plaintext_password IS NOT NULL THEN
      -- Store a placeholder hash that will force password change
      '0000000000000000000000000000000000000000000000000000000000000000'
    ELSE password_hash
  END
WHERE plaintext_password IS NOT NULL;

-- Now we can safely drop the column
-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  email TEXT,
  is_active INTEGER DEFAULT 1,
  role TEXT DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy data
INSERT INTO users_new (id, username, password_hash, email, is_active, role, created_at, updated_at)
SELECT id, username, password_hash, email, is_active, role, created_at, updated_at
FROM users;

-- Drop old table and rename
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Update password_reset_tokens expiry to 15 minutes
-- Note: This is handled in the application logic when generating tokens
