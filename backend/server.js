require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { Readable } = require('stream');
const csvParser = require('csv-parser');
const xlsx = require('xlsx');
const DB = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'vrindavan_estates_secret_key_123';

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Middleware: Authenticate JWT, enforce disable status, and verify token version
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Token missing' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
      const user = await DB.getUserById(decodedUser.id);
      if (!user) {
        return res.status(403).json({ error: 'User account not found' });
      }

      // Check if user is disabled
      if (user.status === 'disabled') {
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact your Admin.' });
      }

      // Force Logout check: compare token version
      if (decodedUser.token_version !== user.token_version) {
        return res.status(403).json({ error: 'Token revoked. Please log in again (Force Logged Out)' });
      }

      req.user = user;
      next();
    } catch (dbErr) {
      res.status(500).json({ error: 'Database validation failed' });
    }
  });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }
}

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await DB.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Your account has been deactivated.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Include token_version in the signed payload to support force-logout checks
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name, token_version: user.token_version },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone,
        status: user.status
      },
      isCloud: DB.isCloud()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    full_name: req.user.full_name,
    phone: req.user.phone,
    status: req.user.status
  });
});

// --- EMPLOYEE LIFECYCLE MANAGEMENT (Admin only) ---

app.post('/api/employees', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, full_name, phone } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Username, password, and full name are required' });
  }

  try {
    const existing = await DB.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newEmployee = await DB.createUser(username, passwordHash, 'employee', full_name, phone);
    res.status(201).json({
      message: 'Employee account created successfully',
      employee: newEmployee
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee account' });
  }
});

app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const employees = await DB.getAllEmployees();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employees list' });
  }
});

// Toggle Employee Status (Enable/Disable + Force Logout)
app.put('/api/employees/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!status || !['active', 'disabled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status type. Must be active or disabled.' });
  }

  try {
    const updatedUser = await DB.updateEmployeeStatus(req.params.id, status);
    res.json({
      message: `Employee account is now ${status}. Forced logout triggered on all logged in devices.`,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        status: updatedUser.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee account status' });
  }
});

// Transfer Leads bulk-wise
app.post('/api/employees/:id/transfer-leads', authenticateToken, requireAdmin, async (req, res) => {
  const { to_employee_id } = req.body;
  if (!to_employee_id) {
    return res.status(400).json({ error: 'Target employee ID is required.' });
  }

  try {
    const count = await DB.transferAllLeads(req.params.id, to_employee_id, req.user.id);
    res.json({ message: `Successfully transferred ${count} leads to the selected employee.` });
  } catch (error) {
    console.error('Bulk transfer error:', error);
    res.status(500).json({ error: 'Failed to bulk-transfer leads.' });
  }
});

// --- LEADS MANAGEMENT ROUTES ---

// Real-time Duplicate Check Endpoint
app.get('/api/leads/check-duplicate', authenticateToken, async (req, res) => {
  const { phone1, phone2, excludeId } = req.query;
  try {
    const duplicate = await DB.checkDuplicateLead(phone1, phone2, excludeId || null);
    res.json({ duplicate: !!duplicate, duplicateLead: duplicate });
  } catch (e) {
    res.status(500).json({ error: 'Failed to perform duplicate detection' });
  }
});

app.get('/api/leads', authenticateToken, async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      city: req.query.city,
      budget: req.query.budget,
      project: req.query.project,
      status: req.query.status,
      assigned_employee_id: req.query.assigned_employee_id,
      source: req.query.source
    };

    const leads = await DB.getLeads(filters, req.user.id, req.user.role);
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

