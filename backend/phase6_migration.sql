-- Phase 6 Migration Script
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(4, 2) DEFAULT 1.50;
