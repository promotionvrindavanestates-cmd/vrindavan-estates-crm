# Vrindavan Estates CRM Portal

A complete, feature-rich Real Estate CRM designed specifically for Vrindavan Estates. The app is mobile-responsive and supports lead tracking, daily follow-ups, site visit scheduling, booking modules, cloud storage (via Supabase), and admin controls (bulk CSV/Excel imports, data backups, and employee accounts management).

---

## Technical Stack
* **Frontend**: React (SPA) built using Vite with modern dark theme and custom responsive styling.
* **Backend**: Node.js + Express API.
* **Database**: Supabase (PostgreSQL) with a local JSON DB fallback for offline or zero-config demo usage.

---

## Quick Start (Demo Mode)

The application features a hybrid "Demo Mode" that runs out-of-the-box using local storage (`database.json`) if Supabase is not configured yet.

### 1. Run the Backend Server
```bash
cd backend
npm install
npm start
```
*The server will start on port `5000`.*

### 2. Run the Frontend Dev Server
```bash
cd frontend
npm install
npm run dev
```
*The dev server will start on port `3000` (proxied to port 5000).*

### 3. Log In using Default Accounts:
* **Admin Role**: Username `admin` / Password `admin123`
* **Employee Role**: Username `employee` / Password `employee123`

---

## Production Cloud Setup (Supabase PostgreSQL)

To secure data in the cloud, connect the application to your Supabase project:

### 1. Setup Supabase Tables
1. Open your [Supabase Dashboard](https://supabase.com).
2. Create a new project.
3. Open the **SQL Editor** in the left sidebar.
4. Copy the SQL schema from [database_schema.sql](file:///C:/Users/abhin/.gemini/antigravity/scratch/vrindavan-estates-crm/database_schema.sql) and click **Run**. This will create the `users`, `leads`, and `call_logs` tables and seed default login credentials.

### 2. Configure Backend Credentials
1. Edit the environment configuration file [backend/.env](file:///C:/Users/abhin/.gemini/antigravity/scratch/vrindavan-estates-crm/backend/.env).
2. Replace the values with your Supabase credentials:
   ```env
   PORT=5000
   JWT_SECRET=any_random_string_secret
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-supabase-service-role-api-key
   ```
   *(Note: Use the **Service Role API Key** for server-side authorization bypass).*

3. Restart the backend server. The console should log `Using Supabase Cloud Database`.

---

## Features Walkthrough

### 1. Lead Fields & Lifecycle
The CRM tracks:
* **Lifecycle**: Name, City, Phone 1, Phone 2, Budget, Project, Requirement, Comments.
* **Status**: Hot / Warm / Cold.
* **Lead Source**: Facebook Ads, Instagram Ads, Google Ads, Website, WhatsApp, Reference, Walk-in.
* **Site Visits**: Site Visit Date, Site Visit Status (None, Scheduled, Completed, Cancelled), Remarks.
* **Bookings**: Token Amount, Booking Date, Booking Status (None, Pending, Confirmed, Cancelled).

### 2. Calling & WhatsApp Integrations
* **WhatsApp Icon**: Located beside each phone number. One click opens a WhatsApp chat on web/mobile with pre-filled professional greetings.
* **Call Icon**: Located beside each phone number. One click triggers a dialer link (`tel:`) and immediately opens the **Call Logger Dialog** to capture call status (Busy, Connected, Interested, Booked, etc.) and save notes.

### 3. Role-Based Security
* **Admin**: Access to the full dashboard, all leads, reassigning leads, managing employees, importing worksheets, and database backups.
* **Employee**: Restricted to viewing, searching, and logging calls *only* for leads assigned to them. They do not have access to employee registration or database backup controls.

### 4. Data Import / Export & Backup
* **Exports**: Download leads matching current view to CSV or Excel worksheets.
* **Imports (Admin Only)**: Bulk-import leads by uploading a CSV or Excel sheet.
* **System Backups**: One-click download of the complete JSON database backup. Database state can be restored by uploading this file in the imports tab.