app.post('/api/leads', authenticateToken, async (req, res) => {
  try {
    const leadData = { ...req.body };
    if (req.user.role !== 'admin') {
      leadData.assigned_employee_id = req.user.id;
    }

    // Enterprise: Duplicate checking before insert
    const duplicate = await DB.checkDuplicateLead(leadData.phone1, leadData.phone2);
    
    const newLead = await DB.createLead(leadData, req.user.id);
    
    // Log audit trail
    let auditDetails = 'Lead created in system.';
    if (duplicate) {
      auditDetails += ` WARNING: Duplicate lead matched phone numbers. Already owned by: ${duplicate.owner}`;
    }
    
    await DB.logAudit(newLead.id, 'Lead Created', auditDetails, req.user.id, req.user.full_name);
    
    if (newLead.assigned_employee_id) {
      await DB.logAudit(
        newLead.id,
        'Lead Assigned/Transferred',
        `Lead initially assigned to: ${leadData.assigned_employee_id}`,
        req.user.id,
        req.user.full_name
      );
    }

    res.status(201).json({ ...newLead, duplicateFound: !!duplicate, duplicateInfo: duplicate });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

app.put('/api/leads/:id', authenticateToken, async (req, res) => {
  try {
    const oldLead = await DB.getLeadById(req.params.id, req.user.id, req.user.role);
    if (!oldLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Enterprise Lockdown check
    // If employee attempts to modify name or phone, we block it or backend ignores it.
    // Our db.js updateLead automatically ignores name/phone changes for employees.
    const lead = await DB.updateLead(req.params.id, req.body, req.user.id, req.user.role);
    
    // Compare changes and Log Audits
    if (req.body.status !== oldLead.status) {
      await DB.logAudit(
        lead.id, 
        'Status Changed', 
        `Status changed from "${oldLead.status}" to "${req.body.status}"`, 
        req.user.id, 
        req.user.full_name
      );
    }
    
    if (req.body.follow_up_date !== oldLead.follow_up_date) {
      await DB.logAudit(
        lead.id,
        'Follow-up Added',
        `Follow-up date scheduled/updated: "${req.body.follow_up_date || 'Cleared'}"`,
        req.user.id,
        req.user.full_name
      );
    }

    if (req.body.comments !== oldLead.comments) {
      await DB.logAudit(
        lead.id,
        'Notes Added',
        `Lead comments notes edited.`,
        req.user.id,
        req.user.full_name
      );
    }

    res.json(lead);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update lead' });
  }
});

app.delete('/api/leads/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await DB.deleteLead(req.params.id, req.user.id, req.user.role);
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to delete lead' });
  }
});

// --- CALL LOGS ---

app.post('/api/leads/:id/call-log', authenticateToken, async (req, res) => {
  const { response, notes } = req.body;
  if (!response) {
    return res.status(400).json({ error: 'Call response selection is required' });
  }

  try {
    const updatedLead = await DB.logCall(req.params.id, req.user.id, response, notes);
    
    // Log audit trail
    await DB.logAudit(
      req.params.id,
      'Notes Added',
      `Logged call response: "${response}". Remarks: ${notes}`,
      req.user.id,
      req.user.full_name
    );

    res.json({ message: 'Call logged successfully', lead: updatedLead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record call log' });
  }
});

app.get('/api/leads/:id/call-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await DB.getCallLogs(req.params.id);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch call logs' });
  }
});

// --- ENTERPRISE HISTORY TRAILS ENDPOINTS ---

// Fetch audit trail for a lead
app.get('/api/leads/:id/audit-trail', authenticateToken, async (req, res) => {
  try {
    const audits = await DB.getAuditTrail(req.params.id);
    res.json(audits);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch audit trails' });
  }
});

// Fetch ownership transfer logs for a lead
app.get('/api/leads/:id/transfer-history', authenticateToken, async (req, res) => {
  try {
    const transfers = await DB.getTransferHistory(req.params.id);
    res.json(transfers);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch transfer history logs' });
  }
});

// --- DATA EXPORT & IMPORTS ---

