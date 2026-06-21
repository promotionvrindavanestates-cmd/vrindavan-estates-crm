-- Phase 8C Migration: Customer 360 & Sales Intelligence

-- Create whatsapp_messages table
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
