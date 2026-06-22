-- =========================================================================
-- VRINDAVAN ESTATES CRM - CONSOLIDATED PHASE 8A & 8B DATABASE MIGRATION SCRIPT
-- =========================================================================
-- Safe and idempotent: can be executed repeatedly in the Supabase SQL Editor.
-- This script contains all missing columns/tables verified in the audit.

-- -------------------------------------------------------------------------
-- 1. Phase 8A: Call Intelligence (call_logs modifications)
-- -------------------------------------------------------------------------
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 0;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS action_taken VARCHAR(255);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS follow_up_time TIME;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS follow_up_datetime TIMESTAMP WITH TIME ZONE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_type VARCHAR(50) DEFAULT 'Outgoing';
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS synced_from_device BOOLEAN DEFAULT FALSE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS device_call_id VARCHAR(100) UNIQUE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS needs_notes BOOLEAN DEFAULT FALSE;

-- -------------------------------------------------------------------------
-- 2. Phase 8B: WhatsApp Synchronization & Timeline Integration
-- -------------------------------------------------------------------------

-- Create whatsapp_activities table (for logging "WhatsApp Opened" events)
CREATE TABLE IF NOT EXISTS whatsapp_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL DEFAULT 'WhatsApp Opened',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create whatsapp_notes table (for structured WhatsApp summaries)
CREATE TABLE IF NOT EXISTS whatsapp_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    discussion_summary TEXT,
    customer_interest VARCHAR(255),
    budget_discussion TEXT,
    objections TEXT,
    next_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create whatsapp_messages table (for simulated chat message logs)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    direction VARCHAR(50) NOT NULL, -- 'Incoming' or 'Outgoing'
    message_text TEXT,
    media_url VARCHAR(255),
    template_name VARCHAR(100),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extend reminders table with priority follow-up status
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'Medium';
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id);
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS completion_notes TEXT;


-- -------------------------------------------------------------------------
-- 3. Indexes & Security (Disable RLS for proxy backend)
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_whatsapp_activities_lead ON whatsapp_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notes_lead ON whatsapp_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead ON whatsapp_messages(lead_id);

ALTER TABLE whatsapp_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages DISABLE ROW LEVEL SECURITY;