// Export Leads: LOCKDOWN: ADMIN ONLY!
app.get('/api/export', authenticateToken, async (req, res) => {
  // Enforce Security: Employee cannot export leads
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Security Access Violation: Export leads data is locked for admin role only.' });
  }

  try {
    const leads = await DB.getLeads({}, req.user.id, req.user.role);
    const format = req.query.format || 'csv';

    const plainLeads = leads.map(l => ({
      'Date': l.created_at ? new Date(l.created_at).toISOString().split('T')[0] : '',
      'Name': l.name || '',
      'City': l.city || '',
      'Phone 1': l.phone1 || '',
      'Phone 2': l.phone2 || '',
      'Budget': l.budget || '',
      'Project': l.project || '',
      'Requirement': l.requirement || '',
      'Comments': l.comments || '',
      'Status': l.status || '',
      'Follow Up Date': l.follow_up_date || '',
      'Assigned Employee': l.assigned_employee ? l.assigned_employee.full_name : 'Unassigned',
      'Lead Source': l.lead_source || '',
      'Site Visit Date': l.site_visit_date || '',
      'Site Visit Status': l.site_visit_status || '',
      'Site Visit Remarks': l.site_visit_remarks || '',
      'Booking Token Amount': l.booking_token_amount || 0,
      'Booking Date': l.booking_date || '',
      'Booking Status': l.booking_status || '',
      'Last Call Date': l.last_call_date || '',
      'Last Call Response': l.last_response || ''
    }));

    if (format === 'xlsx') {
      const worksheet = xlsx.utils.json_to_sheet(plainLeads);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Leads');
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=leads_export.xlsx');
      return res.send(buffer);
    } else {
      if (plainLeads.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');
        return res.send('Date,Name,City,Phone 1,Phone 2,Budget,Project,Requirement,Comments,Status,Follow Up Date,Assigned Employee,Lead Source,Site Visit Date,Site Visit Status,Site Visit Remarks,Booking Token Amount,Booking Date,Booking Status,Last Call Date,Last Call Response\n');
      }

      const headers = Object.keys(plainLeads[0]);
      const csvRows = [headers.join(',')];

      for (const row of plainLeads) {
        const values = headers.map(header => {
          const val = row[header];
          const str = String(val === null || val === undefined ? '' : val);
          const escaped = str.replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');
      return res.send(csvRows.join('\n'));
    }
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Export Bookings, Payments, or Site Visits reports: Admin Only!
app.get('/api/reports/export', authenticateToken, requireAdmin, async (req, res) => {
  const type = req.query.type || 'bookings';
  try {
    let plainData = [];
    let filename = 'report.csv';

    if (type === 'bookings') {
      const list = await DB.getBookings();
      plainData = list.map(b => ({
        'Booking ID': b.id,
        'Booking Date': b.booking_date || '',
        'Customer Name': b.leads ? b.leads.name : 'Unknown',
        'Customer Phone': b.leads ? b.leads.phone1 : 'Unknown',
        'Project Name': b.projects ? b.projects.name : 'Unknown',
        'Unit Number': b.unit_number || '',
        'Token Amount': b.token_amount || 0,
        'Booking Amount': b.booking_amount || 0,
        'Executive Name': b.users ? b.users.full_name : 'Unknown',
        'Status': b.status || 'Token Received'
      }));
      filename = 'bookings_report.csv';
    } else if (type === 'payments') {
      const list = await DB.getPayments();
      plainData = list.map(p => ({
        'Payment ID': p.id,
        'Customer Name': p.bookings && p.bookings.leads ? p.bookings.leads.name : 'Unknown',
        'Project': p.bookings && p.bookings.projects ? p.bookings.projects.name : 'Unknown',
        'Unit Number': p.bookings ? p.bookings.unit_number : 'Unknown',
        'Total Cost': p.total_cost || 0,
        'Amount Received': p.amount_received || 0,
        'Balance': p.balance || 0,
        'Due Date': p.due_date || '',
        'Status': p.status || 'Pending'
      }));
      filename = 'payments_report.csv';
    } else if (type === 'site-visits') {
      const list = await DB.getSiteVisits();
      plainData = list.map(v => ({
        'Visit ID': v.id,
        'Visit Date': v.visit_date || '',
        'Visit Time': v.visit_time || '',
        'Customer Name': v.leads ? v.leads.name : 'Unknown',
        'Project': v.leads ? v.leads.project : 'Unknown',
        'Executive Name': v.leads && v.leads.assigned_employee ? v.leads.assigned_employee.full_name : 'Unassigned',
        'Check-In Time': v.check_in_time || '',
        'Check-In Address': v.check_in_address || '',
        'Check-Out Time': v.check_out_time || '',
        'Check-Out Address': v.check_out_address || '',
        'Outcome': v.outcome || '',
        'Feedback': v.feedback || ''
      }));
      filename = 'site_visits_report.csv';
    } else {
      return res.status(400).json({ error: 'Invalid report type specified.' });
    }

    if (plainData.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      return res.send('');
    }

    const headers = Object.keys(plainData[0]);
    const csvRows = [headers.join(',')];

    for (const row of plainData) {
      const values = headers.map(header => {
        const val = row[header];
        const str = String(val === null || val === undefined ? '' : val);
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.send(csvRows.join('\n'));
  } catch (error) {
    console.error('Report export error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

app.post('/api/import', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filename = req.file.originalname;
  const leadsToImport = [];

  try {
    if (filename.endsWith('.csv')) {
      const stream = Readable.from(req.file.buffer.toString());
      stream
        .pipe(csvParser())
        .on('data', (row) => {
          leadsToImport.push(parseRow(row));
        })
        .on('end', async () => {
          try {
            const imported = await bulkInsert(leadsToImport, req.user.id, req.user.full_name);
            res.json({ message: `Successfully imported ${imported.length} leads` });
          } catch (e) {
            res.status(500).json({ error: 'Error importing data: ' + e.message });
          }
        });
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet);

      for (const row of rows) {
        leadsToImport.push(parseRow(row));
      }

      const imported = await bulkInsert(leadsToImport, req.user.id, req.user.full_name);
      res.json({ message: `Successfully imported ${imported.length} leads` });
    } else {
      res.status(400).json({ error: 'Unsupported file format. Please upload a CSV or Excel (.xlsx) file.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Import failed: ' + error.message });
  }
});

async function bulkInsert(leads, adminId, adminName) {
  const insertedLeads = [];
  for (const lead of leads) {
    const duplicate = await DB.checkDuplicateLead(lead.phone1, lead.phone2);
    const l = await DB.createLead(lead, adminId);
    
    let auditDetails = 'Lead bulk-imported.';
    if (duplicate) {
      auditDetails += ` WARNING: Duplicate lead matched. Owned by: ${duplicate.owner}`;
    }
    await DB.logAudit(l.id, 'Lead Created', auditDetails, adminId, adminName);
    insertedLeads.push(l);
  }
  return insertedLeads;
}

function parseRow(row) {
  const normalized = {};
  for (const k of Object.keys(row)) {
    normalized[k.toLowerCase().replace(/[\s_]/g, '')] = row[k];
  }

  return {
    name: normalized.name || normalized.leadname || 'Imported Lead',
    city: normalized.city || '',
    phone1: String(normalized.phone1 || normalized.phone || normalized.phone_1 || ''),
    phone2: String(normalized.phone2 || normalized.phone_2 || ''),
    budget: normalized.budget || '',
    project: normalized.project || '',
    requirement: normalized.requirement || '',
    comments: normalized.comments || normalized.comment || '',
    status: validateStatus(normalized.status),
    follow_up_date: normalized.followupdate || normalized.followup || null,
    lead_source: validateSource(normalized.leadsource || normalized.source),
    site_visit_date: normalized.sitevisitdate || null,
    site_visit_status: normalized.sitevisitstatus || 'None',
    site_visit_remarks: normalized.sitevisitremarks || '',
    booking_token_amount: normalized.bookingtokenamount || normalized.tokenamount || 0,
    booking_date: normalized.bookingdate || null,
    booking_status: normalized.bookingstatus || 'None',
    last_call_date: normalized.lastcalldate || null,
    last_response: normalized.lastcallresponse || normalized.lastresponse || null
  };
}

function validateStatus(status) {
  if (!status) return 'Warm';
  const s = String(status).trim().toLowerCase();
  if (s.includes('hot')) return 'Hot';
  if (s.includes('cold')) return 'Cold';
  return 'Warm';
}

function validateSource(source) {
  if (!source) return 'Website';
  const srcMap = {
    'facebook': 'Facebook',
    'fb': 'Facebook',
    'instagram': 'Instagram',
    'insta': 'Instagram',
    'google': 'Google',
    'adwords': 'Google',
    'web': 'Website',
    'website': 'Website',
    'whatsapp': 'WhatsApp',
    'reference': 'Referral',
    'referral': 'Referral',
    'ref': 'Referral',
    'walk-in': 'Walk-In',
    'walkin': 'Walk-In',
    'magicbricks': 'MagicBricks',
    'magic': 'MagicBricks',
    '99acres': '99acres',
    'acres': '99acres',
    'housing': 'Housing',
    'housing.com': 'Housing'
  };
  const key = String(source).trim().toLowerCase();
  return srcMap[key] || 'Website';
}

// --- BACKUP & RESTORE ---

app.get('/api/backup/download', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const backupData = await DB.getBackupData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=vrindavan_estates_backup.json');
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate database backup' });
  }
});

app.post('/api/backup/restore', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const backupData = JSON.parse(req.file.buffer.toString('utf8'));
    if (!backupData.users || !backupData.leads) {
      return res.status(400).json({ error: 'Invalid backup format. Must contain users and leads tables.' });
    }

    await DB.restoreData(backupData);
    res.json({ message: 'Database backup restored successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Restore failed: ' + error.message });
  }
});

// --- HELPER: HAVERSINE DISTANCE CALCULATOR ---
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- HELPER: AUTO LEAD DISTRIBUTION ENGINE ---
async function runAutoLeadAssignment(leadId) {
  try {
    const rule = await DB.getDistributionRules();
    if (!rule || !rule.is_active || rule.method === 'Manual') return;

    const employees = await DB.getAllEmployees();
    const activeEmployees = employees.filter(e => e.status === 'active');
    if (activeEmployees.length === 0) return;

    let targetEmployeeId = null;

    if (rule.method === 'Round Robin' || rule.method === 'Equal Distribution') {
      // Find the last assigned lead to determine next in list
      const leads = await DB.getLeads({}, 'system', 'admin');
      const assignedLeads = leads.filter(l => l.assigned_employee_id);
      
      let lastIndex = -1;
      if (assignedLeads.length > 0) {
        const lastAssignedId = assignedLeads[0].assigned_employee_id;
        lastIndex = activeEmployees.findIndex(e => e.id === lastAssignedId);
      }

      const nextIndex = (lastIndex + 1) % activeEmployees.length;
      targetEmployeeId = activeEmployees[nextIndex].id;
    } else if (rule.method === 'Project Wise') {
      // Check if project matching config is defined in rule config
      const lead = await DB.getLeadById(leadId, 'system', 'admin');
      const projectMapping = rule.config || {};
      const matchedEmployeeName = projectMapping[lead.project];
      if (matchedEmployeeName) {
        const emp = activeEmployees.find(e => e.full_name === matchedEmployeeName || e.username === matchedEmployeeName);
        if (emp) targetEmployeeId = emp.id;
      }
      
      // Fallback to round robin if no match found
      if (!targetEmployeeId) {
        const leads = await DB.getLeads({}, 'system', 'admin');
        const assignedLeads = leads.filter(l => l.assigned_employee_id);
        let lastIndex = -1;
        if (assignedLeads.length > 0) {
          const lastAssignedId = assignedLeads[0].assigned_employee_id;
          lastIndex = activeEmployees.findIndex(e => e.id === lastAssignedId);
        }
        const nextIndex = (lastIndex + 1) % activeEmployees.length;
        targetEmployeeId = activeEmployees[nextIndex].id;
      }
    }

    if (targetEmployeeId) {
      await DB.updateLead(leadId, { assigned_employee_id: targetEmployeeId }, 'system', 'admin');
      const emp = activeEmployees.find(e => e.id === targetEmployeeId);
      await DB.logAudit(
        leadId, 
        'Lead Assigned/Transferred', 
        `Auto-assigned to ${emp.full_name} via ${rule.method}`, 
        'system', 
        'Auto Engine'
      );
    }
  } catch (err) {
    console.error('Lead auto assignment engine error:', err);
  }
}

// --- DB HOOK FOR AUTO-ASSIGNMENT ---
// Wrap DB.createLead to automatically trigger lead distribution
const originalCreateLead = DB.createLead;
DB.createLead = async function(leadData, assignerId) {
  // If last_activity_date is not set, initialize it
  leadData.last_activity_date = new Date().toISOString();
  const lead = await originalCreateLead.call(DB, leadData, assignerId);
  
  // Trigger auto-assignment asynchronously if not explicitly assigned
  if (!leadData.assigned_employee_id) {
    setImmediate(() => runAutoLeadAssignment(lead.id));
  }
  return lead;
};

// Wrap DB.updateLead to update last_activity_date
const originalUpdateLead = DB.updateLead;
DB.updateLead = async function(id, leadData, userId, userRole) {
  leadData.last_activity_date = new Date().toISOString();
  return await originalUpdateLead.call(DB, id, leadData, userId, userRole);
};

// Wrap DB.logCall to update last_activity_date
const originalLogCall = DB.logCall;
DB.logCall = async function(leadId, callerId, response, notes) {
  const result = await originalLogCall.call(DB, leadId, callerId, response, notes);
  if (DB.isCloud()) {
    const { supabase } = require('./db');
    await supabase.from('leads').update({ last_activity_date: new Date().toISOString() }).eq('id', leadId);
  } else {
    const fs = require('fs');
    const path = require('path');
    const LOCAL_DB_PATH = path.join(__dirname, 'database.json');
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
      const idx = data.leads.findIndex(l => l.id === leadId);
      if (idx !== -1) {
        data.leads[idx].last_activity_date = new Date().toISOString();
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
      }
    }
  }
  return result;
};

// --- CRON-LIKE INTERVAL INACTIVITY CHECKER (Runs every 1 hour) ---
setInterval(async () => {
  try {
    console.log('Running lead inactivity scanner...');
    const leads = await DB.getLeads({}, 'system', 'admin');
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    for (const lead of leads) {
      if (!lead.assigned_employee_id) continue;
      
      // Determine last activity date
      const activityDate = lead.last_activity_date ? new Date(lead.last_activity_date) : new Date(lead.created_at);
      
      if (activityDate < sevenDaysAgo) {
        // Trigger Inactivity Notification / Audit
        const { data: audits } = await DB.isCloud() 
          ? await require('./db').supabase.from('audit_trails').select('*').eq('lead_id', lead.id).eq('action', 'Inactivity Flagged').limit(1)
          : { data: loadLocalDb().audit_trails.filter(a => a.lead_id === lead.id && a.action === 'Inactivity Flagged') };

        if (!audits || audits.length === 0) {
          await DB.logAudit(
            lead.id, 
            'Inactivity Flagged', 
            `Lead flagged as INACTIVE. No activity detected for 7+ days (Last Activity: ${activityDate.toLocaleDateString()}).`, 
            'system', 
            'Inactivity Engine'
          );
          console.log(`Lead ${lead.name} flagged as inactive.`);
        }
      }
    }
  } catch (err) {
    console.error('Inactivity checker error:', err);
  }
}, 3600000); // 1 hour

// --- PHASE 2: PROJECTS MASTER ---

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getProjects();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.get('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const proj = await DB.getProjectById(req.params.id);
    if (!proj) return res.status(404).json({ error: 'Project not found' });
    res.json(proj);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.post('/api/projects', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const proj = await DB.createProject(req.body);
    res.status(201).json(proj);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.put('/api/projects/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const proj = await DB.updateProject(req.params.id, req.body);
    res.json(proj);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await DB.deleteProject(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// --- PHASE 2: INVENTORY ---

app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getInventory(req.query.project_id);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

app.get('/api/inventory/:id', authenticateToken, async (req, res) => {
  try {
    const item = await DB.getInventoryById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Inventory unit not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch inventory unit' });
  }
});

app.post('/api/inventory', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const item = await DB.createInventory(req.body);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create inventory unit' });
  }
});

app.put('/api/inventory/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const item = await DB.updateInventory(req.params.id, req.body);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update inventory unit' });
  }
});

app.delete('/api/inventory/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await DB.deleteInventory(req.params.id);
    res.json({ message: 'Inventory unit deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete inventory unit' });
  }
});

// --- PHASE 2: BOOKINGS ---

app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getBookings();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const result = await DB.createBooking(req.body, req.user.id);
    
    // Log audit
    await DB.logAudit(
      req.body.lead_id, 
      'Status Changed', 
      `Booking Confirmed. Token of ₹${req.body.token_amount || 0} received for Unit ${req.body.unit_number || 'N/A'}.`, 
      req.user.id, 
      req.user.full_name
    );

    res.status(201).json(result);
  } catch (e) {
    console.error('Booking creation error:', e);
    res.status(500).json({ error: 'Failed to record booking' });
  }
});

