-- migration: 009_add_login_attempt_type.sql
-- Adds a 'type' column to distinguish between username-only checks and full logins for rate limiting.

-- Add the new column, allowing NULL temporarily
ALTER TABLE login_attempts ADD COLUMN type TEXT;

-- Set all existing login attempts to the 'login' type
UPDATE login_attempts SET type = 'login' WHERE type IS NULL;

-- (Note: D1 doesn't fully support NOT NULL with DEFAULT on ALTER TABLE, 
-- but new entries from the worker will now provide this value, so it's effectively NOT NULL for future rows)

-- Create a new index to optimize username-based rate limiting
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_type_time
ON login_attempts(username, type, attempt_time);
