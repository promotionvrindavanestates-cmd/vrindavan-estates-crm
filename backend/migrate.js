require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DB = require('./db');

const LOCAL_DB_PATH = path.join(__dirname, 'database.json');

function isValidUuid(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Lead source normalizer to match Supabase CHECK constraints
function normalizeLeadSource(source) {
  if (!source) return 'Website';
  const key = String(source).trim().toLowerCase();
  
  if (key.includes('facebook') || key.includes('fb')) return 'Facebook';
  if (key.includes('instagram') || key.includes('insta')) return 'Instagram';
  if (key.includes('google') || key.includes('adwords')) return 'Google';
  if (key.includes('whatsapp')) return 'WhatsApp';
  if (key.includes('walk')) return 'Walk-In';
  if (key.includes('referral') || key.includes('reference') || key.includes('ref')) return 'Referral';
  if (key.includes('magicbricks') || key.includes('magic')) return 'MagicBricks';
  if (key.includes('99acres') || key.includes('acres')) return '99acres';
  if (key.includes('housing')) return 'Housing';
  
  return 'Website'; // Fallback
}

async function runMigration() {
  console.log('--- Supabase Data Migration (UUID Converter & Source Normalizer) ---');
  
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    console.error('No local database.json found to migrate.');
    process.exit(1);
  }

  if (!DB.isCloud()) {
    console.error('Supabase credentials are not correctly loaded in db.js. Check .env variables.');
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    const localData = JSON.parse(rawData);

    const userMap = {};
    const leadMap = {};

    // 1. Generate UUID mappings for users
    const mappedUsers = (localData.users || []).map(u => {
      let newId = u.id;
      if (!isValidUuid(u.id)) {
        newId = crypto.randomUUID();
        userMap[u.id] = newId;
      } else {
        userMap[u.id] = u.id;
      }
      return {
        ...u,
        id: newId
      };
    });

    // 2. Generate UUID mappings for leads and normalize lead source
    const mappedLeads = (localData.leads || []).map(l => {
      let newId = l.id;
      if (!isValidUuid(l.id)) {
        newId = crypto.randomUUID();
        leadMap[l.id] = newId;
      } else {
        leadMap[l.id] = l.id;
      }

      // Map foreign keys
      const assigned_employee_id = userMap[l.assigned_employee_id] || l.assigned_employee_id || null;
      const assigned_by_id = userMap[l.assigned_by_id] || l.assigned_by_id || null;

      return {
        ...l,
        id: newId,
        lead_source: normalizeLeadSource(l.lead_source), // Normalization check
        assigned_employee_id: isValidUuid(assigned_employee_id) ? assigned_employee_id : null,
        assigned_by_id: isValidUuid(assigned_by_id) ? assigned_by_id : null
      };
    });

    // 3. Map Call Logs
    const mappedCallLogs = (localData.call_logs || []).map(c => {
      return {
        ...c,
        id: crypto.randomUUID(),
        lead_id: leadMap[c.lead_id] || c.lead_id,
        caller_id: userMap[c.caller_id] || c.caller_id || null
      };
    });

    // 4. Map Lead Transfers
    const mappedTransfers = (localData.lead_transfers || []).map(t => {
      return {
        ...t,
        id: crypto.randomUUID(),
        lead_id: leadMap[t.lead_id] || t.lead_id,
        from_employee_id: userMap[t.from_employee_id] || t.from_employee_id || null,
        to_employee_id: userMap[t.to_employee_id] || t.to_employee_id || null,
        assigned_by: userMap[t.assigned_by] || t.assigned_by || null
      };
    });

    // 5. Map Audit Trails
    const mappedAudits = (localData.audit_trails || []).map(a => {
      return {
        ...a,
        id: crypto.randomUUID(),
        lead_id: leadMap[a.lead_id] || a.lead_id,
        user_id: userMap[a.user_id] || a.user_id || null
      };
    });

    console.log(`Successfully converted keys & normalized lead sources:`);
    console.log(`- Users: ${mappedUsers.length}`);
    console.log(`- Leads: ${mappedLeads.length}`);
    console.log(`- Call Logs: ${mappedCallLogs.length}`);
    console.log(`- Reassignments: ${mappedTransfers.length}`);
    console.log(`- Audit Logs: ${mappedAudits.length}`);

    const mappedData = {
      users: mappedUsers,
      leads: mappedLeads,
      call_logs: mappedCallLogs,
      lead_transfers: mappedTransfers,
      audit_trails: mappedAudits
    };

    console.log('\nRestoring data into Supabase PostgreSQL...');
    await DB.restoreData(mappedData);

    console.log('\nMigration completed successfully! All data has been written to Supabase cloud storage.');
    
    // Rename database.json to database.json.bak
    fs.renameSync(LOCAL_DB_PATH, LOCAL_DB_PATH + '.bak');
    console.log('Renamed database.json to database.json.bak to disable local fallback.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
