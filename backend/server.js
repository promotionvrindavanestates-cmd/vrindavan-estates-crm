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
      source: req.query.source,
      // Phase 3 Advanced filters
      created_start: req.query.created_start,
      created_end: req.query.created_end,
      follow_up_due: req.query.follow_up_due === 'true',
      site_visit_completed: req.query.site_visit_completed === 'true',
      calls_today: req.query.calls_today,
      phone: req.query.phone,
      executive: req.query.executive,
      // Pagination parameters
      page: req.query.page,
      limit: req.query.limit
    };

    const leads = await DB.getLeads(filters, req.user.id, req.user.role);
    res.json(leads);
  } catch (error) {
    console.error('Fetch leads error:', error);
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

// Global memory store for bulk background jobs
const bulkJobs = {};

app.get('/api/leads/bulk/job/:jobId', authenticateToken, requireAdmin, (req, res) => {
  const job = bulkJobs[req.params.jobId];
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

app.delete('/api/leads/bulk', authenticateToken, requireAdmin, async (req, res) => {
  const { leadIds, permanent, backupCreated } = req.body;
  if (!leadIds || leadIds.length === 0) {
    return res.status(400).json({ error: 'No lead IDs provided for deletion' });
  }
  
  const jobId = `job_del_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const device = getClientDevice(req);
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
  const startTime = Date.now();
  
  bulkJobs[jobId] = {
    id: jobId,
    status: 'queued',
    progress: 0,
    total: leadIds.length,
    succeeded: 0,
    failed: 0,
    type: 'delete'
  };

  // Process asynchronously in background
  setImmediate(async () => {
    try {
      bulkJobs[jobId].status = 'processing';
      const result = await DB.deleteLeadsBulk(leadIds, req.user.id, req.user.role, permanent === true || permanent === 'true');
      bulkJobs[jobId].succeeded = result.deletedCount;
      bulkJobs[jobId].failed = result.failed;
      bulkJobs[jobId].progress = leadIds.length;
      const status = result.failed === 0 ? 'completed' : (result.deletedCount === 0 ? 'failed' : 'completed_with_errors');
      bulkJobs[jobId].status = status;

      const backupWasCreated = backupCreated === true || backupCreated === 'true' ? 'Yes' : 'No';
      const backupName = backupWasCreated === 'Yes' ? `Leads_Backup_${new Date().toLocaleDateString('en-CA')}_${leadIds.length}.xlsx` : 'None';

      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2) + ' seconds';
      const details = `Admin: ${req.user.full_name}\nAction: Deleted ${result.deletedCount} Leads${permanent ? ' permanently' : ' (soft-deleted)'}\nIP Address: ${ipAddress}\nDevice: ${device}\nTime Taken: ${timeTaken}\nStatus: ${status}\nJob ID: ${jobId}\nBackup Created: ${backupWasCreated}\nBackup File Name: ${backupName}\nDeleted By: ${req.user.full_name}\nDelete Time: ${new Date().toISOString()}\nTotal Leads Deleted: ${result.deletedCount}`;
      await DB.logAudit(null, 'Bulk Leads Deleted', details, req.user.id, req.user.full_name, device);

      // Auto-create unread bell notification reminder
      await DB.createReminder({
        lead_id: null,
        title: 'Bulk Delete Completed',
        type: 'System',
        reminder_date: new Date().toLocaleDateString('en-CA'),
        reminder_time: new Date().toTimeString().split(' ')[0],
        notes: `Bulk deletion processed. ${result.deletedCount} leads deleted successfully. Failed: ${result.failed}.`,
        is_read: false,
        assigned_employee_id: req.user.id,
        priority: 'High'
      });
    } catch (err) {
      console.error(`Bulk job ${jobId} failed:`, err);
      bulkJobs[jobId].status = 'failed';
      bulkJobs[jobId].failed = leadIds.length;
      bulkJobs[jobId].progress = leadIds.length;
    }
  });

  res.json({
    message: 'Bulk lead deletion queued',
    jobId,
    status: 'queued',
    total: leadIds.length
  });
});

app.post('/api/leads/bulk-restore', authenticateToken, requireAdmin, async (req, res) => {
  const { leadIds } = req.body;
  if (!leadIds || leadIds.length === 0) {
    return res.status(400).json({ error: 'No lead IDs provided for restoration' });
  }

  const jobId = `job_res_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const device = getClientDevice(req);
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
  const startTime = Date.now();
  
  bulkJobs[jobId] = {
    id: jobId,
    status: 'queued',
    progress: 0,
    total: leadIds.length,
    succeeded: 0,
    failed: 0,
    type: 'restore'
  };

  setImmediate(async () => {
    try {
      bulkJobs[jobId].status = 'processing';
      const result = await DB.restoreLeadsBulk(leadIds, req.user.id, req.user.role);
      bulkJobs[jobId].succeeded = result.restoredCount;
      bulkJobs[jobId].failed = result.failed;
      bulkJobs[jobId].progress = leadIds.length;
      const status = result.failed === 0 ? 'completed' : (result.restoredCount === 0 ? 'failed' : 'completed_with_errors');
      bulkJobs[jobId].status = status;

      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2) + ' seconds';
      const details = `Admin: ${req.user.full_name}\nAction: Restored ${result.restoredCount} Leads from Trash Bin\nIP Address: ${ipAddress}\nDevice: ${device}\nTime Taken: ${timeTaken}\nStatus: ${status}\nJob ID: ${jobId}`;
      await DB.logAudit(null, 'Bulk Leads Restored', details, req.user.id, req.user.full_name, device);

      // Auto-create unread bell notification reminder
      await DB.createReminder({
        lead_id: null,
        title: 'Bulk Restore Completed',
        type: 'System',
        reminder_date: new Date().toLocaleDateString('en-CA'),
        reminder_time: new Date().toTimeString().split(' ')[0],
        notes: `Bulk restoration processed. ${result.restoredCount} leads restored successfully. Failed: ${result.failed}.`,
        is_read: false,
        assigned_employee_id: req.user.id,
        priority: 'High'
      });
    } catch (err) {
      console.error(`Bulk job ${jobId} failed:`, err);
      bulkJobs[jobId].status = 'failed';
      bulkJobs[jobId].failed = leadIds.length;
      bulkJobs[jobId].progress = leadIds.length;
    }
  });

  res.json({
    message: 'Bulk lead restoration queued',
    jobId,
    status: 'queued',
    total: leadIds.length
  });
});

app.put('/api/leads/bulk-status', authenticateToken, requireAdmin, async (req, res) => {
  const { leadIds, status } = req.body;
  if (!leadIds || leadIds.length === 0) {
    return res.status(400).json({ error: 'No lead IDs provided' });
  }
  if (!status) {
    return res.status(400).json({ error: 'Status/Priority value is required' });
  }

  const jobId = `job_upd_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const device = getClientDevice(req);
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
  const startTime = Date.now();
  
  bulkJobs[jobId] = {
    id: jobId,
    status: 'queued',
    progress: 0,
    total: leadIds.length,
    succeeded: 0,
    failed: 0,
    type: 'status',
    payload: { status }
  };

  setImmediate(async () => {
    try {
      bulkJobs[jobId].status = 'processing';
      const result = await DB.updateLeadsStatusBulk(leadIds, status, req.user.id, req.user.role);
      bulkJobs[jobId].succeeded = result.updatedCount;
      bulkJobs[jobId].failed = result.failed;
      bulkJobs[jobId].progress = leadIds.length;
      const jobStatus = result.failed === 0 ? 'completed' : (result.updatedCount === 0 ? 'failed' : 'completed_with_errors');
      bulkJobs[jobId].status = jobStatus;

      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2) + ' seconds';
      const details = `Admin: ${req.user.full_name}\nAction: Bulk Updated Status to "${status}" for ${result.updatedCount} Leads\nIP Address: ${ipAddress}\nDevice: ${device}\nTime Taken: ${timeTaken}\nStatus: ${jobStatus}\nJob ID: ${jobId}`;
      await DB.logAudit(null, 'Bulk Leads Updated', details, req.user.id, req.user.full_name, device);

      // Auto-create unread bell notification reminder
      await DB.createReminder({
        lead_id: null,
        title: 'Bulk Status Update Completed',
        type: 'System',
        reminder_date: new Date().toLocaleDateString('en-CA'),
        reminder_time: new Date().toTimeString().split(' ')[0],
        notes: `Bulk status update processed. ${result.updatedCount} leads updated successfully. Failed: ${result.failed}.`,
        is_read: false,
        assigned_employee_id: req.user.id,
        priority: 'High'
      });
    } catch (err) {
      console.error(`Bulk job ${jobId} failed:`, err);
      bulkJobs[jobId].status = 'failed';
      bulkJobs[jobId].failed = leadIds.length;
      bulkJobs[jobId].progress = leadIds.length;
    }
  });

  res.json({
    message: 'Bulk lead status update queued',
    jobId,
    status: 'queued',
    total: leadIds.length
  });
});

app.delete('/api/leads/trash/empty', authenticateToken, requireAdmin, async (req, res) => {
  const device = getClientDevice(req);
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
  const startTime = Date.now();

  try {
    const result = await DB.emptyTrash(req.user.id, req.user.role);
    
    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2) + ' seconds';
    const details = `Admin: ${req.user.full_name}\nAction: Emptied Trash Bin (${result.deletedCount} Leads Purged)\nIP Address: ${ipAddress}\nDevice: ${device}\nTime Taken: ${timeTaken}\nStatus: completed`;
    await DB.logAudit(null, 'Trash Bin Emptied', details, req.user.id, req.user.full_name, device);
    
    await DB.createReminder({
      lead_id: null,
      title: 'Recycle Bin Emptied',
      type: 'System',
      reminder_date: new Date().toLocaleDateString('en-CA'),
      reminder_time: new Date().toTimeString().split(' ')[0],
      notes: `Trash bin emptied. ${result.deletedCount} leads permanently purged.`,
      is_read: false,
      assigned_employee_id: req.user.id,
      priority: 'High'
    });

    res.json({ message: 'Trash bin emptied successfully', deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Empty trash error:', error);
    res.status(500).json({ error: error.message || 'Failed to empty trash bin' });
  }
});

app.get('/api/settings/bulk-delete', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await DB.getBulkDeleteSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/settings/bulk-delete', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await DB.updateBulkDeleteSettings(req.body);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.post('/api/leads/bulk-backup', authenticateToken, requireAdmin, async (req, res) => {
  const { leadIds } = req.body;
  if (!leadIds || leadIds.length === 0) {
    return res.status(400).json({ error: 'No lead IDs provided' });
  }

  try {
    const leads = await DB.getLeadsByIds(leadIds);
    const excelBuffer = generateExcelBuffer(leads);
    const encryptedBuffer = encryptBuffer(excelBuffer);
    
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    
    const todayStr = new Date().toLocaleDateString('en-CA');
    const filename = `Leads_Backup_${todayStr}_${leadIds.length}.xlsx`;
    const filePath = path.join(BACKUPS_DIR, `${filename}.enc`);
    
    fs.writeFileSync(filePath, encryptedBuffer);
    console.log(`Saved encrypted backup: ${filename}.enc`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Bulk backup failed:', error);
    res.status(500).json({ error: 'Failed to generate bulk backup' });
  }
});

app.get('/api/leads/:id', authenticateToken, async (req, res) => {
  try {
    const lead = await DB.getLeadById(req.params.id, req.user.id, req.user.role);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found or access denied' });
    }
    res.json(lead);
  } catch (error) {
    console.error('Fetch lead by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch lead details' });
  }
});

app.put('/api/leads/:id', authenticateToken, async (req, res) => {
  try {
    const oldLead = await DB.getLeadById(req.params.id, req.user.id, req.user.role);
    if (!oldLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Enterprise Lockdown check
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
  const { response, notes, duration, action_taken, follow_up_date, follow_up_time, follow_up_datetime, create_reminder } = req.body;
  if (!response) {
    return res.status(400).json({ error: 'Call response selection is required' });
  }

  try {
    const updatedLead = await DB.logCall(
      req.params.id, 
      req.user.id, 
      response, 
      notes, 
      duration ? parseInt(duration) : 0,
      action_taken || null,
      follow_up_date || null,
      follow_up_time || null,
      follow_up_datetime || null
    );
    
    // Log audit trail
    await DB.logAudit(
      req.params.id,
      'Notes Added',
      `Logged call response: "${response}". Remarks: ${notes}` + (action_taken ? `. Action: ${action_taken}` : ''),
      req.user.id,
      req.user.full_name
    );

    // If follow-up date and create_reminder is set, automatically create a reminder
    if (create_reminder && follow_up_date) {
      await DB.createReminder({
        lead_id: req.params.id,
        title: `Follow-up: ${action_taken || response}`,
        type: 'Follow-up',
        reminder_date: follow_up_date,
        reminder_time: follow_up_time || '09:00:00',
        notes: notes || '',
        is_read: false,
        assigned_employee_id: req.user.id
      });
    }

    res.json({ message: 'Call logged successfully', lead: updatedLead });
  } catch (error) {
    console.error('Call logging server error:', error);
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

// --- MOBILE CALL LOG SYNCHRONIZATION ENDPOINTS ---

app.post('/api/mobile/call-logs/sync', authenticateToken, async (req, res) => {
  const { calls } = req.body;
  if (!Array.isArray(calls)) {
    return res.status(400).json({ error: 'calls parameter must be an array' });
  }
  try {
    const synced = await DB.syncMobileCalls(req.user.id, req.user.role, calls);
    res.json({ message: 'Mobile call logs processed', synced });
  } catch (e) {
    console.error('Mobile call sync error:', e);
    res.status(500).json({ error: 'Failed to sync mobile call logs' });
  }
});

app.get('/api/mobile/call-logs/pending', authenticateToken, async (req, res) => {
  try {
    const pending = await DB.getPendingCallLogs(req.user.id, req.user.role);
    res.json(pending);
  } catch (e) {
    console.error('Fetch pending call logs error:', e);
    res.status(500).json({ error: 'Failed to fetch pending call logs' });
  }
});

app.put('/api/mobile/call-logs/:id/notes', authenticateToken, async (req, res) => {
  const { notes, action_taken, follow_up_date, follow_up_time, follow_up_datetime, create_reminder } = req.body;
  try {
    const updated = await DB.completeCallNotes(
      req.params.id,
      notes,
      action_taken || 'None',
      follow_up_date || null,
      follow_up_time || null,
      follow_up_datetime || null,
      create_reminder || false
    );
    
    // Log audit trail
    await DB.logAudit(
      updated.lead_id,
      'Notes Added',
      `Added notes to mobile call log: ${notes || ''}. Action: ${action_taken || 'None'}`,
      req.user.id,
      req.user.full_name
    );

    // If follow-up date and create_reminder is set, automatically create a reminder
    if (create_reminder && follow_up_date) {
      await DB.createReminder({
        lead_id: updated.lead_id,
        title: `Follow-up: ${action_taken || 'Mobile Call Notes'}`,
        type: 'Follow-up',
        reminder_date: follow_up_date,
        reminder_time: follow_up_time || '09:00:00',
        notes: notes || '',
        is_read: false,
        assigned_employee_id: req.user.id
      });
    }

    res.json({ message: 'Call notes saved successfully', call: updated });
  } catch (e) {
    console.error('Save pending call notes error:', e);
    res.status(500).json({ error: 'Failed to save call notes' });
  }
});

// --- WHATSAPP MESSAGES SYNC & HISTORY ---

app.get('/api/whatsapp/chats/:leadId', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getWhatsAppMessages(req.params.leadId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch WhatsApp chats' });
  }
});

app.post('/api/whatsapp/chats/sync', authenticateToken, async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages parameter must be an array' });
  }
  try {
    const synced = [];
    for (const msg of messages) {
      const resMsg = await DB.logWhatsAppMessage(
        msg.lead_id,
        msg.direction,
        msg.message_text,
        msg.media_url,
        msg.template_name,
        msg.sent_at
      );
      synced.push(resMsg);
    }
    res.json({ message: 'WhatsApp messages synced', count: synced.length, synced });
  } catch (e) {
    console.error('WhatsApp sync error:', e);
    res.status(500).json({ error: 'Failed to sync WhatsApp messages' });
  }
});

app.post('/api/whatsapp/messages/simulate', authenticateToken, async (req, res) => {
  const { leadId, text, direction } = req.body;
  if (!leadId || !text) {
    return res.status(400).json({ error: 'leadId and text are required' });
  }
  try {
    const msg = await DB.logWhatsAppMessage(
      leadId,
      direction || 'Incoming',
      text,
      null, // media
      null, // template
      new Date().toISOString()
    );
    
    // Log audit trail
    await DB.logAudit(
      leadId,
      'WhatsApp Message',
      `WhatsApp message ${direction || 'Incoming'} logged: "${text}"`,
      req.user.id,
      req.user.full_name
    );
    
    res.json({ message: 'Simulation message created', msg });
  } catch (e) {
    res.status(500).json({ error: 'Simulation failed' });
  }
});

app.post('/api/whatsapp/activity', authenticateToken, async (req, res) => {
  const { leadId, actionType } = req.body;
  if (!leadId) {
    return res.status(400).json({ error: 'leadId is required' });
  }
  try {
    const activity = await DB.logWhatsAppActivity(leadId, req.user.id, actionType || 'WhatsApp Opened');
    
    // Auto-create timeline event via audit log
    await DB.logAudit(
      leadId,
      'WhatsApp Clicked',
      `WhatsApp link clicked by employee. Action: ${actionType || 'WhatsApp Opened'}`,
      req.user.id,
      req.user.full_name
    );

    res.json(activity);
  } catch (e) {
    console.error('Log WhatsApp activity error:', e);
    res.status(500).json({ error: 'Failed to log WhatsApp activity' });
  }
});

app.get('/api/whatsapp/activities/:leadId', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getWhatsAppActivities(req.params.leadId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch WhatsApp activities' });
  }
});

app.post('/api/whatsapp/notes', authenticateToken, async (req, res) => {
  const { leadId, discussionSummary, customerInterest, budgetDiscussion, objections, nextAction } = req.body;
  if (!leadId) {
    return res.status(400).json({ error: 'leadId is required' });
  }
  try {
    const notesData = {
      discussion_summary: discussionSummary,
      customer_interest: customerInterest,
      budget_discussion: budgetDiscussion,
      objections: objections,
      next_action: nextAction
    };
    const notes = await DB.saveWhatsAppNotes(leadId, req.user.id, notesData);
    
    // Log audit trail
    await DB.logAudit(
      leadId,
      'WhatsApp Notes Added',
      `WhatsApp notes added: Summary: ${discussionSummary || 'N/A'}. Interest: ${customerInterest || 'N/A'}. Budget: ${budgetDiscussion || 'N/A'}. Objections: ${objections || 'N/A'}. Next: ${nextAction || 'N/A'}`,
      req.user.id,
      req.user.full_name
    );

    res.json(notes);
  } catch (e) {
    console.error('Save WhatsApp notes error:', e);
    res.status(500).json({ error: 'Failed to save WhatsApp notes' });
  }
});

app.get('/api/whatsapp/notes/:leadId', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getWhatsAppNotes(req.params.leadId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch WhatsApp notes' });
  }
});

app.post('/api/whatsapp/follow-up', authenticateToken, async (req, res) => {
  const { leadId, title, reminder_date, reminder_time, notes, priority } = req.body;
  if (!leadId || !title || !reminder_date) {
    return res.status(400).json({ error: 'leadId, title, and reminder_date are required' });
  }
  try {
    const reminder = await DB.createReminder({
      lead_id: leadId,
      title,
      type: 'Follow-up',
      reminder_date,
      reminder_time,
      notes,
      priority: priority || 'Medium',
      is_read: false,
      assigned_employee_id: req.user.id
    });
    
    // Log audit trail
    await DB.logAudit(
      leadId,
      'WhatsApp Follow-up Scheduled',
      `WhatsApp follow-up scheduled for ${reminder_date} at ${reminder_time || '09:00:00'} (Priority: ${priority || 'Medium'}). Notes: ${notes || ''}`,
      req.user.id,
      req.user.full_name
    );

    res.json(reminder);
  } catch (e) {
    console.error('Create WhatsApp follow-up error:', e);
    res.status(500).json({ error: 'Failed to create WhatsApp follow-up reminder' });
  }
});

app.get('/api/whatsapp/communication-history/:leadId', authenticateToken, async (req, res) => {
  try {
    const leadId = req.params.leadId;
    const [messages, activities, notes] = await Promise.all([
      DB.getWhatsAppMessages(leadId),
      DB.getWhatsAppActivities(leadId),
      DB.getWhatsAppNotes(leadId)
    ]);
    
    // Compile history
    const history = [];
    messages.forEach(m => {
      history.push({
        id: m.id,
        type: 'message',
        direction: m.direction,
        text: m.message_text,
        media_url: m.media_url,
        template_name: m.template_name,
        timestamp: m.sent_at || m.created_at
      });
    });
    
    activities.forEach(a => {
      history.push({
        id: a.id,
        type: 'activity',
        action_type: a.action_type,
        timestamp: a.timestamp || a.created_at,
        user: a.employee ? a.employee.full_name : 'Executive'
      });
    });
    
    notes.forEach(n => {
      history.push({
        id: n.id,
        type: 'notes',
        discussion_summary: n.discussion_summary,
        customer_interest: n.customer_interest,
        budget_discussion: n.budget_discussion,
        objections: n.objections,
        next_action: n.next_action,
        timestamp: n.created_at,
        user: n.employee ? n.employee.full_name : 'Executive'
      });
    });
    
    // Sort chronologically ascending for chat interface display
    history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json(history);
  } catch (e) {
    console.error('Fetch WhatsApp communication history error:', e);
    res.status(500).json({ error: 'Failed to fetch WhatsApp communication history' });
  }
});

// --- SALES INTELLIGENCE DASHBOARD ---

app.get('/api/dashboard/sales-intelligence', authenticateToken, async (req, res) => {
  try {
    const dashboard = await DB.getSalesIntelligenceDashboard(req.user.id, req.user.role);
    res.json(dashboard);
  } catch (e) {
    console.error('Sales intelligence API error:', e);
    res.status(500).json({ error: 'Failed to fetch sales intelligence dashboard' });
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

// Export Bookings, Payments, Site Visits, Leads, or Employees reports: Admin Only!
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
    } else if (type === 'leads') {
      const list = await DB.getLeads({}, req.user.id, req.user.role);
      plainData = list.map(l => ({
        'Lead ID': l.id,
        'Created At': l.created_at || '',
        'Name': l.name || '',
        'City': l.city || '',
        'Phone 1': l.phone1 || '',
        'Phone 2': l.phone2 || '',
        'WhatsApp Phone': l.phone_whatsapp || '',
        'Budget': l.budget || '',
        'Project': l.project || '',
        'Source': l.lead_source || '',
        'Status': l.status || '',
        'Assigned Employee': l.assigned_employee ? l.assigned_employee.full_name : 'Unassigned',
        'Follow Up Date': l.follow_up_date || '',
        'Last Call Response': l.last_response || ''
      }));
      filename = 'leads_register.csv';
    } else if (type === 'employees') {
      const employees = await DB.getAllEmployees();
      const leads = await DB.getLeads({}, 'system', 'admin');
      const bookings = await DB.getBookings();
      const siteVisits = await DB.getSiteVisits();
      const callLogs = await DB.getAllCallLogs();
        
      plainData = employees.map(emp => {
        const empLeads = leads.filter(l => l.assigned_employee_id === emp.id);
        const empBookings = bookings.filter(b => b.executive_id === emp.id);
        const empCalls = callLogs.filter(c => c.caller_id === emp.id);
        const empVisits = siteVisits.filter(v => v.leads && v.leads.assigned_employee_id === emp.id && v.outcome && v.outcome !== 'Scheduled');
        const conversionRate = empLeads.length > 0 ? (empBookings.length / empLeads.length) * 100 : 0;
        
        return {
          'Rank': 1, // temporary index mapping placeholder
          'Employee Name': emp.full_name,
          'Username': emp.username,
          'Phone': emp.phone || '',
          'Status': emp.status || '',
          'Assigned Leads': empLeads.length,
          'Total Calls': empCalls.length,
          'Completed Site Visits': empVisits.length,
          'Bookings Confirmed': empBookings.length,
          'Conversion %': Math.round(conversionRate * 10) / 10
        };
      });
      plainData.sort((a, b) => b['Bookings Confirmed'] - a['Bookings Confirmed'] || b['Conversion %'] - a['Conversion %']);
      plainData = plainData.map((emp, idx) => ({ ...emp, 'Rank': idx + 1 }));
      filename = 'employee_performance_report.csv';
    } else if (type === 'followups') {
      const list = await DB.getReminders(null, 'admin');
      plainData = list.map(r => ({
        'Reminder ID': r.id,
        'Scheduled Date': r.reminder_date,
        'Scheduled Time': r.reminder_time || '',
        'Customer Name': r.leads ? r.leads.name : 'Unknown',
        'Customer Phone': r.leads ? r.leads.phone1 : 'Unknown',
        'Title/Type': `${r.title} (${r.type})`,
        'Notes': r.notes || '',
        'Status': r.is_read ? 'Completed' : 'Pending'
      }));
      filename = 'followup_reminders_report.csv';
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

// Helper: Dynamic Client Device Resolver
function getClientDevice(req) {
  const customDevice = req.headers['x-device-name'];
  if (customDevice) return customDevice;
  
  const userAgent = req.headers['user-agent'] || '';
  if (userAgent.includes('Capacitor') || userAgent.includes('Android')) {
    return 'Android App';
  }
  return 'Web Portal';
}

// Helper: Parse Google Sheets or File Buffer to raw JSON rows
async function parseLeadsData(fileBuffer, filename, isGoogleSheetUrl = false, url = '') {
  let rawRows = [];
  
  if (isGoogleSheetUrl) {
    let exportUrl = url;
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    }
    
    const response = await fetch(exportUrl);
    if (!response.ok) throw new Error('Failed to download Google Sheet. Verify it is public (Anyone with the link can view).');
    const text = await response.text();
    
    rawRows = await new Promise((resolve, reject) => {
      const results = [];
      Readable.from(text)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  } else {
    if (filename.endsWith('.csv')) {
      const text = fileBuffer.toString('utf8');
      rawRows = await new Promise((resolve, reject) => {
        const results = [];
        Readable.from(text)
          .pipe(csvParser())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (err) => reject(err));
      });
    } else {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rawRows = xlsx.utils.sheet_to_json(sheet);
    }
  }
  
  return rawRows;
}

app.post('/api/import/preview', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  const { sheetUrl } = req.body;
  try {
    let rows = [];
    let sourceName = '';
    
    if (sheetUrl) {
      rows = await parseLeadsData(null, '', true, sheetUrl);
      sourceName = 'Google Sheet';
    } else if (req.file) {
      rows = await parseLeadsData(req.file.buffer, req.file.originalname, false);
      sourceName = req.file.originalname;
    } else {
      return res.status(400).json({ error: 'No file uploaded or Google Sheet URL provided' });
    }
    
    if (rows.length === 0) {
      return res.json({ filename: sourceName, total: 0, duplicates: 0, preview: [], headers: [] });
    }
    
    const headers = Object.keys(rows[0]);
    let duplicateCount = 0;
    
    const previewRows = rows.slice(0, 50).map(r => parseRow(r));
    
    for (const r of rows) {
      const parsed = parseRow(r);
      const dup = await DB.checkDuplicateLeadByPhones(parsed.phone1, parsed.phone2, parsed.phone_whatsapp);
      if (dup) duplicateCount++;
    }
    
    res.json({
      filename: sourceName,
      total: rows.length,
      duplicates: duplicateCount,
      headers: headers,
      preview: previewRows
    });
  } catch (error) {
    console.error('Import preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import/run', authenticateToken, requireAdmin, async (req, res) => {
  const { records, filename, duplicateStrategy } = req.body; // skip, update, merge
  if (!records || records.length === 0) {
    return res.status(400).json({ error: 'No records provided for import' });
  }
  
  try {
    // 1. Create a processing history record
    const historyRecord = await DB.logImport({
      filename: filename || 'Import Source',
      total_records: records.length,
      imported_records: 0,
      updated_records: 0,
      skipped_records: 0,
      failed_records: 0,
      failed_logs: [],
      created_by: req.user.id
    });

    // 2. Respond immediately to the client to allow progress bar rendering
    res.json({
      message: 'Lead import started in background.',
      history: historyRecord
    });

    // 3. Process the records in background chunks
    const device = getClientDevice(req);
    const userId = req.user.id;
    const userName = req.user.full_name;
    const userRole = req.user.role;

    // Run background processing
    setImmediate(async () => {
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const failedLogs = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        try {
          const phone1 = record.phone1 ? String(record.phone1).trim() : '';
          const phone2 = record.phone2 ? String(record.phone2).trim() : '';
          const phoneWhatsapp = record.phone_whatsapp ? String(record.phone_whatsapp).trim() : '';
          
          if (!record.name || (!phone1 && !phone2)) {
            failedCount++;
            failedLogs.push({ row: i + 1, name: record.name || 'Unknown', error: 'Missing name or phone number' });
            continue;
          }
          
          const duplicate = await DB.checkDuplicateLeadByPhones(phone1, phone2, phoneWhatsapp);

          if (duplicate) {
            if (duplicateStrategy === 'skip') {
              skippedCount++;
              continue;
            }
            
            if (duplicateStrategy === 'update') {
              const updateFields = {
                name: record.name,
                city: record.city || duplicate.city,
                state: record.state || duplicate.state,
                phone1: phone1 || duplicate.phone1,
                phone2: phone2 || duplicate.phone2,
                phone_whatsapp: phoneWhatsapp || duplicate.phone_whatsapp,
                profession: record.profession || duplicate.profession,
                investor_or_end_user: record.investor_or_end_user || duplicate.investor_or_end_user,
                budget: record.budget || duplicate.budget,
                project: record.project || duplicate.project,
                requirement: record.requirement || duplicate.requirement,
                comments: record.comments || record.remarks || duplicate.comments,
                lead_source: record.lead_source || duplicate.lead_source
              };
              await DB.updateLead(duplicate.id, updateFields, userId, userRole);
              await DB.logAudit(duplicate.id, 'Status Changed', `Lead overwritten during bulk import update.`, userId, userName, device);
              updatedCount++;
            } else if (duplicateStrategy === 'merge') {
              const updateFields = {
                city: duplicate.city || record.city || '',
                state: duplicate.state || record.state || '',
                phone2: duplicate.phone2 || phone2 || '',
                phone_whatsapp: duplicate.phone_whatsapp || phoneWhatsapp || '',
                profession: duplicate.profession || record.profession || '',
                investor_or_end_user: duplicate.investor_or_end_user || record.investor_or_end_user || null,
                budget: duplicate.budget || record.budget || '',
                project: duplicate.project || record.project || '',
                requirement: duplicate.requirement || record.requirement || '',
                comments: duplicate.comments || record.comments || record.remarks || '',
                lead_source: duplicate.lead_source || record.lead_source || 'Website'
              };
              await DB.updateLead(duplicate.id, updateFields, userId, userRole);
              await DB.logAudit(duplicate.id, 'Status Changed', `Lead fields merged during bulk import merge.`, userId, userName, device);
              updatedCount++;
            }
          } else {
            const newLead = {
              name: record.name,
              city: record.city || '',
              state: record.state || '',
              phone1: phone1,
              phone2: phone2 || '',
              phone_whatsapp: phoneWhatsapp || '',
              profession: record.profession || '',
              investor_or_end_user: record.investor_or_end_user || null,
              budget: record.budget || '',
              project: record.project || '',
              requirement: record.requirement || '',
              comments: record.comments || record.remarks || '',
              lead_source: record.lead_source || 'Website',
              status: 'New'
            };
            const created = await DB.createLead(newLead, userId);
            await DB.logAudit(created.id, 'Lead Created', `Lead created via Excel/CSV import.`, userId, userName, device);
            importedCount++;
          }
        } catch (err) {
          failedCount++;
          failedLogs.push({ row: i + 1, name: record.name || 'Unknown', error: err.message });
        }

        // Periodically write progress updates to the DB (e.g. every 50 records or at final step)
        if ((i + 1) % 50 === 0 || (i + 1) === records.length) {
          await DB.updateImportHistory(historyRecord.id, {
            imported_records: importedCount,
            updated_records: updatedCount,
            skipped_records: skippedCount,
            failed_records: failedCount,
            failed_logs: failedLogs
          });
        }
      }
    });

  } catch (error) {
    console.error('Import run error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/api/import/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const list = await DB.getImportHistory();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

app.post('/api/leads/bulk-assign', authenticateToken, requireAdmin, async (req, res) => {
  const { leadIds, employeeId, method, config } = req.body; // Manual, Round Robin, Equal Distribution, Project Wise
  if (!leadIds || leadIds.length === 0) {
    return res.status(400).json({ error: 'No lead IDs provided for assignment' });
  }
  
  try {
    const employees = await DB.getAllEmployees();
    const activeEmployees = employees.filter(e => e.status === 'active');
    
    if (activeEmployees.length === 0) {
      return res.status(400).json({ error: 'No active employee accounts available for assignment' });
    }
    
    const device = getClientDevice(req);
    
    if (method === 'Manual') {
      if (!employeeId) return res.status(400).json({ error: 'Target employee ID is required for Manual assignment' });
      const targetEmp = activeEmployees.find(e => e.id === employeeId);
      if (!targetEmp) return res.status(400).json({ error: 'Selected employee is inactive or not found' });
      
      for (const id of leadIds) {
        const lead = await DB.getLeadById(id, req.user.id, req.user.role);
        if (lead) {
          const fromEmpId = lead.assigned_employee_id;
          await DB.updateLead(id, { assigned_employee_id: employeeId }, req.user.id, req.user.role);
          await DB.logLeadTransfer(id, fromEmpId, employeeId, req.user.id);
          await DB.logAudit(id, 'Lead Assigned/Transferred', `Assigned to ${targetEmp.full_name} manually.`, req.user.id, req.user.full_name, device);
        }
      }
    } else if (method === 'Round Robin') {
      const selectedEmpIds = config && config.employeeIds && config.employeeIds.length > 0
        ? config.employeeIds 
        : activeEmployees.map(e => e.id);
        
      const assignees = activeEmployees.filter(e => selectedEmpIds.includes(e.id));
      if (assignees.length === 0) return res.status(400).json({ error: 'No active employees selected' });
      
      let index = 0;
      for (const id of leadIds) {
        const targetEmp = assignees[index];
        const lead = await DB.getLeadById(id, req.user.id, req.user.role);
        if (lead) {
          const fromEmpId = lead.assigned_employee_id;
          await DB.updateLead(id, { assigned_employee_id: targetEmp.id }, req.user.id, req.user.role);
          await DB.logLeadTransfer(id, fromEmpId, targetEmp.id, req.user.id);
          await DB.logAudit(id, 'Lead Assigned/Transferred', `Auto-assigned to ${targetEmp.full_name} via Round Robin.`, req.user.id, req.user.full_name, device);
        }
        index = (index + 1) % assignees.length;
      }
    } else if (method === 'Equal Distribution') {
      const selectedEmpIds = config && config.employeeIds && config.employeeIds.length > 0
        ? config.employeeIds 
        : activeEmployees.map(e => e.id);
        
      const assignees = activeEmployees.filter(e => selectedEmpIds.includes(e.id));
      if (assignees.length === 0) return res.status(400).json({ error: 'No active employees selected' });
      
      const chunkSize = Math.ceil(leadIds.length / assignees.length);
      for (let i = 0; i < assignees.length; i++) {
        const emp = assignees[i];
        const empLeads = leadIds.slice(i * chunkSize, (i + 1) * chunkSize);
        for (const id of empLeads) {
          const lead = await DB.getLeadById(id, req.user.id, req.user.role);
          if (lead) {
            const fromEmpId = lead.assigned_employee_id;
            await DB.updateLead(id, { assigned_employee_id: emp.id }, req.user.id, req.user.role);
            await DB.logLeadTransfer(id, fromEmpId, emp.id, req.user.id);
            await DB.logAudit(id, 'Lead Assigned/Transferred', `Auto-assigned to ${emp.full_name} via Equal Distribution.`, req.user.id, req.user.full_name, device);
          }
        }
      }
    } else if (method === 'Project Wise') {
      const mapping = config && config.projectMapping ? config.projectMapping : {};
      
      for (const id of leadIds) {
        const lead = await DB.getLeadById(id, req.user.id, req.user.role);
        if (lead) {
          const targetEmpId = mapping[lead.project] || null;
          const targetEmp = targetEmpId ? activeEmployees.find(e => e.id === targetEmpId) : null;
          
          if (targetEmp) {
            const fromEmpId = lead.assigned_employee_id;
            await DB.updateLead(id, { assigned_employee_id: targetEmp.id }, req.user.id, req.user.role);
            await DB.logLeadTransfer(id, fromEmpId, targetEmp.id, req.user.id);
            await DB.logAudit(id, 'Lead Assigned/Transferred', `Auto-assigned to ${targetEmp.full_name} via Project-Wise allocation.`, req.user.id, req.user.full_name, device);
          }
        }
      }
    }
    
    res.json({ message: `Successfully assigned ${leadIds.length} leads.` });
  } catch (error) {
    console.error('Bulk assignment error:', error);
    res.status(500).json({ error: error.message });
  }
});

function parseRow(row) {
  const normalized = {};
  for (const k of Object.keys(row)) {
    normalized[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[k];
  }

  const name = normalized.name || normalized.leadname || normalized.customername || 'Imported Lead';
  const city = normalized.city || normalized.location || '';
  const state = normalized.state || '';
  const phone1 = String(normalized.phone1 || normalized.mobile || normalized.mobilenumber || normalized.phone || normalized.phone_1 || '');
  const phone2 = String(normalized.phone2 || normalized.alternate || normalized.alternatenumber || normalized.phone_2 || '');
  const phone_whatsapp = String(normalized.whatsapp || normalized.whatsappnumber || normalized.phone_whatsapp || normalized.whatsapp_phone || '');
  const budget = normalized.budget || '';
  const project = normalized.project || '';
  const requirement = normalized.requirement || normalized.requirements || '';
  const comments = normalized.comments || normalized.remarks || normalized.comment || normalized.remark || '';
  const lead_source = validateSource(normalized.leadsource || normalized.source);
  const status = validateStatus(normalized.status);
  const profession = normalized.profession || '';
  const investor_or_end_user = normalized.investororenduser || normalized.investor_or_end_user || null;

  return {
    name,
    city,
    state,
    phone1,
    phone2,
    phone_whatsapp,
    budget,
    project,
    requirement,
    comments,
    lead_source,
    status,
    profession,
    investor_or_end_user: (investor_or_end_user === 'Investor' || investor_or_end_user === 'End User') ? investor_or_end_user : null,
    follow_up_date: normalized.followupdate || normalized.followup || null,
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
  const valid = ['New', 'Attempted', 'Connected', 'Interested', 'Hot', 'Warm', 'Cold', 'Site Visit Scheduled', 'Site Visit Done', 'Negotiation', 'Booked', 'Lost'];
  const matched = valid.find(v => v.toLowerCase() === s);
  return matched || 'Warm';
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
DB.logCall = async function(leadId, callerId, response, notes, ...args) {
  const result = await originalLogCall.call(DB, leadId, callerId, response, notes, ...args);
  if (DB.isCloud()) {
    const supabase = DB.supabase;
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

app.post('/api/inventory/:id/block', authenticateToken, async (req, res) => {
  try {
    const duration = req.body.duration_hours || 24;
    const item = await DB.blockInventoryUnit(req.params.id, duration);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to block inventory unit' });
  }
});

app.post('/api/inventory/:id/unblock', authenticateToken, async (req, res) => {
  try {
    const item = await DB.unblockInventoryUnit(req.params.id);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to unblock inventory unit' });
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

app.get('/api/bookings/lead/:leadId', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getBookingsForLead(req.params.leadId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch bookings for lead' });
  }
});

app.get('/api/payments/lead/:leadId', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getPayments();
    const filtered = list.filter(p => p.bookings && p.bookings.lead_id === req.params.leadId);
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch payments for lead' });
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

// --- PHASE 5: BOOKING MILESTONES & COLLECTIONS ---

app.get('/api/bookings/:id/milestones', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getBookingMilestones(req.params.id);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

app.post('/api/bookings/:id/milestones', authenticateToken, async (req, res) => {
  try {
    const data = { ...req.body, booking_id: req.params.id };
    const milestone = await DB.createBookingMilestone(data);
    res.status(201).json(milestone);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

app.put('/api/bookings/milestones/:milestoneId', authenticateToken, async (req, res) => {
  try {
    const milestone = await DB.updateBookingMilestone(req.params.milestoneId, req.body);
    res.json(milestone);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

app.delete('/api/bookings/milestones/:milestoneId', authenticateToken, async (req, res) => {
  try {
    await DB.deleteBookingMilestone(req.params.milestoneId);
    res.json({ message: 'Milestone deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

app.get('/api/collections/analytics', authenticateToken, async (req, res) => {
  try {
    const analytics = await DB.getCollectionAnalytics();
    res.json(analytics);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch collection analytics' });
  }
});

app.get('/api/collections/reminders', authenticateToken, async (req, res) => {
  try {
    const reminders = await DB.getCollectionReminders();
    res.json(reminders);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch collection reminders' });
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

// Click-to-WhatsApp manual redirection logger
app.post('/api/whatsapp/campaigns/click-log', authenticateToken, async (req, res) => {
  const { lead_id, phone, message_text } = req.body;
  if (!phone || !message_text) {
    return res.status(400).json({ error: 'Phone and message text are required' });
  }
  try {
    const campaigns = await DB.getWhatsAppCampaigns();
    let campaign = campaigns.find(c => c.name === 'Click-to-WhatsApp Messages');
    if (!campaign) {
      const templates = await DB.getWhatsAppTemplates();
      const welcomeTemp = templates.find(t => t.name === 'welcome_message');
      const result = await DB.createWhatsAppCampaign({
        name: 'Click-to-WhatsApp Messages',
        template_id: welcomeTemp ? welcomeTemp.id : null,
        filters_used: { system: 'Click-to-WhatsApp fallback' }
      }, []);
      campaign = result.campaign;
    }

    const logData = {
      campaign_id: campaign.id,
      lead_id: lead_id || null,
      phone,
      message_text,
      status: 'Sent'
    };

    if (DB.isCloud()) {
      const { supabase } = require('./db');
      const { data, error } = await supabase.from('whatsapp_campaign_logs').insert([logData]).select().single();
      if (error) throw error;
      res.status(201).json(data);
    } else {
      const fs = require('fs');
      const path = require('path');
      const LOCAL_DB_PATH = path.join(__dirname, 'database.json');
      if (fs.existsSync(LOCAL_DB_PATH)) {
        const data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
        const logRecord = {
          id: Math.random().toString(36).substring(2, 15),
          created_at: new Date().toISOString(),
          ...logData
        };
        if (!data.whatsapp_campaign_logs) data.whatsapp_campaign_logs = [];
        data.whatsapp_campaign_logs.push(logRecord);
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
        res.status(201).json(logRecord);
      } else {
        res.status(500).json({ error: 'Local database not found' });
      }
    }
  } catch (err) {
    console.error('Click log error:', err);
    res.status(500).json({ error: 'Failed to record click log' });
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

// --- PHASE 3: INACTIVE LEADS QUEUE (Admin only) ---

app.get('/api/leads/inactive-queue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const leads = await DB.getLeads({}, req.user.id, req.user.role);
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() - days);

    const inactiveLeads = leads.filter(lead => {
      if (!lead.assigned_employee_id) return false;
      const activityDate = lead.last_activity_date ? new Date(lead.last_activity_date) : new Date(lead.created_at);
      return activityDate < thresholdDate;
    });

    res.json(inactiveLeads);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch inactive leads queue' });
  }
});

// --- PHASE 3: REMINDERS API ---

app.get('/api/reminders', authenticateToken, async (req, res) => {
  try {
    const list = await DB.getReminders(req.user.id, req.user.role);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

app.post('/api/reminders', authenticateToken, async (req, res) => {
  try {
    const reminderData = { ...req.body };
    if (req.user.role !== 'admin') {
      reminderData.assigned_employee_id = req.user.id;
    }
    const reminder = await DB.createReminder(reminderData);
    
    // Log audit
    await DB.logAudit(
      reminderData.lead_id,
      'Follow-up Added',
      `Reminder created: "${reminderData.title}" scheduled for ${reminderData.reminder_date}.`,
      req.user.id,
      req.user.full_name,
      getClientDevice(req)
    );

    res.status(201).json(reminder);
  } catch (e) {
    console.error('Create reminder error:', e);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

app.put('/api/reminders/:id/read', authenticateToken, async (req, res) => {
  try {
    const reminder = await DB.markReminderAsRead(req.params.id);
    res.json(reminder);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update reminder status' });
  }
});

app.delete('/api/reminders/:id', authenticateToken, async (req, res) => {
  try {
    await DB.deleteReminder(req.params.id);
    res.json({ message: 'Reminder deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

app.get('/api/reminders/widgets', authenticateToken, async (req, res) => {
  try {
    const widgets = await DB.getReminderWidgets(req.user.id, req.user.role);
    res.json(widgets);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reminder widgets' });
  }
});

// Notifications Alerts sync API
app.get('/api/notifications/alerts', authenticateToken, async (req, res) => {
  try {
    const { since } = req.query;
    const alertsData = await DB.getNotificationsAlerts(req.user.id, req.user.role, since);
    res.json(alertsData);
  } catch (e) {
    console.error('Failed to fetch notifications alerts:', e);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Recent Activities Feed API
app.get('/api/activities/recent', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = await DB.getRecentActivities(limit);
    res.json(activities);
  } catch (error) {
    console.error('Failed to fetch recent activities:', error);
    res.status(500).json({ error: 'Failed to fetch recent activities' });
  }
});

// Employee Performance stats API
app.get('/api/employees/:id/performance', authenticateToken, async (req, res) => {
  try {
    const stats = await DB.getEmployeePerformanceStats(req.params.id);
    res.json(stats);
  } catch (error) {
    console.error('Failed to fetch employee performance stats:', error);
    res.status(500).json({ error: 'Failed to fetch employee performance stats' });
  }
});

// --- PHASE 3: UNIFIED TIMELINE API ---

app.get('/api/leads/:id/timeline', authenticateToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = await DB.getLeadById(leadId, req.user.id, req.user.role);
    if (!lead) return res.status(404).json({ error: 'Lead not found or access denied' });

    // Fetch timeline activities in parallel
    const [audits, calls, transfers, visits, bookings, whatsappLogs, whatsappChats, reminders, payments, whatsappActivities, whatsappNotes] = await Promise.all([
      DB.getAuditTrail(leadId),
      DB.getCallLogs(leadId),
      DB.getTransferHistory(leadId),
      DB.getSiteVisits(leadId),
      DB.getBookingsForLead(leadId),
      DB.getWhatsAppLogsForLead(leadId),
      DB.getWhatsAppMessages(leadId),
      DB.getReminders(req.user.id, req.user.role),
      DB.getPayments(),
      DB.getWhatsAppActivities(leadId),
      DB.getWhatsAppNotes(leadId)
    ]);

    const timeline = [];

    // 1. Audit logs
    audits.forEach(a => {
      timeline.push({
        id: a.id,
        type: 'activity',
        title: a.action,
        description: a.details,
        date: a.created_at,
        user: a.user_name || 'System',
        device: a.device || 'Web Portal'
      });
    });

    // 2. Call Logs
    calls.forEach(c => {
      timeline.push({
        id: c.id,
        type: 'call',
        title: `Call Outcome: ${c.response}`,
        description: c.notes || 'No remarks logged.',
        date: c.call_date,
        user: c.caller ? c.caller.full_name : 'Executive',
        duration: c.duration || 0,
        action_taken: c.action_taken || null,
        follow_up_date: c.follow_up_date || null,
        follow_up_time: c.follow_up_time || null,
        follow_up_datetime: c.follow_up_datetime || null,
        call_type: c.call_type || 'Outgoing',
        synced_from_device: c.synced_from_device || false,
        needs_notes: c.needs_notes || false,
        recording_url: c.recording_url || null,
        recording_duration: c.recording_duration || 0
      });
    });

    // 3. Lead Transfers
    transfers.forEach(t => {
      timeline.push({
        id: t.id,
        type: 'transfer',
        title: 'Lead Assignment/Transfer',
        description: `Owner transferred from ${t.from_employee ? t.from_employee.full_name : 'Unassigned'} to ${t.to_employee ? t.to_employee.full_name : 'Unassigned'}.`,
        date: t.transfer_date,
        user: t.assigner ? t.assigner.full_name : 'System'
      });
    });

    // 4. Site Visits
    visits.forEach(v => {
      if (v.check_in_time) {
        timeline.push({
          id: `${v.id}-checkin`,
          type: 'site-visit-in',
          title: 'Site Visit Check-In',
          description: `Checked in at project site. GPS coords: ${v.check_in_lat}, ${v.check_in_lng}. Address: ${v.check_in_address || 'N/A'}`,
          date: v.check_in_time,
          user: lead.assigned_employee ? lead.assigned_employee.full_name : 'Executive'
        });
      }
      if (v.check_out_time) {
        timeline.push({
          id: `${v.id}-checkout`,
          type: 'site-visit-out',
          title: 'Site Visit Check-Out',
          description: `Checked out of project site. Outcome: ${v.outcome}. Feedback: "${v.feedback || 'None'}". Address: ${v.check_out_address || 'N/A'}`,
          date: v.check_out_time,
          user: lead.assigned_employee ? lead.assigned_employee.full_name : 'Executive'
        });
      }
    });

    // 5. Bookings
    bookings.forEach(b => {
      timeline.push({
        id: b.id,
        type: 'booking',
        title: `Booking Action: ${b.status}`,
        description: `Booked Unit ${b.unit_number || 'N/A'} in Project ${b.projects ? b.projects.name : 'N/A'}. Token: ₹${b.token_amount}, Total Cost: ₹${b.booking_amount}.`,
        date: b.created_at,
        user: 'System'
      });
    });

    // 6. WhatsApp Logs (Campaigns)
    whatsappLogs.forEach(w => {
      timeline.push({
        id: w.id,
        type: 'whatsapp',
        title: `WhatsApp Campaign: ${w.status}`,
        description: `Message: "${w.message_text}". Response Details: ${w.response_details || 'N/A'}`,
        date: w.created_at,
        user: 'WhatsApp Automation'
      });
    });

    // 7. WhatsApp Chats (Direct Messages)
    whatsappChats.forEach(w => {
      timeline.push({
        id: w.id,
        type: 'whatsapp-chat',
        title: `WhatsApp Message (${w.direction === 'Incoming' ? 'Incoming' : 'Outgoing'})`,
        description: w.message_text + (w.media_url ? ` [Media: ${w.media_url}]` : '') + (w.template_name ? ` [Template: ${w.template_name}]` : ''),
        date: w.sent_at || w.created_at,
        user: w.direction === 'Outgoing' ? 'Executive' : (lead.name || 'Client')
      });
    });

    // 7a. WhatsApp Activity Logs
    whatsappActivities.forEach(a => {
      timeline.push({
        id: a.id,
        type: 'whatsapp-activity',
        title: a.action_type,
        description: 'WhatsApp redirection clicked by executive.',
        date: a.timestamp || a.created_at,
        user: a.employee ? a.employee.full_name : 'Executive'
      });
    });

    // 7b. WhatsApp Notes
    whatsappNotes.forEach(n => {
      timeline.push({
        id: n.id,
        type: 'whatsapp-notes',
        title: 'WhatsApp Notes Saved',
        description: `Discussion Summary: ${n.discussion_summary || 'N/A'}\nCustomer Interest: ${n.customer_interest || 'N/A'}\nBudget Discussion: ${n.budget_discussion || 'N/A'}\nObjections: ${n.objections || 'N/A'}\nNext Action: ${n.next_action || 'N/A'}`,
        date: n.created_at,
        user: n.employee ? n.employee.full_name : 'Executive'
      });
    });

    // 8. Reminders (Follow-ups)
    reminders.filter(r => r.lead_id === leadId).forEach(r => {
      timeline.push({
        id: r.id,
        type: 'reminder',
        title: `Follow-up Alert: ${r.title}`,
        description: `Follow-up reminder set for ${r.reminder_date} at ${r.reminder_time || '09:00'}. Status: ${r.is_read ? 'Completed' : 'Pending'}. Notes: ${r.notes || 'None'}`,
        date: `${r.reminder_date}T${r.reminder_time || '09:00:00'}`,
        user: 'System'
      });
    });

    // 9. Payment Collections
    const leadBookingIds = new Set(bookings.map(b => b.id));
    payments.filter(p => leadBookingIds.has(p.booking_id)).forEach(p => {
      timeline.push({
        id: p.id,
        type: 'payment',
        title: `Payment Collected (${p.status || 'Success'})`,
        description: `Received amount: ₹${p.amount_received}, Remaining Balance: ₹${p.balance}. Mode: ${p.payment_mode || 'N/A'}. Remarks: ${p.remarks || 'None'}`,
        date: p.payment_date || p.created_at,
        user: 'Billing Team'
      });
    });

    // Sort chronologically descending
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(timeline);
  } catch (e) {
    console.error('Unified timeline error:', e);
    res.status(500).json({ error: 'Failed to build lead timeline' });
  }
});

// --- PHASE 2: ADVANCED ANALYTICS DASHBOARDS ---

app.get('/api/dashboard/advanced', authenticateToken, async (req, res) => {
  try {
    const isBasic = req.query.basic === 'true';
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
    const callLogs = await DB.getAllCallLogs();
    
    // Count calls today
    let callsToday = 0;
    let connectedCallsToday = 0;
    let missedCallsToday = 0;
    const notConnectedResponses = ['Not Picked', 'Busy', 'Failed', 'Not Connected'];

    let todayCalls = [];
    if (role === 'employee') {
      todayCalls = callLogs.filter(c => c.caller_id === userId && c.call_date && c.call_date.startsWith(todayStr));
    } else {
      todayCalls = callLogs.filter(c => c.call_date && c.call_date.startsWith(todayStr));
    }
    
    callsToday = todayCalls.length;
    connectedCallsToday = todayCalls.filter(c => !notConnectedResponses.includes(c.response)).length;
    missedCallsToday = todayCalls.filter(c => c.response === 'Not Picked' || c.call_type === 'Missed' || c.response === 'Not Connected').length;

    if (isBasic) {
      return res.json({
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
          callsToday,
          connectedCallsToday,
          missedCallsToday,
          todayBookingsCount: 0,
          monthlyBookingsCount: 0,
          collectionReceived: 0,
          pendingCollection: 0
        },
        basic: true
      });
    }

    // Booking & Revenue summary calculations
    const payments = await DB.getPayments();
    const filteredPayments = role === 'employee' ? payments.filter(p => p.bookings && p.bookings.executive_id === userId) : payments;
    const thisMonthPrefix = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    const todayBookingsCount = filteredBookings.filter(b => b.created_at && b.created_at.startsWith(todayStr)).length;
    const monthlyBookingsCount = filteredBookings.filter(b => b.created_at && b.created_at.startsWith(thisMonthPrefix)).length;
    const collectionReceived = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount_received) || 0), 0);
    const pendingCollection = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.balance) || 0), 0);

    // Lead Aging calculation
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const aging = {
      active: 0,     // <7 days
      stagnant: 0,   // 7-15 days
      cold: 0,       // 15-30 days
      critical: 0    // 30+ days
    };
    leads.forEach(l => {
      const created = new Date(l.created_at || now);
      const diffDays = Math.floor((now - created) / oneDay);
      if (diffDays < 7) aging.active++;
      else if (diffDays < 15) aging.stagnant++;
      else if (diffDays < 30) aging.cold++;
      else aging.critical++;
    });

    // Follow-up Compliance calculation
    const allReminders = await DB.getReminders(req.user.id, req.user.role);
    const completedRemindersCount = allReminders.filter(r => r.is_read).length;
    const missedRemindersCount = allReminders.filter(r => !r.is_read && r.reminder_date < todayStr).length;
    const pendingRemindersCount = allReminders.filter(r => !r.is_read && r.reminder_date >= todayStr).length;
    const totalRemindersCount = allReminders.length;
    const complianceRate = totalRemindersCount > 0 ? Math.round((completedRemindersCount / totalRemindersCount) * 100) : 100;

    // Lead Source Distribution
    const sourceMap = { Facebook: 0, Instagram: 0, Google: 0, Website: 0, WhatsApp: 0, 'Walk-In': 0, Referral: 0, MagicBricks: 0, '99acres': 0, Housing: 0 };
    leads.forEach(l => {
      const src = l.lead_source || 'Website';
      if (sourceMap[src] !== undefined) sourceMap[src]++;
    });

    // Employee Performance comparison (Admin & Leaderboard)
    let employeePerformance = [];
    const employees = await DB.getAllEmployees();
    employeePerformance = employees.map(emp => {
      const empLeads = leads.filter(l => l.assigned_employee_id === emp.id);
      const empBookings = bookings.filter(b => b.executive_id === emp.id);
      const empCalls = callLogs.filter(c => c.caller_id === emp.id);
      const empConnectedCalls = empCalls.filter(c => !['Not Picked', 'Busy', 'Failed', 'Not Connected'].includes(c.response));
      const empVisits = siteVisits.filter(v => v.leads && v.leads.assigned_employee_id === emp.id && v.outcome && v.outcome !== 'Scheduled');
      const conversionRate = empLeads.length > 0 ? (empBookings.length / empLeads.length) * 100 : 0;
      const revenueClosed = empBookings.reduce((sum, b) => sum + (parseFloat(b.token_amount) || 0) + (parseFloat(b.booking_amount) || 0), 0);
      const empCallsToday = empCalls.filter(c => c.call_date && c.call_date.startsWith(todayStr)).length;
      return {
        id: emp.id,
        name: emp.full_name,
        leadsCount: empLeads.length,
        callsCount: empCalls.length,
        connectedCallsCount: empConnectedCalls.length,
        siteVisitsCount: empVisits.length,
        bookingsCount: empBookings.length,
        revenueClosed,
        conversionRate: Math.round(conversionRate * 10) / 10,
        callsTodayCount: empCallsToday
      };
    });
    // Sort by bookings then conversion rate for Ranking Board
    employeePerformance.sort((a, b) => b.bookingsCount - a.bookingsCount || b.conversionRate - a.conversionRate);

    // Fetch reminder widget counts
    const remindersWidget = await DB.getReminderWidgets(req.user.id, req.user.role);

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
        callsToday,
        connectedCallsToday,
        missedCallsToday,
        todayBookingsCount,
        monthlyBookingsCount,
        collectionReceived,
        pendingCollection
      },
      funnel: {
        new: leads.filter(l => l.status === 'New').length,
        contacted: leads.filter(l => ['Attempted', 'Connected', 'Warm', 'Cold', 'Interested'].includes(l.status)).length,
        visit: leads.filter(l => ['Site Visit Scheduled', 'Site Visit Done'].includes(l.status)).length,
        negotiation: leads.filter(l => ['Negotiation', 'Hot'].includes(l.status)).length,
        booked: leads.filter(l => l.status === 'Booked').length
      },
      sourceDistribution: sourceMap,
      employeePerformance,
      reminders: remindersWidget,
      leadAging: aging,
      compliance: {
        completed: completedRemindersCount,
        missed: missedRemindersCount,
        pending: pendingRemindersCount,
        total: totalRemindersCount,
        rate: complianceRate
      }
    });
  } catch (e) {
    console.error('Analytics dashboard error:', e);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// --- PHASE 6: DASHBOARD ANALYTICS & INCENTIVES ENDPOINTS ---

app.get('/api/analytics/roi', authenticateToken, async (req, res) => {
  try {
    const roiStats = await DB.getSourceRoiStats();
    res.json(roiStats);
  } catch (error) {
    console.error('Failed to fetch ROI stats:', error);
    res.status(500).json({ error: 'Failed to fetch ROI stats' });
  }
});

app.get('/api/analytics/funnel', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.query.employee_id || null;
    const funnelStats = await DB.getFunnelStats(employeeId);
    res.json(funnelStats);
  } catch (error) {
    console.error('Failed to fetch funnel stats:', error);
    res.status(500).json({ error: 'Failed to fetch funnel stats' });
  }
});

app.get('/api/analytics/performance', authenticateToken, async (req, res) => {
  try {
    const report = await DB.getEmployeePerformanceReports();
    res.json(report);
  } catch (error) {
    console.error('Failed to fetch performance report:', error);
    res.status(500).json({ error: 'Failed to fetch performance report' });
  }
});

app.get('/api/analytics/incentives', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.role === 'admin' ? (req.query.employee_id || null) : req.user.id;
    const incentivesData = await DB.getIncentivesData(employeeId);
    res.json(incentivesData);
  } catch (error) {
    console.error('Failed to fetch incentives data:', error);
    res.status(500).json({ error: 'Failed to fetch incentives data' });
  }
});

app.put('/api/employees/:id/commission', authenticateToken, requireAdmin, async (req, res) => {
  const { commission_percentage } = req.body;
  if (commission_percentage === undefined || isNaN(parseFloat(commission_percentage))) {
    return res.status(400).json({ error: 'Invalid or missing commission_percentage' });
  }
  try {
    const updated = await DB.updateEmployeeCommission(req.params.id, parseFloat(commission_percentage));
    res.json({ message: 'Employee commission updated successfully', user: updated });
  } catch (error) {
    console.error('Failed to update employee commission:', error);
    res.status(500).json({ error: 'Failed to update employee commission' });
  }
});

// --- SALES COMMAND CENTER (DAYBOOK) ---
app.get('/api/command-center/tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await DB.getCommandCenterTasks(req.user.id, req.user.role);
    res.json(tasks);
  } catch (error) {
    console.error('Failed to fetch command center tasks:', error);
    res.status(500).json({ error: 'Failed to fetch command center tasks' });
  }
});

app.post('/api/command-center/tasks/:id/complete', authenticateToken, async (req, res) => {
  const { notes } = req.body;
  try {
    const result = await DB.completeCommandCenterTask(req.params.id, req.user.id, notes || '');
    res.json({ message: 'Task completed successfully', task: result });
  } catch (error) {
    console.error('Failed to complete task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

app.post('/api/command-center/tasks/:id/reschedule', authenticateToken, async (req, res) => {
  const { newDate, newTime } = req.body;
  if (!newDate) {
    return res.status(400).json({ error: 'Missing newDate for rescheduling' });
  }
  try {
    const result = await DB.rescheduleCommandCenterTask(req.params.id, newDate, newTime || null);
    res.json({ message: 'Task rescheduled successfully', task: result });
  } catch (error) {
    console.error('Failed to reschedule task:', error);
    res.status(500).json({ error: 'Failed to reschedule task' });
  }
});

app.get('/api/command-center/targets', authenticateToken, async (req, res) => {
  try {
    const targets = await DB.getDailyTargets(req.user.id, req.user.role);
    res.json(targets);
  } catch (error) {
    console.error('Failed to fetch daily targets:', error);
    res.status(500).json({ error: 'Failed to fetch daily targets' });
  }
});

app.get('/api/command-center/performance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const performance = await DB.getAdminPerformanceMetrics();
    res.json(performance);
  } catch (error) {
    console.error('Failed to fetch admin performance stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin performance stats' });
  }
});


app.get('/api/leads/duplicates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const list = await DB.getDuplicateLeads();
    res.json(list);
  } catch (e) {
    console.error('Failed to fetch duplicate leads:', e);
    res.status(500).json({ error: 'Failed to fetch duplicate leads' });
  }
});

app.post('/api/leads/merge', authenticateToken, requireAdmin, async (req, res) => {
  const { targetLeadId, duplicateLeadIds } = req.body;
  if (!targetLeadId || !duplicateLeadIds || !Array.isArray(duplicateLeadIds) || duplicateLeadIds.length === 0) {
    return res.status(400).json({ error: 'Missing targetLeadId or duplicateLeadIds' });
  }
  try {
    const result = await DB.mergeLeads(targetLeadId, duplicateLeadIds, req.user.id, req.user.full_name);
    res.json({ success: true, lead: result });
  } catch (e) {
    console.error('Lead merge failed:', e);
    res.status(500).json({ error: `Lead merge failed: ${e.message}` });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.send('Vrindavan Estates CRM Backend Server is running successfully!');
});

async function seedWhatsAppTemplatesAndCampaigns() {
  try {
    const templates = await DB.getWhatsAppTemplates();
    const defaults = [
      {
        name: 'welcome_message',
        category: 'Utility',
        body_text: 'Hello {customer_name}, thank you for inquiring about {project_name} with Vrindavan Estates. An executive will contact you shortly.',
        variables: ['customer_name', 'project_name']
      },
      {
        name: 'followup_reminder',
        category: 'Utility',
        body_text: 'Hello {customer_name}, this is a reminder regarding your scheduled {type} today at {time} for {project_name}. Regards!',
        variables: ['customer_name', 'type', 'time', 'project_name']
      },
      {
        name: 'site_visit_invite',
        category: 'Marketing',
        body_text: 'Hi {customer_name}, we would love to invite you for a site visit to {project_name} in {location}. Let us know your convenient time. - Vrindavan Estates',
        variables: ['customer_name', 'project_name', 'location']
      },
      {
        name: 'booking_confirmation',
        category: 'Utility',
        body_text: 'Hi {customer_name}, congratulations! We have confirmed your booking for Unit {unit_number} in {project_name}. Token amount: ₹{token_amount}.',
        variables: ['customer_name', 'unit_number', 'project_name', 'token_amount']
      }
    ];

    for (const def of defaults) {
      if (!templates.find(t => t.name === def.name)) {
        await DB.createWhatsAppTemplate(def);
        console.log(`Seeded WhatsApp Template: ${def.name}`);
      }
    }

    const campaigns = await DB.getWhatsAppCampaigns();
    const clickCampaignName = 'Click-to-WhatsApp Messages';
    if (!campaigns.find(c => c.name === clickCampaignName)) {
      const freshTemplates = await DB.getWhatsAppTemplates();
      const welcomeTemp = freshTemplates.find(t => t.name === 'welcome_message');
      
      const campaignData = {
        name: clickCampaignName,
        template_id: welcomeTemp ? welcomeTemp.id : null,
        filters_used: { system: 'Click-to-WhatsApp fallback' }
      };
      
      await DB.createWhatsAppCampaign(campaignData, []);
      console.log(`Seeded WhatsApp Campaign: ${clickCampaignName}`);
    }
  } catch (err) {
    console.error('Failed to seed default WhatsApp configuration:', err);
  }
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT} (Bound to 0.0.0.0)`);
  await seedWhatsAppTemplatesAndCampaigns();
});

// --- SMART BULK DELETE SAFETY SYSTEM HELPERS ---
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const BACKUPS_DIR = path.join(__dirname, 'backups');
const BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY || 'vrindavan_estates_sec_key_32bytes_!'; // 32 bytes key
const IV_LENGTH = 16;

function generateExcelBuffer(leads) {
  const rows = leads.map(l => ({
    'Lead ID': l.id,
    'Name': l.name || '',
    'Mobile': l.phone1 || '',
    'Alternate Mobile': l.phone2 || '',
    'Email': l.email || '',
    'City': l.city || '',
    'State': l.state || '',
    'Source': l.source || '',
    'Project': l.project || '',
    'Budget': l.budget || '',
    'Status': l.status || '',
    'Priority': l.priority || '',
    'Assigned Employee': l.assigned_employee_name || l.assigned_employee_id || '',
    'Follow-up Date': l.follow_up_date || '',
    'Last Call Date': l.last_call_date || '',
    'Notes': l.comments || '',
    'Created Date': l.created_at || '',
    'Updated Date': l.updated_at || ''
  }));

  const worksheet = xlsx.utils.json_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Leads Backup');
  
  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(BACKUP_ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function purgeOldBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return;

  fs.readdir(BACKUPS_DIR, (err, files) => {
    if (err) return console.error('Failed to read backups directory:', err);
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      if (!file.endsWith('.enc')) return;
      const filePath = path.join(BACKUPS_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > sevenDaysMs) {
          fs.unlink(filePath, err => {
            if (err) console.error('Failed to delete old backup:', file);
            else console.log('Auto-purged 7-day-old backup:', file);
          });
        }
      });
    });
  });
}

// Run cleanup on startup and then every 24 hours
purgeOldBackups();
setInterval(purgeOldBackups, 24 * 60 * 60 * 1000);
