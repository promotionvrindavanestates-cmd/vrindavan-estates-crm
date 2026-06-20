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
    if (!data.projects) data.projects = [];
    if (!data.inventory) data.inventory = [];
    if (!data.bookings) data.bookings = [];
    if (!data.payments) data.payments = [];
    if (!data.payment_installments) data.payment_installments = [];
    if (!data.whatsapp_templates) data.whatsapp_templates = [];
    if (!data.whatsapp_campaigns) data.whatsapp_campaigns = [];
    if (!data.whatsapp_campaign_logs) data.whatsapp_campaign_logs = [];
    if (!data.distribution_rules) data.distribution_rules = [];
    if (!data.site_visits) data.site_visits = [];
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
        .select('*, assigned_employee:users!assigned_employee_id(*), assigned_by:users!assigned_by_id(*)', { count: 'exact' });

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
      
      // Phase 3 Filters
      if (filters.created_start) query = query.gte('created_at', filters.created_start);
      if (filters.created_end) query = query.lte('created_at', filters.created_end);
      if (filters.follow_up_due) {
        const todayStr = new Date().toISOString().split('T')[0];
        query = query.lte('follow_up_date', todayStr);
      }
      if (filters.site_visit_completed) query = query.eq('site_visit_status', 'Completed');
      if (filters.calls_today === 'true') {
        const todayStr = new Date().toISOString().split('T')[0];
        query = query.gte('last_call_date', `${todayStr}T00:00:00.000Z`).lte('last_call_date', `${todayStr}T23:59:59.999Z`);
      }
      if (filters.phone) {
        const p = `%${filters.phone}%`;
        query = query.or(`phone1.ilike.${p},phone2.ilike.${p},phone_whatsapp.ilike.${p}`);
      }
      if (filters.executive) {
        const { data: emps } = await supabase.from('users').select('id').or(`full_name.ilike.%${filters.executive}%,username.ilike.%${filters.executive}%`);
        if (emps && emps.length > 0) {
          query = query.in('assigned_employee_id', emps.map(e => e.id));
        } else {
          query = query.eq('assigned_employee_id', '00000000-0000-0000-0000-000000000000'); // mismatch
        }
      }
      
      // Apply pagination range if page and limit exist
      if (filters.page && filters.limit) {
        const page = parseInt(filters.page);
        const limit = parseInt(filters.limit);
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
      }
      
      const { data, error, count } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      if (filters.page && filters.limit) {
        return {
          leads: data,
          total: count,
          page: parseInt(filters.page),
          limit: parseInt(filters.limit),
          pages: Math.ceil(count / parseInt(filters.limit))
        };
      }
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

      // Phase 3 Filters local
      if (filters.created_start) {
        results = results.filter(l => new Date(l.created_at) >= new Date(filters.created_start));
      }
      if (filters.created_end) {
        results = results.filter(l => new Date(l.created_at) <= new Date(filters.created_end));
      }
      if (filters.follow_up_due) {
        const todayStr = new Date().toISOString().split('T')[0];
        results = results.filter(l => l.follow_up_date && l.follow_up_date <= todayStr);
      }
      if (filters.site_visit_completed) {
        results = results.filter(l => l.site_visit_status === 'Completed');
      }
      if (filters.calls_today === 'true') {
        const todayStr = new Date().toISOString().split('T')[0];
        results = results.filter(l => l.last_call_date && l.last_call_date.startsWith(todayStr));
      }
      if (filters.phone) {
        const p = filters.phone.replace(/\D/g, '');
        results = results.filter(l => 
          (l.phone1 && l.phone1.replace(/\D/g, '').includes(p)) ||
          (l.phone2 && l.phone2.replace(/\D/g, '').includes(p)) ||
          (l.phone_whatsapp && l.phone_whatsapp.replace(/\D/g, '').includes(p))
        );
      }
      if (filters.executive) {
        const term = filters.executive.toLowerCase();
        results = results.filter(l => {
          const emp = db.users.find(u => u.id === l.assigned_employee_id);
          return emp && (emp.full_name.toLowerCase().includes(term) || emp.username.toLowerCase().includes(term));
        });
      }

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

      results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (filters.page && filters.limit) {
        const page = parseInt(filters.page);
        const limit = parseInt(filters.limit);
        const total = results.length;
        const from = (page - 1) * limit;
        const paginated = results.slice(from, from + limit);
        return {
          leads: paginated,
          total: total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        };
      }
      return results;
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
      state: leadData.state,
      phone1: isEmployee ? existing.phone1 : leadData.phone1,
      phone2: isEmployee ? existing.phone2 : leadData.phone2,
      phone_whatsapp: isEmployee ? existing.phone_whatsapp : leadData.phone_whatsapp,
      profession: leadData.profession,
      investor_or_end_user: leadData.investor_or_end_user,
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

  async getAllCallLogs() {
    if (this.isCloud()) {
      const { data, error } = await supabase.from('call_logs').select('*');
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.call_logs || [];
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
  },

  // --- PHASE 2: PROJECTS ---
  async getProjects() {
    if (this.isCloud()) {
      const { data, error } = await supabase.from('projects').select('*').order('name', { ascending: true });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.projects.sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  async getProjectById(id) {
    if (this.isCloud()) {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.projects.find(p => p.id === id) || null;
    }
  },

  async createProject(projectData) {
    const formatted = {
      name: projectData.name,
      type: projectData.type || '',
      location: projectData.location || '',
      rera: projectData.rera || '',
      mvda: projectData.mvda || '',
      price_list_url: projectData.price_list_url || '',
      brochure_url: projectData.brochure_url || '',
      map_link: projectData.map_link || '',
      description: projectData.description || '',
      approval_details: projectData.approval_details || '',
      images: projectData.images || [],
      videos: projectData.videos || []
    };
    if (this.isCloud()) {
      const { data, error } = await supabase.from('projects').insert([formatted]).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const newProj = { id: generateUuid(), created_at: new Date().toISOString(), ...formatted };
      db.projects.push(newProj);
      saveLocalDb(db);
      return newProj;
    }
  },

  async updateProject(id, projectData) {
    const formatted = {
      name: projectData.name,
      type: projectData.type,
      location: projectData.location,
      rera: projectData.rera,
      mvda: projectData.mvda,
      price_list_url: projectData.price_list_url,
      brochure_url: projectData.brochure_url,
      map_link: projectData.map_link,
      description: projectData.description,
      approval_details: projectData.approval_details,
      images: projectData.images,
      videos: projectData.videos
    };
    if (this.isCloud()) {
      const { data, error } = await supabase.from('projects').update(formatted).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.projects.findIndex(p => p.id === id);
      if (idx !== -1) {
        db.projects[idx] = { ...db.projects[idx], ...formatted };
        saveLocalDb(db);
        return db.projects[idx];
      }
      throw new Error('Project not found');
    }
  },

  async deleteProject(id) {
    if (this.isCloud()) {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      return true;
    } else {
      const db = loadLocalDb();
      db.projects = db.projects.filter(p => p.id !== id);
      saveLocalDb(db);
      return true;
    }
  },

  // --- PHASE 2: INVENTORY ---
  async getInventory(projectId = null) {
    if (this.isCloud()) {
      let query = supabase.from('inventory').select('*, projects(*)');
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      let list = db.inventory;
      if (projectId) {
        list = list.filter(i => i.project_id === projectId);
      }
      return list.map(i => {
        const proj = db.projects.find(p => p.id === i.project_id);
        return { ...i, projects: proj || null };
      });
    }
  },

  async getInventoryById(id) {
    if (this.isCloud()) {
      const { data, error } = await supabase.from('inventory').select('*, projects(*)').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const item = db.inventory.find(i => i.id === id);
      if (!item) return null;
      const proj = db.projects.find(p => p.id === item.project_id);
      return { ...item, projects: proj || null };
    }
  },

  async createInventory(invData) {
    const formatted = {
      project_id: invData.project_id,
      unit_number: invData.unit_number,
      status: invData.status || 'Available',
      property_type: invData.property_type || 'Flat',
      price: invData.price ? parseFloat(invData.price) : 0.00,
      details: invData.details || {}
    };
    if (this.isCloud()) {
      const { data, error } = await supabase.from('inventory').insert([formatted]).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const newItem = { id: generateUuid(), created_at: new Date().toISOString(), ...formatted };
      db.inventory.push(newItem);
      saveLocalDb(db);
      return newItem;
    }
  },

  async updateInventory(id, invData) {
    const formatted = {
      project_id: invData.project_id,
      unit_number: invData.unit_number,
      status: invData.status,
      property_type: invData.property_type,
      price: invData.price ? parseFloat(invData.price) : 0.00,
      details: invData.details
    };
    if (this.isCloud()) {
      const { data, error } = await supabase.from('inventory').update(formatted).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.inventory.findIndex(i => i.id === id);
      if (idx !== -1) {
        db.inventory[idx] = { ...db.inventory[idx], ...formatted };
        saveLocalDb(db);
        return db.inventory[idx];
      }
      throw new Error('Inventory unit not found');
    }
  },

  async updateInventoryStatus(id, status) {
    if (this.isCloud()) {
      const { data, error } = await supabase.from('inventory').update({ status }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.inventory.findIndex(i => i.id === id);
      if (idx !== -1) {
        db.inventory[idx].status = status;
        saveLocalDb(db);
        return db.inventory[idx];
      }
      throw new Error('Inventory unit not found');
    }
  },

  async deleteInventory(id) {
    if (this.isCloud()) {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      return true;
    } else {
      const db = loadLocalDb();
      db.inventory = db.inventory.filter(i => i.id !== id);
      saveLocalDb(db);
      return true;
    }
  },

  // --- PHASE 2: BOOKINGS ---
  async getBookings() {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, leads(*), users!executive_id(*), projects(*), inventory(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.bookings.map(b => {
        const lead = db.leads.find(l => l.id === b.lead_id);
        const exec = db.users.find(u => u.id === b.executive_id);
        const proj = db.projects.find(p => p.id === b.project_id);
        const inv = db.inventory.find(i => i.id === b.inventory_id);
        return {
          ...b,
          leads: lead || null,
          users: exec ? { id: exec.id, full_name: exec.full_name, username: exec.username } : null,
          projects: proj || null,
          inventory: inv || null
        };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async createBooking(bookingData, createdByUserId) {
    const formatted = {
      lead_id: bookingData.lead_id,
      project_id: bookingData.project_id || null,
      inventory_id: bookingData.inventory_id || null,
      unit_number: bookingData.unit_number || '',
      token_amount: bookingData.token_amount ? parseFloat(bookingData.token_amount) : 0.00,
      booking_amount: bookingData.booking_amount ? parseFloat(bookingData.booking_amount) : 0.00,
      booking_date: bookingData.booking_date || new Date().toISOString().split('T')[0],
      executive_id: bookingData.executive_id || createdByUserId,
      status: bookingData.status || 'Token Received'
    };

    if (this.isCloud()) {
      // 1. Create Booking
      const { data: booking, error: bErr } = await supabase.from('bookings').insert([formatted]).select().single();
      if (bErr) throw bErr;

      // 2. Initialize Payment Tracking
      const totalCost = bookingData.total_cost ? parseFloat(bookingData.total_cost) : 0.00;
      const initialReceived = formatted.booking_amount + formatted.token_amount;
      const balance = totalCost - initialReceived;
      const dueDays = bookingData.due_days ? parseInt(bookingData.due_days) : 30;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      const payFormatted = {
        booking_id: booking.id,
        total_cost: totalCost,
        amount_received: initialReceived,
        balance: balance,
        due_date: dueDate.toISOString().split('T')[0],
        status: balance <= 0 ? 'Completed' : (initialReceived > 0 ? 'Partial' : 'Pending')
      };

      const { data: payment, error: pErr } = await supabase.from('payments').insert([payFormatted]).select().single();
      if (pErr) throw pErr;

      // 3. Mark inventory status as Booked
      if (formatted.inventory_id) {
        await supabase.from('inventory').update({ status: 'Booked' }).eq('id', formatted.inventory_id);
      }

      // 4. Update lead status to Booked
      await supabase.from('leads').update({
        status: 'Booked',
        booking_token_amount: formatted.token_amount,
        booking_date: formatted.booking_date,
        booking_status: 'Confirmed'
      }).eq('id', formatted.lead_id);

      return { booking, payment };
    } else {
      const db = loadLocalDb();
      const newBooking = { id: generateUuid(), created_at: new Date().toISOString(), ...formatted };
      db.bookings.push(newBooking);

      const totalCost = bookingData.total_cost ? parseFloat(bookingData.total_cost) : 0.00;
      const initialReceived = formatted.booking_amount + formatted.token_amount;
      const balance = totalCost - initialReceived;
      const dueDays = bookingData.due_days ? parseInt(bookingData.due_days) : 30;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      const newPayment = {
        id: generateUuid(),
        booking_id: newBooking.id,
        total_cost: totalCost,
        amount_received: initialReceived,
        balance: balance,
        due_date: dueDate.toISOString().split('T')[0],
        status: balance <= 0 ? 'Completed' : (initialReceived > 0 ? 'Partial' : 'Pending'),
        created_at: new Date().toISOString()
      };
      db.payments.push(newPayment);

      if (formatted.inventory_id) {
        const invIdx = db.inventory.findIndex(i => i.id === formatted.inventory_id);
        if (invIdx !== -1) db.inventory[invIdx].status = 'Booked';
      }

      const leadIdx = db.leads.findIndex(l => l.id === formatted.lead_id);
      if (leadIdx !== -1) {
        db.leads[leadIdx].status = 'Booked';
        db.leads[leadIdx].booking_token_amount = formatted.token_amount;
        db.leads[leadIdx].booking_date = formatted.booking_date;
        db.leads[leadIdx].booking_status = 'Confirmed';
      }

      saveLocalDb(db);
      return { booking: newBooking, payment: newPayment };
    }
  },

  async updateBookingStatus(id, status, adminUserId) {
    if (this.isCloud()) {
      const { data: booking, error: bErr } = await supabase.from('bookings').update({ status }).eq('id', id).select().single();
      if (bErr) throw bErr;

      // Handle Cancelled booking inventory release
      if (status === 'Cancelled' && booking.inventory_id) {
        await supabase.from('inventory').update({ status: 'Available' }).eq('id', booking.inventory_id);
        await supabase.from('leads').update({ status: 'Lost', booking_status: 'Cancelled' }).eq('id', booking.lead_id);
      } else if (status === 'Registered' && booking.lead_id) {
        // Keep status as Booked, lead is converted completely
        await supabase.from('leads').update({ booking_status: 'Confirmed' }).eq('id', booking.lead_id);
      }

      return booking;
    } else {
      const db = loadLocalDb();
      const idx = db.bookings.findIndex(b => b.id === id);
      if (idx !== -1) {
        db.bookings[idx].status = status;
        const booking = db.bookings[idx];

        if (status === 'Cancelled') {
          if (booking.inventory_id) {
            const invIdx = db.inventory.findIndex(i => i.id === booking.inventory_id);
            if (invIdx !== -1) db.inventory[invIdx].status = 'Available';
          }
          const leadIdx = db.leads.findIndex(l => l.id === booking.lead_id);
          if (leadIdx !== -1) {
            db.leads[leadIdx].status = 'Lost';
            db.leads[leadIdx].booking_status = 'Cancelled';
          }
        } else if (status === 'Registered') {
          const leadIdx = db.leads.findIndex(l => l.id === booking.lead_id);
          if (leadIdx !== -1) {
            db.leads[leadIdx].booking_status = 'Confirmed';
          }
        }
        saveLocalDb(db);
        return booking;
      }
      throw new Error('Booking not found');
    }
  },

  // --- PHASE 2: PAYMENTS & INSTALLMENTS ---
  async getPayments() {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('payments')
        .select('*, bookings(*, leads(*), projects(*), inventory(*))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.payments.map(p => {
        const booking = db.bookings.find(b => b.id === p.booking_id);
        let bkWithJoins = null;
        if (booking) {
          const lead = db.leads.find(l => l.id === booking.lead_id);
          const proj = db.projects.find(pr => pr.id === booking.project_id);
          const inv = db.inventory.find(i => i.id === booking.inventory_id);
          bkWithJoins = { ...booking, leads: lead || null, projects: proj || null, inventory: inv || null };
        }
        return { ...p, bookings: bkWithJoins };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async getPaymentById(id) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('payments')
        .select('*, bookings(*, leads(*), projects(*), inventory(*))')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const p = db.payments.find(p => p.id === id);
      if (!p) return null;
      const booking = db.bookings.find(b => b.id === p.booking_id);
      let bkWithJoins = null;
      if (booking) {
        const lead = db.leads.find(l => l.id === booking.lead_id);
        const proj = db.projects.find(pr => pr.id === booking.project_id);
        const inv = db.inventory.find(i => i.id === booking.inventory_id);
        bkWithJoins = { ...booking, leads: lead || null, projects: proj || null, inventory: inv || null };
      }
      return { ...p, bookings: bkWithJoins };
    }
  },

  async createPaymentInstallment(paymentId, amountPaid, paymentMode, remarks = '') {
    const formatted = {
      payment_id: paymentId,
      amount_paid: parseFloat(amountPaid),
      payment_mode: paymentMode || 'UPI',
      remarks: remarks || '',
      payment_date: new Date().toISOString().split('T')[0]
    };

    if (this.isCloud()) {
      // 1. Fetch current payment details
      const { data: pay, error: fetchErr } = await supabase.from('payments').select('*').eq('id', paymentId).single();
      if (fetchErr) throw fetchErr;

      // 2. Add installment
      const { data: installment, error: insErr } = await supabase.from('payment_installments').insert([formatted]).select().single();
      if (insErr) throw insErr;

      // 3. Update payment running balance
      const newReceived = (pay.amount_received || 0) + formatted.amount_paid;
      const newBalance = pay.total_cost - newReceived;
      const newStatus = newBalance <= 0 ? 'Completed' : (newReceived > 0 ? 'Partial' : 'Pending');

      const { data: updatedPay, error: upErr } = await supabase
        .from('payments')
        .update({ amount_received: newReceived, balance: newBalance, status: newStatus })
        .eq('id', paymentId)
        .select()
        .single();
      if (upErr) throw upErr;

      return { installment, payment: updatedPay };
    } else {
      const db = loadLocalDb();
      const payIdx = db.payments.findIndex(p => p.id === paymentId);
      if (payIdx === -1) throw new Error('Payment schedule not found');

      const pay = db.payments[payIdx];
      const newInstallment = { id: generateUuid(), created_at: new Date().toISOString(), ...formatted };
      db.payment_installments.push(newInstallment);

      const newReceived = (pay.amount_received || 0) + formatted.amount_paid;
      const newBalance = pay.total_cost - newReceived;
      const newStatus = newBalance <= 0 ? 'Completed' : (newReceived > 0 ? 'Partial' : 'Pending');

      db.payments[payIdx].amount_received = newReceived;
      db.payments[payIdx].balance = newBalance;
      db.payments[payIdx].status = newStatus;

      saveLocalDb(db);
      return { installment: newInstallment, payment: db.payments[payIdx] };
    }
  },

  async getPaymentInstallments(paymentId) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('payment_installments')
        .select('*')
        .eq('payment_id', paymentId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.payment_installments
        .filter(pi => pi.payment_id === paymentId)
        .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
    }
  },

  // --- PHASE 2: WHATSAPP AUTOMATION ---
  async getWhatsAppTemplates() {
    if (this.isCloud()) {
      const { data, error } = await supabase.from('whatsapp_templates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.whatsapp_templates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async getWhatsAppTemplateById(id) {
    if (this.isCloud()) {
      const { data, error } = await supabase.from('whatsapp_templates').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.whatsapp_templates.find(t => t.id === id) || null;
    }
  },

  async createWhatsAppTemplate(templateData) {
    const formatted = {
      name: templateData.name,
      category: templateData.category || 'Utility',
      body_text: templateData.body_text,
      media_url: templateData.media_url || '',
      variables: templateData.variables || []
    };
    if (this.isCloud()) {
      const { data, error } = await supabase.from('whatsapp_templates').insert([formatted]).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const newTemp = { id: generateUuid(), created_at: new Date().toISOString(), ...formatted };
      db.whatsapp_templates.push(newTemp);
      saveLocalDb(db);
      return newTemp;
    }
  },

  async getWhatsAppCampaigns() {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('whatsapp_campaigns')
        .select('*, whatsapp_templates(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.whatsapp_campaigns.map(c => {
        const temp = db.whatsapp_templates.find(t => t.id === c.template_id);
        return { ...c, whatsapp_templates: temp || null };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async createWhatsAppCampaign(campaignData, logsList) {
    const formatted = {
      name: campaignData.name,
      template_id: campaignData.template_id,
      filters_used: campaignData.filters_used || {},
      status: 'Completed'
    };

    if (this.isCloud()) {
      // 1. Insert Campaign
      const { data: campaign, error: cErr } = await supabase.from('whatsapp_campaigns').insert([formatted]).select().single();
      if (cErr) throw cErr;

      // 2. Insert Logs
      const logsToInsert = logsList.map(log => ({
        campaign_id: campaign.id,
        lead_id: log.lead_id,
        phone: log.phone,
        message_text: log.message_text,
        status: log.status || 'Sent'
      }));

      const { data: campaignLogs, error: lErr } = await supabase.from('whatsapp_campaign_logs').insert(logsToInsert).select();
      if (lErr) throw lErr;

      return { campaign, campaignLogs };
    } else {
      const db = loadLocalDb();
      const newCamp = { id: generateUuid(), created_at: new Date().toISOString(), ...formatted };
      db.whatsapp_campaigns.push(newCamp);

      const logsToInsert = logsList.map(log => ({
        id: generateUuid(),
        campaign_id: newCamp.id,
        lead_id: log.lead_id,
        phone: log.phone,
        message_text: log.message_text,
        status: log.status || 'Sent',
        created_at: new Date().toISOString()
      }));
      db.whatsapp_campaign_logs.push(...logsToInsert);

      saveLocalDb(db);
      return { campaign: newCamp, campaignLogs: logsToInsert };
    }
  },

  async getWhatsAppCampaignLogs(campaignId) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('whatsapp_campaign_logs')
        .select('*, leads(*)')
        .eq('campaign_id', campaignId);
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      return db.whatsapp_campaign_logs
        .filter(l => l.campaign_id === campaignId)
        .map(l => {
          const lead = db.leads.find(le => le.id === l.lead_id);
          return { ...l, leads: lead || null };
        });
    }
  },

  async updateWhatsAppLogStatus(logId, status, responseDetails = '') {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('whatsapp_campaign_logs')
        .update({ status, response_details: responseDetails })
        .eq('id', logId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.whatsapp_campaign_logs.findIndex(l => l.id === logId);
      if (idx !== -1) {
        db.whatsapp_campaign_logs[idx].status = status;
        db.whatsapp_campaign_logs[idx].response_details = responseDetails;
        saveLocalDb(db);
        return db.whatsapp_campaign_logs[idx];
      }
      throw new Error('Log entry not found');
    }
  },

  // --- PHASE 2: SMART DISTRIBUTION RULES ---
  async getDistributionRules() {
    if (this.isCloud()) {
      const { data, error } = await supabase.from('distribution_rules').select('*').limit(1).maybeSingle();
      if (error) throw error;
      if (!data) {
        // Seed default
        const defaultRule = { method: 'Round Robin', is_active: true, config: {} };
        const { data: seeded, error: seedErr } = await supabase.from('distribution_rules').insert([defaultRule]).select().single();
        if (seedErr) throw seedErr;
        return seeded;
      }
      return data;
    } else {
      const db = loadLocalDb();
      if (db.distribution_rules.length === 0) {
        const defaultRule = { id: generateUuid(), method: 'Round Robin', is_active: true, config: {}, updated_at: new Date().toISOString() };
        db.distribution_rules.push(defaultRule);
        saveLocalDb(db);
        return defaultRule;
      }
      return db.distribution_rules[0];
    }
  },

  async updateDistributionRules(method, isActive, config) {
    const rules = await this.getDistributionRules();
    const updated = {
      method,
      is_active: isActive,
      config,
      updated_at: new Date().toISOString()
    };
    if (this.isCloud()) {
      const { data, error } = await supabase.from('distribution_rules').update(updated).eq('id', rules.id).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.distribution_rules.findIndex(r => r.id === rules.id);
      db.distribution_rules[idx] = { ...db.distribution_rules[idx], ...updated };
      saveLocalDb(db);
      return db.distribution_rules[idx];
    }
  },

  // --- PHASE 2: GEOLOCATION SITE VISITS ---
  async checkInSiteVisit(leadId, checkInTime, lat, lng, address) {
    const timeStr = new Date(checkInTime).toTimeString().split(' ')[0]; // HH:MM:SS
    const dateStr = new Date(checkInTime).toISOString().split('T')[0];  // YYYY-MM-DD
    const formatted = {
      lead_id: leadId,
      visit_date: dateStr,
      visit_time: timeStr,
      check_in_time: checkInTime,
      check_in_lat: parseFloat(lat),
      check_in_lng: parseFloat(lng),
      check_in_address: address || '',
      outcome: 'Scheduled',
      media_urls: [],
      feedback: ''
    };

    if (this.isCloud()) {
      const { data: visit, error: vErr } = await supabase.from('site_visits').insert([formatted]).select().single();
      if (vErr) throw vErr;

      // Update lead site visit details
      await supabase.from('leads').update({
        site_visit_date: dateStr,
        site_visit_status: 'Scheduled',
        site_visit_remarks: 'Checked-in. Site visit in progress.'
      }).eq('id', leadId);

      return visit;
    } else {
      const db = loadLocalDb();
      const newVisit = { id: generateUuid(), created_at: new Date().toISOString(), ...formatted };
      db.site_visits.push(newVisit);

      const leadIdx = db.leads.findIndex(l => l.id === leadId);
      if (leadIdx !== -1) {
        db.leads[leadIdx].site_visit_date = dateStr;
        db.leads[leadIdx].site_visit_status = 'Scheduled';
        db.leads[leadIdx].site_visit_remarks = 'Checked-in. Site visit in progress.';
      }
      saveLocalDb(db);
      return newVisit;
    }
  },

  async checkOutSiteVisit(visitId, checkOutTime, lat, lng, address, feedback, outcome, mediaUrls = []) {
    if (this.isCloud()) {
      // 1. Fetch check-in details
      const { data: visit, error: fErr } = await supabase.from('site_visits').select('*').eq('id', visitId).single();
      if (fErr) throw fErr;

      // 2. Perform check-out updates
      const formatted = {
        check_out_time: checkOutTime,
        check_out_lat: parseFloat(lat),
        check_out_lng: parseFloat(lng),
        check_out_address: address || '',
        feedback: feedback || '',
        outcome: outcome || 'Interested',
        media_urls: mediaUrls || []
      };

      const { data: updatedVisit, error: uErr } = await supabase
        .from('site_visits')
        .update(formatted)
        .eq('id', visitId)
        .select()
        .single();
      if (uErr) throw uErr;

      // 3. Update lead values based on outcome
      let leadStatus = 'Warm';
      if (outcome === 'Negotiation') leadStatus = 'Negotiation';
      else if (outcome === 'Booking Expected') leadStatus = 'Hot';
      else if (outcome === 'Not Interested') leadStatus = 'Cold';
      else if (outcome === 'Interested') leadStatus = 'Hot';

      await supabase.from('leads').update({
        status: leadStatus,
        site_visit_status: 'Completed',
        site_visit_remarks: `Completed. Outcome: ${outcome}. Feedback: ${feedback}`
      }).eq('id', visit.lead_id);

      return updatedVisit;
    } else {
      const db = loadLocalDb();
      const idx = db.site_visits.findIndex(v => v.id === visitId);
      if (idx === -1) throw new Error('Site visit not found');

      const visit = db.site_visits[idx];
      const formatted = {
        check_out_time: checkOutTime,
        check_out_lat: parseFloat(lat),
        check_out_lng: parseFloat(lng),
        check_out_address: address || '',
        feedback: feedback || '',
        outcome: outcome || 'Interested',
        media_urls: mediaUrls || []
      };

      db.site_visits[idx] = { ...db.site_visits[idx], ...formatted };

      let leadStatus = 'Warm';
      if (outcome === 'Negotiation') leadStatus = 'Negotiation';
      else if (outcome === 'Booking Expected') leadStatus = 'Hot';
      else if (outcome === 'Not Interested') leadStatus = 'Cold';
      else if (outcome === 'Interested') leadStatus = 'Hot';

      const leadIdx = db.leads.findIndex(l => l.id === visit.lead_id);
      if (leadIdx !== -1) {
        db.leads[leadIdx].status = leadStatus;
        db.leads[leadIdx].site_visit_status = 'Completed';
        db.leads[leadIdx].site_visit_remarks = `Completed. Outcome: ${outcome}. Feedback: ${feedback}`;
      }

      saveLocalDb(db);
      return db.site_visits[idx];
    }
  },

  async getSiteVisits(leadId = null) {
    if (this.isCloud()) {
      let query = supabase.from('site_visits').select('*, leads(*)').order('created_at', { ascending: false });
      if (leadId) {
        query = query.eq('lead_id', leadId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      let list = db.site_visits;
      if (leadId) {
        list = list.filter(v => v.lead_id === leadId);
      }
      return list.map(v => {
        const lead = db.leads.find(l => l.id === v.lead_id);
        return { ...v, leads: lead || null };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  // --- PHASE 3: DUPLICATE DETECTION ---
  async checkDuplicateLeadByPhones(phone1, phone2, phoneWhatsapp, excludeId = null) {
    const p1 = phone1 ? String(phone1).replace(/\D/g, '') : null;
    const p2 = phone2 ? String(phone2).replace(/\D/g, '') : null;
    const pw = phoneWhatsapp ? String(phoneWhatsapp).replace(/\D/g, '') : null;
    
    if (!p1 && !p2 && !pw) return null;
    
    if (this.isCloud()) {
      const { data: leadsList, error } = await supabase.from('leads').select('*, assigned_employee:users!assigned_employee_id(*)');
      if (error) throw error;
      
      for (const lead of leadsList) {
        if (excludeId && lead.id === excludeId) continue;
        const lp1 = lead.phone1 ? String(lead.phone1).replace(/\D/g, '') : '';
        const lp2 = lead.phone2 ? String(lead.phone2).replace(/\D/g, '') : '';
        const lpw = lead.phone_whatsapp ? String(lead.phone_whatsapp).replace(/\D/g, '') : '';
        
        if (
          (p1 && (lp1 === p1 || lp2 === p1 || lpw === p1)) ||
          (p2 && (lp1 === p2 || lp2 === p2 || lpw === p2)) ||
          (pw && (lp1 === pw || lp2 === pw || lpw === pw))
        ) {
          return lead;
        }
      }
      return null;
    } else {
      const db = loadLocalDb();
      for (const lead of db.leads) {
        if (excludeId && lead.id === excludeId) continue;
        const lp1 = lead.phone1 ? String(lead.phone1).replace(/\D/g, '') : '';
        const lp2 = lead.phone2 ? String(lead.phone2).replace(/\D/g, '') : '';
        const lpw = lead.phone_whatsapp ? String(lead.phone_whatsapp).replace(/\D/g, '') : '';
        
        if (
          (p1 && (lp1 === p1 || lp2 === p1 || lpw === p1)) ||
          (p2 && (lp1 === p2 || lp2 === p2 || lpw === p2)) ||
          (pw && (lp1 === pw || lp2 === pw || lpw === pw))
        ) {
          return lead;
        }
      }
      return null;
    }
  },

  // --- PHASE 3: IMPORT HISTORY ---
  async logImport(importData) {
    const formatted = {
      filename: importData.filename,
      total_records: importData.total_records || 0,
      imported_records: importData.imported_records || 0,
      updated_records: importData.updated_records || 0,
      skipped_records: importData.skipped_records || 0,
      failed_records: importData.failed_records || 0,
      failed_logs: importData.failed_logs || [],
      created_by: importData.created_by || null
    };

    if (this.isCloud()) {
      const { data, error } = await supabase.from('import_history').insert([formatted]).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const record = { id: generateUuid(), created_at: new Date().toISOString(), ...formatted };
      if (!db.import_history) db.import_history = [];
      db.import_history.push(record);
      saveLocalDb(db);
      return record;
    }
  },

  async getImportHistory() {
    if (this.isCloud()) {
      const { data, error } = await supabase.from('import_history').select('*, users!created_by(*)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      if (!db.import_history) db.import_history = [];
      return db.import_history.map(record => {
        const user = db.users.find(u => u.id === record.created_by);
        return { ...record, users: user || null };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async updateImportHistory(id, updates) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('import_history')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      if (!db.import_history) db.import_history = [];
      const idx = db.import_history.findIndex(r => r.id === id);
      if (idx !== -1) {
        db.import_history[idx] = { ...db.import_history[idx], ...updates };
        saveLocalDb(db);
        return db.import_history[idx];
      }
      throw new Error('Import history not found');
    }
  },

  async getWhatsAppLogsForLead(leadId) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('whatsapp_campaign_logs')
        .select('*, whatsapp_campaigns(*)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      if (!db.whatsapp_campaign_logs) db.whatsapp_campaign_logs = [];
      return db.whatsapp_campaign_logs
        .filter(l => l.lead_id === leadId)
        .map(l => {
          const campaign = db.whatsapp_campaigns.find(c => c.id === l.campaign_id);
          return { ...l, whatsapp_campaigns: campaign || null };
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  async getBookingsForLead(leadId) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, projects(*), inventory(*)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      if (!db.bookings) db.bookings = [];
      return db.bookings
        .filter(b => b.lead_id === leadId)
        .map(b => {
          const proj = db.projects.find(p => p.id === b.project_id);
          const inv = db.inventory.find(i => i.id === b.inventory_id);
          return { ...b, projects: proj || null, inventory: inv || null };
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  // --- PHASE 3: REMINDERS ---
  async getReminders(employeeId = null, role = 'admin') {
    if (this.isCloud()) {
      let query = supabase.from('reminders').select('*, leads(*)');
      if (role === 'employee' && employeeId) {
        query = query.eq('assigned_employee_id', employeeId);
      }
      const { data, error } = await query.order('reminder_date', { ascending: true });
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      if (!db.reminders) db.reminders = [];
      let list = db.reminders;
      if (role === 'employee' && employeeId) {
        list = list.filter(r => r.assigned_employee_id === employeeId);
      }
      return list.map(r => {
        const lead = db.leads.find(l => l.id === r.lead_id);
        return { ...r, leads: lead || null };
      }).sort((a, b) => a.reminder_date.localeCompare(b.reminder_date));
    }
  },

  async createReminder(reminderData) {
    const formatted = {
      lead_id: reminderData.lead_id,
      title: reminderData.title,
      type: reminderData.type || 'Follow-up',
      reminder_date: reminderData.reminder_date,
      reminder_time: reminderData.reminder_time || null,
      notes: reminderData.notes || '',
      is_read: reminderData.is_read || false,
      assigned_employee_id: reminderData.assigned_employee_id || null
    };

    if (this.isCloud()) {
      const { data, error } = await supabase.from('reminders').insert([formatted]).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const record = { id: generateUuid(), created_at: new Date().toISOString(), ...formatted };
      if (!db.reminders) db.reminders = [];
      db.reminders.push(record);
      saveLocalDb(db);
      return record;
    }
  },

  async markReminderAsRead(id) {
    if (this.isCloud()) {
      const { data, error } = await supabase.from('reminders').update({ is_read: true }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      if (!db.reminders) db.reminders = [];
      const idx = db.reminders.findIndex(r => r.id === id);
      if (idx !== -1) {
        db.reminders[idx].is_read = true;
        saveLocalDb(db);
        return db.reminders[idx];
      }
      throw new Error('Reminder not found');
    }
  },

  async deleteReminder(id) {
    if (this.isCloud()) {
      const { error } = await supabase.from('reminders').delete().eq('id', id);
      if (error) throw error;
      return true;
    } else {
      const db = loadLocalDb();
      if (!db.reminders) db.reminders = [];
      db.reminders = db.reminders.filter(r => r.id !== id);
      saveLocalDb(db);
      return true;
    }
  },

  async getReminderWidgets(employeeId = null, role = 'admin') {
    const list = await this.getReminders(employeeId, role);
    const nowStr = new Date().toISOString().split('T')[0];

    const todayReminders = list.filter(r => r.reminder_date === nowStr && !r.is_read);
    const missedReminders = list.filter(r => r.reminder_date < nowStr && !r.is_read);
    const upcomingReminders = list.filter(r => r.reminder_date > nowStr && !r.is_read);

    return {
      today: todayReminders.length,
      missed: missedReminders.length,
      upcoming: upcomingReminders.length
    };
  },

  async getNotificationsAlerts(userId, role, since) {
    const sinceTimestamp = since || new Date(Date.now() - 60000).toISOString();

    if (this.isCloud()) {
      let leadsQuery = supabase
        .from('leads')
        .select('*, assigned_employee:users!assigned_employee_id(*)')
        .gt('created_at', sinceTimestamp);
      if (role === 'employee') {
        leadsQuery = leadsQuery.eq('assigned_employee_id', userId);
      }
      const { data: newLeads, error: leadsErr } = await leadsQuery;
      if (leadsErr) throw leadsErr;

      let bookingsQuery = supabase
        .from('bookings')
        .select('*, leads(*), projects(*), inventory(*)')
        .gt('created_at', sinceTimestamp);
      const { data: newBookings, error: bookingsErr } = await bookingsQuery;
      if (bookingsErr) throw bookingsErr;

      let filteredBookings = newBookings || [];
      if (role === 'employee') {
        filteredBookings = filteredBookings.filter(b => b.executive_id === userId || (b.leads && b.leads.assigned_employee_id === userId));
      }

      const todayStr = new Date().toISOString().split('T')[0];
      let remindersQuery = supabase
        .from('reminders')
        .select('*, leads(*)')
        .eq('reminder_date', todayStr)
        .eq('is_read', false);
      if (role === 'employee') {
        remindersQuery = remindersQuery.eq('assigned_employee_id', userId);
      }
      const { data: dueReminders, error: remErr } = await remindersQuery;
      if (remErr) throw remErr;

      let missedQuery = supabase
        .from('reminders')
        .select('*, leads(*)')
        .lt('reminder_date', todayStr)
        .eq('is_read', false);
      if (role === 'employee') {
        missedQuery = missedQuery.eq('assigned_employee_id', userId);
      }
      const { data: missedReminders, error: missErr } = await missedQuery;
      if (missErr) throw missErr;

      return {
        newLeads: newLeads || [],
        newBookings: filteredBookings || [],
        dueReminders: dueReminders || [],
        missedReminders: missedReminders || []
      };
    } else {
      const db = loadLocalDb();
      const sinceDate = new Date(sinceTimestamp);
      const todayStr = new Date().toISOString().split('T')[0];

      const newLeads = db.leads.filter(l => {
        const isNew = new Date(l.created_at) > sinceDate;
        const isMatch = role === 'employee' ? l.assigned_employee_id === userId : true;
        return isNew && isMatch;
      }).map(l => {
        const emp = db.users.find(u => u.id === l.assigned_employee_id);
        return { ...l, assigned_employee: emp || null };
      });

      const newBookings = db.bookings.filter(b => {
        const isNew = new Date(b.created_at) > sinceDate;
        let isMatch = true;
        if (role === 'employee') {
          const lead = db.leads.find(l => l.id === b.lead_id);
          isMatch = b.executive_id === userId || (lead && lead.assigned_employee_id === userId);
        }
        return isNew && isMatch;
      }).map(b => {
        const lead = db.leads.find(l => l.id === b.lead_id);
        const proj = db.projects.find(p => p.id === b.project_id);
        const inv = db.inventory.find(i => i.id === b.inventory_id);
        return { ...b, leads: lead || null, projects: proj || null, inventory: inv || null };
      });

      const dueReminders = (db.reminders || []).filter(r => {
        const isToday = r.reminder_date === todayStr;
        const isActive = !r.is_read;
        const isMatch = role === 'employee' ? r.assigned_employee_id === userId : true;
        return isToday && isActive && isMatch;
      }).map(r => {
        const lead = db.leads.find(l => l.id === r.lead_id);
        return { ...r, leads: lead || null };
      });

      const missedReminders = (db.reminders || []).filter(r => {
        const isPast = r.reminder_date < todayStr;
        const isActive = !r.is_read;
        const isMatch = role === 'employee' ? r.assigned_employee_id === userId : true;
        return isPast && isActive && isMatch;
      }).map(r => {
        const lead = db.leads.find(l => l.id === r.lead_id);
        return { ...r, leads: lead || null };
      });

      return {
        newLeads,
        newBookings,
        dueReminders,
        missedReminders
      };
    }
  }
};

module.exports = DB;
