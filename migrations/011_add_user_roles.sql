-- Add role column to users table
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin' NOT NULL;

-- Add created_by column for audit trail
ALTER TABLE users ADD COLUMN created_by TEXT;

-- Add is_active column for user management
ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1 NOT NULL;
