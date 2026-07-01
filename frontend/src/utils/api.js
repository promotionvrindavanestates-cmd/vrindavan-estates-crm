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

const cache = {};
const CACHE_TTL = 60000; // 60 seconds

// Offline sync queue and caching config
const OFFLINE_QUEUE_KEY = 'offline_mutations_queue';
const CACHE_PREFIX = 'offline_cache:';

const getOfflineQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch (e) {
    return [];
  }
};

const saveOfflineQueue = (queue) => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const queueOfflineMutation = (url, options) => {
  const queue = getOfflineQueue();
  queue.push({
    url,
    options: {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    },
    id: Date.now() + Math.random(),
    timestamp: Date.now()
  });
  saveOfflineQueue(queue);
  console.log(`[Offline Queue] Mutation queued: ${options.method || 'POST'} ${url}`);
  
  // Notify UI
  window.dispatchEvent(new CustomEvent('offline-mutation-queued', { detail: { method: options.method || 'POST', url } }));
};

export const syncOfflineMutations = async () => {
  if (!navigator.onLine) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`[Offline Sync] Syncing ${queue.length} offline mutations...`);
  saveOfflineQueue([]); // Clear temp

  for (const item of queue) {
    try {
      console.log(`[Offline Sync] Sending queued mutation: ${item.options.method} ${item.url}`);
      const headers = {
        'Content-Type': 'application/json',
        ...item.options.headers
      };
      
      const response = await fetch(`${getBaseUrl()}${item.url}`, {
        ...item.options,
        headers
      });

      if (!response.ok) {
        throw new Error(`Sync failed with status: ${response.status}`);
      }
      console.log(`[Offline Sync] Queued mutation succeeded: ${item.url}`);
    } catch (err) {
      console.error(`[Offline Sync] Failed to sync mutation: ${item.url}. Re-queueing.`, err);
      const currentQueue = getOfflineQueue();
      currentQueue.unshift(item); // Re-insert at front
      saveOfflineQueue(currentQueue);
      return; // Stop sync to keep order
    }
  }

  console.log('[Offline Sync] Sync complete!');
  window.dispatchEvent(new CustomEvent('offline-sync-complete'));
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineMutations);
}

