// Dynamic Base URL resolver for Capacitor vs Web dev proxy
let customBaseUrl = localStorage.getItem('backend_url') || '';

export const getBaseUrl = () => {
  if (customBaseUrl) return customBaseUrl;
  if (window.Capacitor) {
    return 'https://vrindavan-estates-crm-backend.onrender.com'; // Default to Render production cloud backend
  }
  return ''; // Default to proxy
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
    })
};
