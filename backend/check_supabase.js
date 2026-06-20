const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkTable(tableName, columns = []) {
  try {
    let selectStr = '*';
    if (columns.length > 0) {
      selectStr = columns.join(',');
    }
    const { data, error } = await supabase
      .from(tableName)
      .select(selectStr)
      .limit(1);

    if (error) {
      return { exists: false, error: error.message };
    }
    return { exists: true };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

async function runAudit() {
  console.log('--- DATABASE SCHEMA AUDIT ---');
  
  const tablesToCheck = [
    { name: 'users', cols: ['username', 'role', 'status', 'token_version'] },
    { name: 'leads', cols: ['phone_whatsapp', 'state', 'profession', 'investor_or_end_user', 'last_activity_date'] },
    { name: 'call_logs', cols: ['response', 'notes'] },
    { name: 'lead_transfers', cols: ['from_employee_id', 'to_employee_id'] },
    { name: 'audit_trails', cols: ['device'] },
    { name: 'device_sessions', cols: ['device_name'] },
    { name: 'projects', cols: ['description', 'latitude', 'longitude'] },
    { name: 'inventory', cols: ['property_type', 'price', 'details'] },
    { name: 'bookings', cols: ['project_id', 'inventory_id', 'status'] },
    { name: 'payments', cols: ['total_cost', 'amount_received', 'balance'] },
    { name: 'payment_installments', cols: ['payment_mode'] },
    { name: 'whatsapp_templates', cols: ['body_text'] },
    { name: 'whatsapp_campaigns', cols: ['template_id', 'filters_used'] },
    { name: 'whatsapp_campaign_logs', cols: ['campaign_id', 'status'] },
    { name: 'distribution_rules', cols: ['method', 'config'] },
    { name: 'site_visits', cols: ['check_in_lat', 'check_in_lng', 'check_out_lat'] },
    { name: 'import_history', cols: ['filename', 'total_records', 'failed_logs'] },
    { name: 'reminders', cols: ['lead_id', 'title', 'reminder_date'] }
  ];

  for (const t of tablesToCheck) {
    const res = await checkTable(t.name, t.cols);
    if (res.exists) {
      console.log(`✅ Table '${t.name}': EXISTS, all checked columns exist.`);
    } else {
      console.log(`❌ Table '${t.name}': FAILED/MISSING columns. Error: ${res.error}`);
    }
  }
}

runAudit();