const request = async (url, options = {}) => {
  const method = options.method || 'GET';

  // Invalidate cache on mutations (POST, PUT, DELETE)
  if (method !== 'GET') {
    for (const key in cache) {
      delete cache[key];
    }
  }

  // Offline capability check
  if (!navigator.onLine && method !== 'GET') {
    queueOfflineMutation(url, options);
    return { success: true, offline: true, message: 'Action queued offline' };
  }

  const cacheKey = `${method}:${url}:${options.body || ''}`;
  if (method === 'GET' && (
    url.includes('/api/dashboard/widgets') ||
    url.includes('/api/dashboard/advanced') ||
    url.includes('/api/notifications/alerts') ||
    url.includes('/api/reminders') ||
    (url.includes('/api/leads') && !url.includes('/job/'))
  )) {
    const cached = cache[cacheKey];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`[Cache Hit] Returning cached response for: ${url}`);
      return cached.data;
    }
  }

  const label = `API Request: ${method} ${url}`;
  console.time(label);
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(`${getBaseUrl()}${url}`, {
        ...options,
        headers,
      });
    } catch (fetchErr) {
      if (method === 'GET') {
        const localCacheData = localStorage.getItem(`${CACHE_PREFIX}${url}`);
        if (localCacheData) {
          console.log(`[Offline Cache Fallback] Serving cached data for: ${url}`);
          return JSON.parse(localCacheData);
        }
      } else {
        queueOfflineMutation(url, options);
        return { success: true, offline: true, message: 'Action queued offline' };
      }
      throw fetchErr;
    }

    if (response.status === 401 || response.status === 403) {
      setAuthToken('');
      window.location.reload();
      throw new Error('Session expired. Please log in again.');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && (contentType.includes('sheet') || contentType.includes('csv'))) {
      if (!response.ok) throw new Error('File download failed');
      return response.blob();
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    // Save to offline cache
    if (method === 'GET' && !url.includes('/job/')) {
      try {
        localStorage.setItem(`${CACHE_PREFIX}${url}`, JSON.stringify(data));
      } catch (cacheErr) {
        console.warn('Failed to write to localStorage offline cache:', cacheErr);
      }
    }

    // Cache the response
    if (method === 'GET' && (
      url.includes('/api/dashboard/widgets') ||
      url.includes('/api/dashboard/advanced') ||
      url.includes('/api/notifications/alerts') ||
      url.includes('/api/reminders')
    )) {
      cache[cacheKey] = {
        timestamp: Date.now(),
        data: data
      };
    }

    return data;
  } finally {
    console.timeEnd(label);
  }
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
  getLeads: async (params = {}) => {
    const query = new URLSearchParams();
    const limit = params.limit !== undefined ? params.limit : (params.page !== undefined ? 20 : 100000);
    query.append('limit', limit);
    Object.keys(params).forEach(key => {
      if (key !== 'limit' && params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    const queryString = query.toString();
    const res = await request(`/api/leads${queryString ? `?${queryString}` : ''}`);
    if (params.page !== undefined || params.limit !== undefined) {
      return res;
    }
    return (res && res.leads) ? res.leads : res;
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
  logCall: (leadId, response, notes, extra = {}) =>
    request(`/api/leads/${leadId}/call-log`, {
      method: 'POST',
      body: JSON.stringify({ response, notes, ...extra }),
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
  getAdvancedDashboardStats: (params = {}) => {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        query.append(key, params[key]);
      }
    });
    const queryString = query.toString();
    return request(`/api/dashboard/advanced${queryString ? `?${queryString}` : ''}`);
  },

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

  syncMobileCalls: (calls) =>
    request('/api/mobile/call-logs/sync', {
      method: 'POST',
      body: JSON.stringify({ calls })
    }),

  getPendingMobileCalls: () => request('/api/mobile/call-logs/pending'),

  savePendingCallNotes: (id, payload) =>
    request(`/api/mobile/call-logs/${id}/notes`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  updateEmployeeCommission: (id, commissionPct) => 
    request(`/api/employees/${id}/commission`, {
      method: 'PUT',
      body: JSON.stringify({ commission_percentage: commissionPct })
    }),

  getWhatsAppChats: (leadId) => request(`/api/whatsapp/chats/${leadId}`),
  syncWhatsAppChats: (messages) => request('/api/whatsapp/chats/sync', { method: 'POST', body: JSON.stringify({ messages }) }),
  simulateWhatsAppMessage: (leadId, text, direction) => request('/api/whatsapp/messages/simulate', { method: 'POST', body: JSON.stringify({ leadId, text, direction }) }),
  getSalesIntelligenceDashboard: () => request('/api/dashboard/sales-intelligence'),
  logWhatsAppActivity: (payload) => request('/api/whatsapp/activity', { method: 'POST', body: JSON.stringify(payload) }),
  saveWhatsAppNotes: (payload) => request('/api/whatsapp/notes', { method: 'POST', body: JSON.stringify(payload) }),
  createWhatsAppFollowUp: (payload) => request('/api/whatsapp/follow-up', { method: 'POST', body: JSON.stringify(payload) }),
  getWhatsAppCommunicationHistory: (leadId) => request(`/api/whatsapp/communication-history/${leadId}`),
  getBookingsForLead: (leadId) => request(`/api/bookings/lead/${leadId}`),
  getPaymentsForLead: (leadId) => request(`/api/payments/lead/${leadId}`),

  // CommandCenter (Daybook) APIs
  getCommandCenterTasks: () => request('/api/command-center/tasks'),
  completeCommandCenterTask: (taskId, notes) => request(`/api/command-center/tasks/${taskId}/complete`, { method: 'POST', body: JSON.stringify({ notes }) }),
  rescheduleCommandCenterTask: (taskId, newDate, newTime) => request(`/api/command-center/tasks/${taskId}/reschedule`, { method: 'POST', body: JSON.stringify({ newDate, newTime }) }),
  getDailyTargets: () => request('/api/command-center/targets'),
  getAdminPerformance: () => request('/api/command-center/performance'),

  deleteLeadsBulk: (leadIds, permanent = false, backupCreated = false) =>
    request('/api/leads/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ leadIds, permanent, backupCreated })
    }),

  restoreLeadsBulk: (leadIds) =>
    request('/api/leads/bulk-restore', {
      method: 'POST',
      body: JSON.stringify({ leadIds })
    }),

  updateLeadsStatusBulk: (leadIds, status) =>
    request('/api/leads/bulk-status', {
      method: 'PUT',
      body: JSON.stringify({ leadIds, status })
    }),

  getBulkJobStatus: (jobId) =>
    request(`/api/leads/bulk/job/${jobId}`),

  emptyRecycleBin: () =>
    request('/api/leads/recycle-bin/empty', {
      method: 'DELETE'
    }),

  getBulkDeleteSettings: () =>
    request('/api/settings/bulk-delete'),

  updateBulkDeleteSettings: (settings) =>
    request('/api/settings/bulk-delete', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }),

  getUniqueCpCodes: () =>
    request('/api/leads/cp-codes'),

  getChannelPartnerReports: () =>
    request('/api/reports/channel-partners')
};
