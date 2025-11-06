-- Migration 007: Drop the forex_rates_historical table
-- We're simplifying the database structure to use only the forex_rates table

DROP TABLE IF EXISTS forex_rates_historical;