app.put('/api/bookings/:id/status', authenticateToken, async (req, res) => {
  try {
    const booking = await DB.updateBookingStatus(req.params.id, req.body.status, req.user.id);
    
    await DB.logAudit(
      booking.lead_id,
      'Status Changed',
      `Booking status updated to "${req.body.status}"`,
      req.user.id,
      req.user.full_name
    );

    res.json(booking);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// --- PHASE 2: PAYMENTS & INSTALLMENTS ---

app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getPayments();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.get('/api/payments/:id', authenticateToken, async (req, res) => {
  try {
    const p = await DB.getPaymentById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Payment record not found' });
    res.json(p);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch payment record' });
  }
});

app.post('/api/payments/:id/installments', authenticateToken, async (req, res) => {
  try {
    const result = await DB.createPaymentInstallment(
      req.params.id,
      req.body.amount_paid,
      req.body.payment_mode,
      req.body.remarks
    );
    
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to record installment payment' });
  }
});

app.get('/api/payments/:id/installments', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getPaymentInstallments(req.params.id);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch installments' });
  }
});

// --- PHASE 2: WHATSAPP AUTOMATION ---

app.get('/api/whatsapp/templates', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getWhatsAppTemplates();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

app.post('/api/whatsapp/templates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const temp = await DB.createWhatsAppTemplate(req.body);
    res.status(201).json(temp);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

app.get('/api/whatsapp/campaigns', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getWhatsAppCampaigns();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

app.get('/api/whatsapp/campaigns/:id/logs', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getWhatsAppCampaignLogs(req.params.id);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch campaign logs' });
  }
});

// Send Bulk WhatsApp Campaign
app.post('/api/whatsapp/campaigns', authenticateToken, async (req, res) => {
  const { name, template_id, filters, leads } = req.body;
  if (!name || !template_id || !leads || leads.length === 0) {
    return res.status(400).json({ error: 'Campaign name, template, and recipient list are required' });
  }

  try {
    const template = await DB.getWhatsAppTemplateById(template_id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Construct the logs list for database commit
    const logs = [];
    for (const lead of leads) {
      // Simple variable interpolation helper
      let text = template.body_text;
      text = text.replace(/{customer_name}/gi, lead.name || '');
      text = text.replace(/{project_name}/gi, lead.project || '');
      text = text.replace(/{price}/gi, lead.budget || '');
      text = text.replace(/{location}/gi, lead.city || '');
      text = text.replace(/{executive_name}/gi, req.user.full_name || '');

      logs.push({
        lead_id: lead.id,
        phone: lead.phone1,
        message_text: text,
        status: 'Sent' // Mocking initial status as Sent
      });
    }

    const campaignData = {
      name,
      template_id,
      filters_used: filters || {}
    };

    const result = await DB.createWhatsAppCampaign(campaignData, logs);
    
    // Simulate web hook or immediate Delivery/Read update for mock testing
    setTimeout(async () => {
      try {
        for (const log of result.campaignLogs) {
          // 80% read, 90% delivered, 20% replied status generator
          const rand = Math.random();
          let nextStatus = 'Sent';
          if (rand > 0.9) nextStatus = 'Failed';
          else if (rand > 0.6) nextStatus = 'Delivered';
          else if (rand > 0.2) nextStatus = 'Read';
          else nextStatus = 'Replied';
          
          await DB.updateWhatsAppLogStatus(log.id, nextStatus, nextStatus === 'Replied' ? 'Mock: Interested' : '');
        }
      } catch (err) {
        console.error('Mock status generator error:', err);
      }
    }, 10000);

    res.status(201).json({ message: `Campaign launched successfully to ${leads.length} leads.`, result });
  } catch (e) {
    console.error('Launch campaign error:', e);
    res.status(500).json({ error: 'Failed to launch campaign' });
  }
});

// Configure API keys
app.get('/api/whatsapp/config', authenticateToken, requireAdmin, async (req, res) => {
  // Config mock or file read/write
  res.json({
    meta_url: 'https://graph.facebook.com/v19.0',
    phone_id: '123456789',
    api_key_configured: true
  });
});

// --- PHASE 2: SMART DISTRIBUTION CONFIG ---

app.get('/api/distribution/rules', authenticateToken, async (req, res) => {
  try {
    const rules = await DB.getDistributionRules();
    res.json(rules);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch assignment rules' });
  }
});

app.put('/api/distribution/rules', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rules = await DB.updateDistributionRules(req.body.method, req.body.is_active, req.body.config);
    res.json(rules);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update assignment rules' });
  }
});

// --- PHASE 2: GPS SITE VISIT GEOFENCING ---

app.get('/api/site-visits', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getSiteVisits(req.query.lead_id);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch site visits' });
  }
});

