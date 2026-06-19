require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

let supabase = null;
const isSupabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY && process.env.SUPABASE_URL !== 'YOUR_SUPABASE_URL');

if (isSupabaseConfigured) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log('Using Supabase Cloud Database');
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err.message);
    supabase = null;
  }
}

// Local JSON DB fallback file
const LOCAL_DB_PATH = path.join(__dirname, 'database.json');

// Helper to load/save local database
function loadLocalDb() {
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const salt = bcrypt.genSaltSync(10);
    const adminPasswordHash = bcrypt.hashSync('admin123', salt);
    const employeePasswordHash = bcrypt.hashSync('employee123', salt);

    const initialDb = {
      users: [
        {
          id: 'admin-id-1',
          username: 'admin',
          password_hash: adminPasswordHash,
          role: 'admin',
          full_name: 'Vrindavan Admin',
          phone: '9999999999',
          status: 'active',
          token_version: 1,
          created_at: new Date().toISOString()
        },
        {
          id: 'employee-id-1',
          username: 'employee',
          password_hash: employeePasswordHash,
          role: 'employee',
          full_name: 'Gopal Sharma',
          phone: '8888888888',
          status: 'active',
          token_version: 1,
          created_at: new Date().toISOString()
        }
      ],
      leads: [
        {
          id: 'lead-id-1',
          created_at: new Date().toISOString(),
          name: 'Rajesh Kumar',
          city: 'Delhi',
          phone1: '9876543210',
          phone2: '9876543211',
          budget: '50-70 Lakhs',
          project: 'Vrindavan Heights',
          requirement: 'Looking for a 2 BHK apartment near Temple area.',
          comments: 'Interested in early possession.',
          status: 'Hot',
          follow_up_date: new Date().toISOString().split('T')[0],
          assigned_employee_id: 'employee-id-1',
          assigned_by_id: 'admin-id-1',
          assigned_date: new Date().toISOString(),
          lead_source: 'Facebook',
          last_call_date: new Date().toISOString(),
          last_response: 'Interested',
          site_visit_date: null,
          site_visit_status: 'None',
          site_visit_remarks: '',
          booking_token_amount: 0,
          booking_date: null,
          booking_status: 'None'
        }
      ],
      call_logs: [],
      lead_transfers: [],
      audit_trails: [
        {
          id: 'audit-id-1',
          lead_id: 'lead-id-1',
          action: 'Lead Created',
          details: 'Lead imported into local database system.',
          user_id: 'admin-id-1',
          user_name: 'Vrindavan Admin',
          created_at: new Date().toISOString()
        }
      ]
    };
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initialDb, null, 2), 'utf8');
    return initialDb;
  }
  try {
    const data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
    // Ensure migrations exist in local DB JSON structure
    if (!data.lead_transfers) data.lead_transfers = [];
    if (!data.audit_trails) data.audit_trails = [];
    data.users.forEach(u => {
      if (!u.status) u.status = 'active';
      if (!u.token_version) u.token_version = 1;
    });
    return data;
  } catch (e) {
    console.error('Failed to parse database.json, returning empty structure');
    return { users: [], leads: [], call_logs: [], lead_transfers: [], audit_trails: [] };
  }
}

