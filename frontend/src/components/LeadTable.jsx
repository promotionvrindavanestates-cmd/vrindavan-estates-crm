import React, { useState } from 'react';
import { Phone, MessageSquare, Edit2, Trash2, UserPlus, PhoneCall, Plus, History } from 'lucide-react';

export default function LeadTable({ 
  leads = [], 
  employees = [], 
  currentUser = {}, 
  onAddLead, 
  onEditLead, 
  onDeleteLead, 
  onLogCall,
  onAssignLead,
  onViewHistory
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedBudget, setSelectedBudget] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');

  // Extract unique projects, cities, budgets for dynamic filter dropdowns
  const uniqueProjects = [...new Set(leads.map(l => l.project).filter(Boolean))];
  const uniqueCities = [...new Set(leads.map(l => l.city).filter(Boolean))];
  const uniqueBudgets = [...new Set(leads.map(l => l.budget).filter(Boolean))];

  // Filtering leads client-side to ensure instant results
  const filteredLeads = leads.filter(l => {
    // Search filter
    const term = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      (l.name && l.name.toLowerCase().includes(term)) ||
      (l.phone1 && l.phone1.toLowerCase().includes(term)) ||
      (l.phone2 && l.phone2.toLowerCase().includes(term)) ||
      (l.project && l.project.toLowerCase().includes(term)) ||
      (l.city && l.city.toLowerCase().includes(term)) ||
      (l.assigned_employee && l.assigned_employee.full_name.toLowerCase().includes(term));

    // Filters
    const matchesCity = !selectedCity || (l.city && l.city.toLowerCase() === selectedCity.toLowerCase());
    const matchesBudget = !selectedBudget || (l.budget && l.budget.toLowerCase() === selectedBudget.toLowerCase());
    const matchesProject = !selectedProject || (l.project && l.project.toLowerCase() === selectedProject.toLowerCase());
    const matchesStatus = !selectedStatus || l.status === selectedStatus;
    const matchesEmployee = !selectedEmployee || l.assigned_employee_id === selectedEmployee;

    return matchesSearch && matchesCity && matchesBudget && matchesProject && matchesStatus && matchesEmployee;
  });

  const getStatusBadgeClass = (status) => {
    if (status === 'Hot') return 'badge badge-hot';
    if (status === 'Warm') return 'badge badge-warm';
    return 'badge badge-cold';
  };

  const formatPhoneNumber = (num) => {
    if (!num) return '';
    // Clean and normalize number for WhatsApp
    return num.replace(/\D/g, '');
  };

  const handleWhatsAppClick = (phone, leadName) => {
    const cleanPhone = formatPhoneNumber(phone);
    // Add country code if not present (default to 91 for India as Vrindavan is in India)
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(`Hi ${leadName}, greetings from Vrindavan Estates! We are following up regarding your query. How can we assist you today?`);
    const url = `https://wa.me/${waPhone}?text=${text}`;
    window.open(url, window.Capacitor ? '_system' : '_blank');
  };

  const handleCallClick = (phone, lead) => {
    // 1. Open the tel protocol to trigger dialer (native or VOIP)
    if (window.Capacitor) {
      window.open(`tel:${phone}`, '_system');
    } else {
      window.location.href = `tel:${phone}`;
    }
    // 2. Open Call Logger modal immediately to record outcome
    onLogCall(lead);
  };

  return (
    <div>
      {/* Search and Filters panel */}
      <div class="filter-bar">
        <div class="filter-grid">
          <div class="form-group" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="search">Search Leads</label>
            <input
              id="search"
              type="text"
              class="form-control"
              placeholder="Search by Name, Phone, Project, City..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div class="form-group">
            <label htmlFor="filter-project">Project</label>
            <select
              id="filter-project"
              class="form-control"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">All Projects</option>
              {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div class="form-group">
            <label htmlFor="filter-city">City</label>
            <select
              id="filter-city"
              class="form-control"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              <option value="">All Cities</option>
              {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div class="form-group">
            <label htmlFor="filter-budget">Budget</label>
            <select
              id="filter-budget"
              class="form-control"
              value={selectedBudget}
              onChange={(e) => setSelectedBudget(e.target.value)}
            >
              <option value="">All Budgets</option>
              {uniqueBudgets.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div class="form-group">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              class="form-control"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Hot">Hot</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
            </select>
          </div>

          {currentUser.role === 'admin' && (
            <div class="form-group">
              <label htmlFor="filter-employee">Assigned To</label>
              <select
                id="filter-employee"
                class="form-control"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Leads Table Panel */}
      <div class="table-panel">
        <div class="table-header-row">
          <h3>Leads Directory ({filteredLeads.length})</h3>
          <button class="btn btn-primary" onClick={onAddLead}>
            <Plus size={16} /> Add Lead
          </button>
        </div>

        <div class="table-container">
          {filteredLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              No leads match the filters. Click "Add Lead" to create a new one.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Lead Info</th>
                  <th>Contact Info</th>
                  <th>Budget & Project</th>
                  <th>Requirement & Comments</th>
                  <th>Status</th>
                  <th>Follow Up</th>
                  <th>Assigned To</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(l => (
                  <tr key={l.id}>
                    <td data-label="Lead Info">
                      <div style={{ fontWeight: 600 }}>{l.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>City: {l.city || 'N/A'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '2px' }}>Src: {l.lead_source || 'Website'}</div>
                    </td>
                    
                    <td data-label="Contact Info">
                      <div class="phone-actions">
                        <span>{l.phone1}</span>
                        <button 
                          class="action-icon-btn call" 
                          title="Call Lead"
                          onClick={() => handleCallClick(l.phone1, l)}
                        >
                          <Phone size={12} />
                        </button>
                        <button 
                          class="action-icon-btn whatsapp" 
                          title="WhatsApp Chat"
                          onClick={() => handleWhatsAppClick(l.phone1, l.name)}
                        >
                          <MessageSquare size={12} />
                        </button>
                      </div>
                      
                      {l.phone2 && (
                        <div class="phone-actions" style={{ marginTop: '4px' }}>
                          <span>{l.phone2}</span>
                          <button 
                            class="action-icon-btn call" 
                            title="Call Lead Phone 2"
                            onClick={() => handleCallClick(l.phone2, l)}
                          >
                            <Phone size={12} />
                          </button>
                          <button 
                            class="action-icon-btn whatsapp" 
                            title="WhatsApp Chat Phone 2"
                            onClick={() => handleWhatsAppClick(l.phone2, l.name)}
                          >
                            <MessageSquare size={12} />
                          </button>
                        </div>
                      )}

                      {(l.last_call_date || l.last_response) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                          Last: {l.last_response || 'Call'} ({l.last_call_date ? new Date(l.last_call_date).toLocaleDateString() : 'N/A'})
                        </div>
                      )}
                    </td>
                    
                    <td data-label="Budget & Project">
                      <div style={{ fontWeight: 500 }}>{l.project || 'Unspecified Project'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Budget: {l.budget || 'N/A'}</div>
                    </td>
                    
                    <td data-label="Requirement & Comments" style={{ maxWidth: '280px' }}>
                      <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.requirement}>
                        {l.requirement || <span style={{ color: 'var(--text-muted)' }}>No requirement notes</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.comments}>
                        Comment: {l.comments || 'None'}
                      </div>
                    </td>
                    
                    <td data-label="Status">
                      <span class={getStatusBadgeClass(l.status)}>{l.status}</span>
                      {l.site_visit_status && l.site_visit_status !== 'None' && (
                        <div style={{ marginTop: '4px' }}>
                          <span class="badge badge-info" style={{ fontSize: '9px', padding: '2px 6px' }}>Visit: {l.site_visit_status}</span>
                        </div>
                      )}
                      {l.booking_status && l.booking_status !== 'None' && (
                        <div style={{ marginTop: '4px' }}>
                          <span class="badge badge-success" style={{ fontSize: '9px', padding: '2px 6px' }}>Booked ({l.booking_status})</span>
                        </div>
                      )}
                    </td>
                    
                    <td data-label="Follow Up">
                      {l.follow_up_date ? (
                        <span style={{ 
                          color: l.follow_up_date < new Date().toLocaleDateString('en-CA') && l.booking_status !== 'Confirmed' ? 'var(--color-hot)' : 'inherit',
                          fontWeight: 500
                        }}>
                          {l.follow_up_date}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Not scheduled</span>
                      )}
                    </td>
                    
                    <td data-label="Assigned To">
                      {l.assigned_employee ? (
                        <span>{l.assigned_employee.full_name}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Unassigned</span>
                      )}
                      {currentUser.role === 'admin' && (
                        <button 
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            marginLeft: '6px',
                            verticalAlign: 'middle'
                          }} 
                          title="Reassign Employee"
                          onClick={() => onAssignLead(l)}
                        >
                          <UserPlus size={14} />
                        </button>
                      )}
                    </td>
                    
                    <td data-label="Actions" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button 
                          class="action-icon-btn" 
                          title="View History Trails"
                          onClick={() => onViewHistory(l)}
                        >
                          <History size={14} />
                        </button>
                        <button 
                          class="action-icon-btn" 
                          title="Log Call Response"
                          onClick={() => onLogCall(l)}
                        >
                          <PhoneCall size={14} />
                        </button>
                        <button 
                          class="action-icon-btn" 
                          title="Edit Lead"
                          onClick={() => onEditLead(l)}
                        >
                          <Edit2 size={14} />
                        </button>
                        {currentUser.role === 'admin' && (
                          <button 
                            class="action-icon-btn" 
                            style={{ color: 'var(--color-hot)', borderColor: 'rgba(255,94,94,0.1)' }}
                            title="Delete Lead"
                            onClick={() => onDeleteLead(l.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
