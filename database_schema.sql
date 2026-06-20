-- =========================================================================
-- COMPLETE DATABASE BOOTSTRAP & PHASE 2 MIGRATION SCRIPT (SAFE & IDEMPOTENT)
-- =========================================================================
-- This script is designed to be executed in the Supabase SQL Editor.
-- It can be safely run on a fresh database state or a partially populated state.
-- It creates all base tables first, adds necessary columns/constraints/indexes,
-- and then applies Phase 2 migrations without dropping any existing tables or records.

-- -------------------------------------------------------------------------
-- 1. BASE TABLES CREATION (PHASE 1 CORE TABLES)
-- -------------------------------------------------------------------------

-- Create Users Table (Base)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'employee')),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    token_version INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Leads Table (Base)
CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(255),
    phone1 VARCHAR(50) NOT NULL,
    phone2 VARCHAR(50),
    budget VARCHAR(100),
    project VARCHAR(255),
    requirement TEXT,
    comments TEXT,
    status VARCHAR(50) CHECK (status IN ('Hot', 'Warm', 'Cold')),
    follow_up_date DATE,
    assigned_employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_date TIMESTAMP WITH TIME ZONE,
    last_call_date TIMESTAMP WITH TIME ZONE,
    last_response VARCHAR(100) CHECK (last_response IN ('Connected', 'Not Picked', 'Busy', 'Interested', 'Site Visit', 'Follow Up', 'Not Interested', 'Booked')),
    lead_source VARCHAR(100) CHECK (lead_source IN ('Facebook', 'Instagram', 'Google', 'Website', 'WhatsApp', 'Walk-In', 'Referral', 'MagicBricks', '99acres', 'Housing')),
    site_visit_date DATE,
    site_visit_status VARCHAR(100) CHECK (site_visit_status IN ('None', 'Scheduled', 'Completed', 'Cancelled')),
    site_visit_remarks TEXT,
    booking_token_amount NUMERIC(12, 2) DEFAULT 0.00,
    booking_date DATE,
    booking_status VARCHAR(100) CHECK (booking_status IN ('None', 'Pending', 'Confirmed', 'Cancelled'))
);

-- Create Call Logs Table (Base)
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    call_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    caller_id UUID REFERENCES users(id) ON DELETE SET NULL,
    response VARCHAR(100) NOT NULL,
    notes TEXT
);

-- Create Lead Transfers Table (Base)
CREATE TABLE IF NOT EXISTS lead_transfers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    from_employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    to_employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    transfer_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Audit Trails Table (Base)
CREATE TABLE IF NOT EXISTS audit_trails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Device Sessions Table (Base)
CREATE TABLE IF NOT EXISTS device_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255),
    os_version VARCHAR(50),
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE
);

-- Create Projects Table (Base)
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(100),
    location VARCHAR(255),
    rera VARCHAR(100),
    mvda VARCHAR(100),
    price_list_url TEXT,
    brochure_url TEXT,
    map_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Inventory Table (Base)
CREATE TABLE IF NOT EXISTS inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    unit_number VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Available' CHECK (status IN ('Available', 'Hold', 'Reserved', 'Booked', 'Sold')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Bookings Table (Base)
CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    unit_number VARCHAR(100),
    token_amount NUMERIC(12, 2) DEFAULT 0.00,
    booking_amount NUMERIC(12, 2) DEFAULT 0.00,
    booking_date DATE DEFAULT CURRENT_DATE,
    executive_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Payments Table (Base)
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    total_cost NUMERIC(12, 2) NOT NULL,
    amount_received NUMERIC(12, 2) DEFAULT 0.00,
    balance NUMERIC(12, 2) DEFAULT 0.00,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partial', 'Completed', 'Overdue')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Site Visits Table (Base)
CREATE TABLE IF NOT EXISTS site_visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    visit_time TIME NOT NULL,
    feedback TEXT,
    outcome VARCHAR(100),
    media_urls TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------------------
-- 2. BASE TABLE UPGRADES & EXTENSIONS (PHASE 1 EXTRA COLUMNS)
-- -------------------------------------------------------------------------

-- Extend Leads Table with Phase 1 additional attributes
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS profession VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS investor_or_end_user VARCHAR(50);

-- Safely add check constraint for investor_or_end_user
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_investor_or_end_user_check;
ALTER TABLE leads ADD CONSTRAINT leads_investor_or_end_user_check CHECK (investor_or_end_user IN ('Investor', 'End User'));

