-- =========================================================================
-- VRINDAVAN ESTATES CRM - PHASE 9 BULK LEAD DELETE & SOFT DELETE MIGRATION
-- =========================================================================
-- Safe and idempotent: can be executed repeatedly in the Supabase SQL Editor.

-- Add deleted_at column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index on deleted_at for fast query performance
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads(deleted_at);
