// Dynamic Base URL resolver for Capacitor vs Web dev proxy
let customBaseUrl = localStorage.getItem('backend_url') || '';

export const getBaseUrl = () => {
  if (customBaseUrl) return customBaseUrl;
  if (window.Capacitor || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
    return 'https://vrindavan-estates-crm-backend.onrender.com'; // Production cloud backend URL
  }
  return ''; // Default to local proxy
};

export const setBackendUrl = (url) => {
  customBaseUrl = url;
  if (url) {
    localStorage.setItem('backend_url', url);
  } else {
    localStorage.removeItem('backend_url');
  }
};

let token = localStorage.getItem('token') || '';

export const setAuthToken = (newToken) => {
  token = newToken;
  if (newToken) {
    localStorage.setItem('token', newToken);
  } else {
    localStorage.removeItem('token');
  }
};

const request = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getBaseUrl()}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    // Session expired or unauthorized, logout
    setAuthToken('');
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  // Handle binary downloads (xlsx/csv export)
  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('sheet') || contentType.includes('csv'))) {
    if (!response.ok) throw new Error('File download failed');
    return response.blob();
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
};

export const api = {
  // Authentication
  login: (username, password) => 
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
    
  getCurrentUser: () => request('/api/auth/me'),

  // Employees
  getEmployees: () => request('/api/employees'),
  createEmployee: (employeeData) => 
    request('/api/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    }),

  // Leads
  getLeads: (params = {}) => {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key]) query.append(key, params[key]);
    });
    const queryString = query.toString();
    return request(`/api/leads${queryString ? `?${queryString}` : ''}`);
  },

  getLeadById: (id) => request(`/api/leads/${id}`),

  createLead: (leadData) =>
    request('/api/leads', {
      method: 'POST',
      body: JSON.stringify(leadData),
    }),

  updateLead: (id, leadData) =>
    request(`/api/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(leadData),
    }),

  deleteLead: (id) =>
    request(`/api/leads/${id}`, {
      method: 'DELETE',
    }),

  // Call Logs
  logCall: (leadId, response, notes) =>
    request(`/api/leads/${leadId}/call-log`, {
      method: 'POST',
      body: JSON.stringify({ response, notes }),
    }),

  getCallLogs: (leadId) => request(`/api/leads/${leadId}/call-logs`),

  // Exports
  exportLeads: async (format = 'csv') => {
    const blob = await request(`/api/export?format=${format}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // Imports
  importLeads: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${getBaseUrl()}/api/import`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401 || response.status === 403) {
      setAuthToken('');
      window.location.reload();
      throw new Error('Session expired');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Import failed');
    }
    return data;
  },

  // Backup & Restore
  downloadBackup: async () => {
    const blob = await request('/api/backup/download');
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vrindavan_estates_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  restoreBackup: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${getBaseUrl()}/api/backup/restore`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401 || response.status === 403) {
      setAuthToken('');
      window.location.reload();
      throw new Error('Session expired');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Restore failed');
    }
    return data;
  },

  // History Trails
  getLeadsAuditTrail: (leadId) => request(`/api/leads/${leadId}/audit-trail`),
  getLeadsTransferHistory: (leadId) => request(`/api/leads/${leadId}/transfer-history`),

  // Duplicate Check
  checkDuplicateLead: (phone1, phone2, excludeId) => 
    request(`/api/leads/check-duplicate?phone1=${phone1 || ''}&phone2=${phone2 || ''}${excludeId ? `&excludeId=${excludeId}` : ''}`),

  // Employee Lifecycle
  toggleEmployeeStatus: (id, status) => 
    request(`/api/employees/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }),

  transferEmployeeLeads: (fromId, toId) => 
    request(`/api/employees/${fromId}/transfer-leads`, {
      method: 'POST',
      body: JSON.stringify({ to_employee_id: toId })
    }),

  // --- PHASE 2: PROJECTS ---
  getProjects: () => request('/api/projects'),
  getProjectById: (id) => request(`/api/projects/${id}`),
  createProject: (data) => request('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),

  // --- PHASE 2: INVENTORY ---
  getInventory: (projectId) => request(`/api/inventory${projectId ? `?project_id=${projectId}` : ''}`),
  getInventoryById: (id) => request(`/api/inventory/${id}`),
  createInventory: (data) => request('/api/inventory', { method: 'POST', body: JSON.stringify(data) }),
  updateInventory: (id, data) => request(`/api/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteInventory: (id) => request(`/api/inventory/${id}`, { method: 'DELETE' }),

  // --- PHASE 2: BOOKINGS ---
  getBookings: () => request('/api/bookings'),
  createBooking: (data) => request('/api/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBookingStatus: (id, status) => request(`/api/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // --- PHASE 2: PAYMENTS ---
  getPayments: () => request('/api/payments'),
  getPaymentById: (id) => request(`/api/payments/${id}`),
  createPaymentInstallment: (paymentId, amountPaid, paymentMode, remarks) => 
    request(`/api/payments/${paymentId}/installments`, { method: 'POST', body: JSON.stringify({ amount_paid: amountPaid, payment_mode: paymentMode, remarks }) }),
  getPaymentInstallments: (paymentId) => request(`/api/payments/${paymentId}/installments`),

  // --- PHASE 2: WHATSAPP ---
  getWhatsAppTemplates: () => request('/api/whatsapp/templates'),
  createWhatsAppTemplate: (data) => request('/api/whatsapp/templates', { method: 'POST', body: JSON.stringify(data) }),
  getWhatsAppCampaigns: () => request('/api/whatsapp/campaigns'),
  getWhatsAppCampaignLogs: (campaignId) => request(`/api/whatsapp/campaigns/${campaignId}/logs`),
  createWhatsAppCampaign: (name, templateId, filters, leads) => 
    request('/api/whatsapp/campaigns', { method: 'POST', body: JSON.stringify({ name, template_id: templateId, filters, leads }) }),

  // --- PHASE 2: SMART DISTRIBUTION RULES ---
  getDistributionRules: () => request('/api/distribution/rules'),
  updateDistributionRules: (method, isActive, config) => 
    request('/api/distribution/rules', { method: 'PUT', body: JSON.stringify({ method, is_active: isActive, config }) }),

  // --- PHASE 2: SITE VISITS (GEOFENCED) ---
  getSiteVisits: (leadId) => request(`/api/site-visits${leadId ? `?lead_id=${leadId}` : ''}`),
  checkInSiteVisit: (leadId, lat, lng, address) => 
    request(`/api/leads/${leadId}/site-visits/check-in`, { method: 'POST', body: JSON.stringify({ lat, lng, address }) }),
  checkOutSiteVisit: (leadId, visitId, lat, lng, address, feedback, outcome, mediaUrls) => 
    request(`/api/leads/${leadId}/site-visits/${visitId}/check-out`, { method: 'POST', body: JSON.stringify({ lat, lng, address, feedback, outcome, media_urls: mediaUrls }) }),

  // --- PHASE 2: INACTIVE QUEUE & ADVANCED DASHBOARD ---
  getInactiveLeadsQueue: (days) => request(`/api/leads/inactive-queue${days ? `?days=${days}` : ''}`),
  getAdvancedDashboardStats: () => request('/api/dashboard/advanced'),

  // --- PHASE 2: REPORTS EXPORT ---
  exportReport: async (type = 'bookings') => {
    const blob = await request(`/api/reports/export?type=${type}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // --- PHASE 3: REMINDERS ---
  getReminders: () => request('/api/reminders'),
  createReminder: (data) => request('/api/reminders', { method: 'POST', body: JSON.stringify(data) }),
  markReminderAsRead: (id) => request(`/api/reminders/${id}/read`, { method: 'PUT' }),
  deleteReminder: (id) => request(`/api/reminders/${id}`, { method: 'DELETE' }),
  getReminderWidgets: () => request('/api/reminders/widgets'),
  getNotificationsAlerts: (since) => request(`/api/notifications/alerts${since ? `?since=${since}` : ''}`),
  logWhatsAppClick: (leadId, phone, messageText) =>
    request('/api/whatsapp/campaigns/click-log', {
      method: 'POST',
      body: JSON.stringify({ lead_id: leadId, phone, message_text: messageText })
    }),

  // --- PHASE 3: TIMELINE ---
  getLeadTimeline: (leadId) => request(`/api/leads/${leadId}/timeline`),

  // --- PHASE 3: BULK ASSIGN ---
  bulkAssignLeads: (leadIds, employeeId, method, config) => 
    request('/api/leads/bulk-assign', { method: 'POST', body: JSON.stringify({ leadIds, employeeId, method, config }) }),

  // --- PHASE 3: EXCEL/CSV IMPORT ENGINE ---
  getImportHistory: () => request('/api/import/history'),
  previewImportLeads: async (file, sheetUrl = '') => {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (sheetUrl) {
      formData.append('sheetUrl', sheetUrl);
    }
    
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${getBaseUrl()}/api/import/preview`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401 || response.status === 403) {
      setAuthToken('');
      window.location.reload();
      throw new Error('Session expired');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Preview failed');
    }
    return data;
  },
  runImportLeads: (records, filename, duplicateStrategy) => 
    request('/api/import/run', {
      method: 'POST',
      body: JSON.stringify({ records, filename, duplicateStrategy })
    }),

  getRecentActivities: (limit) => 
    request(`/api/activities/recent${limit ? `?limit=${limit}` : ''}`),

  getEmployeePerformance: (id) =>
    request(`/api/employees/${id}/performance`),

  getDuplicateLeads: () => request('/api/leads/duplicates'),
  
  mergeLeads: (targetLeadId, duplicateLeadIds) => 
    request('/api/leads/merge', {
      method: 'POST',
      body: JSON.stringify({ targetLeadId, duplicateLeadIds })
    }),

  blockInventoryUnit: (id, durationHours) =>
    request(`/api/inventory/${id}/block`, {
      method: 'POST',
      body: JSON.stringify({ duration_hours: durationHours })
    }),

  unblockInventoryUnit: (id) =>
    request(`/api/inventory/${id}/unblock`, {
      method: 'POST'
    }),

  getBookingMilestones: (bookingId) =>
    request(`/api/bookings/${bookingId}/milestones`),

  createBookingMilestone: (bookingId, milestoneData) =>
    request(`/api/bookings/${bookingId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(milestoneData)
    }),

  updateBookingMilestone: (milestoneId, milestoneData) =>
    request(`/api/bookings/milestones/${milestoneId}`, {
      method: 'PUT',
      body: JSON.stringify(milestoneData)
    }),

  deleteBookingMilestone: (milestoneId) =>
    request(`/api/bookings/milestones/${milestoneId}`, {
      method: 'DELETE'
    }),

  getCollectionAnalytics: () => request('/api/collections/analytics'),
  
  getCollectionReminders: () => request('/api/collections/reminders'),

  getSourceRoiStats: () => request('/api/analytics/roi'),

  getFunnelStats: (employeeId = '') => 
    request(`/api/analytics/funnel${employeeId ? `?employee_id=${employeeId}` : ''}`),

  getEmployeePerformanceReports: () => request('/api/analytics/performance'),

  getIncentivesData: (employeeId = '') => 
    request(`/api/analytics/incentives${employeeId ? `?employee_id=${employeeId}` : ''}`),

  updateEmployeeCommission: (id, commissionPct) => 
    request(`/api/employees/${id}/commission`, {
      method: 'PUT',
      body: JSON.stringify({ commission_percentage: commissionPct })
    })
};
