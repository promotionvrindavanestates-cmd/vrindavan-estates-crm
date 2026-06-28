import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Phone, Edit2, Trash2, UserPlus, PhoneCall, Plus, History, Filter, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

export default function LeadTable({ 
  leads = [], 
  employees = [], 
  currentUser = {}, 
  initialFilters = null,
  onClearInitialFilters = () => {},
  onOpenLeadDrawer = () => {},
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
  
  // Advanced filters state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedSource, setSelectedSource] = useState('');
  const [createdStart, setCreatedStart] = useState('');
  const [createdEnd, setCreatedEnd] = useState('');
  const [followupStart, setFollowupStart] = useState('');
  const [followupEnd, setFollowupEnd] = useState('');
  const [siteVisitStart, setSiteVisitStart] = useState('');
  const [siteVisitEnd, setSiteVisitEnd] = useState('');
  const [callsToday, setCallsToday] = useState('');
  const [siteVisitCompleted, setSiteVisitCompleted] = useState('');

  // Server-side Pagination & Query States
  const [leadsState, setLeadsState] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [employeeFilterHeading, setEmployeeFilterHeading] = useState('');

  // Row selection states for bulk assignments
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  
  // Bulk Assignment Modal state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkMethod, setBulkMethod] = useState('Manual'); // Manual, Round Robin, Equal Distribution, Project Wise
  const [bulkTargetEmployee, setBulkTargetEmployee] = useState('');
  const [bulkSelectedEmployees, setBulkSelectedEmployees] = useState([]);
  const [bulkProjectMapping, setBulkProjectMapping] = useState({});
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Phase 9 Bulk Delete & Trash Bin States
  const [showTrash, setShowTrash] = useState(false);
  const [bulkProgressOpen, setBulkProgressOpen] = useState(false);
  const [bulkProgressCurrent, setBulkProgressCurrent] = useState(0);
  const [bulkProgressTotal, setBulkProgressTotal] = useState(0);
  const [bulkReport, setBulkReport] = useState(null);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmTypedText, setDeleteConfirmTypedText] = useState('');
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);
  
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [selectedBulkStatus, setSelectedBulkStatus] = useState('');

  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const [selectedBulkPriority, setSelectedBulkPriority] = useState('');

  // Click-to-WhatsApp Assistant States
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [activeWhatsAppLead, setActiveWhatsAppLead] = useState(null);
  const [activeWhatsAppPhone, setActiveWhatsAppPhone] = useState('');
  const [whatsAppTemplates, setWhatsAppTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customWhatsAppText, setCustomWhatsAppText] = useState('');

  // Extract unique projects, cities, budgets for dynamic filter dropdowns
  const uniqueProjects = [...new Set(leads.map(l => l.project).filter(Boolean))];
  const uniqueCities = [...new Set(leads.map(l => l.city).filter(Boolean))];
  const uniqueBudgets = [...new Set(leads.map(l => l.budget).filter(Boolean))];
  const uniqueSources = ['Facebook', 'Instagram', 'Google', 'Website', 'WhatsApp', 'Walk-In', 'Referral', 'MagicBricks', '99acres', 'Housing'];

  // Fetch leads dynamically from backend server
  // Handle initial filters passed from Dashboard drill-down
  useEffect(() => {
    if (initialFilters) {
      // Clear out general filter fields
      setSearchTerm('');
      setSelectedCity('');
      setSelectedBudget('');
      setSelectedProject('');
      setSelectedEmployee('');
      setSelectedSource('');
      setCreatedStart('');
      setCreatedEnd('');
      setFollowupStart('');
      setFollowupEnd('');
      setSiteVisitStart('');
      setSiteVisitEnd('');

      // Set target fields
      const targetStatus = initialFilters.status || '';
      const targetCallsToday = initialFilters.calls_today || '';
      const targetSiteVisitCompleted = initialFilters.site_visit_completed || '';
      const targetCreatedStart = initialFilters.created_start || '';
      const targetCreatedEnd = initialFilters.created_end || '';
      const targetSource = initialFilters.source || '';

      setSelectedStatus(targetStatus);
      setCallsToday(targetCallsToday);
      setSiteVisitCompleted(targetSiteVisitCompleted);
      setCreatedStart(targetCreatedStart);
      setCreatedEnd(targetCreatedEnd);
      setSelectedSource(targetSource);

      if (initialFilters.assigned_employee_id) {
        setSelectedEmployee(initialFilters.assigned_employee_id);
        const name = initialFilters.employee_name || 'Executive';
        const count = initialFilters.leads_count || 0;
        let suffix = '';
        if (targetStatus === 'Booked') {
          suffix = ' - Bookings';
        } else if (targetCallsToday === 'true') {
          suffix = ' - Calls Today';
        } else if (targetSiteVisitCompleted === 'true') {
          suffix = ' - Site Visits';
        }
        setEmployeeFilterHeading(`Showing Leads Assigned To: ${name}${suffix} (${count} Leads)`);
      } else if (targetSource) {
        setEmployeeFilterHeading(`Showing Leads from Source: ${targetSource}`);
      } else if (initialFilters.created_start || initialFilters.created_end) {
        setEmployeeFilterHeading(`Showing Leads Created: ${initialFilters.created_start || 'Start'} to ${initialFilters.created_end || 'End'}`);
      } else {
        setEmployeeFilterHeading('');
      }

      // If either advanced filter is activated, open the advanced section
      if (targetCallsToday || targetSiteVisitCompleted || targetSource) {
        setShowAdvanced(true);
      }

      setCurrentPage(1);
      onClearInitialFilters();
    }
  }, [initialFilters, onClearInitialFilters]);

  // Fetch leads dynamically from backend server
  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const data = await api.getLeads({
        search: searchTerm,
        city: selectedCity,
        budget: selectedBudget,
        project: selectedProject,
        status: selectedStatus,
        assigned_employee_id: selectedEmployee,
        source: selectedSource,
        created_start: createdStart,
        created_end: createdEnd,
        calls_today: callsToday,
        site_visit_completed: siteVisitCompleted,
        page: currentPage,
        limit: limit,
        trash: showTrash
      });

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setLeadsState(data.leads || []);
        setTotalCount(data.total || 0);
        setTotalPages(data.pages || 1);
      } else {
        const arr = data || [];
        setLeadsState(arr);
        setTotalCount(arr.length);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Reset page to 1 when search terms or filters are updated
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedCity,
    selectedBudget,
    selectedProject,
    selectedStatus,
    selectedEmployee,
    selectedSource,
    createdStart,
    createdEnd,
    callsToday,
    siteVisitCompleted,
    limit,
    showTrash
  ]);

  // Load leads whenever pagination or filters change
  useEffect(() => {
    fetchLeads();
  }, [
    searchTerm,
    selectedCity,
    selectedBudget,
    selectedProject,
    selectedStatus,
    selectedEmployee,
    selectedSource,
    createdStart,
    createdEnd,
    callsToday,
    siteVisitCompleted,
    currentPage,
    limit,
    leads.length,
    showTrash
  ]);

  // Server-side filtered and paginated leads
  const filteredLeads = leadsState;

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'New': return 'badge badge-cold';
      case 'Attempted': return 'badge badge-cold';
      case 'Connected': return 'badge badge-warm';
      case 'Interested': return 'badge badge-hot';
      case 'Hot': return 'badge badge-hot';
      case 'Warm': return 'badge badge-warm';
      case 'Cold': return 'badge badge-cold';
      case 'Site Visit Scheduled': return 'badge badge-warm';
      case 'Site Visit Done': return 'badge badge-warm';
      case 'Negotiation': return 'badge badge-hot';
      case 'Booked': return 'badge badge-success';
      case 'Lost': return 'badge badge-cold';
      default: return 'badge badge-cold';
    }
  };

  const formatPhoneNumber = (num) => {
    if (!num) return '';
    return num.replace(/\D/g, '');
  };

  // Load WhatsApp templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const list = await api.getWhatsAppTemplates();
        setWhatsAppTemplates(list || []);
        if (list && list.length > 0) {
          setSelectedTemplateId(list[0].id);
        }
      } catch (err) {
        console.warn('Failed to load templates in LeadTable:', err);
      }
    };
    fetchTemplates();
  }, []);

  const handleWhatsAppClick = (phone, lead) => {
    setActiveWhatsAppLead(lead);
    setActiveWhatsAppPhone(phone);
    setWhatsAppModalOpen(true);
    setCustomWhatsAppText('');
  };

  const getInterpolatedWhatsAppMessage = () => {
    if (!activeWhatsAppLead) return '';
    
    const template = whatsAppTemplates.find(t => t.id === selectedTemplateId);
    if (!template) return customWhatsAppText || 'Hi, greetings from Vrindavan Estates!';
    
    let text = template.body_text;
    text = text.replace(/{customer_name}/gi, activeWhatsAppLead.name || '');
    text = text.replace(/{project_name}/gi, activeWhatsAppLead.project || 'Vrindavan Estates');
    text = text.replace(/{price}/gi, activeWhatsAppLead.budget || 'N/A');
    text = text.replace(/{location}/gi, activeWhatsAppLead.city || 'Vrindavan');
    text = text.replace(/{executive_name}/gi, currentUser.full_name || 'Our Executive');
    text = text.replace(/{unit_number}/gi, activeWhatsAppLead.unit_number || 'your unit');
    text = text.replace(/{token_amount}/gi, activeWhatsAppLead.booking_token_amount || 'token amount');
    
    return text;
  };

  const handleSendWhatsAppMessage = async () => {
    if (!activeWhatsAppLead) return;
    
    const messageText = getInterpolatedWhatsAppMessage();
    const cleanPhone = formatPhoneNumber(activeWhatsAppPhone);
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(messageText)}`;
    
    try {
      await api.logWhatsAppActivity({ leadId: activeWhatsAppLead.id, actionType: 'WhatsApp Opened' });
      await api.logWhatsAppClick(activeWhatsAppLead.id, activeWhatsAppPhone, messageText);
    } catch (err) {
      console.warn('Failed to log WhatsApp campaign click:', err);
    }
    
    window.open(url, window.Capacitor ? '_system' : '_blank');
    setWhatsAppModalOpen(false);
    setActiveWhatsAppLead(null);
  };

  const handleCallClick = (phone, lead) => {
    if (window.Capacitor) {
      window.open(`tel:${phone}`, '_system');
    } else {
      window.location.href = `tel:${phone}`;
    }
    onLogCall(lead);
  };

  // Checkbox Selection Helpers
  const handleToggleSelectAll = () => {
    const allPageIdsSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.includes(l.id));
    if (allPageIdsSelected) {
      const pageIds = filteredLeads.map(l => l.id);
      setSelectedLeadIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      const pageIds = filteredLeads.map(l => l.id);
      setSelectedLeadIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = async () => {
    setLoadingLeads(true);
    try {
      const data = await api.getLeads({
        search: searchTerm,
        city: selectedCity,
        budget: selectedBudget,
        project: selectedProject,
        status: selectedStatus,
        assigned_employee_id: selectedEmployee,
        source: selectedSource,
        created_start: createdStart,
        created_end: createdEnd,
        calls_today: callsToday,
        site_visit_completed: siteVisitCompleted,
        limit: 999999,
        trash: showTrash
      });
      const list = data && data.leads ? data.leads : (Array.isArray(data) ? data : []);
      setSelectedLeadIds(list.map(l => l.id));
    } catch (err) {
      console.error('Failed to select all filtered leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleBulkDeleteTrigger = (permanent = false) => {
    setIsPermanentDelete(permanent);
    setDeleteConfirmTypedText('');
    setDeleteConfirmOpen(true);
  };

  const handleExecuteBulkDelete = async () => {
    if (deleteConfirmTypedText !== 'DELETE') return;
    setDeleteConfirmOpen(false);
    
    setBulkProgressTotal(selectedLeadIds.length);
    setBulkProgressCurrent(0);
    setBulkProgressOpen(true);
    
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    
    try {
      const res = await api.deleteLeadsBulk(selectedLeadIds, isPermanentDelete);
      success = res.deleted || 0;
      failed = res.failed || 0;
      setBulkProgressCurrent(selectedLeadIds.length);
    } catch (err) {
      console.error('Bulk deletion call failed:', err);
      failed = selectedLeadIds.length;
    }
    
    const elapsed = Date.now() - startTime;
    setBulkReport({
      success,
      failed,
      time: `${(elapsed / 1000).toFixed(2)}s`
    });
  };

  const handleExecuteBulkRestore = async () => {
    setBulkProgressTotal(selectedLeadIds.length);
    setBulkProgressCurrent(0);
    setBulkProgressOpen(true);
    
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    
    try {
      const res = await api.restoreLeadsBulk(selectedLeadIds);
      success = res.restored || 0;
      failed = res.failed || 0;
      setBulkProgressCurrent(selectedLeadIds.length);
    } catch (err) {
      console.error('Bulk restoration call failed:', err);
      failed = selectedLeadIds.length;
    }
    
    const elapsed = Date.now() - startTime;
    setBulkReport({
      success,
      failed,
      time: `${(elapsed / 1000).toFixed(2)}s`
    });
  };

  const handleExecuteBulkStatus = async () => {
    setBulkStatusOpen(false);
    setBulkProgressTotal(selectedLeadIds.length);
    setBulkProgressCurrent(0);
    setBulkProgressOpen(true);
    
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    
    try {
      const res = await api.updateLeadsStatusBulk(selectedLeadIds, selectedBulkStatus);
      success = res.updated || 0;
      failed = res.failed || 0;
      setBulkProgressCurrent(selectedLeadIds.length);
    } catch (err) {
      console.error('Bulk status update call failed:', err);
      failed = selectedLeadIds.length;
    }
    
    const elapsed = Date.now() - startTime;
    setBulkReport({
      success,
      failed,
      time: `${(elapsed / 1000).toFixed(2)}s`
    });
    setSelectedBulkStatus('');
  };

  const handleExecuteBulkPriority = async () => {
    setBulkPriorityOpen(false);
    setBulkProgressTotal(selectedLeadIds.length);
    setBulkProgressCurrent(0);
    setBulkProgressOpen(true);
    
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    
    try {
      const res = await api.updateLeadsStatusBulk(selectedLeadIds, selectedBulkPriority);
      success = res.updated || 0;
      failed = res.failed || 0;
      setBulkProgressCurrent(selectedLeadIds.length);
    } catch (err) {
      console.error('Bulk priority update call failed:', err);
      failed = selectedLeadIds.length;
    }
    
    const elapsed = Date.now() - startTime;
    setBulkReport({
      success,
      failed,
      time: `${(elapsed / 1000).toFixed(2)}s`
    });
    setSelectedBulkPriority('');
  };

  const handleBulkExport = async () => {
    try {
      const selectedLeads = leadsState.filter(l => selectedLeadIds.includes(l.id));
      if (selectedLeads.length === 0) return;
      
      const headers = ['Name', 'Phone1', 'Phone2', 'Project', 'Budget', 'City', 'Status', 'Lead Source', 'Created At'];
      const rows = selectedLeads.map(l => [
        l.name || '',
        l.phone1 || '',
        l.phone2 || '',
        l.project || '',
        l.budget || '',
        l.city || '',
        l.status || '',
        l.lead_source || '',
        l.created_at || ''
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `selected_leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to export leads: ' + err.message);
    }
  };

  // Bulk Assignment Submission
  const handleExecuteBulkAssign = async () => {
    if (selectedLeadIds.length === 0) return;
    
    // Validations
    if (bulkMethod === 'Manual' && !bulkTargetEmployee) {
      alert('Please select a target employee.');
      return;
    }
    if ((bulkMethod === 'Round Robin' || bulkMethod === 'Equal Distribution') && bulkSelectedEmployees.length === 0) {
      alert('Please select at least one employee to distribute to.');
      return;
    }

    setBulkAssigning(true);
    try {
      const config = {};
      if (bulkMethod === 'Round Robin' || bulkMethod === 'Equal Distribution') {
        config.employeeIds = bulkSelectedEmployees;
      }
      if (bulkMethod === 'Project Wise') {
        config.projectMapping = bulkProjectMapping;
      }

      const res = await api.bulkAssignLeads(
        selectedLeadIds,
        bulkMethod === 'Manual' ? bulkTargetEmployee : null,
        bulkMethod,
        config
      );
      
      alert(res.message || 'Leads successfully assigned.');
      setSelectedLeadIds([]);
      setBulkModalOpen(false);
      
      // Force refresh CRM data
      if (window.location) window.location.reload();
    } catch (err) {
      alert(`Bulk assign failed: ${err.message}`);
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleSelectBulkEmployee = (empId) => {
    setBulkSelectedEmployees(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const handleProjectMapChange = (projectName, empId) => {
    setBulkProjectMapping(prev => ({
      ...prev,
      [projectName]: empId
    }));
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
              <option value="New">New</option>
              <option value="Attempted">Attempted</option>
              <option value="Connected">Connected</option>
              <option value="Interested">Interested</option>
              <option value="Hot">Hot</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
              <option value="Site Visit Scheduled">Site Visit Scheduled</option>
              <option value="Site Visit Done">Site Visit Done</option>
              <option value="Negotiation">Negotiation</option>
              <option value="Booked">Booked</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          {currentUser.role === 'admin' && (
            <div class="form-group">
              <label htmlFor="filter-employee">Assigned To</label>
              <select
                id="filter-employee"
                class="form-control"
                value={selectedEmployee}
                onChange={(e) => {
                  setSelectedEmployee(e.target.value);
                  setEmployeeFilterHeading('');
                }}
              >
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Toggle Advanced Filters */}
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            type="button" 
            class="btn btn-secondary" 
            style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Filter size={12} /> {showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          
          <button 
            type="button" 
            class="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => {
              setSearchTerm('');
              setSelectedCity('');
              setSelectedBudget('');
              setSelectedProject('');
              setSelectedStatus('');
              setSelectedEmployee('');
              setSelectedSource('');
              setCreatedStart('');
              setCreatedEnd('');
              setFollowupStart('');
              setFollowupEnd('');
              setSiteVisitStart('');
              setSiteVisitEnd('');
              setCallsToday('');
              setSiteVisitCompleted('');
              setEmployeeFilterHeading('');
            }}
          >
            Reset All Filters
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div class="form-group">
              <label>Lead Source</label>
              <select class="form-control" value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
                <option value="">All Sources</option>
                {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <div class="form-group">
              <label>Created From</label>
              <input type="date" class="form-control" value={createdStart} onChange={(e) => setCreatedStart(e.target.value)} />
            </div>
            <div class="form-group">
              <label>Created To</label>
              <input type="date" class="form-control" value={createdEnd} onChange={(e) => setCreatedEnd(e.target.value)} />
            </div>

            <div class="form-group">
              <label>Follow-up From</label>
              <input type="date" class="form-control" value={followupStart} onChange={(e) => setFollowupStart(e.target.value)} />
            </div>
            <div class="form-group">
              <label>Follow-up To</label>
              <input type="date" class="form-control" value={followupEnd} onChange={(e) => setFollowupEnd(e.target.value)} />
            </div>

            <div class="form-group">
              <label>Site Visit From</label>
              <input type="date" class="form-control" value={siteVisitStart} onChange={(e) => setSiteVisitStart(e.target.value)} />
            </div>
            <div class="form-group">
              <label>Site Visit To</label>
              <input type="date" class="form-control" value={siteVisitEnd} onChange={(e) => setSiteVisitEnd(e.target.value)} />
            </div>

            <div class="form-group">
              <label>Calls Logged Today</label>
              <select class="form-control" value={callsToday} onChange={(e) => setCallsToday(e.target.value)}>
                <option value="">All Leads</option>
                <option value="true">Calls Logged Today Only</option>
              </select>
            </div>

            <div class="form-group">
              <label>Site Visit Status</label>
              <select class="form-control" value={siteVisitCompleted} onChange={(e) => setSiteVisitCompleted(e.target.value)}>
                <option value="">All Leads</option>
                <option value="true">Completed Visits Only</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Leads Table Panel */}
      <div class="table-panel">
        {/* Selection Banner */}
        {selectedLeadIds.length > 0 && selectedLeadIds.length < totalCount && (
          <div style={{
            background: 'rgba(212, 175, 55, 0.08)',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px'
          }}>
            <span>
              Selected <strong>{selectedLeadIds.length}</strong> leads on this page.
            </span>
            <button 
              type="button"
              className="btn btn-primary"
              style={{ padding: '4px 10px', fontSize: '11px' }}
              onClick={handleSelectAllFiltered}
              disabled={loadingLeads}
            >
              Select all {totalCount} matching leads
            </button>
          </div>
        )}

        <div class="table-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h3>{showTrash ? `Trash Bin (${totalCount})` : (employeeFilterHeading || `Leads Directory (${totalCount})`)}</h3>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {currentUser.role === 'admin' && (
              <button 
                type="button"
                className={`btn ${showTrash ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: showTrash ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: showTrash ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.06)',
                  color: showTrash ? '#ef4444' : 'var(--text-muted)'
                }}
                onClick={() => {
                  const targetTrash = !showTrash;
                  setShowTrash(targetTrash);
                  setSelectedLeadIds([]);
                  setCurrentPage(1);
                }}
              >
                🗑️ {showTrash ? 'View Active Leads' : 'View Trash Bin'}
              </button>
            )}
            <button class="btn btn-primary" onClick={onAddLead}>
              <Plus size={16} /> Add Lead
            </button>
          </div>
        </div>

        <div class="table-container">
          {filteredLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              No leads match the filters. {showTrash ? 'Trash bin is empty.' : 'Click "Add Lead" to create a new one.'}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  {currentUser.role === 'admin' && (
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                        onClick={handleToggleSelectAll}
                      >
                        {filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.includes(l.id)) ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                  )}
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
                {filteredLeads.map(l => {
                  const isRowSelected = selectedLeadIds.includes(l.id);
                  return (
                    <tr key={l.id} style={{ background: isRowSelected ? 'rgba(219, 178, 93, 0.05)' : 'inherit' }}>
                      {currentUser.role === 'admin' && (
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            type="button" 
                            style={{ background: 'none', border: 'none', color: isRowSelected ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                            onClick={() => handleToggleSelectRow(l.id)}
                          >
                            {isRowSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                        </td>
                      )}
                      
                      <td data-label="Lead Info">
                        <div 
                          style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
                          onClick={() => onOpenLeadDrawer && onOpenLeadDrawer(l.id)}
                          title="Click to view details side drawer"
                        >
                          {l.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>City: {l.city || 'N/A'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '2px' }}>Src: {l.lead_source || 'Website'}</div>
                      </td>
                      
                      <td data-label="Contact Info">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div><strong>P1:</strong> {l.phone1}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                            <button 
                              className="call-action-btn" 
                              onClick={() => handleCallClick(l.phone1, l)}
                              title="Call Lead"
                            >
                              📞 Call
                            </button>
                            <button 
                              className="whatsapp-action-btn" 
                              onClick={() => handleWhatsAppClick(l.phone1, l)}
                              title="WhatsApp Customer"
                            >
                              <FaWhatsapp size={14} /> WhatsApp
                            </button>
                            <button 
                              className="open-action-btn" 
                              onClick={() => onOpenLeadDrawer && onOpenLeadDrawer(l.id)}
                              title="Open Lead"
                            >
                              👁 Open
                            </button>
                          </div>
                          
                          {l.phone2 && (
                            <>
                              <div style={{ marginTop: '4px' }}><strong>P2:</strong> {l.phone2}</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                <button 
                                  className="call-action-btn" 
                                  onClick={() => handleCallClick(l.phone2, l)}
                                  title="Call Lead Phone 2"
                                >
                                  📞 Call
                                </button>
                                <button 
                                  className="whatsapp-action-btn" 
                                  onClick={() => handleWhatsAppClick(l.phone2, l)}
                                  title="WhatsApp Customer Phone 2"
                                >
                                  <FaWhatsapp size={14} /> WhatsApp
                                </button>
                              </div>
                            </>
                          )}
                        </div>

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
                          {!showTrash ? (
                            <>
                              <button 
                                class="action-icon-btn" 
                                title="WhatsApp Customer"
                                onClick={() => handleWhatsAppClick(l.phone1 || l.phone2 || '', l)}
                              >
                                <FaWhatsapp size={14} style={{ color: '#25D366' }} />
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
                                  title="Move to Trash"
                                  onClick={async () => {
                                    if (confirm('Are you sure you want to move this lead to the Trash Bin?')) {
                                      await api.deleteLeadsBulk([l.id], false);
                                      fetchLeads();
                                    }
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button 
                                class="action-icon-btn" 
                                title="Restore Lead"
                                style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.15)', background: 'none' }}
                                onClick={async () => {
                                  await api.restoreLeadsBulk([l.id]);
                                  fetchLeads();
                                }}
                              >
                                ♻️
                              </button>
                              <button 
                                class="action-icon-btn" 
                                title="Delete Permanently"
                                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.15)', background: 'none' }}
                                onClick={() => {
                                  setSelectedLeadIds([l.id]);
                                  setIsPermanentDelete(true);
                                  setDeleteConfirmTypedText('');
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                💀
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          {loadingLeads && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              Loading leads from database...
            </div>
          )}
        </div>

        {/* Server-side Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            marginTop: '16px',
            border: '1px solid var(--border-color)',
            fontSize: '13px',
            color: 'var(--text-muted)'
          }}>
            <div>
              Showing <strong style={{ color: 'var(--text-main)' }}>{Math.min((currentPage - 1) * limit + 1, totalCount)}</strong> to{' '}
              <strong style={{ color: 'var(--text-main)' }}>{Math.min(currentPage * limit, totalCount)}</strong> of{' '}
              <strong style={{ color: 'var(--text-main)' }}>{totalCount}</strong> leads
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                class="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px', border: '1px solid var(--border-color)' }}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>
                Page <strong style={{ color: 'var(--text-main)' }}>{currentPage}</strong> of{' '}
                <strong style={{ color: 'var(--text-main)' }}>{totalPages}</strong>
              </span>
              <button
                class="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px', border: '1px solid var(--border-color)' }}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Assignment Modal */}
      {bulkModalOpen && (
        <div class="modal-overlay">
          <div class="modal-content" style={{ maxWidth: '540px' }}>
            <div class="modal-header">
              <h2>Bulk Assignment Wizard ({selectedLeadIds.length} Leads Selected)</h2>
              <button class="close-btn" onClick={() => setBulkModalOpen(false)}>×</button>
            </div>
            
            <div class="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div class="form-group">
                <label>Allocation Methodology</label>
                <select class="form-control" value={bulkMethod} onChange={(e) => setBulkMethod(e.target.value)}>
                  <option value="Manual">Manual Assignment (Single Target)</option>
                  <option value="Round Robin">Round Robin Distribution</option>
                  <option value="Equal Distribution">Equal Distribution</option>
                  <option value="Project Wise">Project-Wise Allocation</option>
                </select>
              </div>

              {/* Manual Assignment Options */}
              {bulkMethod === 'Manual' && (
                <div class="form-group">
                  <label>Target Executive</label>
                  <select 
                    class="form-control" 
                    value={bulkTargetEmployee} 
                    onChange={(e) => setBulkTargetEmployee(e.target.value)}
                  >
                    <option value="">-- Select Target Employee --</option>
                    {employees.filter(e => e.status === 'active').map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Round Robin & Equal Distribution Options */}
              {(bulkMethod === 'Round Robin' || bulkMethod === 'Equal Distribution') && (
                <div class="form-group">
                  <label style={{ marginBottom: '8px', display: 'block' }}>Select Executives to Include</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-main)', padding: '12px', borderRadius: 'var(--radius-md)', maxHeight: '180px', overflowY: 'auto' }}>
                    {employees.filter(e => e.status === 'active').map(emp => (
                      <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input 
                          type="checkbox"
                          checked={bulkSelectedEmployees.includes(emp.id)}
                          onChange={() => handleSelectBulkEmployee(emp.id)}
                        />
                        <span>{emp.full_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Project Wise Options */}
              {bulkMethod === 'Project Wise' && (
                <div class="form-group">
                  <label style={{ marginBottom: '8px', display: 'block' }}>Map Executives to Projects</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-main)', padding: '12px', borderRadius: 'var(--radius-md)', maxHeight: '220px', overflowY: 'auto' }}>
                    {uniqueProjects.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No projects defined in lead database.</span>
                    ) : (
                      uniqueProjects.map(proj => (
                        <div key={proj} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{proj}</span>
                          <select 
                            class="form-control"
                            style={{ fontSize: '12px', padding: '4px' }}
                            value={bulkProjectMapping[proj] || ''}
                            onChange={(e) => handleProjectMapChange(proj, e.target.value)}
                          >
                            <option value="">-- Skip / Leave Unassigned --</option>
                            {employees.filter(e => e.status === 'active').map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                            ))}
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div class="modal-footer" style={{ display: 'flex', justifySelf: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button class="btn btn-secondary" onClick={() => setBulkModalOpen(false)}>Cancel</button>
              <button 
                class="btn btn-primary" 
                onClick={handleExecuteBulkAssign}
                disabled={bulkAssigning}
              >
                {bulkAssigning ? 'Reassigning...' : `Execute Assignment (${selectedLeadIds.length} Leads)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click-to-WhatsApp Assistant Modal */}
      {whatsAppModalOpen && activeWhatsAppLead && (
        <div class="modal-overlay">
          <div class="modal-content" style={{ maxWidth: '540px' }}>
            <div class="modal-header">
              <h2>💬 Click-to-WhatsApp Assistant</h2>
              <button class="close-btn" onClick={() => { setWhatsAppModalOpen(false); setActiveWhatsAppLead(null); }}>×</button>
            </div>
            <div class="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ fontSize: '13px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                Sending to: <strong style={{ color: 'var(--primary)' }}>{activeWhatsAppLead.name}</strong> ({activeWhatsAppPhone})
              </div>
              
              <div class="form-group">
                <label>Select Message Template</label>
                <select 
                  class="form-control" 
                  value={selectedTemplateId} 
                  onChange={e => {
                    setSelectedTemplateId(e.target.value);
                    if (e.target.value === 'custom') setCustomWhatsAppText('');
                  }}
                >
                  {whatsAppTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                  ))}
                  <option value="custom">-- Custom Free-form Message --</option>
                </select>
              </div>
              
              {selectedTemplateId === 'custom' ? (
                <div class="form-group">
                  <label>Custom Message Text</label>
                  <textarea 
                    class="form-control" 
                    rows="4" 
                    value={customWhatsAppText} 
                    onChange={e => setCustomWhatsAppText(e.target.value)} 
                    placeholder="Type your WhatsApp message here..."
                  />
                </div>
              ) : (
                <div class="form-group">
                  <label>Message Preview (Auto-filled Variables)</label>
                  <div style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    padding: '12px', 
                    borderRadius: 'var(--radius-md)', 
                    fontSize: '13px', 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace',
                    lineHeight: '1.4',
                    border: '1px solid var(--border-color)',
                    minHeight: '80px'
                  }}>
                    {getInterpolatedWhatsAppMessage()}
                  </div>
                </div>
              )}
            </div>
            <div class="modal-footer" style={{ display: 'flex', justifySelf: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button class="btn btn-secondary" onClick={() => { setWhatsAppModalOpen(false); setActiveWhatsAppLead(null); }}>Cancel</button>
              <button class="btn btn-primary" onClick={handleSendWhatsAppMessage}>
                🚀 Open WhatsApp & Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bulk Action Toolbar */}
      {selectedLeadIds.length > 0 && currentUser.role === 'admin' && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(5, 8, 15, 0.95)',
          border: '1.5px solid #D4AF37',
          boxShadow: '0 0 25px rgba(212, 175, 55, 0.35), 0 20px 40px rgba(0, 0, 0, 0.8)',
          borderRadius: '16px',
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          backdropFilter: 'blur(16px)',
          animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <style>{`
            @keyframes slideUp {
              from { transform: translate(-50%, 100px); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
          `}</style>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#D4AF37', whiteSpace: 'nowrap' }}>
              Selected: {selectedLeadIds.length} Leads
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Bulk Action Console
            </span>
          </div>

          <div style={{ height: '32px', width: '1px', background: 'rgba(212, 175, 55, 0.25)' }}></div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {!showTrash ? (
              <>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12px', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#ef4444', background: 'none' }}
                  onClick={() => handleBulkDeleteTrigger(false)}
                >
                  🗑️ Move to Trash
                </button>

                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12px' }}
                  onClick={() => {
                    const defaults = {};
                    uniqueProjects.forEach(p => { defaults[p] = ''; });
                    setBulkProjectMapping(defaults);
                    setBulkSelectedEmployees(employees.filter(e => e.status === 'active').map(e => e.id));
                    setBulkModalOpen(true);
                  }}
                >
                  👤 Assign Employee
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12px', background: 'none' }}
                  onClick={() => setBulkStatusOpen(true)}
                >
                  🏷️ Change Status
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12px', background: 'none' }}
                  onClick={() => setBulkPriorityOpen(true)}
                >
                  ⭐ Change Priority
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12px', background: 'none' }}
                  onClick={handleBulkExport}
                >
                  📤 Export Selected
                </button>
              </>
            ) : (
              <>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12px', background: '#10b981', borderColor: '#10b981', color: '#05080f' }}
                  onClick={handleExecuteBulkRestore}
                >
                  ♻️ Restore Selected
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12px', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#ef4444', background: 'none' }}
                  onClick={() => handleBulkDeleteTrigger(true)}
                >
                  💀 Delete Permanently
                </button>
              </>
            )}

            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ padding: '8px 12px', fontSize: '12px', background: 'none' }}
              onClick={() => setSelectedLeadIds([])}
            >
              ❌ Clear
            </button>
          </div>
        </div>
      )}

      {/* Double Confirmation Modal */}
      {deleteConfirmOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div className="glass-card" style={{ padding: '28px', width: '90%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(239,68,68,0.35)', boxShadow: '0 0 30px rgba(239,68,68,0.2)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '12px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ Confirm Bulk Deletion
            </h3>
            
            <p style={{ fontSize: '14px', color: '#f1f5f9', margin: 0, lineHeight: 1.5 }}>
              You are about to delete <strong>{selectedLeadIds.length}</strong> lead(s). 
              {isPermanentDelete ? (
                <span style={{ color: '#ef4444', display: 'block', marginTop: '6px', fontWeight: 600 }}>
                  This action is permanent and CANNOT be undone. All associated reminders, timeline history, bookings, and payments will be deleted.
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                  Leads will be moved to the Trash Bin and can be restored within 30 days.
                </span>
              )}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Type <span style={{ color: '#ef4444', fontWeight: 'bold' }}>DELETE</span> to confirm:
              </label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Type DELETE here..."
                value={deleteConfirmTypedText}
                onChange={(e) => setDeleteConfirmTypedText(e.target.value)}
                style={{ background: 'rgba(5, 8, 15, 0.6)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '10px', color: '#f1f5f9' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmTypedText(''); }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'none' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleExecuteBulkDelete}
                disabled={deleteConfirmTypedText !== 'DELETE'}
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: '8px', 
                  background: deleteConfirmTypedText === 'DELETE' ? '#ef4444' : 'rgba(239,68,68,0.2)', 
                  color: deleteConfirmTypedText === 'DELETE' ? '#ffffff' : 'rgba(255,255,255,0.3)', 
                  border: 'none', 
                  fontWeight: 600, 
                  cursor: deleteConfirmTypedText === 'DELETE' ? 'pointer' : 'not-allowed'
                }}
              >
                {isPermanentDelete ? 'Delete Permanently' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Progress Modal */}
      {bulkProgressOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001 }}>
          <div className="glass-card" style={{ padding: '32px', width: '90%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', border: '1px solid rgba(212,175,55,0.2)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#D4AF37', margin: 0 }}>
              {bulkProgressCurrent < bulkProgressTotal ? 'Processing Bulk Action...' : 'Bulk Action Completed!'}
            </h3>
            
            <div style={{ fontSize: '14px', color: '#f1f5f9' }}>
              {bulkProgressCurrent} of {bulkProgressTotal} leads processed.
            </div>

            <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', width: '100%', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <div style={{ 
                height: '100%', 
                background: 'var(--primary)', 
                width: `${(bulkProgressCurrent / bulkProgressTotal) * 100}%`, 
                borderRadius: '4px', 
                transition: 'width 0.3s ease' 
              }}></div>
            </div>

            {bulkProgressCurrent === bulkProgressTotal && bulkReport && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212, 175, 55, 0.15)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#D4AF37', margin: '0 0 6px 0' }}>Execution Report</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Successful Operations:</span>
                  <strong style={{ color: 'var(--color-success)' }}>{bulkReport.success}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Failed Operations:</span>
                  <strong style={{ color: 'var(--color-hot)' }}>{bulkReport.failed}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Execution Elapsed Time:</span>
                  <strong style={{ color: '#f1f5f9' }}>{bulkReport.time}</strong>
                </div>
              </div>
            )}

            {bulkProgressCurrent === bulkProgressTotal && (
              <button 
                className="btn btn-primary"
                onClick={() => { setBulkProgressOpen(false); setSelectedLeadIds([]); setBulkReport(null); fetchLeads(); }}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#D4AF37', color: '#05080F', border: 'none', fontWeight: 600, cursor: 'pointer', marginTop: '10px' }}
              >
                Close & Refresh
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Status Change Modal */}
      {bulkStatusOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div className="glass-card" style={{ padding: '28px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(212,175,55,0.2)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#D4AF37', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', paddingBottom: '10px', margin: 0 }}>
              Bulk Change Status
            </h3>
            
            <div class="form-group">
              <label style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Select New Status</label>
              <select 
                className="form-control"
                value={selectedBulkStatus}
                onChange={(e) => setSelectedBulkStatus(e.target.value)}
                style={{ width: '100%', background: 'rgba(5, 8, 15, 0.6)', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '8px', padding: '10px', color: '#f1f5f9' }}
              >
                <option value="">Choose status...</option>
                <option value="New">New</option>
                <option value="Attempted">Attempted</option>
                <option value="Connected">Connected</option>
                <option value="Interested">Interested</option>
                <option value="Site Visit Scheduled">Site Visit Scheduled</option>
                <option value="Site Visit Done">Site Visit Done</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Booked">Booked</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setBulkStatusOpen(false); setSelectedBulkStatus(''); }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'none' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleExecuteBulkStatus}
                disabled={!selectedBulkStatus}
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#D4AF37', color: '#05080F', border: 'none', fontWeight: 600, cursor: selectedBulkStatus ? 'pointer' : 'not-allowed' }}
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Priority Change Modal */}
      {bulkPriorityOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div className="glass-card" style={{ padding: '28px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(212,175,55,0.2)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#D4AF37', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', paddingBottom: '10px', margin: 0 }}>
              Bulk Change Priority
            </h3>
            
            <div class="form-group">
              <label style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Select New Priority</label>
              <select 
                className="form-control"
                value={selectedBulkPriority}
                onChange={(e) => setSelectedBulkPriority(e.target.value)}
                style={{ width: '100%', background: 'rgba(5, 8, 15, 0.6)', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '8px', padding: '10px', color: '#f1f5f9' }}
              >
                <option value="">Choose priority...</option>
                <option value="Hot">🔥 Hot</option>
                <option value="Warm">🟡 Warm</option>
                <option value="Cold">⚪ Cold</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setBulkPriorityOpen(false); setSelectedBulkPriority(''); }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'none' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleExecuteBulkPriority}
                disabled={!selectedBulkPriority}
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#D4AF37', color: '#05080F', border: 'none', fontWeight: 600, cursor: selectedBulkPriority ? 'pointer' : 'not-allowed' }}
              >
                Update Priority
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