function saveLocalDb(data) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function generateUuid() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const DB = {
  isCloud: () => isSupabaseConfigured && supabase !== null,

  // --- USERS ---
  async getUserByUsername(username) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    }
  },

  async getUserById(id) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.users.find(u => u.id === id) || null;
    }
  },

  async createUser(username, passwordHash, role, fullName, phone) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('users')
        .insert([{ username, password_hash: passwordHash, role, full_name: fullName, phone }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const newUser = {
        id: generateUuid(),
        username,
        password_hash: passwordHash,
        role,
        full_name: fullName,
        phone,
        status: 'active',
        token_version: 1,
        created_at: new Date().toISOString()
      };
      db.users.push(newUser);
      saveLocalDb(db);
      return newUser;
    }
  },

  async getAllEmployees() {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, phone, role, status, token_version')
        .eq('role', 'employee');
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.users.filter(u => u.role === 'employee').map(u => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        phone: u.phone,
        role: u.role,
        status: u.status,
        token_version: u.token_version
      }));
    }
  },

  async updateEmployeeStatus(id, newStatus) {
    if (this.isCloud()) {
      // 1. Get current user's token version
      const { data: user, error: fetchErr } = await supabase
        .from('users')
        .select('token_version')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      // 2. Increment token_version to force logout and set status
      const { data, error } = await supabase
        .from('users')
        .update({ 
          status: newStatus, 
          token_version: (user.token_version || 1) + 1 
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.users.findIndex(u => u.id === id);
      if (idx !== -1) {
        db.users[idx].status = newStatus;
        db.users[idx].token_version = (db.users[idx].token_version || 1) + 1;
        saveLocalDb(db);
        return db.users[idx];
      }
      throw new Error('Employee not found');
    }
  },

  // --- LEADS ---
  async checkDuplicateLead(phone1, phone2, excludeId = null) {
    if (!phone1 && !phone2) return null;
    
    // Normalize input mobile numbers (strip spaces/symbols)
    const p1 = phone1 ? phone1.replace(/\D/g, '') : 'NO_PHONE';
    const p2 = phone2 ? phone2.replace(/\D/g, '') : 'NO_PHONE';

    if (this.isCloud()) {
      // Postgres query using regex or ilike to match numbers
      // We will fetch leads and filter or do clean queries
      let query = supabase.from('leads').select('id, name, phone1, phone2, assigned_employee:users!assigned_employee_id(*)');
      
      if (excludeId) {
        query = query.neq('id', excludeId);
      }
      
      const { data: leadsList, error } = await query;
      if (error) throw error;
      
      // Look for matches
      for (const lead of leadsList) {
        const lp1 = lead.phone1 ? lead.phone1.replace(/\D/g, '') : '';
        const lp2 = lead.phone2 ? lead.phone2.replace(/\D/g, '') : '';
        
        if ((p1 && (lp1 === p1 || lp2 === p1)) || (p2 && (lp1 === p2 || lp2 === p2))) {
          return {
            id: lead.id,
            name: lead.name,
            owner: lead.assigned_employee ? lead.assigned_employee.full_name : 'Unassigned'
          };
        }
      }
      return null;
    } else {
      const db = loadLocalDb();
      for (const lead of db.leads) {
        if (excludeId && lead.id === excludeId) continue;
        
        const lp1 = lead.phone1 ? lead.phone1.replace(/\D/g, '') : '';
        const lp2 = lead.phone2 ? lead.phone2.replace(/\D/g, '') : '';
        
        if ((p1 && (lp1 === p1 || lp2 === p1)) || (p2 && (lp1 === p2 || lp2 === p2))) {
          const employee = db.users.find(u => u.id === lead.assigned_employee_id);
          return {
            id: lead.id,
            name: lead.name,
            owner: employee ? employee.full_name : 'Unassigned'
          };
        }
      }
      return null;
    }
  },

  async getLeads(filters = {}, userId, userRole) {
    if (this.isCloud()) {
      let query = supabase
        .from('leads')
        .select('*, assigned_employee:users!assigned_employee_id(*), assigned_by:users!assigned_by_id(*)');

      if (userRole === 'employee') {
        query = query.eq('assigned_employee_id', userId);
      }

      if (filters.search) {
        const term = `%${filters.search}%`;
        query = query.or(`name.ilike.${term},phone1.ilike.${term},phone2.ilike.${term},project.ilike.${term},city.ilike.${term}`);
      }
      if (filters.city) query = query.ilike('city', `%${filters.city}%`);
      if (filters.budget) query = query.ilike('budget', `%${filters.budget}%`);
      if (filters.project) query = query.ilike('project', `%${filters.project}%`);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.assigned_employee_id) query = query.eq('assigned_employee_id', filters.assigned_employee_id);
      if (filters.source) query = query.eq('lead_source', filters.source);
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      let results = [...db.leads];

      if (userRole === 'employee') {
        results = results.filter(l => l.assigned_employee_id === userId);
      }

      if (filters.search) {
        const term = filters.search.toLowerCase();
        results = results.filter(l => 
          (l.name && l.name.toLowerCase().includes(term)) ||
          (l.phone1 && l.phone1.toLowerCase().includes(term)) ||
          (l.phone2 && l.phone2.toLowerCase().includes(term)) ||
          (l.project && l.project.toLowerCase().includes(term)) ||
          (l.city && l.city.toLowerCase().includes(term))
        );
      }

      if (filters.city) results = results.filter(l => l.city && l.city.toLowerCase().includes(filters.city.toLowerCase()));
      if (filters.budget) results = results.filter(l => l.budget && l.budget.toLowerCase().includes(filters.budget.toLowerCase()));
      if (filters.project) results = results.filter(l => l.project && l.project.toLowerCase().includes(filters.project.toLowerCase()));
      if (filters.status) results = results.filter(l => l.status === filters.status);
      if (filters.assigned_employee_id) results = results.filter(l => l.assigned_employee_id === filters.assigned_employee_id);
      if (filters.source) results = results.filter(l => l.lead_source === filters.source);

      // Join employee details
      results = results.map(l => {
        const employee = db.users.find(u => u.id === l.assigned_employee_id);
        const assigner = db.users.find(u => u.id === l.assigned_by_id);
        return {
          ...l,
          assigned_employee: employee ? { id: employee.id, full_name: employee.full_name, username: employee.username } : null,
          assigned_by: assigner ? { id: assigner.id, full_name: assigner.full_name } : null
        };
      });

      return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async getLeadById(id, userId, userRole) {
    if (this.isCloud()) {
      let query = supabase
        .from('leads')
        .select('*, assigned_employee:users!assigned_employee_id(*), assigned_by:users!assigned_by_id(*)')
        .eq('id', id);
      if (userRole === 'employee') {
        query = query.eq('assigned_employee_id', userId);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const lead = db.leads.find(l => l.id === id);
      if (!lead) return null;
      if (userRole === 'employee' && lead.assigned_employee_id !== userId) return null;
      return lead;
    }
  },

  async createLead(leadData, assignerId = null) {
    const formattedLead = {
      name: leadData.name,
      city: leadData.city || '',
      phone1: leadData.phone1,
      phone2: leadData.phone2 || '',
      budget: leadData.budget || '',
      project: leadData.project || '',
      requirement: leadData.requirement || '',
      comments: leadData.comments || '',
      status: leadData.status || 'Warm',
      follow_up_date: leadData.follow_up_date || null,
      assigned_employee_id: leadData.assigned_employee_id || null,
      assigned_by_id: leadData.assigned_employee_id ? assignerId : null,
      assigned_date: leadData.assigned_employee_id ? new Date().toISOString() : null,
      lead_source: leadData.lead_source || 'Website',
      site_visit_date: leadData.site_visit_date || null,
      site_visit_status: leadData.site_visit_status || 'None',
      site_visit_remarks: leadData.site_visit_remarks || '',
      booking_token_amount: leadData.booking_token_amount ? parseFloat(leadData.booking_token_amount) : 0,
      booking_date: leadData.booking_date || null,
      booking_status: leadData.booking_status || 'None',
      last_call_date: leadData.last_call_date || null,
      last_response: leadData.last_response || null
    };

    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('leads')
        .insert([formattedLead])
        .select('*, assigned_employee:users!assigned_employee_id(*), assigned_by:users!assigned_by_id(*)')
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const newLead = {
        id: generateUuid(),
        created_at: new Date().toISOString(),
        ...formattedLead
      };
      db.leads.push(newLead);
      saveLocalDb(db);
      return newLead;
    }
  },

  async updateLead(id, leadData, userId, userRole) {
    const existing = await this.getLeadById(id, userId, userRole);
    if (!existing) throw new Error('Lead not found or unauthorized');

    // Role-based security check: employees cannot modify name or phone numbers
    const isEmployee = userRole === 'employee';
    
    // Set up assignment tracking details
    let assignedById = existing.assigned_by_id;
    let assignedDate = existing.assigned_date;
    
    // Admin only reassignment checks
    if (userRole === 'admin' && leadData.assigned_employee_id !== existing.assigned_employee_id) {
      assignedById = userId;
      assignedDate = new Date().toISOString();
      
      // Log lead transfer history
      await this.logLeadTransfer(id, existing.assigned_employee_id, leadData.assigned_employee_id, userId);
    }

    const updateFields = {
      name: isEmployee ? existing.name : leadData.name,
      city: leadData.city,
      phone1: isEmployee ? existing.phone1 : leadData.phone1,
      phone2: isEmployee ? existing.phone2 : leadData.phone2,
      budget: leadData.budget,
      project: leadData.project,
      requirement: leadData.requirement,
      comments: leadData.comments,
      status: leadData.status,
      follow_up_date: leadData.follow_up_date,
      assigned_employee_id: isEmployee ? existing.assigned_employee_id : leadData.assigned_employee_id,
      assigned_by_id: assignedById,
      assigned_date: assignedDate,
      lead_source: leadData.lead_source,
      site_visit_date: leadData.site_visit_date,
      site_visit_status: leadData.site_visit_status,
      site_visit_remarks: leadData.site_visit_remarks,
      booking_token_amount: leadData.booking_token_amount ? parseFloat(leadData.booking_token_amount) : 0,
      booking_date: leadData.booking_date,
      booking_status: leadData.booking_status,
      last_call_date: leadData.last_call_date,
      last_response: leadData.last_response
    };

    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('leads')
        .update(updateFields)
        .eq('id', id)
        .select('*, assigned_employee:users!assigned_employee_id(*), assigned_by:users!assigned_by_id(*)')
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.leads.findIndex(l => l.id === id);
      db.leads[idx] = {
        ...db.leads[idx],
        ...updateFields
      };
      saveLocalDb(db);
      return db.leads[idx];
    }
  },

  async deleteLead(id, userId, userRole) {
    if (userRole !== 'admin') throw new Error('Unauthorized: Only Admin can delete leads');

    if (this.isCloud()) {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
      return true;
    } else {
      const db = loadLocalDb();
      db.leads = db.leads.filter(l => l.id !== id);
      saveLocalDb(db);
      return true;
    }
  },

  async transferAllLeads(fromEmpId, toEmpId, adminUserId) {
    if (this.isCloud()) {
      // 1. Get all leads owned by fromEmpId
      const { data: leadsToTransfer, error: fetchErr } = await supabase
        .from('leads')
        .select('id')
        .eq('assigned_employee_id', fromEmpId);
      
      if (fetchErr) throw fetchErr;

      // 2. Perform bulk update
      const { error: updateErr } = await supabase
        .from('leads')
        .update({ 
          assigned_employee_id: toEmpId,
          assigned_by_id: adminUserId,
          assigned_date: new Date().toISOString()
        })
        .eq('assigned_employee_id', fromEmpId);
      
      if (updateErr) throw updateErr;

      // 3. Log transfers and audits
      const userName = (await this.getUserById(adminUserId))?.full_name || 'Admin';
      const toEmpName = (await this.getUserById(toEmpId))?.full_name || 'New Owner';
      
      for (const lead of leadsToTransfer) {
        await this.logLeadTransfer(lead.id, fromEmpId, toEmpId, adminUserId);
        await this.logAudit(
          lead.id, 
          'Lead Assigned/Transferred', 
          `Lead transferred bulk-wise from disabled employee to ${toEmpName}`, 
          adminUserId, 
          userName
        );
      }
      return leadsToTransfer.length;
    } else {
      const db = loadLocalDb();
      const admin = db.users.find(u => u.id === adminUserId);
      const adminName = admin ? admin.full_name : 'Admin';
      const toEmp = db.users.find(u => u.id === toEmpId);
      const toEmpName = toEmp ? toEmp.full_name : 'New Owner';

      let count = 0;
      db.leads.forEach(l => {
        if (l.assigned_employee_id === fromEmpId) {
          const fromEmpIdStored = l.assigned_employee_id;
          l.assigned_employee_id = toEmpId;
          l.assigned_by_id = adminUserId;
          l.assigned_date = new Date().toISOString();
          count++;
          
          // Log locally
          db.lead_transfers.push({
            id: generateUuid(),
            lead_id: l.id,
            from_employee_id: fromEmpIdStored,
            to_employee_id: toEmpId,
            assigned_by: adminUserId,
            transfer_date: new Date().toISOString()
          });

          db.audit_trails.push({
            id: generateUuid(),
            lead_id: l.id,
            action: 'Lead Assigned/Transferred',
            details: `Lead transferred bulk-wise from disabled employee to ${toEmpName}`,
            user_id: adminUserId,
            user_name: adminName,
            created_at: new Date().toISOString()
          });
        }
      });

      saveLocalDb(db);
      return count;
    }
  },

  // --- CALL LOGGING ---
  async logCall(leadId, callerId, response, notes) {
    if (this.isCloud()) {
      const { error: logError } = await supabase
        .from('call_logs')
        .insert([{ lead_id: leadId, caller_id: callerId, response, notes }]);
      if (logError) throw logError;

      const { data, error: updateError } = await supabase
        .from('leads')
        .update({
          last_call_date: new Date().toISOString(),
          last_response: response
        })
        .eq('id', leadId)
        .select('*, assigned_employee:users!assigned_employee_id(*), assigned_by:users!assigned_by_id(*)')
        .single();
      if (updateError) throw updateError;
      return data;
    } else {
      const db = loadLocalDb();
      const newLog = {
        id: generateUuid(),
        lead_id: leadId,
        caller_id: callerId,
        response,
        notes,
        call_date: new Date().toISOString()
      };
      db.call_logs.push(newLog);

      const idx = db.leads.findIndex(l => l.id === leadId);
      if (idx !== -1) {
        db.leads[idx].last_call_date = newLog.call_date;
        db.leads[idx].last_response = response;
      }
      saveLocalDb(db);
      return db.leads[idx];
    }
  },

  async getCallLogs(leadId) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*, caller:users!caller_id(id, full_name)')
        .eq('lead_id', leadId)
        .order('call_date', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.call_logs
        .filter(c => c.lead_id === leadId)
        .map(c => {
          const caller = db.users.find(u => u.id === c.caller_id);
          return {
            ...c,
            caller: caller ? { id: caller.id, full_name: caller.full_name } : null
          };
        })
        .sort((a, b) => new Date(b.call_date) - new Date(a.call_date));
    }
  },

  // --- OWNERSHIP TRANSFER TRACKING ---
  async logLeadTransfer(leadId, fromEmpId, toEmpId, assignedByUserId) {
    if (this.isCloud()) {
      const { error } = await supabase
        .from('lead_transfers')
        .insert([{
          lead_id: leadId,
          from_employee_id: fromEmpId,
          to_employee_id: toEmpId,
          assigned_by: assignedByUserId
        }]);
      if (error) throw error;
    } else {
      const db = loadLocalDb();
      db.lead_transfers.push({
        id: generateUuid(),
        lead_id: leadId,
        from_employee_id: fromEmpId,
        to_employee_id: toEmpId,
        assigned_by: assignedByUserId,
        transfer_date: new Date().toISOString()
      });
      saveLocalDb(db);
    }
  },

  async getTransferHistory(leadId) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('lead_transfers')
        .select('*, from_employee:users!from_employee_id(full_name), to_employee:users!to_employee_id(full_name), assigner:users!assigned_by(full_name)')
        .eq('lead_id', leadId)
        .order('transfer_date', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.lead_transfers
        .filter(t => t.lead_id === leadId)
        .map(t => {
          const fromEmp = db.users.find(u => u.id === t.from_employee_id);
          const toEmp = db.users.find(u => u.id === t.to_employee_id);
          const assigner = db.users.find(u => u.id === t.assigned_by);
          return {
            ...t,
            from_employee: fromEmp ? { full_name: fromEmp.full_name } : null,
            to_employee: toEmp ? { full_name: toEmp.full_name } : null,
            assigner: assigner ? { full_name: assigner.full_name } : null
          };
        })
        .sort((a, b) => new Date(b.transfer_date) - new Date(a.transfer_date));
    }
  },

  // --- AUDIT TRAILS ---
  async logAudit(leadId, action, details, userId, userName) {
    if (this.isCloud()) {
      const { error } = await supabase
        .from('audit_trails')
        .insert([{
          lead_id: leadId,
          action,
          details,
          user_id: userId,
          user_name: userName
        }]);
      if (error) throw error;
    } else {
      const db = loadLocalDb();
      db.audit_trails.push({
        id: generateUuid(),
        lead_id: leadId,
        action,
        details,
        user_id: userId,
        user_name: userName,
        created_at: new Date().toISOString()
      });
      saveLocalDb(db);
    }
  },

  async getAuditTrail(leadId) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('audit_trails')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.audit_trails
        .filter(a => a.lead_id === leadId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  // --- BACKUP & RESTORE ---
  async getBackupData() {
    if (this.isCloud()) {
      const { data: users, error: uErr } = await supabase.from('users').select('*');
      if (uErr) throw uErr;
      const { data: leads, error: lErr } = await supabase.from('leads').select('*');
      if (lErr) throw lErr;
      const { data: callLogs, error: cErr } = await supabase.from('call_logs').select('*');
      if (cErr) throw cErr;
      const { data: transfers, error: tErr } = await supabase.from('lead_transfers').select('*');
      if (tErr) throw tErr;
      const { data: audits, error: aErr } = await supabase.from('audit_trails').select('*');
      if (aErr) throw aErr;

      return { users, leads, call_logs: callLogs, lead_transfers: transfers, audit_trails: audits };
    } else {
      return loadLocalDb();
    }
  },

  async restoreData(backupData) {
    if (this.isCloud()) {
      await supabase.from('audit_trails').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('lead_transfers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('call_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      if (backupData.users && backupData.users.length > 0) {
        const { error } = await supabase.from('users').insert(backupData.users);
        if (error) throw error;
      }
      if (backupData.leads && backupData.leads.length > 0) {
        const { error } = await supabase.from('leads').insert(backupData.leads);
        if (error) throw error;
      }
      if (backupData.call_logs && backupData.call_logs.length > 0) {
        const { error } = await supabase.from('call_logs').insert(backupData.call_logs);
        if (error) throw error;
      }
      if (backupData.lead_transfers && backupData.lead_transfers.length > 0) {
        const { error } = await supabase.from('lead_transfers').insert(backupData.lead_transfers);
        if (error) throw error;
      }
      if (backupData.audit_trails && backupData.audit_trails.length > 0) {
        const { error } = await supabase.from('audit_trails').insert(backupData.audit_trails);
        if (error) throw error;
      }
      return true;
    } else {
      saveLocalDb(backupData);
      return true;
    }
  }
};

module.exports = DB;
