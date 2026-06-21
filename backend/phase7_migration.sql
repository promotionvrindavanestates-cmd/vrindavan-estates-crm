-- Phase 7 Migration: Smart Call Outcome & Lead Timeline Automation
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 0;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS action_taken VARCHAR(255);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS follow_up_time TIME;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS follow_up_datetime TIMESTAMP WITH TIME ZONE;
