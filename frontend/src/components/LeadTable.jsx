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
  onViewHistory,
  defaultShowRecycleBin = false,
  lastUpdated
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
  const [selectedCpCode, setSelectedCpCode] = useState('');
  const [uniqueCpCodes, setUniqueCpCodes] = useState(['LDS', 'LDR', 'VE', 'VES', 'VEN', 'LD']);

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

  // Phase 9 Bulk Delete & Recycle Bin States (Optimistic UI & Background Execution)
  const [showRecycleBin, setShowRecycleBin] = useState(defaultShowRecycleBin);
  const [deletingLeadIds, setDeletingLeadIds] = useState([]);
  const [toasts, setToasts] = useState([]);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);
  const [deleteType, setDeleteType] = useState('soft'); // 'soft' or 'permanent'

  const [emptyRecycleBinConfirmOpen, setEmptyRecycleBinConfirmOpen] = useState(false);
  const [emptyingRecycleBin, setEmptyingRecycleBin] = useState(false);
  
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [selectedBulkStatus, setSelectedBulkStatus] = useState('');

  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const [selectedBulkPriority, setSelectedBulkPriority] = useState('');

  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkRestoring, setBulkRestoring] = useState(false);
  const [bulkUpdatingStatus, setBulkUpdatingStatus] = useState(false);
  const [bulkUpdatingPriority, setBulkUpdatingPriority] = useState(false);

  const showToast = (message, type = 'success', action = null) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, action }]);
    const duration = action ? 10000 : (type === 'error' ? 5000 : 3000);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  // Click-to-WhatsApp Assistant States
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [activeWhatsAppLead, setActiveWhatsAppLead] = useState(null);
  const [activeWhatsAppPhone, setActiveWhatsAppPhone] = useState('');
  const [whatsAppTemplates, setWhatsAppTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customWhatsAppText, setCustomWhatsAppText] = useState('');

  // Smart Bulk Delete Settings & States
  const [bulkDeleteSettings, setBulkDeleteSettings] = useState({ requireBackup: true, threshold: 20 });
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false);
  const [backupCompleted, setBackupCompleted] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.getBulkDeleteSettings();
        setBulkDeleteSettings(res || { requireBackup: true, threshold: 20 });
      } catch (err) {
        console.error('Failed to load bulk delete settings:', err);
      }
    };
    const loadCpCodes = async () => {
      try {
        const codes = await api.getUniqueCpCodes();
        const defaults = ['LDS', 'LDR', 'VE', 'VES', 'VEN', 'LD'];
        const merged = [...new Set([...defaults, ...(codes || [])])];
        setUniqueCpCodes(merged.sort());
      } catch (err) {
        console.error('Failed to load unique cp codes:', err);
      }
    };

    if (currentUser && currentUser.role === 'admin') {
      loadSettings();
      loadCpCodes();
    }
  }, [currentUser]);

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
        cp_code: selectedCpCode,
        page: currentPage,
        limit: limit,
        recycleBin: showRecycleBin
      });

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const newLeads = data.leads || [];
        if (currentPage === 1) {
          setLeadsState(newLeads);
        } else {
          setLeadsState(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            const uniqueNewLeads = newLeads.filter(item => !existingIds.has(item.id));
            return [...prev, ...uniqueNewNewLeads];
          });
        }
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
    selectedCpCode,
    limit,
    showRecycleBin
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
    selectedCpCode,
    currentPage,
    limit,
    leads.length,
    showRecycleBin,
    lastUpdated
  ]);

  const handleTableScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 80 && !loadingLeads && currentPage < totalPages) {
      console.log(`[Infinite Scroll] Near bottom. Loading page ${currentPage + 1}...`);
      setCurrentPage(prev => prev + 1);
    }
  };

  // Server-side filtered and paginated leads (filtered optimistically for background deletions)
  const filteredLeads = leadsState.filter(l => !deletingLeadIds.includes(l.id));

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
        recycleBin: showRecycleBin
      });
      const list = data && data.leads ? data.leads : (Array.isArray(data) ? data : []);
      setSelectedLeadIds(list.map(l => l.id));
    } catch (err) {
      console.error('Failed to select all filtered leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleBulkDeleteTrigger = (permanent = true) => {
    setIsPermanentDelete(true);
    setDeleteType('permanent');
    
    const count = selectedLeadIds.length;
    const isAboveThreshold = bulkDeleteSettings.requireBackup && count > bulkDeleteSettings.threshold;

    if (isAboveThreshold) {
      setBackupCompleted(false);
      setSafetyDialogOpen(true);
    } else {
      setDeleteConfirmOpen(true);
    }
  };

  const handleDownloadBackup = async () => {
    const targets = [...selectedLeadIds];
    if (targets.length === 0) return;

    setDownloadingBackup(true);
    showToast('⚡ Generating safety Excel backup...', 'info');

    try {
      const response = await fetch(`${api.baseUrl || ''}/api/leads/bulk-backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ leadIds: targets })
      });

      if (!response.ok) throw new Error('Backup failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const todayStr = new Date().toLocaleDateString('en-CA');
      a.download = `Leads_Backup_${todayStr}_${targets.length}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setBackupCompleted(true);
      showToast('✅ Safety backup created successfully!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to download safety backup', 'error');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const getEstimatedTime = (count) => {
    if (count <= 100) return '< 1 second';
    if (count <= 500) return '< 2 seconds';
    if (count <= 1000) return '< 5 seconds';
    return '< 15 seconds';
  };

  const handleExecuteSoftDeleteBulk = async () => {
    const targets = [...selectedLeadIds];
    if (targets.length === 0) return;

    setBulkDeleting(true);
    setLeadsState(prev => prev.filter(l => !targets.includes(l.id)));
    setTotalCount(prev => Math.max(0, prev - targets.length));
    setSelectedLeadIds([]);

    showToast(`✅ ${targets.length} Leads moved to Recycle Bin`, 'success');

    try {
      await api.deleteLeadsBulk(targets, false, false);
      setBulkDeleting(false);
      fetchLeads();
    } catch (err) {
      showToast('Failed to move leads to Recycle Bin', 'error');
      setBulkDeleting(false);
      fetchLeads();
    }
  };

  const handleExecuteBulkDelete = async () => {
    setDeleteConfirmOpen(false);
    
    const targets = [...selectedLeadIds];
    if (targets.length === 0) return;

    setBulkDeleting(true);
    // Optimistic UI: instantly hide deleting leads from the table
    setDeletingLeadIds(prev => [...new Set([...prev, ...targets])]);
    
    try {
      const isPerm = deleteType === 'permanent';
      const res = await api.deleteLeadsBulk(targets, isPerm, backupCompleted);
      const jobId = res.jobId;
      
      showToast(`⚡ Deletion queued. Job ID: ${jobId}`, 'info');
      
      let pollCount = 0;
      const timeoutSeconds = 10;
      
      // Start polling background worker progress
      const interval = setInterval(async () => {
        pollCount++;
        if (pollCount > timeoutSeconds) {
          clearInterval(interval);
          setBulkDeleting(false);
          setDeletingLeadIds([]);
          showToast('Delete request timed out.', 'error');
          fetchLeads();
          return;
        }

        try {
          const job = await api.getBulkJobStatus(jobId);
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'completed_with_errors') {
            clearInterval(interval);
            setBulkDeleting(false);
            
            // Remove processing toast
            setToasts(prev => prev.filter(t => t.id !== jobId));
            
            if (job.failed === 0) {
              const isSoftDelete = deleteType === 'soft' && !showRecycleBin;
              if (isSoftDelete) {
                const undoAction = (
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      setToasts(prev => prev.filter(t => t.id !== jobId)); // Remove the success toast
                      showToast(`⚡ Undoing deletion...`, 'info');
                      try {
                        const restoreRes = await api.restoreLeadsBulk(targets);
                        const restoreJobId = restoreRes.jobId;
                        const restInterval = setInterval(async () => {
                          try {
                            const rJob = await api.getBulkJobStatus(restoreJobId);
                            if (rJob.status === 'completed' || rJob.status === 'failed' || rJob.status === 'completed_with_errors') {
                              clearInterval(restInterval);
                              setToasts(prev => prev.filter(t => t.id !== restoreJobId));
                              if (rJob.failed === 0) {
                                showToast(`🔄 Undone: ${rJob.succeeded} Leads restored successfully`, 'success');
                              } else {
                                showToast(`🔄 Undone: Restored ${rJob.succeeded} leads. ${rJob.failed} failed.`, 'error');
                              }
                              fetchLeads();
                            } else {
                              const pct = Math.round((rJob.progress / rJob.total) * 100) || 0;
                              setToasts(prev => {
                                const exists = prev.some(t => t.id === restoreJobId);
                                if (exists) {
                                  return prev.map(t => t.id === restoreJobId ? { ...t, message: `⚡ Restoring leads: ${pct}%`, progress: pct } : t);
                                } else {
                                  return [...prev, { id: restoreJobId, message: `⚡ Restoring leads: ${pct}%`, type: 'processing', progress: pct }];
                                }
                              });
                            }
                          } catch (pollErr) {
                            clearInterval(restInterval);
                          }
                        }, 1000);
                      } catch (restoreErr) {
                        showToast('Failed to queue restoration job for undo', 'error');
                      }
                    }}
                    style={{
                      background: 'rgba(212, 175, 55, 0.15)',
                      border: '1px solid #D4AF37',
                      color: '#D4AF37',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      marginTop: '6px',
                      alignSelf: 'flex-end',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                    }}
                  >
                    Undo (10s)
                  </button>
                );
                showToast(`✅ ${job.succeeded} Leads moved to Recycle Bin`, 'success', undoAction);
              } else {
                showToast(`🗑 ${job.succeeded} Leads permanently deleted`, 'success');
              }
              setSelectedLeadIds([]);
              setDeletingLeadIds([]);
            } else {
              showToast(`${job.succeeded} leads deleted successfully. ${job.failed} leads could not be deleted.`, 'error');
              setSelectedLeadIds(targets.slice(job.succeeded)); // keep failed selected
              setDeletingLeadIds([]);
            }
            fetchLeads();
          } else {
            // Update progress toast in real-time
            const pct = Math.round((job.progress / job.total) * 100) || 0;
            setToasts(prev => {
              const exists = prev.some(t => t.id === jobId);
              if (exists) {
                return prev.map(t => t.id === jobId ? { ...t, message: `⚡ Deleting leads: ${pct}% (${job.progress}/${job.total})`, progress: pct } : t);
              } else {
                return [...prev, { id: jobId, message: `⚡ Deleting leads: ${pct}%`, type: 'processing', progress: pct }];
              }
            });
          }
        } catch (pollErr) {
          console.error('Error polling delete job status:', pollErr);
          clearInterval(interval);
          setBulkDeleting(false);
          setDeletingLeadIds([]);
          showToast(`Error polling delete job: ${pollErr.message || pollErr}`, 'error');
          fetchLeads();
        }
      }, 1000);

    } catch (err) {
      console.error('Failed to queue bulk delete:', err);
      showToast('Failed to queue bulk deletion job', 'error');
      setBulkDeleting(false);
      setDeletingLeadIds([]);
      fetchLeads();
    }
  };

  const handleExecuteEmptyRecycleBin = async () => {
    setEmptyRecycleBinConfirmOpen(false);
    setEmptyingRecycleBin(true);
    showToast('⚡ Emptying Recycle Bin in background...', 'info');
    try {
      const res = await api.emptyRecycleBin();
      showToast(`✅ Recycle Bin emptied: ${res.deletedCount} leads permanently purged.`, 'success');
      fetchLeads();
    } catch (err) {
      showToast('Failed to empty Recycle Bin', 'error');
    } finally {
      setEmptyingRecycleBin(false);
    }
  };

  const handleExecuteBulkRestore = async () => {
    const targets = [...selectedLeadIds];
    if (targets.length === 0) return;

    setBulkRestoring(true);
    // Optimistic UI: instantly hide restored leads from Recycle Bin view
    setDeletingLeadIds(prev => [...new Set([...prev, ...targets])]);

    try {
      const res = await api.restoreLeadsBulk(targets);
      const jobId = res.jobId;
      
      showToast(`⚡ Restoration queued. Job ID: ${jobId}`, 'info');
      
      const interval = setInterval(async () => {
        try {
          const job = await api.getBulkJobStatus(jobId);
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'completed_with_errors') {
            clearInterval(interval);
            setBulkRestoring(false);
            setToasts(prev => prev.filter(t => t.id !== jobId));
            
            if (job.failed === 0) {
              showToast(`${job.succeeded} Leads restored successfully`, 'success');
              setSelectedLeadIds([]);
              setDeletingLeadIds([]);
            } else {
              showToast(`${job.succeeded} leads restored successfully. ${job.failed} leads could not be restored.`, 'error');
              setSelectedLeadIds(targets.slice(job.succeeded));
              setDeletingLeadIds([]);
            }
            fetchLeads();
          } else {
            const pct = Math.round((job.progress / job.total) * 100) || 0;
            setToasts(prev => {
              const exists = prev.some(t => t.id === jobId);
              if (exists) {
                return prev.map(t => t.id === jobId ? { ...t, message: `⚡ Restoring leads: ${pct}% (${job.progress}/${job.total})`, progress: pct } : t);
              } else {
                return [...prev, { id: jobId, message: `⚡ Restoring leads: ${pct}%`, type: 'processing', progress: pct }];
              }
            });
          }
        } catch (pollErr) {
          console.error('Error polling restore job status:', pollErr);
          clearInterval(interval);
          setBulkRestoring(false);
          setDeletingLeadIds([]);
          fetchLeads();
        }
      }, 1000);

    } catch (err) {
      console.error('Failed to queue bulk restore:', err);
      showToast('Failed to queue bulk restoration job', 'error');
      setBulkRestoring(false);
      setDeletingLeadIds([]);
      fetchLeads();
    }
  };

  const handleExecuteBulkStatus = async () => {
    setBulkStatusOpen(false);
    const targets = [...selectedLeadIds];
    if (targets.length === 0 || !selectedBulkStatus) return;

    setBulkUpdatingStatus(true);
    // Optimistic UI: update status in grid state immediately
    setLeadsState(prev => prev.map(l => targets.includes(l.id) ? { ...l, status: selectedBulkStatus } : l));

    try {
      const res = await api.updateLeadsStatusBulk(targets, selectedBulkStatus);
      const jobId = res.jobId;
      
      showToast(`⚡ Status update queued. Job ID: ${jobId}`, 'info');
      
      const interval = setInterval(async () => {
        try {
          const job = await api.getBulkJobStatus(jobId);
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'completed_with_errors') {
            clearInterval(interval);
            setBulkUpdatingStatus(false);
            setToasts(prev => prev.filter(t => t.id !== jobId));
            
            if (job.failed === 0) {
              showToast(`Status updated to "${selectedBulkStatus}" for ${job.succeeded} leads`, 'success');
              setSelectedLeadIds([]);
            } else {
              showToast(`${job.succeeded} leads updated. ${job.failed} leads failed.`, 'error');
              setSelectedLeadIds(targets.slice(job.succeeded));
            }
            fetchLeads();
          } else {
            const pct = Math.round((job.progress / job.total) * 100) || 0;
            setToasts(prev => {
              const exists = prev.some(t => t.id === jobId);
              if (exists) {
                return prev.map(t => t.id === jobId ? { ...t, message: `⚡ Updating status: ${pct}% (${job.progress}/${job.total})`, progress: pct } : t);
              } else {
                return [...prev, { id: jobId, message: `⚡ Updating status: ${pct}%`, type: 'processing', progress: pct }];
              }
            });
          }
        } catch (pollErr) {
          console.error('Error polling status job status:', pollErr);
          clearInterval(interval);
          setBulkUpdatingStatus(false);
          fetchLeads();
        }
      }, 1000);

    } catch (err) {
      console.error('Failed to queue bulk status update:', err);
      showToast('Failed to queue bulk status update job', 'error');
      setBulkUpdatingStatus(false);
      fetchLeads();
    }
    setSelectedBulkStatus('');
  };

  const handleExecuteBulkPriority = async () => {
    setBulkPriorityOpen(false);
    const targets = [...selectedLeadIds];
    if (targets.length === 0 || !selectedBulkPriority) return;

    setBulkUpdatingPriority(true);
    // Optimistic UI: update priority status immediately
    setLeadsState(prev => prev.map(l => targets.includes(l.id) ? { ...l, status: selectedBulkPriority } : l));

    try {
      const res = await api.updateLeadsStatusBulk(targets, selectedBulkPriority);
      const jobId = res.jobId;
      
      showToast(`⚡ Priority update queued. Job ID: ${jobId}`, 'info');
      
      const interval = setInterval(async () => {
        try {
          const job = await api.getBulkJobStatus(jobId);
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'completed_with_errors') {
            clearInterval(interval);
            setBulkUpdatingPriority(false);
            setToasts(prev => prev.filter(t => t.id !== jobId));
            
            if (job.failed === 0) {
              showToast(`Priority updated to "${selectedBulkPriority}" for ${job.succeeded} leads`, 'success');
              setSelectedLeadIds([]);
            } else {
              showToast(`${job.succeeded} leads updated. ${job.failed} leads failed.`, 'error');
              setSelectedLeadIds(targets.slice(job.succeeded));
            }
            fetchLeads();
          } else {
            const pct = Math.round((job.progress / job.total) * 100) || 0;
            setToasts(prev => {
              const exists = prev.some(t => t.id === jobId);
              if (exists) {
                return prev.map(t => t.id === jobId ? { ...t, message: `⚡ Updating priority: ${pct}% (${job.progress}/${job.total})`, progress: pct } : t);
              } else {
                return [...prev, { id: jobId, message: `⚡ Updating priority: ${pct}%`, type: 'processing', progress: pct }];
              }
            });
          }
        } catch (pollErr) {
          console.error('Error polling priority job status:', pollErr);
          clearInterval(interval);
          setBulkUpdatingPriority(false);
          fetchLeads();
        }
      }, 1000);

    } catch (err) {
      console.error('Failed to queue bulk priority update:', err);
      showToast('Failed to queue bulk priority update job', 'error');
      setBulkUpdatingPriority(false);
      fetchLeads();
    }
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
              setSelectedCpCode('');
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
            
            <div className="form-group">
              <label>Channel Partner</label>
              <select className="form-control" value={selectedCpCode} onChange={(e) => setSelectedCpCode(e.target.value)}>
                <option value="">All Channel Partners</option>
                {uniqueCpCodes.map(c => <option key={c} value={c}>{c}</option>)}
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
            <h3>{showRecycleBin ? `Recycle Bin (${totalCount})` : (employeeFilterHeading || `Leads Directory (${totalCount})`)}</h3>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {showRecycleBin && currentUser.role === 'admin' && (
              <button 
                type="button"
                className="btn"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  fontWeight: 600
                }}
                onClick={() => {
                  setEmptyRecycleBinConfirmOpen(true);
                }}
              >
                🗑 Empty Recycle Bin
              </button>
            )}
            {!showRecycleBin && (
              <button class="btn btn-primary" onClick={onAddLead}>
                <Plus size={16} /> Add Lead
              </button>
            )}
          </div>
        </div>

        <div class="table-container" onScroll={handleTableScroll} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {filteredLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              No leads match the filters. {showRecycleBin ? 'Recycle Bin is empty.' : 'Click "Add Lead" to create a new one.'}
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
                {filteredLeads.map(l => (
                  <LeadRowKeyed
                    key={l.id}
                    lead={l}
                    isRowSelected={selectedLeadIds.includes(l.id)}
                    currentUser={currentUser}
                    showRecycleBin={showRecycleBin}
                    getStatusBadgeClass={getStatusBadgeClass}
                    formatPhoneNumber={formatPhoneNumber}
                    handleToggleSelectRow={handleToggleSelectRow}
                    onOpenLeadDrawer={onOpenLeadDrawer}
                    onAssignLead={onAssignLead}
                    onEditLead={onEditLead}
                    onDeleteLeadSingle={async () => {
                      setLeadsState(prev => prev.filter(item => item.id !== l.id));
                      setTotalCount(prev => Math.max(0, prev - 1));
                      showToast('✅ Lead moved to Recycle Bin', 'success');
                      try {
                        await api.deleteLeadsBulk([l.id], false);
                        fetchLeads();
                      } catch (err) {
                        showToast('Failed to delete lead', 'error');
                        fetchLeads();
                      }
                    }}
                    onRestoreLeadSingle={async () => {
                      setLeadsState(prev => prev.filter(item => item.id !== l.id));
                      setTotalCount(prev => Math.max(0, prev - 1));
                      showToast('✅ Lead restored to Leads Directory', 'success');
                      try {
                        await api.restoreLeadsBulk([l.id]);
                        fetchLeads();
                      } catch (err) {
                        showToast('Failed to restore lead', 'error');
                        fetchLeads();
                      }
                    }}
                    onPermanentDeleteSingle={() => {
                      setSelectedLeadIds([l.id]);
                      setIsPermanentDelete(true);
                      setDeleteConfirmTypedText('');
                      setDeleteConfirmOpen(true);
                    }}
                    handleWhatsAppClick={handleWhatsAppClick}
                    handleCallClick={handleCallClick}
                  />
                ))}
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
            {!showRecycleBin ? (
              <>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '8px 14px', 
                    fontSize: '12px', 
                    border: `1px solid ${bulkDeleting ? 'rgba(255,255,255,0.1)' : 'rgba(239, 68, 68, 0.35)'}`, 
                    color: bulkDeleting ? 'rgba(255,255,255,0.4)' : '#ef4444', 
                    background: 'none',
                    cursor: bulkDeleting ? 'not-allowed' : 'pointer'
                  }}
                  disabled={bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority}
                  onClick={handleExecuteSoftDeleteBulk}
                >
                  {bulkDeleting && !isPermanentDelete ? '⏳ Deleting...' : '🗑️ Move to Recycle Bin'}
                </button>

                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '8px 14px', 
                    fontSize: '12px',
                    opacity: (bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority) ? 0.5 : 1,
                    cursor: (bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority) ? 'not-allowed' : 'pointer'
                  }}
                  disabled={bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority}
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
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '8px 14px', 
                    fontSize: '12px', 
                    background: 'none',
                    opacity: (bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority) ? 0.5 : 1,
                    cursor: (bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority) ? 'not-allowed' : 'pointer'
                  }}
                  disabled={bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority}
                  onClick={() => setBulkStatusOpen(true)}
                >
                  {bulkUpdatingStatus ? '⏳ Updating...' : '🏷️ Change Status'}
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '8px 14px', 
                    fontSize: '12px', 
                    background: 'none',
                    opacity: (bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority) ? 0.5 : 1,
                    cursor: (bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority) ? 'not-allowed' : 'pointer'
                  }}
                  disabled={bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority}
                  onClick={() => setBulkPriorityOpen(true)}
                >
                  {bulkUpdatingPriority ? '⏳ Updating...' : '⭐ Change Priority'}
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '8px 14px', 
                    fontSize: '12px', 
                    background: 'none',
                    opacity: (bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority) ? 0.5 : 1,
                    cursor: (bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority) ? 'not-allowed' : 'pointer'
                  }}
                  disabled={bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority}
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
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '8px 14px', 
                    fontSize: '12px', 
                    background: bulkRestoring ? 'rgba(255,255,255,0.1)' : '#10b981', 
                    borderColor: bulkRestoring ? 'rgba(255,255,255,0.1)' : '#10b981', 
                    color: bulkRestoring ? 'rgba(255,255,255,0.4)' : '#05080f',
                    cursor: bulkRestoring ? 'not-allowed' : 'pointer'
                  }}
                  disabled={bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority}
                  onClick={handleExecuteBulkRestore}
                >
                  {bulkRestoring ? '⏳ Restoring...' : '♻️ Restore Selected'}
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '8px 14px', 
                    fontSize: '12px', 
                    border: `1px solid ${bulkDeleting ? 'rgba(255,255,255,0.1)' : 'rgba(239, 68, 68, 0.35)'}`, 
                    color: bulkDeleting ? 'rgba(255,255,255,0.4)' : '#ef4444', 
                    background: 'none',
                    cursor: bulkDeleting ? 'not-allowed' : 'pointer'
                  }}
                  disabled={bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority}
                  onClick={() => handleBulkDeleteTrigger(true)}
                >
                  {bulkDeleting && isPermanentDelete ? '⏳ Deleting...' : '💀 Delete Permanently'}
                </button>
              </>
            )}

            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ 
                padding: '8px 12px', 
                fontSize: '12px', 
                background: 'none',
                opacity: (bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority) ? 0.5 : 1,
                cursor: (bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority) ? 'not-allowed' : 'pointer'
              }}
              disabled={bulkDeleting || bulkRestoring || bulkUpdatingStatus || bulkUpdatingPriority}
              onClick={() => setSelectedLeadIds([])}
            >
              ❌ Clear
            </button>
          </div>
        </div>
      )}

      {/* Single Confirmation Modal */}
      {deleteConfirmOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div className="glass-card" style={{ padding: '28px', width: '90%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(212,175,55,0.25)', boxShadow: '0 15px 35px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ Delete Permanently
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.15)' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Selected Leads</span>
              <strong style={{ fontSize: '16px', color: '#f1f5f9' }}>{selectedLeadIds.length}</strong>
            </div>

            <p style={{ fontSize: '13px', color: '#ef4444', margin: 0, lineHeight: 1.5 }}>
              These leads are in the Recycle Bin. Proceeding will permanently purge them. This cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Estimated Time: <strong style={{ color: '#D4AF37' }}>{getEstimatedTime(selectedLeadIds.length)}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setDeleteConfirmOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'none' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleExecuteBulkDelete}
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: '8px', 
                  background: deleteType === 'permanent' ? '#ef4444' : '#D4AF37', 
                  color: deleteType === 'permanent' ? '#ffffff' : '#05080F', 
                  border: 'none', 
                  fontWeight: 600, 
                  cursor: 'pointer' 
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise Safety Dialog */}
      {safetyDialogOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div className="glass-card" style={{ padding: '28px', width: '90%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(239, 68, 68, 0.3)', boxShadow: '0 15px 35px rgba(0,0,0,0.6)' }}>
            {!backupCompleted ? (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚠️ Large Delete Detected
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Selected Leads</span>
                  <strong style={{ fontSize: '16px', color: '#f1f5f9' }}>{selectedLeadIds.length.toLocaleString()}</strong>
                </div>

                <p style={{ fontSize: '13px', color: '#f1f5f9', margin: 0, lineHeight: 1.5 }}>
                  This operation will permanently remove a large amount of customer data. It is highly recommended to export a backup before executing.
                </p>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Estimated Excel Size:</span>
                    <strong style={{ color: '#D4AF37' }}>{(selectedLeadIds.length * 0.15).toFixed(1)} KB</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Estimated Delete Time:</span>
                    <strong style={{ color: '#D4AF37' }}>{getEstimatedTime(selectedLeadIds.length)}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleDownloadBackup}
                    disabled={downloadingBackup}
                    autoFocus
                    style={{ 
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      background: '#D4AF37', 
                      color: '#05080F', 
                      border: 'none', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    ⬇️ Download Backup
                  </button>

                  <button 
                    className="btn" 
                    onClick={() => {
                      setSafetyDialogOpen(false);
                      setDeleteConfirmOpen(true);
                    }}
                    style={{ 
                      padding: '10px 16px', 
                      borderRadius: '8px', 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      border: '1px solid #ef4444', 
                      color: '#ef4444', 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    🗑️ Delete Without Backup
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setSafetyDialogOpen(false)}
                    style={{ 
                      padding: '10px 16px', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      cursor: 'pointer', 
                      background: 'none',
                      fontSize: '13px'
                    }}
                  >
                    ❌ Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✅ Backup Completed Successfully
                </h3>
                
                <p style={{ fontSize: '14px', color: '#f1f5f9', margin: 0, lineHeight: 1.5 }}>
                  Excel backup has been generated and downloaded. Do you want to proceed with deleting these {selectedLeadIds.length} leads?
                </p>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setSafetyDialogOpen(false)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'none' }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      setSafetyDialogOpen(false);
                      setDeleteConfirmOpen(true);
                    }}
                    style={{ 
                      padding: '8px 16px', 
                      borderRadius: '8px', 
                      background: '#ef4444', 
                      color: '#ffffff', 
                      border: 'none', 
                      fontWeight: 600, 
                      cursor: 'pointer' 
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty Recycle Bin Confirmation Modal */}
      {emptyRecycleBinConfirmOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div className="glass-card" style={{ padding: '28px', width: '90%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(239, 68, 68, 0.25)', boxShadow: '0 15px 35px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🗑 Empty Recycle Bin?
            </h3>
            
            <p style={{ fontSize: '13px', color: '#f1f5f9', margin: 0, lineHeight: 1.5 }}>
              This action cannot be undone. Delete all recycle records permanently.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setEmptyRecycleBinConfirmOpen(false);
                }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'none' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleExecuteEmptyRecycleBin}
                disabled={emptyingRecycleBin}
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: '8px', 
                  background: '#ef4444', 
                  color: '#ffffff', 
                  border: 'none', 
                  fontWeight: 600, 
                  cursor: 'pointer'
                }}
              >
                {emptyingRecycleBin ? 'Purging...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications container */}
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '320px',
        width: '90%'
      }}>
        {toasts.map(t => (
          <div 
            key={t.id} 
            style={{
              background: 'rgba(5, 8, 15, 0.95)',
              border: `1.5px solid ${t.type === 'error' ? '#ef4444' : '#D4AF37'}`,
              boxShadow: `0 0 15px ${t.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(212, 175, 55, 0.2)'}`,
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#f1f5f9',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              backdropFilter: 'blur(8px)',
              animation: 'slideInRight 0.3s ease forwards'
            }}
          >
            <style>{`
              @keyframes slideInRight {
                from { transform: translateX(120%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t.type === 'error' ? '⚠️' : '✅'} {t.message}</span>
              <button 
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: 0 }}
              >
                ×
              </button>
            </div>
            {t.action && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {t.action}
              </div>
            )}
          </div>
        ))}
      </div>

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

const LeadRowKeyed = React.memo(({
  lead: l,
  isRowSelected,
  currentUser,
  showRecycleBin,
  getStatusBadgeClass,
  formatPhoneNumber,
  handleToggleSelectRow,
  onOpenLeadDrawer,
  onAssignLead,
  onEditLead,
  onDeleteLeadSingle,
  onRestoreLeadSingle,
  onPermanentDeleteSingle,
  handleWhatsAppClick,
  handleCallClick
}) => {
  return (
    <tr style={{ background: isRowSelected ? 'rgba(219, 178, 93, 0.05)' : 'inherit' }}>
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
          {l.cp_code && (
            <span 
              style={{ 
                padding: '2px 6px', 
                borderRadius: '4px', 
                border: '1px solid #D4AF37', 
                background: 'rgba(212,175,55,0.1)', 
                color: '#D4AF37', 
                fontSize: '10px', 
                fontWeight: 'bold', 
                marginRight: '6px',
                display: 'inline-block',
                letterSpacing: '0.5px',
                textShadow: '0 0 5px rgba(212,175,55,0.2)'
              }}
            >
              CP:{l.cp_code}
            </span>
          )}
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
        <span className={getStatusBadgeClass(l.status)}>{l.status}</span>
        {l.site_visit_status && l.site_visit_status !== 'None' && (
          <div style={{ marginTop: '4px' }}>
            <span className="badge badge-info" style={{ fontSize: '9px', padding: '2px 6px' }}>Visit: {l.site_visit_status}</span>
          </div>
        )}
        {l.booking_status && l.booking_status !== 'None' && (
          <div style={{ marginTop: '4px' }}>
            <span className="badge badge-success" style={{ fontSize: '9px', padding: '2px 6px' }}>Booked ({l.booking_status})</span>
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
          {!showRecycleBin ? (
            <>
              <button 
                className="action-icon-btn" 
                title="WhatsApp Customer"
                onClick={() => handleWhatsAppClick(l.phone1 || l.phone2 || '', l)}
              >
                <FaWhatsapp size={14} style={{ color: '#25D366' }} />
              </button>
              <button 
                className="action-icon-btn" 
                title="Edit Lead"
                onClick={() => onEditLead(l)}
              >
                <Edit2 size={14} />
              </button>
              {currentUser.role === 'admin' && (
                <button 
                  className="action-icon-btn" 
                  style={{ color: 'var(--color-hot)', borderColor: 'rgba(255,94,94,0.1)' }}
                  title="Move to Recycle Bin"
                  onClick={onDeleteLeadSingle}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                className="action-icon-btn" 
                title="Restore Lead"
                style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.15)', background: 'none' }}
                onClick={onRestoreLeadSingle}
              >
                ♻️
              </button>
              <button 
                className="action-icon-btn" 
                title="Delete Permanently"
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.15)', background: 'none' }}
                onClick={onPermanentDeleteSingle}
              >
                💀
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
});
