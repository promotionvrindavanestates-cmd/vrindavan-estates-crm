-- Phase 8B Migration: WhatsApp Communication Center & Priority Reminders

-- Create whatsapp_activities table
CREATE TABLE IF NOT EXISTS whatsapp_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL DEFAULT 'WhatsApp Opened',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create whatsapp_notes table
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

-- Add priority column to reminders table
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'Medium';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_activities_lead ON whatsapp_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notes_lead ON whatsapp_notes(lead_id);

-- Disable Row Level Security (RLS) as backend is proxy-driven
ALTER TABLE whatsapp_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_notes DISABLE ROW LEVEL SECURITY;
