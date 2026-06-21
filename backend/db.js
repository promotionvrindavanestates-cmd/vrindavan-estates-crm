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
    if (!data.booking_milestones) data.booking_milestones = [];
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
        .select('id, username, full_name, phone, role, status, token_version, commission_percentage')
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
        token_version: u.token_version,
        commission_percentage: u.commission_percentage !== undefined ? parseFloat(u.commission_percentage) : 1.50
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
      if (filters.site_visit_status) query = query.eq('site_visit_status', filters.site_visit_status);
      
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
      if (filters.site_visit_status) results = results.filter(l => l.site_visit_status === filters.site_visit_status);

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
  async logCall(leadId, callerId, response, notes, duration = 0, action_taken = null, follow_up_date = null, follow_up_time = null, follow_up_datetime = null, call_type = 'Outgoing', synced_from_device = false, device_call_id = null, needs_notes = false) {
    if (this.isCloud()) {
      const { error: logError } = await supabase
        .from('call_logs')
        .insert([{ 
          lead_id: leadId, 
          caller_id: callerId, 
          response, 
          notes,
          duration,
          action_taken,
          follow_up_date,
          follow_up_time,
          follow_up_datetime,
          call_type,
          synced_from_device,
          device_call_id,
          needs_notes
        }]);
      if (logError) throw logError;

      const { data, error: updateError } = await supabase
        .from('leads')
        .update({
          last_call_date: new Date().toISOString(),
          last_response: response,
          follow_up_date: follow_up_date || undefined
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
        duration,
        action_taken,
        follow_up_date,
        follow_up_time,
        follow_up_datetime,
        call_type,
        synced_from_device,
        device_call_id,
        needs_notes,
        call_date: new Date().toISOString()
      };
      db.call_logs.push(newLog);

      const idx = db.leads.findIndex(l => l.id === leadId);
      if (idx !== -1) {
        db.leads[idx].last_call_date = newLog.call_date;
        db.leads[idx].last_response = response;
        if (follow_up_date) {
          db.leads[idx].follow_up_date = follow_up_date;
        }
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

  async syncMobileCalls(userId, role, calls) {
    const normalizePhone = (num) => {
      if (!num) return '';
      const cleaned = num.replace(/\D/g, '');
      return cleaned.slice(-10);
    };

    // 1. Fetch leads
    let leads = [];
    if (this.isCloud()) {
      let query = supabase.from('leads').select('id, name, phone1, phone2, assigned_employee_id');
      if (role === 'employee') {
        query = query.eq('assigned_employee_id', userId);
      }
      const { data, error } = await query;
      if (error) throw error;
      leads = data || [];
    } else {
      const db = loadLocalDb();
      leads = db.leads || [];
      if (role === 'employee') {
        leads = leads.filter(l => l.assigned_employee_id === userId);
      }
    }

    // 2. Fetch already synced call ids
    let existingIds = new Set();
    if (this.isCloud()) {
      const { data, error } = await supabase.from('call_logs').select('device_call_id').not('device_call_id', 'is', null);
      if (error) throw error;
      data.forEach(c => existingIds.add(c.device_call_id));
    } else {
      const db = loadLocalDb();
      const logs = db.call_logs || [];
      logs.forEach(c => {
        if (c.device_call_id) existingIds.add(c.device_call_id);
      });
    }

    const syncedCalls = [];

    // 3. Process each call
    for (const call of calls) {
      if (existingIds.has(call.id)) continue; // Already synced

      const callType = call.type || 'Outgoing';
      const callDuration = call.duration || 0;
      const callTimestamp = call.timestamp || new Date().toISOString();
      const callPhoneNormalized = normalizePhone(call.number);

      if (!callPhoneNormalized) continue;

      // Find match
      const matchedLead = leads.find(l => {
        const p1 = normalizePhone(l.phone1);
        const p2 = normalizePhone(l.phone2);
        return p1 === callPhoneNormalized || p2 === callPhoneNormalized;
      });

      if (matchedLead) {
        // Automatically sync to that lead
        const outcome = callType === 'Missed' ? 'Not Picked' : 'Connected';
        const defaultNotes = `Mobile ${callType.toLowerCase()} call log synced automatically.`;
        
        // Insert call log
        await this.logCall(
          matchedLead.id,
          userId,
          outcome,
          defaultNotes,
          callDuration,
          null, // action_taken
          null, // follow_up_date
          null, // follow_up_time
          null, // follow_up_datetime
          callType, // call_type
          true, // synced_from_device
          call.id, // device_call_id
          true // needs_notes
        );

        syncedCalls.push({
          id: call.id,
          leadName: matchedLead.name,
          number: call.number,
          type: callType,
          duration: callDuration,
          timestamp: callTimestamp
        });
      }
    }

    return syncedCalls;
  },

  async getPendingCallLogs(userId, role) {
    if (this.isCloud()) {
      let query = supabase.from('call_logs').select('*, leads(*)').eq('needs_notes', true);
      if (role === 'employee') {
        query = query.eq('caller_id', userId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } else {
      const db = loadLocalDb();
      let logs = db.call_logs || [];
      logs = logs.filter(c => c.needs_notes === true);
      if (role === 'employee') {
        logs = logs.filter(c => c.caller_id === userId);
      }
      return logs.map(c => {
        const lead = db.leads.find(l => l.id === c.lead_id);
        return { ...c, leads: lead || null };
      });
    }
  },

  async completeCallNotes(callId, notes, actionTaken, followUpDate, followUpTime, followUpDatetime, createReminder) {
    // 1. Get the call log first to find the lead
    let callLog = null;
    if (this.isCloud()) {
      const { data, error } = await supabase.from('call_logs').select('*').eq('id', callId).single();
      if (error) throw error;
      callLog = data;
    } else {
      const db = loadLocalDb();
      callLog = db.call_logs.find(c => c.id === callId);
    }

    if (!callLog) throw new Error('Call log not found');

    const updateFields = {
      notes: notes || '',
      action_taken: actionTaken !== 'None' ? actionTaken : null,
      follow_up_date: actionTaken !== 'None' && followUpDate ? followUpDate : null,
      follow_up_time: actionTaken !== 'None' && followUpTime ? followUpTime : null,
      follow_up_datetime: actionTaken !== 'None' && followUpDate ? followUpDatetime : null,
      needs_notes: false
    };

    if (this.isCloud()) {
      // Update call log
      const { data, error: updateError } = await supabase
        .from('call_logs')
        .update(updateFields)
        .eq('id', callId)
        .select()
        .single();
      if (updateError) throw updateError;

      // Update lead
      await supabase
        .from('leads')
        .update({
          follow_up_date: (actionTaken !== 'None' && followUpDate) ? followUpDate : undefined
        })
        .eq('id', callLog.lead_id);

      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.call_logs.findIndex(c => c.id === callId);
      if (idx !== -1) {
        db.call_logs[idx] = { ...db.call_logs[idx], ...updateFields };
        
        const leadIdx = db.leads.findIndex(l => l.id === callLog.lead_id);
        if (leadIdx !== -1 && actionTaken !== 'None' && followUpDate) {
          db.leads[leadIdx].follow_up_date = followUpDate;
        }
        
        saveLocalDb(db);
        return db.call_logs[idx];
      }
      throw new Error('Call log not found');
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
  async logAudit(leadId, action, details, userId, userName, device = 'Web Portal') {
    if (this.isCloud()) {
      const { error } = await supabase
        .from('audit_trails')
        .insert([{
          lead_id: leadId,
          action,
          details,
          user_id: userId,
          user_name: userName,
          device: device
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
        device: device,
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

  async getRecentActivities(limit = 30) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('audit_trails')
        .select('*, leads(name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const audits = [...db.audit_trails];
      audits.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const sliced = audits.slice(0, limit);
      return sliced.map(a => {
        const lead = db.leads.find(l => l.id === a.lead_id);
        return {
          ...a,
          leads: lead ? { name: lead.name } : null
        };
      });
    }
  },

  async getEmployeePerformanceStats(employeeId) {
    if (this.isCloud()) {
      // 1. Get Employee Profile
      const { data: profile, error: uErr } = await supabase
        .from('users')
        .select('id, username, full_name, role, status, created_at, phone')
        .eq('id', employeeId)
        .single();
      if (uErr) throw uErr;

      // 2. Get Leads Assigned stats grouped by status
      const { data: leads, error: lErr } = await supabase
        .from('leads')
        .select('status')
        .eq('assigned_employee_id', employeeId);
      if (lErr) throw lErr;

      const leadsCount = leads.length;
      const statusCounts = { New: 0, Hot: 0, Warm: 0, Cold: 0, Booked: 0 };
      leads.forEach(l => {
        if (statusCounts[l.status] !== undefined) statusCounts[l.status]++;
      });

      // 3. Get Calls Made
      const { data: calls, error: cErr } = await supabase
        .from('call_logs')
        .select('response, call_date')
        .eq('caller_id', employeeId);
      if (cErr) throw cErr;

      const callsMade = calls.length;
      const notConnectedResponses = ['Not Picked', 'Busy', 'Failed', 'Not Connected'];
      let connectedCalls = 0;
      let notConnectedCalls = 0;
      calls.forEach(c => {
        if (notConnectedResponses.includes(c.response)) {
          notConnectedCalls++;
        } else {
          connectedCalls++;
        }
      });

      // 4. Reminders
      const { data: reminders, error: rErr } = await supabase
        .from('reminders')
        .select('is_read')
        .eq('assigned_employee_id', employeeId);
      if (rErr) throw rErr;

      let followUpsPending = 0;
      let followUpsCompleted = 0;
      reminders.forEach(r => {
        if (r.is_read) {
          followUpsCompleted++;
        } else {
          followUpsPending++;
        }
      });

      // 5. Site Visits Outcome
      const { data: visits, error: vErr } = await supabase
        .from('site_visits')
        .select('outcome, created_at, leads!inner(assigned_employee_id)')
        .eq('leads.assigned_employee_id', employeeId);
      if (vErr) throw vErr;

      let visitsScheduled = 0;
      let visitsCompleted = 0;
      let visitsCancelled = 0;
      visits.forEach(v => {
        if (v.outcome === 'Scheduled') {
          visitsScheduled++;
        } else if (v.outcome === 'Cancelled' || v.outcome === 'Not Interested') {
          visitsCancelled++;
        } else {
          visitsCompleted++;
        }
      });

      // 6. Booking stats & values
      const { data: bookings, error: bErr } = await supabase
        .from('bookings')
        .select('id, token_amount, booking_amount, created_at, payments(amount_received, balance, total_cost)')
        .eq('executive_id', employeeId);
      if (bErr) throw bErr;

      const totalBookings = bookings.length;
      let bookingValue = 0;
      let collectionReceived = 0;
      let pendingCollection = 0;

      bookings.forEach(b => {
        const token = parseFloat(b.token_amount) || 0;
        const bookingAmt = parseFloat(b.booking_amount) || 0;
        bookingValue += (token + bookingAmt);
        
        if (b.payments && b.payments.length > 0) {
          const pay = b.payments[0];
          collectionReceived += (parseFloat(pay.amount_received) || 0);
          pendingCollection += (parseFloat(pay.balance) || 0);
        }
      });

      // 7. Trends (Last 6 Months)
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const trends = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        trends[key] = {
          month: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`,
          calls: 0,
          visits: 0,
          bookings: 0,
          revenue: 0
        };
      }

      // Group Calls trend
      calls.forEach(c => {
        if (!c.call_date) return;
        const date = new Date(c.call_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (trends[key]) trends[key].calls++;
      });

      // Group Visits trend
      visits.forEach(v => {
        if (!v.created_at) return;
        const date = new Date(v.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (trends[key]) trends[key].visits++;
      });

      // Group Bookings & Revenue trend
      bookings.forEach(b => {
        if (!b.created_at) return;
        const date = new Date(b.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (trends[key]) {
          trends[key].bookings++;
          const token = parseFloat(b.token_amount) || 0;
          const bookingAmt = parseFloat(b.booking_amount) || 0;
          trends[key].revenue += (token + bookingAmt);
        }
      });

      const trendList = Object.values(trends);

      // Conversion funnel (this employee's leads)
      const funnel = {
        new: leads.filter(l => l.status === 'New').length,
        contacted: leads.filter(l => ['Attempted', 'Connected', 'Warm', 'Cold', 'Interested'].includes(l.status)).length,
        visit: leads.filter(l => ['Site Visit Scheduled', 'Site Visit Done'].includes(l.status)).length,
        negotiation: leads.filter(l => ['Negotiation', 'Hot'].includes(l.status)).length,
        booked: leads.filter(l => l.status === 'Booked').length
      };

      const interestedLeads = leads.filter(l => ['Interested', 'Warm', 'Hot'].includes(l.status)).length;
      const followUpsTotal = followUpsCompleted + followUpsPending;
      const followupCompliancePct = followUpsTotal > 0 ? Math.round((followUpsCompleted / followUpsTotal) * 100) : 100;
      const conversionRate = leadsCount > 0 ? Math.round((totalBookings / leadsCount) * 100) : 0;

      return {
        profile,
        metrics: {
          leadsOwned: leadsCount,
          newLeads: statusCounts.New,
          hotLeads: statusCounts.Hot,
          warmLeads: statusCounts.Warm,
          coldLeads: statusCounts.Cold,
          bookedLeads: statusCounts.Booked,
          callsMade,
          connectedCalls,
          notConnectedCalls,
          followUpsPending,
          followUpsCompleted,
          interestedLeads,
          followupCompliancePct,
          visitsScheduled,
          visitsCompleted,
          visitsCancelled,
          totalBookings,
          bookingValue,
          collectionReceived,
          pendingCollection,
          conversionRate
        },
        trends: trendList,
        funnel
      };
    } else {
      // Local fallback DB
      const db = loadLocalDb();
      const profile = db.users.find(u => u.id === employeeId);
      if (!profile) throw new Error('Employee not found');

      const empLeads = db.leads.filter(l => l.assigned_employee_id === employeeId);
      const leadsCount = empLeads.length;

      const statusCounts = { New: 0, Hot: 0, Warm: 0, Cold: 0, Booked: 0 };
      empLeads.forEach(l => {
        if (statusCounts[l.status] !== undefined) statusCounts[l.status]++;
      });

      const calls = db.call_logs.filter(c => c.caller_id === employeeId);
      const callsMade = calls.length;
      const notConnectedResponses = ['Not Picked', 'Busy', 'Failed', 'Not Connected'];
      let connectedCalls = 0;
      let notConnectedCalls = 0;
      calls.forEach(c => {
        if (notConnectedResponses.includes(c.response)) {
          notConnectedCalls++;
        } else {
          connectedCalls++;
        }
      });

      const reminders = (db.reminders || []).filter(r => r.assigned_employee_id === employeeId);
      let followUpsPending = 0;
      let followUpsCompleted = 0;
      reminders.forEach(r => {
        if (r.is_read) {
          followUpsCompleted++;
        } else {
          followUpsPending++;
        }
      });

      const visits = (db.site_visits || []).filter(v => {
        const lead = db.leads.find(l => l.id === v.lead_id);
        return lead && lead.assigned_employee_id === employeeId;
      });

      let visitsScheduled = 0;
      let visitsCompleted = 0;
      let visitsCancelled = 0;
      visits.forEach(v => {
        if (v.outcome === 'Scheduled') {
          visitsScheduled++;
        } else if (v.outcome === 'Cancelled' || v.outcome === 'Not Interested') {
          visitsCancelled++;
        } else {
          visitsCompleted++;
        }
      });

      const bookings = db.bookings.filter(b => b.executive_id === employeeId);
      const totalBookings = bookings.length;
      let bookingValue = 0;
      let collectionReceived = 0;
      let pendingCollection = 0;

      bookings.forEach(b => {
        const token = parseFloat(b.token_amount) || 0;
        const bookingAmt = parseFloat(b.booking_amount) || 0;
        bookingValue += (token + bookingAmt);
        
        const pay = db.payments.find(p => p.booking_id === b.id);
        if (pay) {
          collectionReceived += (parseFloat(pay.amount_received) || 0);
          pendingCollection += (parseFloat(pay.balance) || 0);
        }
      });

      // Trends (Last 6 Months)
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const trends = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        trends[key] = {
          month: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`,
          calls: 0,
          visits: 0,
          bookings: 0,
          revenue: 0
        };
      }

      calls.forEach(c => {
        if (!c.call_date) return;
        const date = new Date(c.call_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (trends[key]) trends[key].calls++;
      });

      visits.forEach(v => {
        const createdDate = v.created_at || v.check_in_time || v.check_out_time;
        if (!createdDate) return;
        const date = new Date(createdDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (trends[key]) trends[key].visits++;
      });

      bookings.forEach(b => {
        if (!b.created_at) return;
        const date = new Date(b.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (trends[key]) {
          trends[key].bookings++;
          const token = parseFloat(b.token_amount) || 0;
          const bookingAmt = parseFloat(b.booking_amount) || 0;
          trends[key].revenue += (token + bookingAmt);
        }
      });

      const trendList = Object.values(trends);

      const funnel = {
        new: empLeads.filter(l => l.status === 'New').length,
        contacted: empLeads.filter(l => ['Attempted', 'Connected', 'Warm', 'Cold', 'Interested'].includes(l.status)).length,
        visit: empLeads.filter(l => ['Site Visit Scheduled', 'Site Visit Done'].includes(l.status)).length,
        negotiation: empLeads.filter(l => ['Negotiation', 'Hot'].includes(l.status)).length,
        booked: empLeads.filter(l => l.status === 'Booked').length
      };

      const interestedLeads = empLeads.filter(l => ['Interested', 'Warm', 'Hot'].includes(l.status)).length;
      const followUpsTotal = followUpsCompleted + followUpsPending;
      const followupCompliancePct = followUpsTotal > 0 ? Math.round((followUpsCompleted / followUpsTotal) * 100) : 100;
      const conversionRate = leadsCount > 0 ? Math.round((totalBookings / leadsCount) * 100) : 0;

      return {
        profile: {
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          role: profile.role,
          status: profile.status,
          created_at: profile.created_at,
          phone: profile.phone
        },
        metrics: {
          leadsOwned: leadsCount,
          newLeads: statusCounts.New,
          hotLeads: statusCounts.Hot,
          warmLeads: statusCounts.Warm,
          coldLeads: statusCounts.Cold,
          bookedLeads: statusCounts.Booked,
          callsMade,
          connectedCalls,
          notConnectedCalls,
          followUpsPending,
          followUpsCompleted,
          interestedLeads,
          followupCompliancePct,
          visitsScheduled,
          visitsCompleted,
          visitsCancelled,
          totalBookings,
          bookingValue,
          collectionReceived,
          pendingCollection,
          conversionRate
        },
        trends: trendList,
        funnel
      };
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
      // First check and release expired blocks
      const nowStr = new Date().toISOString();
      const { data: expiredList } = await supabase
        .from('inventory')
        .select('id')
        .eq('status', 'Blocked')
        .lt('blocked_until', nowStr);
      
      if (expiredList && expiredList.length > 0) {
        const expiredIds = expiredList.map(item => item.id);
        await supabase
          .from('inventory')
          .update({ status: 'Available', blocked_until: null })
          .in('id', expiredIds);
      }

      let query = supabase.from('inventory').select('*, projects(*)');
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      let updated = false;
      const now = new Date();
      db.inventory.forEach(item => {
        if (item.status === 'Blocked' && item.blocked_until && new Date(item.blocked_until) < now) {
          item.status = 'Available';
          item.blocked_until = null;
          updated = true;
        }
      });
      if (updated) {
        saveLocalDb(db);
      }

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
      details: invData.details || {},
      blocked_until: invData.blocked_until || null
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
    if (invData.blocked_until !== undefined) formatted.blocked_until = invData.blocked_until;
    
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
      const { data, error } = await supabase.from('inventory').update({ status, blocked_until: null }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.inventory.findIndex(i => i.id === id);
      if (idx !== -1) {
        db.inventory[idx].status = status;
        db.inventory[idx].blocked_until = null;
        saveLocalDb(db);
        return db.inventory[idx];
      }
      throw new Error('Inventory unit not found');
    }
  },

  async blockInventoryUnit(id, durationHours) {
    const blockedUntil = new Date();
    blockedUntil.setHours(blockedUntil.getHours() + parseFloat(durationHours));
    const blockedUntilStr = blockedUntil.toISOString();

    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('inventory')
        .update({ status: 'Blocked', blocked_until: blockedUntilStr })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.inventory.findIndex(i => i.id === id);
      if (idx !== -1) {
        db.inventory[idx].status = 'Blocked';
        db.inventory[idx].blocked_until = blockedUntilStr;
        saveLocalDb(db);
        return db.inventory[idx];
      }
      throw new Error('Inventory unit not found');
    }
  },

  async unblockInventoryUnit(id) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('inventory')
        .update({ status: 'Available', blocked_until: null })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.inventory.findIndex(i => i.id === id);
      if (idx !== -1) {
        db.inventory[idx].status = 'Available';
        db.inventory[idx].blocked_until = null;
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
      status: bookingData.status || 'Token Booking'
    };

    const totalCost = bookingData.total_cost ? parseFloat(bookingData.total_cost) : 0.00;
    const initialReceived = formatted.booking_amount + formatted.token_amount;
    const balance = totalCost - initialReceived;
    const dueDays = bookingData.due_days ? parseInt(bookingData.due_days) : 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    // Generate milestones
    const planType = bookingData.payment_plan_type || 'default';
    let generatedMilestones = [];

    if (planType === '20:20:20:20:20') {
      const part = totalCost * 0.20;
      for (let i = 1; i <= 5; i++) {
        const d = new Date(formatted.booking_date);
        d.setDate(d.getDate() + (i - 1) * 30);
        generatedMilestones.push({
          milestone_name: `Installment ${i} (20%)`,
          amount: part,
          due_date: d.toISOString().split('T')[0]
        });
      }
    } else if (planType === '40:30:30') {
      const parts = [totalCost * 0.40, totalCost * 0.30, totalCost * 0.30];
      const offsets = [0, 45, 90];
      parts.forEach((p, idx) => {
        const d = new Date(formatted.booking_date);
        d.setDate(d.getDate() + offsets[idx]);
        generatedMilestones.push({
          milestone_name: idx === 0 ? 'Booking Confirmation (40%)' : `Installment ${idx} (30%)`,
          amount: p,
          due_date: d.toISOString().split('T')[0]
        });
      });
    } else if (planType === 'custom' && bookingData.custom_milestones && bookingData.custom_milestones.length > 0) {
      generatedMilestones = bookingData.custom_milestones.map(m => ({
        milestone_name: m.milestone_name,
        amount: parseFloat(m.amount),
        due_date: m.due_date
      }));
    } else {
      // Default: Token, Confirmation (15 days), Balance (45 days)
      const tokenM = formatted.token_amount > 0 ? formatted.token_amount : totalCost * 0.10;
      const confirmM = formatted.booking_amount > 0 ? formatted.booking_amount : totalCost * 0.15;
      const balanceM = Math.max(0, totalCost - tokenM - confirmM);

      const dToken = new Date(formatted.booking_date);
      const dConfirm = new Date(formatted.booking_date);
      dConfirm.setDate(dConfirm.getDate() + 15);
      const dBalance = new Date(formatted.booking_date);
      dBalance.setDate(dBalance.getDate() + 45);

      generatedMilestones.push(
        { milestone_name: 'Token Payment', amount: tokenM, due_date: dToken.toISOString().split('T')[0] },
        { milestone_name: 'Booking Confirmation', amount: confirmM, due_date: dConfirm.toISOString().split('T')[0] },
        { milestone_name: 'Balance Payment', amount: balanceM, due_date: dBalance.toISOString().split('T')[0] }
      );
    }

    // Allocate upfront amount to generated milestones
    let remainingUpfront = initialReceived;
    generatedMilestones.forEach(m => {
      m.amount_paid = 0;
      m.status = 'Pending';
      if (remainingUpfront > 0) {
        const payToThis = Math.min(remainingUpfront, m.amount);
        m.amount_paid = payToThis;
        if (m.amount_paid >= m.amount) {
          m.status = 'Paid';
        } else {
          m.status = 'Partial';
        }
        remainingUpfront -= payToThis;
      } else {
        const nowStr = new Date().toISOString().split('T')[0];
        if (m.due_date < nowStr) {
          m.status = 'Overdue';
        }
      }
    });

    if (this.isCloud()) {
      // 1. Create Booking
      const { data: booking, error: bErr } = await supabase.from('bookings').insert([formatted]).select().single();
      if (bErr) throw bErr;

      // 2. Initialize Payment Tracking
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

      // 3. Insert Milestones
      if (generatedMilestones.length > 0) {
        const milestonePayloads = generatedMilestones.map(m => ({
          booking_id: booking.id,
          ...m
        }));
        await supabase.from('booking_milestones').insert(milestonePayloads);
      }

      // 4. Mark inventory status based on booking status
      if (formatted.inventory_id) {
        let invStatus = 'Token';
        if (formatted.status === 'Booking Confirmed') invStatus = 'Booked';
        await supabase.from('inventory').update({ status: invStatus, blocked_until: null }).eq('id', formatted.inventory_id);
      }

      // 5. Update lead status
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

      // Insert Milestones
      if (!db.booking_milestones) db.booking_milestones = [];
      generatedMilestones.forEach(m => {
        db.booking_milestones.push({
          id: generateUuid(),
          booking_id: newBooking.id,
          created_at: new Date().toISOString(),
          ...m
        });
      });

      if (formatted.inventory_id) {
        const invIdx = db.inventory.findIndex(i => i.id === formatted.inventory_id);
        if (invIdx !== -1) {
          let invStatus = 'Token';
          if (formatted.status === 'Booking Confirmed') invStatus = 'Booked';
          db.inventory[invIdx].status = invStatus;
          db.inventory[invIdx].blocked_until = null;
        }
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

      // Sync inventory status based on booking status
      if (booking.inventory_id) {
        let invStatus = 'Available';
        if (status === 'Token Booking') invStatus = 'Token';
        else if (status === 'Booking Confirmed') invStatus = 'Booked';
        else if (status === 'Agreement Pending') invStatus = 'Booked';
        else if (status === 'Registry Pending') invStatus = 'Registry Pending';
        else if (status === 'Registry Complete') invStatus = 'Registered';
        else if (status === 'Cancelled') invStatus = 'Available';

        await supabase.from('inventory').update({ status: invStatus, blocked_until: null }).eq('id', booking.inventory_id);
      }

      // Sync lead status
      if (booking.lead_id) {
        let leadStatus = 'Booked';
        let bStatus = 'Confirmed';
        if (status === 'Cancelled') {
          leadStatus = 'Lost';
          bStatus = 'Cancelled';
        }
        await supabase.from('leads').update({ status: leadStatus, booking_status: bStatus }).eq('id', booking.lead_id);
      }

      return booking;
    } else {
      const db = loadLocalDb();
      const idx = db.bookings.findIndex(b => b.id === id);
      if (idx !== -1) {
        db.bookings[idx].status = status;
        const booking = db.bookings[idx];

        let invStatus = 'Available';
        if (status === 'Token Booking') invStatus = 'Token';
        else if (status === 'Booking Confirmed') invStatus = 'Booked';
        else if (status === 'Agreement Pending') invStatus = 'Booked';
        else if (status === 'Registry Pending') invStatus = 'Registry Pending';
        else if (status === 'Registry Complete') invStatus = 'Registered';
        else if (status === 'Cancelled') invStatus = 'Available';

        if (booking.inventory_id) {
          const invIdx = db.inventory.findIndex(i => i.id === booking.inventory_id);
          if (invIdx !== -1) {
            db.inventory[invIdx].status = invStatus;
            db.inventory[invIdx].blocked_until = null;
          }
        }

        const leadIdx = db.leads.findIndex(l => l.id === booking.lead_id);
        if (leadIdx !== -1) {
          let leadStatus = 'Booked';
          let bStatus = 'Confirmed';
          if (status === 'Cancelled') {
            leadStatus = 'Lost';
            bStatus = 'Cancelled';
          }
          db.leads[leadIdx].status = leadStatus;
          db.leads[leadIdx].booking_status = bStatus;
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

      // 4. Distribute installment amount to milestones chronologically
      const { data: milestones, error: mFetchErr } = await supabase
        .from('booking_milestones')
        .select('*')
        .eq('booking_id', pay.booking_id)
        .order('due_date', { ascending: true });
      
      if (!mFetchErr && milestones && milestones.length > 0) {
        let remainingPaid = parseFloat(amountPaid);
        for (const m of milestones) {
          if (remainingPaid <= 0) break;
          const leftToPay = m.amount - m.amount_paid;
          if (leftToPay > 0) {
            const payToThis = Math.min(remainingPaid, leftToPay);
            const newMPaid = m.amount_paid + payToThis;
            const newMStatus = newMPaid >= m.amount ? 'Paid' : 'Partial';
            
            await supabase
              .from('booking_milestones')
              .update({ amount_paid: newMPaid, status: newMStatus })
              .eq('id', m.id);
              
            remainingPaid -= payToThis;
          }
        }
      }

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

      // Distribute to milestones chronologically
      if (!db.booking_milestones) db.booking_milestones = [];
      const milestones = db.booking_milestones
        .filter(m => m.booking_id === pay.booking_id)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      
      let remainingPaid = parseFloat(amountPaid);
      milestones.forEach(m => {
        if (remainingPaid <= 0) return;
        const leftToPay = m.amount - m.amount_paid;
        if (leftToPay > 0) {
          const payToThis = Math.min(remainingPaid, leftToPay);
          m.amount_paid += payToThis;
          if (m.amount_paid >= m.amount) {
            m.status = 'Paid';
          } else {
            m.status = 'Partial';
          }
          remainingPaid -= payToThis;
        }
      });

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
  },

  async getDuplicateLeads() {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone1, email, assigned_employee_id, created_at');
      if (error) throw error;
      return this._processDuplicates(data);
    } else {
      const db = loadLocalDb();
      return this._processDuplicates(db.leads || []);
    }
  },

  _processDuplicates(leads) {
    const phoneMap = {};
    const emailMap = {};
    const duplicates = [];

    leads.forEach(l => {
      if (l.phone1) {
        const cleanPhone = String(l.phone1).trim();
        if (cleanPhone) {
          if (!phoneMap[cleanPhone]) phoneMap[cleanPhone] = [];
          phoneMap[cleanPhone].push(l);
        }
      }
      if (l.email) {
        const cleanEmail = String(l.email).trim().toLowerCase();
        if (cleanEmail) {
          if (!emailMap[cleanEmail]) emailMap[cleanEmail] = [];
          emailMap[cleanEmail].push(l);
        }
      }
    });

    const processedIds = new Set();

    Object.keys(phoneMap).forEach(phone => {
      const group = phoneMap[phone];
      if (group.length > 1) {
        const unseen = group.filter(l => !processedIds.has(l.id));
        if (unseen.length > 1) {
          duplicates.push({
            type: 'phone',
            value: phone,
            leads: group
          });
          group.forEach(l => processedIds.add(l.id));
        }
      }
    });

    Object.keys(emailMap).forEach(email => {
      const group = emailMap[email];
      if (group.length > 1) {
        const unseen = group.filter(l => !processedIds.has(l.id));
        if (unseen.length > 1) {
          duplicates.push({
            type: 'email',
            value: email,
            leads: group
          });
          group.forEach(l => processedIds.add(l.id));
        }
      }
    });

    return duplicates;
  },

  async mergeLeads(targetId, duplicateIds, userId, userName) {
    let targetLead = null;
    let dupLeads = [];

    if (this.isCloud()) {
      const { data: target, error: tErr } = await supabase.from('leads').select('*').eq('id', targetId).single();
      if (tErr) throw tErr;
      targetLead = target;

      const { data: dups, error: dErr } = await supabase.from('leads').select('*').in('id', duplicateIds);
      if (dErr) throw dErr;
      dupLeads = dups;

      const mergedFields = {};
      const fieldsToCheck = ['phone2', 'email', 'project', 'budget', 'city', 'lead_source', 'notes'];
      fieldsToCheck.forEach(f => {
        if (!targetLead[f]) {
          const val = dupLeads.find(d => d[f])?.[f];
          if (val) {
            mergedFields[f] = val;
            targetLead[f] = val;
          }
        }
      });

      if (Object.keys(mergedFields).length > 0) {
        const { error: uErr } = await supabase.from('leads').update(mergedFields).eq('id', targetId);
        if (uErr) throw uErr;
      }

      await supabase.from('call_logs').update({ lead_id: targetId }).in('lead_id', duplicateIds);
      await supabase.from('site_visits').update({ lead_id: targetId }).in('lead_id', duplicateIds);
      await supabase.from('reminders').update({ lead_id: targetId }).in('lead_id', duplicateIds);
      await supabase.from('bookings').update({ lead_id: targetId }).in('lead_id', duplicateIds);
      
      const { error: delErr } = await supabase.from('leads').delete().in('id', duplicateIds);
      if (delErr) throw delErr;

      await this.createAuditLog(targetId, 'Merge Leads', `Merged duplicate lead IDs [${duplicateIds.join(', ')}] into this lead`, userId, userName, 'Web Portal');
    } else {
      const db = loadLocalDb();
      const targetIdx = db.leads.findIndex(l => l.id === targetId);
      if (targetIdx === -1) throw new Error('Target lead not found');
      targetLead = db.leads[targetIdx];

      duplicateIds.forEach(dupId => {
        const dup = db.leads.find(l => l.id === dupId);
        if (dup) {
          dupLeads.push(dup);
        }
      });

      const fieldsToCheck = ['phone2', 'email', 'project', 'budget', 'city', 'lead_source', 'notes'];
      fieldsToCheck.forEach(f => {
        if (!targetLead[f]) {
          const val = dupLeads.find(d => d[f])?.[f];
          if (val) {
            targetLead[f] = val;
          }
        }
      });

      if (db.call_logs) {
        db.call_logs.forEach(c => {
          if (duplicateIds.includes(c.lead_id)) c.lead_id = targetId;
        });
      }
      if (db.site_visits) {
        db.site_visits.forEach(v => {
          if (duplicateIds.includes(v.lead_id)) v.lead_id = targetId;
        });
      }
      if (db.reminders) {
        db.reminders.forEach(r => {
          if (duplicateIds.includes(r.lead_id)) r.lead_id = targetId;
        });
      }
      if (db.bookings) {
        db.bookings.forEach(b => {
          if (duplicateIds.includes(b.lead_id)) b.lead_id = targetId;
        });
      }

      db.leads = db.leads.filter(l => !duplicateIds.includes(l.id));

      if (!db.audit_trails) db.audit_trails = [];
      db.audit_trails.push({
        id: generateUuid(),
        lead_id: targetId,
        action: 'Merge Leads',
        details: `Merged duplicate lead IDs [${duplicateIds.join(', ')}] into this lead`,
        user_id: userId,
        user_name: userName,
        device: 'Web Portal',
        created_at: new Date().toISOString()
      });

      saveLocalDb(db);
    }
    return targetLead;
  },

  // --- PHASE 5: BOOKING MILESTONES & COLLECTIONS ---
  async getBookingMilestones(bookingId) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('booking_milestones')
        .select('*')
        .eq('booking_id', bookingId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      
      // Update overdue status dynamically on read
      const nowStr = new Date().toISOString().split('T')[0];
      const updated = data.map(m => {
        if (m.status === 'Pending' && m.due_date < nowStr) {
          m.status = 'Overdue';
        }
        return m;
      });
      return updated;
    } else {
      const db = loadLocalDb();
      const nowStr = new Date().toISOString().split('T')[0];
      const list = (db.booking_milestones || []).filter(m => m.booking_id === bookingId);
      list.forEach(m => {
        if (m.status === 'Pending' && m.due_date < nowStr) {
          m.status = 'Overdue';
        }
      });
      return list.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    }
  },

  async createBookingMilestone(milestoneData) {
    const formatted = {
      booking_id: milestoneData.booking_id,
      milestone_name: milestoneData.milestone_name,
      amount: parseFloat(milestoneData.amount),
      due_date: milestoneData.due_date,
      amount_paid: parseFloat(milestoneData.amount_paid || 0),
      status: milestoneData.status || 'Pending'
    };
    if (formatted.amount_paid >= formatted.amount) {
      formatted.status = 'Paid';
    } else {
      const nowStr = new Date().toISOString().split('T')[0];
      if (formatted.due_date < nowStr) {
        formatted.status = 'Overdue';
      }
    }

    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('booking_milestones')
        .insert([formatted])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      if (!db.booking_milestones) db.booking_milestones = [];
      const newMilestone = { id: generateUuid(), created_at: new Date().toISOString(), ...formatted };
      db.booking_milestones.push(newMilestone);
      saveLocalDb(db);
      return newMilestone;
    }
  },

  async updateBookingMilestone(id, milestoneData) {
    const formatted = {};
    if (milestoneData.milestone_name !== undefined) formatted.milestone_name = milestoneData.milestone_name;
    if (milestoneData.amount !== undefined) formatted.amount = parseFloat(milestoneData.amount);
    if (milestoneData.due_date !== undefined) formatted.due_date = milestoneData.due_date;
    if (milestoneData.amount_paid !== undefined) formatted.amount_paid = parseFloat(milestoneData.amount_paid);
    if (milestoneData.status !== undefined) formatted.status = milestoneData.status;

    if (formatted.amount !== undefined || formatted.amount_paid !== undefined) {
      const amt = formatted.amount !== undefined ? formatted.amount : milestoneData.amount;
      const paid = formatted.amount_paid !== undefined ? formatted.amount_paid : milestoneData.amount_paid;
      if (paid >= amt) {
        formatted.status = 'Paid';
      } else {
        const dDate = formatted.due_date !== undefined ? formatted.due_date : milestoneData.due_date;
        const nowStr = new Date().toISOString().split('T')[0];
        if (dDate && dDate < nowStr) {
          formatted.status = 'Overdue';
        } else {
          formatted.status = 'Pending';
        }
      }
    }

    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('booking_milestones')
        .update(formatted)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.booking_milestones.findIndex(m => m.id === id);
      if (idx !== -1) {
        db.booking_milestones[idx] = { ...db.booking_milestones[idx], ...formatted };
        saveLocalDb(db);
        return db.booking_milestones[idx];
      }
      throw new Error('Milestone not found');
    }
  },

  async deleteBookingMilestone(id) {
    if (this.isCloud()) {
      const { error } = await supabase
        .from('booking_milestones')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } else {
      const db = loadLocalDb();
      db.booking_milestones = (db.booking_milestones || []).filter(m => m.id !== id);
      saveLocalDb(db);
      return true;
    }
  },

  async getCollectionAnalytics() {
    let bookings = [];
    let payments = [];
    let milestones = [];

    if (this.isCloud()) {
      const { data: b } = await supabase.from('bookings').select('*');
      bookings = b || [];
      const { data: p } = await supabase.from('payments').select('*');
      payments = p || [];
      const { data: m } = await supabase.from('booking_milestones').select('*');
      milestones = m || [];
    } else {
      const db = loadLocalDb();
      bookings = db.bookings || [];
      payments = db.payments || [];
      milestones = db.booking_milestones || [];
    }

    const totalCollection = payments.reduce((sum, p) => sum + (p.total_cost || 0), 0);
    const receivedCollection = payments.reduce((sum, p) => sum + (p.amount_received || 0), 0);
    const pendingCollection = totalCollection - receivedCollection;

    const nowStr = new Date().toISOString().split('T')[0];
    const curMonthStr = nowStr.substring(0, 7); // YYYY-MM
    
    // Milestones due this month
    const dueThisMonth = milestones
      .filter(m => m.due_date && m.due_date.substring(0, 7) === curMonthStr)
      .reduce((sum, m) => sum + (m.amount || 0), 0);

    // Overdue amount
    const overdueAmount = milestones
      .filter(m => m.due_date < nowStr && m.status !== 'Paid')
      .reduce((sum, m) => sum + ((m.amount || 0) - (m.amount_paid || 0)), 0);

    let installments = [];
    if (this.isCloud()) {
      const { data } = await supabase.from('payment_installments').select('*');
      installments = data || [];
    } else {
      const db = loadLocalDb();
      installments = db.payment_installments || [];
    }

    const modeBreakdown = { UPI: 0, Cash: 0, Cheque: 0, 'NEFT/RTGS': 0, Other: 0 };
    installments.forEach(inst => {
      const mode = inst.payment_mode || 'Other';
      if (modeBreakdown[mode] !== undefined) {
        modeBreakdown[mode] += inst.amount_paid || 0;
      } else {
        modeBreakdown.Other += inst.amount_paid || 0;
      }
    });

    return {
      totalCollection,
      receivedCollection,
      pendingCollection,
      dueThisMonth,
      overdueAmount,
      modeBreakdown
    };
  },

  async getCollectionReminders() {
    let milestones = [];
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('booking_milestones')
        .select('*, bookings(*, leads(*), projects(*), inventory(*))')
        .neq('status', 'Paid')
        .order('due_date', { ascending: true });
      if (error) throw error;
      milestones = data || [];
    } else {
      const db = loadLocalDb();
      milestones = (db.booking_milestones || []).filter(m => m.status !== 'Paid').map(m => {
        const booking = db.bookings.find(b => b.id === m.booking_id);
        let bkWithJoins = null;
        if (booking) {
          const lead = db.leads.find(l => l.id === booking.lead_id);
          const proj = db.projects.find(pr => pr.id === booking.project_id);
          const inv = db.inventory.find(i => i.id === booking.inventory_id);
          bkWithJoins = { ...booking, leads: lead || null, projects: proj || null, inventory: inv || null };
        }
        return { ...m, bookings: bkWithJoins };
      });
    }

    const nowStr = new Date().toISOString().split('T')[0];
    const upcoming = milestones.filter(m => m.due_date >= nowStr);
    const overdue = milestones.filter(m => m.due_date < nowStr);

    return {
      upcoming,
      overdue
    };
  },

  async getSourceRoiStats() {
    if (this.isCloud()) {
      const { data: leads, error: errLeads } = await supabase
        .from('leads')
        .select('id, lead_source, status');
      if (errLeads) throw errLeads;

      const { data: bookings, error: errBookings } = await supabase
        .from('bookings')
        .select('id, lead_id, token_amount, booking_amount');
      if (errBookings) throw errBookings;

      const leadMap = {};
      leads.forEach(l => {
        leadMap[l.id] = l.lead_source || 'Website';
      });

      const stats = {};
      const targetSources = ['Facebook', 'Instagram', 'Google', 'Website', 'Referral'];
      targetSources.forEach(s => {
        stats[s] = { source: s, leads: 0, bookings: 0, revenue: 0 };
      });

      leads.forEach(l => {
        const src = l.lead_source || 'Website';
        const standardizedSrc = targetSources.includes(src) ? src : 'Website';
        stats[standardizedSrc].leads++;
      });

      bookings.forEach(b => {
        const src = leadMap[b.lead_id] || 'Website';
        const standardizedSrc = targetSources.includes(src) ? src : 'Website';
        stats[standardizedSrc].bookings++;
        stats[standardizedSrc].revenue += (parseFloat(b.token_amount) || 0) + (parseFloat(b.booking_amount) || 0);
      });

      return Object.values(stats).map(s => ({
        ...s,
        conversion: s.leads > 0 ? Math.round((s.bookings / s.leads) * 100 * 10) / 10 : 0
      }));
    } else {
      const db = loadLocalDb();
      const leads = db.leads || [];
      const bookings = db.bookings || [];

      const leadMap = {};
      leads.forEach(l => {
        leadMap[l.id] = l.lead_source || 'Website';
      });

      const stats = {};
      const targetSources = ['Facebook', 'Instagram', 'Google', 'Website', 'Referral'];
      targetSources.forEach(s => {
        stats[s] = { source: s, leads: 0, bookings: 0, revenue: 0 };
      });

      leads.forEach(l => {
        const src = l.lead_source || 'Website';
        const standardizedSrc = targetSources.includes(src) ? src : 'Website';
        stats[standardizedSrc].leads++;
      });

      bookings.forEach(b => {
        const src = leadMap[b.lead_id] || 'Website';
        const standardizedSrc = targetSources.includes(src) ? src : 'Website';
        stats[standardizedSrc].bookings++;
        stats[standardizedSrc].revenue += (parseFloat(b.token_amount) || 0) + (parseFloat(b.booking_amount) || 0);
      });

      return Object.values(stats).map(s => ({
        ...s,
        conversion: s.leads > 0 ? Math.round((s.bookings / s.leads) * 100 * 10) / 10 : 0
      }));
    }
  },

  async getFunnelStats(employeeId = null) {
    let leads = [];
    let bookings = [];
    let callLogs = [];
    let siteVisits = [];

    if (this.isCloud()) {
      let leadQuery = supabase.from('leads').select('id, status, assigned_employee_id');
      if (employeeId) {
        leadQuery = leadQuery.eq('assigned_employee_id', employeeId);
      }
      const { data: l } = await leadQuery;
      leads = l || [];

      const leadIds = leads.map(x => x.id);

      if (leadIds.length > 0) {
        const { data: b } = await supabase.from('bookings').select('token_amount, booking_amount, lead_id').in('lead_id', leadIds);
        bookings = b || [];
        const { data: c } = await supabase.from('call_logs').select('lead_id').in('lead_id', leadIds);
        callLogs = c || [];
        const { data: v } = await supabase.from('site_visits').select('lead_id').in('lead_id', leadIds);
        siteVisits = v || [];
      }
    } else {
      const db = loadLocalDb();
      leads = db.leads || [];
      if (employeeId) {
        leads = leads.filter(l => l.assigned_employee_id === employeeId);
      }
      const leadIds = new Set(leads.map(x => x.id));
      bookings = (db.bookings || []).filter(b => leadIds.has(b.lead_id));
      callLogs = (db.call_logs || []).filter(c => leadIds.has(c.lead_id));
      siteVisits = (db.site_visits || []).filter(v => leadIds.has(v.lead_id));
    }

    const contactedLeadIds = new Set(callLogs.map(c => c.lead_id));
    const visitLeadIds = new Set(siteVisits.map(v => v.lead_id));
    const bookedLeadIds = new Set(bookings.map(b => b.lead_id));

    let contacted = leads.filter(l => contactedLeadIds.has(l.id) || ['Attempted', 'Connected', 'Warm', 'Cold', 'Interested'].includes(l.status)).length;
    let visit = leads.filter(l => visitLeadIds.has(l.id) || ['Site Visit Scheduled', 'Site Visit Done'].includes(l.status)).length;
    let negotiation = leads.filter(l => ['Negotiation', 'Hot'].includes(l.status)).length;
    let booked = leads.filter(l => bookedLeadIds.has(l.id) || l.status === 'Booked').length;

    const revenue = bookings.reduce((sum, b) => sum + (parseFloat(b.token_amount) || 0) + (parseFloat(b.booking_amount) || 0), 0);

    return {
      leads: leads.length,
      contacted,
      site_visit: visit,
      negotiation,
      booking: booked,
      revenue
    };
  },

  async getIncentivesData(employeeId = null) {
    let bookings = [];
    let users = [];

    if (this.isCloud()) {
      let query = supabase.from('bookings').select('*, leads(*), projects(*), users!executive_id(*)').order('booking_date', { ascending: false });
      if (employeeId) {
        query = query.eq('executive_id', employeeId);
      }
      const { data: b, error } = await query;
      if (error) throw error;
      bookings = b || [];

      const { data: u } = await supabase.from('users').select('id, full_name, role, commission_percentage');
      users = u || [];
    } else {
      const db = loadLocalDb();
      bookings = db.bookings || [];
      if (employeeId) {
        bookings = bookings.filter(b => b.executive_id === employeeId);
      }
      bookings = bookings.map(b => {
        const lead = db.leads.find(l => l.id === b.lead_id);
        const proj = db.projects.find(pr => pr.id === b.project_id);
        const exec = db.users.find(u => u.id === b.executive_id);
        return {
          ...b,
          leads: lead || null,
          projects: proj || null,
          users: exec || null
        };
      });
      users = db.users || [];
    }

    const formattedBookings = bookings.map(b => {
      const value = (parseFloat(b.token_amount) || 0) + (parseFloat(b.booking_amount) || 0);
      const commissionRate = b.users && b.users.commission_percentage !== undefined ? parseFloat(b.users.commission_percentage) : 1.50;
      const incentive = (value * commissionRate) / 100;
      return {
        id: b.id,
        customer_name: b.leads ? b.leads.name : 'N/A',
        lead_id: b.lead_id,
        project_name: b.projects ? b.projects.name : 'N/A',
        unit_number: b.unit_number || 'N/A',
        booking_date: b.booking_date || b.created_at,
        booking_value: value,
        executive_name: b.users ? b.users.full_name : 'System',
        executive_id: b.executive_id,
        commission_rate: commissionRate,
        incentive_amount: incentive
      };
    });

    return {
      bookings: formattedBookings,
      default_commission: 1.50
    };
  },

  async getEmployeePerformanceReports() {
    let users = [];
    let leads = [];
    let callLogs = [];
    let reminders = [];
    let siteVisits = [];
    let bookings = [];
    let payments = [];

    if (this.isCloud()) {
      const { data: u } = await supabase.from('users').select('id, full_name, username, status, commission_percentage').eq('role', 'employee');
      users = u || [];
      const { data: l } = await supabase.from('leads').select('id, assigned_employee_id, status');
      leads = l || [];
      const { data: c } = await supabase.from('call_logs').select('caller_id, response');
      callLogs = c || [];
      const { data: r } = await supabase.from('reminders').select('assigned_employee_id, is_read');
      reminders = r || [];
      const { data: v } = await supabase.from('site_visits').select('id, lead_id, outcome');
      siteVisits = v || [];
      const { data: b } = await supabase.from('bookings').select('id, lead_id, executive_id');
      bookings = b || [];
      const { data: p } = await supabase.from('payments').select('amount_received, booking_id');
      payments = p || [];
    } else {
      const db = loadLocalDb();
      users = (db.users || []).filter(u => u.role === 'employee');
      leads = db.leads || [];
      callLogs = db.call_logs || [];
      reminders = db.reminders || [];
      siteVisits = db.site_visits || [];
      bookings = db.bookings || [];
      payments = db.payments || [];
    }

    const leadMap = {};
    leads.forEach(l => {
      leadMap[l.id] = l;
    });

    const report = users.map(u => {
      const empLeads = leads.filter(l => l.assigned_employee_id === u.id);
      const empLeadsCount = empLeads.length;
      
      const empCallsLogs = callLogs.filter(c => c.caller_id === u.id);
      const empCalls = empCallsLogs.length;

      const notConnectedResponses = ['Not Picked', 'Busy', 'Failed', 'Not Connected'];
      const connectedCalls = empCallsLogs.filter(c => !notConnectedResponses.includes(c.response)).length;

      const interestedLeads = empLeads.filter(l => ['Interested', 'Warm', 'Hot'].includes(l.status)).length;
      
      const empReminders = reminders.filter(r => r.assigned_employee_id === u.id);
      const followUps = empReminders.length;
      const followUpsCompleted = empReminders.filter(r => r.is_read).length;
      const followUpsPending = followUps - followUpsCompleted;
      const followupCompliancePct = followUps > 0 ? Math.round((followUpsCompleted / followUps) * 100) : 100;

      const empVisits = siteVisits.filter(v => {
        const lead = leadMap[v.lead_id];
        return lead && lead.assigned_employee_id === u.id && v.outcome && v.outcome !== 'Scheduled';
      }).length;

      const empBookings = bookings.filter(b => b.executive_id === u.id);
      const bookingsCount = empBookings.length;

      const empBookingIds = new Set(empBookings.map(b => b.id));
      const collections = payments
        .filter(p => empBookingIds.has(p.booking_id))
        .reduce((sum, p) => sum + (parseFloat(p.amount_received) || 0), 0);

      const conversion = empLeadsCount > 0 ? Math.round((bookingsCount / empLeadsCount) * 100 * 10) / 10 : 0;

      return {
        employee_id: u.id,
        name: u.full_name,
        username: u.username,
        status: u.status || 'active',
        commission_percentage: u.commission_percentage !== undefined ? parseFloat(u.commission_percentage) : 1.50,
        leads_count: empLeadsCount,
        calls: empCalls,
        connected_calls: connectedCalls,
        interested_leads: interestedLeads,
        follow_ups: followUps,
        follow_ups_completed: followUpsCompleted,
        follow_ups_pending: followUpsPending,
        followup_compliance_pct: followupCompliancePct,
        site_visits: empVisits,
        bookings: bookingsCount,
        collections,
        conversion
      };
    });

    return report;
  },

  async updateEmployeeCommission(id, commissionPct) {
    if (this.isCloud()) {
      const { data, error } = await supabase
        .from('users')
        .update({ commission_percentage: commissionPct })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const db = loadLocalDb();
      const idx = db.users.findIndex(u => u.id === id);
      if (idx !== -1) {
        db.users[idx].commission_percentage = parseFloat(commissionPct);
        saveLocalDb(db);
        return db.users[idx];
      }
      throw new Error('User not found');
    }
  }
};

module.exports = DB;
