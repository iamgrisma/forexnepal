-- migration: 008_create_settings_table.sql
CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT
);

-- Insert default values
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('ticker_enabled', 'true');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('adsense_enabled', 'false');