// Geofenced Check-In
app.post('/api/leads/:id/site-visits/check-in', authenticateToken, async (req, res) => {
  const { lat, lng, address } = req.body;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Current coordinates are required for GPS Check-In.' });
  }

  try {
    const lead = await DB.getLeadById(req.params.id, req.user.id, req.user.role);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Retrieve project coordinates
    const projects = await DB.getProjects();
    const project = projects.find(p => p.name === lead.project);

    if (project && project.price_list_url) { // Mock or extract coordinates if stored in price_list_url or lat/lng
      // We will parse coordinates from price_list_url if it contains lat/lng comma separated, 
      // or map link, or default to checking if it's within 500m of project.
      // Let's add default fallback coordinate mapping for Vrindavan Estates projects:
      let projLat = 27.5650;
      let projLng = 77.6850; // Coordinates near Vrindavan
      
      // Let's check if the project record actually has coordinates
      if (project.price_list_url && project.price_list_url.includes(',')) {
        const parts = project.price_list_url.split(',');
        const pLat = parseFloat(parts[0]);
        const pLng = parseFloat(parts[1]);
        if (!isNaN(pLat) && !isNaN(pLng)) {
          projLat = pLat;
          projLng = pLng;
        }
      }

      // Calculate distance
      const distance = getDistanceInMeters(lat, lng, projLat, projLng);
      if (distance > 500) {
        return res.status(400).json({
          error: `Check-in denied: You are ${Math.round(distance)}m away from project "${lead.project}". Geofence limit is 500 meters.`
        });
      }
    }

    const checkInTime = new Date().toISOString();
    const visit = await DB.checkInSiteVisit(req.params.id, checkInTime, lat, lng, address);
    
    await DB.logAudit(
      req.params.id,
      'Site Visit Flagged',
      `Checked-in at site. Latitude: ${lat}, Longitude: ${lng}. Address: ${address || 'N/A'}.`,
      req.user.id,
      req.user.full_name
    );

    res.status(201).json(visit);
  } catch (e) {
    console.error('Check-in error:', e);
    res.status(500).json({ error: 'Failed to complete GPS check-in' });
  }
});

