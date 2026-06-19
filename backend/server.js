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

// --- FUTURE INTEGRATION PLUGS ---

app.post('/api/integrations/whatsapp/send', authenticateToken, async (req, res) => {
  const { phone, message } = req.body;
  res.json({
    success: true,
    message: 'Stub: WhatsApp API request accepted',
    details: { phone, message }
  });
});

app.post('/api/integrations/call-log', async (req, res) => {
  console.log('Telemetry call webhook received:', req.body);
  res.json({ success: true, message: 'Webhook call received' });
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
