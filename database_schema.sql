-- Enterprise Database Schema Setup for Vrindavan Estates CRM
-- Copy and run this in your Supabase project's SQL Editor:

-- 1. Create Users Table with status and token versioning
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

-- 2. Create Leads Table
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

-- 3. Create Call History Logs Table
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    call_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    caller_id UUID REFERENCES users(id) ON DELETE SET NULL,
    response VARCHAR(100) NOT NULL,
    notes TEXT
);

-- 4. Create Lead Transfers History Table (Ownership Tracking)
CREATE TABLE IF NOT EXISTS lead_transfers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    from_employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    to_employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    transfer_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Audit Trails Table (Enterprise Action Tracking)
CREATE TABLE IF NOT EXISTS audit_trails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Row Level Security (RLS) Configuration:
-- Since the database is accessed securely through our Node.js API server acting as a middleware proxy,
-- we disable RLS to let the backend read and write to all tables without token-profile issues.
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trails DISABLE ROW LEVEL SECURITY;

-- 7. Seed default Admin and Employee accounts
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

-- 8. ALTER Leads Table for Enterprise CRM Upgrade
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS profession VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS investor_or_end_user VARCHAR(50) CHECK (investor_or_end_user IN ('Investor', 'End User'));

-- Drop old status check constraint if it exists and add the 12 custom statuses
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN ('New', 'Attempted', 'Connected', 'Interested', 'Hot', 'Warm', 'Cold', 'Site Visit Scheduled', 'Site Visit Done', 'Negotiation', 'Booked', 'Lost'));

-- 9. Create Projects Table
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

-- 10. Create Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    unit_number VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Available' CHECK (status IN ('Available', 'Hold', 'Reserved', 'Booked', 'Sold')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Create Bookings Table
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

-- 12. Create Payments Table
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

-- 13. Create Device Sessions Table
CREATE TABLE IF NOT EXISTS device_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255),
    os_version VARCHAR(50),
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE
);

-- 14. Create Site Visits Table
CREATE TABLE IF NOT EXISTS site_visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    visit_time TIME NOT NULL,
    feedback TEXT,
    outcome VARCHAR(100),
    media_urls TEXT[], -- Array of uploaded image/video URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disable RLS on new tables
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits DISABLE ROW LEVEL SECURITY;