// Check-Out site visit
app.post('/api/leads/:id/site-visits/:visitId/check-out', authenticateToken, async (req, res) => {
  const { lat, lng, address, feedback, outcome, media_urls } = req.body;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Current coordinates are required for GPS Check-Out.' });
  }

  try {
    const checkOutTime = new Date().toISOString();
    const visit = await DB.checkOutSiteVisit(req.params.visitId, checkOutTime, lat, lng, address, feedback, outcome, media_urls);

    await DB.logAudit(
      req.params.id,
      'Site Visit Flagged',
      `Checked-out of site. Feedback: "${feedback}". Outcome: "${outcome}".`,
      req.user.id,
      req.user.full_name
    );

    res.json(visit);
  } catch (e) {
    console.error('Check-out error:', e);
    res.status(500).json({ error: 'Failed to complete GPS check-out' });
  }
});

// --- PHASE 2: INACTIVE LEADS QUEUE (Admin only) ---

app.get('/api/leads/inactive-queue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const leads = await DB.getLeads({}, req.user.id, req.user.role);
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const inactiveLeads = leads.filter(lead => {
      if (!lead.assigned_employee_id) return false;
      const activityDate = lead.last_activity_date ? new Date(lead.last_activity_date) : new Date(lead.created_at);
      return activityDate < sevenDaysAgo;
    });

    res.json(inactiveLeads);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch inactive leads queue' });
  }
});