-- Safely update leads status check constraint (drop old status constraint first, then add the 12 custom statuses)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN ('New', 'Attempted', 'Connected', 'Interested', 'Hot', 'Warm', 'Cold', 'Site Visit Scheduled', 'Site Visit Done', 'Negotiation', 'Booked', 'Lost'));

-- -------------------------------------------------------------------------
-- 3. PHASE 2 SCHEMA MIGRATION (UPGRADES & NEW FEATURES)
-- -------------------------------------------------------------------------

-- A. Extend Leads Table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_activity_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- B. Extend Projects Table with Description, Coordinates and Media
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS approval_details TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS images TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS videos TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8);

-- C. Extend Inventory Table with property type, price and details
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS property_type VARCHAR(100);
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_property_type_check;
ALTER TABLE inventory ADD CONSTRAINT inventory_property_type_check CHECK (property_type IN ('Plot', 'Flat', 'Villa', 'Commercial'));

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

-- D. Extend Bookings Table with relations & statuses
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'Token Received';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('Token Received', 'Booked', 'Agreement Pending', 'Registered', 'Cancelled'));

-- E. Create Payment Installments History Table
CREATE TABLE IF NOT EXISTS payment_installments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    amount_paid NUMERIC(12, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_mode VARCHAR(100) CHECK (payment_mode IN ('Cash', 'Cheque', 'NEFT/RTGS', 'UPI', 'Other')),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- F. Create WhatsApp Automation Templates & Campaigns Tables
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    body_text TEXT NOT NULL,
    media_url TEXT,
    variables TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
    filters_used JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'Completed' CHECK (status IN ('Pending', 'Sending', 'Completed', 'Failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_campaign_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Sent' CHECK (status IN ('Sent', 'Delivered', 'Read', 'Replied', 'Failed')),
    response_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- G. Create Smart Assignment Engine Rules Table
CREATE TABLE IF NOT EXISTS distribution_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    method VARCHAR(50) DEFAULT 'Round Robin' CHECK (method IN ('Round Robin', 'Equal Distribution', 'Project Wise', 'Manual')),
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- H. Extend Site Visits Table with GPS Details & Durations
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS check_in_lat NUMERIC(10, 8);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS check_in_lng NUMERIC(11, 8);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS check_out_lat NUMERIC(10, 8);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS check_out_lng NUMERIC(11, 8);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS check_in_address TEXT;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS check_out_address TEXT;

-- -------------------------------------------------------------------------
-- 4. DATABASE INDEXES FOR PERFORMANCE & CONSTRAINT ENFORCEMENT
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_assigned_employee ON leads (assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_phone1 ON leads (phone1);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead ON call_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_transfers_lead ON lead_transfers (lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_trails_lead ON audit_trails (lead_id);
CREATE INDEX IF NOT EXISTS idx_inventory_project ON inventory (project_id);
CREATE INDEX IF NOT EXISTS idx_bookings_lead ON bookings (lead_id);
CREATE INDEX IF NOT EXISTS idx_bookings_project ON bookings (project_id);
CREATE INDEX IF NOT EXISTS idx_bookings_inventory ON bookings (inventory_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_installments_payment ON payment_installments (payment_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_logs_campaign ON whatsapp_campaign_logs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_logs_lead ON whatsapp_campaign_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_lead ON site_visits (lead_id);

-- -------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) LOCKDOWN DISABLE
-- -------------------------------------------------------------------------
-- Since the database is accessed securely through our Node.js API server acting as a middleware proxy,
-- we disable RLS to let the backend read and write to all tables without token-profile issues.
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trails DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_installments DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaign_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_rules DISABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 6. DATA SEEDING (ADMIN & EMPLOYEE DEFAULT ACCOUNTS)
-- -------------------------------------------------------------------------
-- Admin default: admin / admin123
-- Employee default: employee / employee123
INSERT INTO users (id, username, password_hash, role, full_name, phone, status, token_version)
VALUES 
('9f0a283f-df34-4bba-9571-b0dbb8830172', 'admin', '$2a$10$tZ2R8qB.NfS/tQ9/62pMteh986KjZfA1e6D41G7r8nJ9/Q67s9m82', 'admin', 'Vrindavan Admin', '9999999999', 'active', 1)
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (id, username, password_hash, role, full_name, phone, status, token_version)
VALUES 
('b19d45e0-32df-42b7-a35f-14984be01362', 'employee', '$2a$10$7Z2v8qB.NfS/tQ9/62pMteh986KjZfA1e6D41G7r8nJ9/Q67s9m82', 'employee', 'Gopal Sharma', '8888888888', 'active', 1)
ON CONFLICT (username) DO NOTHING;
