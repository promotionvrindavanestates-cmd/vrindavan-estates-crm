-- Phase 7 Enhancement Migration: Mobile Call Log Synchronization
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_type VARCHAR(50) DEFAULT 'Outgoing';
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS synced_from_device BOOLEAN DEFAULT FALSE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS device_call_id VARCHAR(100) UNIQUE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS needs_notes BOOLEAN DEFAULT FALSE;