// --- PHASE 2: ADVANCED ANALYTICS DASHBOARDS ---

app.get('/api/dashboard/advanced', authenticateToken, async (req, res) => {
  try {
    const leads = await DB.getLeads({}, req.user.id, req.user.role);
    const bookings = await DB.getBookings();
    const siteVisits = await DB.getSiteVisits();

    const role = req.user.role;
    const userId = req.user.id;

    // Filters bookings and visits by executive role if employee
    const filteredBookings = role === 'employee' ? bookings.filter(b => b.executive_id === userId) : bookings;
    const filteredVisits = role === 'employee' ? siteVisits.filter(v => v.leads && v.leads.assigned_employee_id === userId) : siteVisits;

    // Count states
    let totalLeads = leads.length;
    let newLeads = leads.filter(l => l.status === 'New').length;
    let hotLeads = leads.filter(l => l.status === 'Hot').length;
    let warmLeads = leads.filter(l => l.status === 'Warm').length;
    let coldLeads = leads.filter(l => l.status === 'Cold').length;
    let negotiationLeads = leads.filter(l => l.status === 'Negotiation').length;
    let bookedLeads = leads.filter(l => l.status === 'Booked').length;

    // Visits count
    let totalVisits = filteredVisits.length;
    let completedVisits = filteredVisits.filter(v => v.outcome && v.outcome !== 'Scheduled').length;

    // Bookings & Revenue
    let totalBookedCount = filteredBookings.length;
    let revenueEarned = filteredBookings.reduce((sum, b) => sum + (parseFloat(b.token_amount) || 0) + (parseFloat(b.booking_amount) || 0), 0);

    // Call logging today counts
    const todayStr = new Date().toISOString().split('T')[0];
    let callsToday = 0;
    
    if (role === 'employee') {
      const callLogs = await DB.isCloud()
        ? (await require('./db').supabase.from('call_logs').select('*').eq('caller_id', userId))?.data || []
        : loadLocalDb().call_logs.filter(c => c.caller_id === userId);
      callsToday = callLogs.filter(c => c.call_date && c.call_date.startsWith(todayStr)).length;
    } else {
      const callLogs = await DB.isCloud()
        ? (await require('./db').supabase.from('call_logs').select('*'))?.data || []
        : loadLocalDb().call_logs;
      callsToday = callLogs.filter(c => c.call_date && c.call_date.startsWith(todayStr)).length;
    }

    // Lead Source Distribution
    const sourceMap = { Facebook: 0, Instagram: 0, Google: 0, Website: 0, WhatsApp: 0, 'Walk-In': 0, Referral: 0, MagicBricks: 0, '99acres': 0, Housing: 0 };
    leads.forEach(l => {
      const src = l.lead_source || 'Website';
      if (sourceMap[src] !== undefined) sourceMap[src]++;
    });

    // Employee Performance comparison (Admin Only)
    let employeePerformance = [];
    if (role === 'admin') {
      const employees = await DB.getAllEmployees();
      employeePerformance = employees.map(emp => {
        const empLeads = leads.filter(l => l.assigned_employee_id === emp.id);
        const empBookings = bookings.filter(b => b.executive_id === emp.id);
        const conversionRate = empLeads.length > 0 ? (empBookings.length / empLeads.length) * 100 : 0;
        return {
          id: emp.id,
          name: emp.full_name,
          leadsCount: empLeads.length,
          bookingsCount: empBookings.length,
          conversionRate: Math.round(conversionRate * 10) / 10
        };
      });
    }

    res.json({
      summary: {
        totalLeads,
        newLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        negotiationLeads,
        bookedLeads,
        totalVisits,
        completedVisits,
        totalBookedCount,
        revenueEarned,
        callsToday
      },
      sourceDistribution: sourceMap,
      employeePerformance
    });
  } catch (e) {
    console.error('Analytics dashboard error:', e);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.send('Vrindavan Estates CRM Backend Server is running successfully!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (Bound to 0.0.0.0)`);
});
