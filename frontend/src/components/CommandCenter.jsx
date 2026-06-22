import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Phone, Clock, MessageSquare, Plus, CheckCircle, Calendar, RefreshCw, BarChart2, Award, Users, AlertTriangle, TrendingUp, Compass, Search, Filter, ArrowRight, User, MapPin, DollarSign, Award as Trophy, FolderOpen, MoreVertical } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

export default function CommandCenter({ leads = [], employees = [], currentUser, onOpenLeadDrawer, onRefreshData }) {
  const [tasks, setTasks] = useState([]);
  const [targets, setTargets] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [activeCounterFilter, setActiveCounterFilter] = useState('all'); // 'overdue', 'today', 'tomorrow', 'week', 'completed', 'all'

  // Action Modals state
  const [selectedTaskForCall, setSelectedTaskForCall] = useState(null);
  const [callOutcomeOpen, setCallOutcomeOpen] = useState(false);
  const [selectedTaskForComplete, setSelectedTaskForComplete] = useState(null);
  const [completionNotesOpen, setCompletionNotesOpen] = useState(false);
  const [completionNotesText, setCompletionNotesText] = useState('');
  const [selectedTaskForReschedule, setSelectedTaskForReschedule] = useState(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [customRescheduleDate, setCustomRescheduleDate] = useState('');
  const [customRescheduleTime, setCustomRescheduleTime] = useState('10:00');
  
  // Note Modal state
  const [selectedTaskForNote, setSelectedTaskForNote] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const taskList = await api.getCommandCenterTasks();
      setTasks(taskList || []);
      
      const targetStats = await api.getDailyTargets();
      setTargets(targetStats);

      if (isAdmin) {
        const perfData = await api.getAdminPerformance();
        setPerformance(perfData || []);
      }
    } catch (err) {
      console.error('Failed to load command center data:', err);
      setError('Failed to fetch command center metrics. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format date headers: e.g. "02 July 2026 Wednesday"
  const formatDateHeader = (dateStr) => {
    if (!dateStr) return 'No Date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    const weekday = date.toLocaleString('default', { weekday: 'long' });
    
    return `${day} ${month} ${year} ${weekday}`;
  };

  // Check date bounds relative to local time (today: 2026-06-23)
  const getTaskCategory = (task) => {
    if (task.is_completed) return 'completed';

    const todayStr = '2026-06-23';
    const tomorrowStr = '2026-06-24';
    
    const taskDate = task.date;
    if (!taskDate) return 'today';
    
    if (taskDate < todayStr) return 'overdue';
    if (taskDate === todayStr) return 'today';
    if (taskDate === tomorrowStr) return 'tomorrow';
    
    // Check if task is within the current week (Sunday to Saturday)
    // 2026-06-23 is Tuesday, so week range: 2026-06-21 to 2026-06-27
    if (taskDate >= '2026-06-21' && taskDate <= '2026-06-27') return 'week';
    
    return 'upcoming';
  };

  // Counters computation
  const getCounterCounts = () => {
    let overdue = 0, today = 0, tomorrow = 0, week = 0, completed = 0;
    
    tasks.forEach(t => {
      const cat = getTaskCategory(t);
      if (cat === 'completed') completed++;
      else if (cat === 'overdue') overdue++;
      else if (cat === 'today') today++;
      else if (cat === 'tomorrow') tomorrow++;
      else if (cat === 'week') week++;
    });

    return { overdue, today, tomorrow, week, completed };
  };

  const counts = getCounterCounts();

  // Handle WhatsApp action
  const handleWhatsAppAction = async (task) => {
    if (!task.lead) return alert('No client information associated with this task.');
    const phone = task.lead.phone1 || '';
    if (!phone) return alert('No mobile number available.');

    const msg = `Hi ${task.lead.name},\n\nGreetings from Vrindavan Estates team. Let me know a convenient time to connect.\n\nRegards,\nIndiana Vrindavan Team`;
    const cleanPhone = phone.replace(/\D/g, '');
    const prefix = cleanPhone.length === 10 ? '91' : '';
    const url = `https://wa.me/${prefix}${cleanPhone}?text=${encodeURIComponent(msg)}`;
    
    // Log WhatsApp activity on backend
    try {
      await api.logWhatsAppActivity({ leadId: task.lead.id, actionType: 'WhatsApp Opened' });
    } catch (e) {
      console.warn('Failed to log WhatsApp activity:', e);
    }
    
    window.open(url, '_blank');
    fetchData();
  };

  // Handle Call Outcome selector
  const handleCallAction = (task) => {
    if (!task.lead) return alert('No client information associated.');
    setSelectedTaskForCall(task);
    setCallOutcomeOpen(true);
  };

  const submitCallOutcome = async (outcome) => {
    if (!selectedTaskForCall?.lead) return;
    const leadId = selectedTaskForCall.lead.id;
    const outcomeNotes = `Call logged from Daybook with outcome: ${outcome}`;
    
    try {
      // 1. Log call log
      await api.logCall(leadId, outcome, outcomeNotes);
      
      // Map call outcome to lead status
      let newStatus = selectedTaskForCall.lead.status;
      if (outcome === 'No Response' || outcome === 'Not Picked') newStatus = 'Follow Up';
      else if (outcome === 'Busy') newStatus = 'Follow Up';
      else if (outcome === 'Interested') newStatus = 'Warm';
      else if (outcome === 'Follow Up') newStatus = 'Negotiation';
      else if (outcome === 'Site Visit') newStatus = 'Site Visit Scheduled';
      else if (outcome === 'Negotiation') newStatus = 'Negotiation';
      else if (outcome === 'Booked') newStatus = 'Booked';

      // 2. Update lead status
      if (newStatus !== selectedTaskForCall.lead.status) {
        await api.updateLead(leadId, {
          ...selectedTaskForCall.lead,
          status: newStatus
        });
      }

      alert(`Logged: "${outcome}" and updated lead status to "${newStatus}".`);
      setCallOutcomeOpen(false);
      setSelectedTaskForCall(null);
      fetchData();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(`Failed to save call outcome: ${err.message}`);
    }
  };

  // Handle Reschedule
  const handleRescheduleAction = (task) => {
    setSelectedTaskForReschedule(task);
    setRescheduleOpen(true);
  };

  const submitReschedule = async (offsetType) => {
    if (!selectedTaskForReschedule) return;
    
    let targetDate = new Date();
    let targetTime = '10:00';

    if (offsetType === '30m') {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      targetDate = now;
      targetTime = now.toTimeString().split(' ')[0];
    } else if (offsetType === '1h') {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      targetDate = now;
      targetTime = now.toTimeString().split(' ')[0];
    } else if (offsetType === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDate = tomorrow;
      targetTime = '10:00';
    } else if (offsetType === 'custom') {
      if (!customRescheduleDate) return alert('Please pick a custom date.');
      targetDate = new Date(customRescheduleDate);
      targetTime = customRescheduleTime || '10:00';
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    
    try {
      await api.rescheduleCommandCenterTask(selectedTaskForReschedule.id, dateStr, targetTime);
      alert(`Task rescheduled successfully to ${dateStr} at ${targetTime}.`);
      setRescheduleOpen(false);
      setSelectedTaskForReschedule(null);
      setCustomRescheduleDate('');
      fetchData();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(`Reschedule failed: ${err.message}`);
    }
  };

  // Handle Mark Complete
  const handleCompleteAction = (task) => {
    setSelectedTaskForComplete(task);
    setCompletionNotesOpen(true);
  };

  const submitCompletion = async () => {
    if (!selectedTaskForComplete) return;
    
    try {
      await api.completeCommandCenterTask(selectedTaskForComplete.id, completionNotesText);
      
      // If it's a follow-up call, log a call log automatically with notes
      if (selectedTaskForComplete.type === '📞 Follow Up Call' && selectedTaskForComplete.lead) {
        await api.logCall(selectedTaskForComplete.lead.id, 'Connected', completionNotesText || 'Follow-up Call completed.');
      }

      alert('Task marked complete!');
      setCompletionNotesOpen(false);
      setSelectedTaskForComplete(null);
      setCompletionNotesText('');
      fetchData();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(`Failed to complete task: ${err.message}`);
    }
  };

  // Add custom note
  const handleAddNoteAction = (task) => {
    if (!task.lead) return alert('No client info.');
    setSelectedTaskForNote(task);
    setNoteOpen(true);
  };

  const submitNote = async () => {
    if (!selectedTaskForNote?.lead || !noteText.trim()) return;
    
    try {
      await api.logCall(selectedTaskForNote.lead.id, 'Follow Up', `Notes: ${noteText}`);
      alert('Note saved successfully!');
      setNoteOpen(false);
      setSelectedTaskForNote(null);
      setNoteText('');
      fetchData();
    } catch (err) {
      alert(`Failed to save notes: ${err.message}`);
    }
  };

  // Missed follow ups computation
  const getMissedFollowUpsStats = () => {
    const overdueTasks = tasks.filter(t => getTaskCategory(t) === 'overdue');
    let revenueRisk = 0; // budget sum
    
    overdueTasks.forEach(t => {
      if (t.lead?.budget) {
        const amt = parseFloat(t.lead.budget);
        if (!isNaN(amt)) revenueRisk += amt;
      }
    });

    // budget is in Lakhs, so risk = budget sum * 100000.
    // Convert to Crores: risk in Lakhs / 100 = Crores
    const riskCrores = (revenueRisk / 100).toFixed(2);
    
    return {
      count: overdueTasks.length,
      risk: riskCrores
    };
  };

  const missedStats = getMissedFollowUpsStats();

  // Filter & Search Logic
  const getFilteredTasks = () => {
    return tasks.filter(t => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const clientName = t.lead?.name?.toLowerCase() || '';
        const phone = t.lead?.phone1?.toLowerCase() || '';
        const project = t.lead?.project?.toLowerCase() || '';
        const city = t.lead?.city?.toLowerCase() || '';
        const leadId = t.lead_id?.toLowerCase() || '';
        
        if (!clientName.includes(query) && 
            !phone.includes(query) && 
            !project.includes(query) && 
            !city.includes(query) && 
            !leadId.includes(query)) {
          return false;
        }
      }

      // 2. Counter filter
      const cat = getTaskCategory(t);
      if (activeCounterFilter !== 'all') {
        if (activeCounterFilter === 'overdue' && cat !== 'overdue') return false;
        if (activeCounterFilter === 'today' && cat !== 'today') return false;
        if (activeCounterFilter === 'tomorrow' && cat !== 'tomorrow') return false;
        if (activeCounterFilter === 'week' && cat !== 'week') return false;
        if (activeCounterFilter === 'completed' && cat !== 'completed') return false;
      }

      // 3. Task Type Filter
      if (filterType !== 'all') {
        if (filterType === 'call' && t.type !== '📞 Follow Up Call') return false;
        if (filterType === 'meeting' && t.type !== '🤝 Meeting') return false;
        if (filterType === 'visit' && t.type !== '🏠 Site Visit') return false;
        if (filterType === 'booking' && t.type !== '💰 Token Booking') return false;
        if (filterType === 'collection' && t.type !== '💵 Collection') return false;
        if (filterType === 'reminder' && t.type !== '📋 Reminder') return false;
      }

      // 4. Priority Filter (Lead interest)
      if (filterPriority !== 'all') {
        const hotStatus = ['Negotiation', 'Booked', 'Site Visit Scheduled'];
        const warmStatus = ['Connected', 'Follow Up'];
        
        if (filterPriority === 'hot' && !hotStatus.includes(t.lead?.status)) return false;
        if (filterPriority === 'warm' && !warmStatus.includes(t.lead?.status)) return false;
        if (filterPriority === 'cold' && (hotStatus.includes(t.lead?.status) || warmStatus.includes(t.lead?.status))) return false;
      }

      // 5. Project Filter
      if (filterProject !== 'all' && t.lead?.project !== filterProject) return false;

      // 6. Source Filter
      if (filterSource !== 'all' && t.lead?.lead_source !== filterSource) return false;

      // 7. Employee Filter (Admin-only)
      if (filterEmployee !== 'all' && t.lead?.assigned_employee_id !== filterEmployee) return false;

      return true;
    }).sort((a, b) => {
      // Sort priority: Hot status (Negotiation, Site Visit Scheduled) first
      const getPriorityVal = (t) => {
        const status = t.lead?.status || '';
        if (status === 'Negotiation' || status === 'Site Visit Scheduled') return 3;
        if (status === 'Connected' || status === 'Follow Up') return 2;
        return 1;
      };
      
      const valA = getPriorityVal(a);
      const valB = getPriorityVal(b);
      
      if (valA !== valB) return valB - valA; // High priority first
      return a.date.localeCompare(b.date); // ascending date
    });
  };

  const filteredTasks = getFilteredTasks();

  // Group filtered tasks by Category
  const groupTasks = () => {
    const grouped = {
      overdue: [],
      today: [],
      tomorrow: [],
      week: [],
      completed: []
    };

    filteredTasks.forEach(t => {
      const cat = getTaskCategory(t);
      if (cat === 'completed') grouped.completed.push(t);
      else if (cat === 'overdue') grouped.overdue.push(t);
      else if (cat === 'today') grouped.today.push(t);
      else if (cat === 'tomorrow') grouped.tomorrow.push(t);
      else if (cat === 'week') grouped.week.push(t);
    });

    return grouped;
  };

  const grouped = groupTasks();

  const getLeadPriorityText = (lead) => {
    if (!lead) return 'Cold';
    const status = lead.status;
    if (status === 'Negotiation' || status === 'Site Visit Scheduled') return 'Hot';
    if (status === 'Connected' || status === 'Follow Up') return 'Warm';
    return 'Cold';
  };

  const getPriorityBadgeClass = (priority) => {
    if (priority === 'Hot') return 'priority-badge-hot';
    if (priority === 'Warm') return 'priority-badge-warm';
    return 'priority-badge-cold';
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', position: 'relative' }}>
      
      {/* Sticky Header with logo, user profile, and Daybook branding */}
      <div className="sticky-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--primary)', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <Compass size={28} className="text-gold" /> 
              <span className="text-gold-gradient">Sales Command Center</span>
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
              Daybook • Vrindavan Estates CRM Premium Dashboard
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
              <User size={14} className="text-gold" />
              <span>{currentUser?.full_name || 'Sales Officer'}</span>
              <span style={{ fontSize: '10px', background: 'rgba(223, 177, 91, 0.2)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {currentUser?.role || 'User'}
              </span>
            </div>
            
            <button 
              className="btn" 
              onClick={fetchData} 
              disabled={loading}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                background: 'rgba(223, 177, 91, 0.15)',
                border: '1px solid rgba(223, 177, 91, 0.3)',
                color: 'var(--primary)',
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={loading ? "spin-animation" : ""} /> 
              {loading ? "Syncing..." : "Sync Daybook"}
            </button>
          </div>
        </div>
      </div>

      {/* Briefing Banner Widget (Morning / Evening dynamically based on time) */}
      {renderBriefingWidget()}

      {/* KPI Counters Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        {renderKPICounter('overdue', '🔴 Overdue', counts.overdue, 'var(--color-hot)')}
        {renderKPICounter('today', '🟡 Today', counts.today, 'var(--color-warm)')}
        {renderKPICounter('tomorrow', '🔵 Tomorrow', counts.tomorrow, '#3b82f6')}
        {renderKPICounter('week', '📅 This Week', counts.week, 'var(--primary)')}
        {renderKPICounter('completed', '✅ Completed', counts.completed, 'var(--color-success)')}
      </div>

      {/* Main Content Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.1fr', gap: '24px' }} className="command-grid-layout">
        
        {/* Left Side: Search, Filters & Tasks Group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Glass Search & Filter Panel */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search leads by name, mobile, city, project or lead ID..." 
                style={{ 
                  paddingLeft: '42px', 
                  height: '46px', 
                  borderRadius: '12px',
                  background: 'rgba(21, 34, 32, 0.6)', 
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  width: '100%',
                  fontSize: '14px'
                }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Filter Chips Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Quick Filter Chips
              </div>
              
              {/* Task Type Filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', marginRight: '4px' }}>Type:</span>
                {[
                  { value: 'all', label: 'All Tasks' },
                  { value: 'call', label: '📞 Calls' },
                  { value: 'meeting', label: '🤝 Meetings' },
                  { value: 'visit', label: '🏠 Site Visits' },
                  { value: 'booking', label: '💰 Bookings' },
                  { value: 'collection', label: '💵 Collections' },
                  { value: 'reminder', label: '📋 Reminders' }
                ].map(item => (
                  <button 
                    key={item.value} 
                    className={`filter-chip ${filterType === item.value ? 'active' : ''}`}
                    onClick={() => setFilterType(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Priority Filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', marginRight: '4px' }}>Priority:</span>
                {[
                  { value: 'all', label: 'All Priorities' },
                  { value: 'hot', label: '🔥 Hot Leads' },
                  { value: 'warm', label: '🟡 Warm Leads' },
                  { value: 'cold', label: '⚪ Cold Leads' }
                ].map(item => (
                  <button 
                    key={item.value} 
                    className={`filter-chip ${filterPriority === item.value ? 'active' : ''}`}
                    onClick={() => setFilterPriority(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Advanced Dropdown selectors row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                {/* Project selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Project</label>
                  <select 
                    className="form-control" 
                    style={{ background: 'rgba(21, 34, 32, 0.8)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: 'var(--text-main)', width: 'auto' }} 
                    value={filterProject} 
                    onChange={(e) => setFilterProject(e.target.value)}
                  >
                    <option value="all">All Projects</option>
                    <option value="skf">SKF</option>
                    <option value="vrindavan">Vrindavan</option>
                  </select>
                </div>

                {/* Source selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lead Source</label>
                  <select 
                    className="form-control" 
                    style={{ background: 'rgba(21, 34, 32, 0.8)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: 'var(--text-main)', width: 'auto' }} 
                    value={filterSource} 
                    onChange={(e) => setFilterSource(e.target.value)}
                  >
                    <option value="all">All Sources</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Google">Google</option>
                    <option value="Website">Website</option>
                  </select>
                </div>

                {/* Employee selector (Admin only) */}
                {isAdmin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned Employee</label>
                    <select 
                      className="form-control" 
                      style={{ background: 'rgba(21, 34, 32, 0.8)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: 'var(--text-main)', width: 'auto' }} 
                      value={filterEmployee} 
                      onChange={(e) => setFilterEmployee(e.target.value)}
                    >
                      <option value="all">All Employees</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* Grouped Tasks Lists */}
          {loading ? (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={24} className="spin-animation text-gold" />
              <span>Synchronizing Daybook metrics...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Overdue Section */}
              {grouped.overdue.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-hot)', borderBottom: '2px solid rgba(255, 94, 94, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span>🔴 Overdue Activities</span>
                    <span style={{ fontSize: '11px', background: 'rgba(255, 94, 94, 0.15)', color: 'var(--color-hot)', padding: '2px 8px', borderRadius: '10px' }}>{grouped.overdue.length}</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {grouped.overdue.map(t => renderTaskCard(t))}
                  </div>
                </div>
              )}

              {/* Today Section */}
              {grouped.today.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-warm)', borderBottom: '2px solid rgba(255, 184, 48, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span>🟡 Today Activities</span>
                    <span style={{ fontSize: '11px', background: 'rgba(255, 184, 48, 0.15)', color: 'var(--color-warm)', padding: '2px 8px', borderRadius: '10px' }}>{grouped.today.length}</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {grouped.today.map(t => renderTaskCard(t))}
                  </div>
                </div>
              )}

              {/* Tomorrow Section */}
              {grouped.tomorrow.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#3b82f6', borderBottom: '2px solid rgba(59, 130, 246, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span>🔵 Tomorrow Activities</span>
                    <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '2px 8px', borderRadius: '10px' }}>{grouped.tomorrow.length}</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {grouped.tomorrow.map(t => renderTaskCard(t))}
                  </div>
                </div>
              )}

              {/* This Week Section */}
              {grouped.week.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '2px solid rgba(223, 177, 91, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span>📅 Later This Week</span>
                    <span style={{ fontSize: '11px', background: 'rgba(223, 177, 91, 0.15)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '10px' }}>{grouped.week.length}</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {grouped.week.map(t => renderTaskCard(t))}
                  </div>
                </div>
              )}

              {/* Completed Section */}
              {grouped.completed.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-success)', borderBottom: '2px solid rgba(16, 185, 129, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span>✅ Completed Activities</span>
                    <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', padding: '2px 8px', borderRadius: '10px' }}>{grouped.completed.length}</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {grouped.completed.map(t => renderTaskCard(t))}
                  </div>
                </div>
              )}

              {filteredTasks.length === 0 && (
                <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No pending activities found matching filters. Try adjusting search query or chips.
                </div>
              )}

            </div>
          )}

        </div>

        {/* Right Side: Missed risk widget, targets progress widget, admin leaderboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Missed Follow-Up / Revenue Risk Widget with Pulsing Red Glass */}
          <div className="glass-card-risk" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-hot)', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.02em' }}>
              <AlertTriangle size={18} style={{ filter: 'drop-shadow(0 0 4px var(--color-hot))' }} /> 
              <span>Revenue Risk Widget</span>
            </div>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Missed Activities:</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-hot)' }}>{missedStats.count} Leads</span>
            </div>
            
            <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                Estimated Revenue Risk
              </div>
              <div style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--color-hot)', marginTop: '4px', filter: 'drop-shadow(0 0 6px rgba(255, 94, 94, 0.3))' }}>
                ₹{missedStats.risk} Cr
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                *Calculated as the sum of budgets for all overdue follow-up tasks.
              </div>
            </div>
          </div>

          {/* Daily Target Widget */}
          {targets && (
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} />
                <span>Daily Targets Widget</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {renderTargetProgress('📞 Call Logs', targets.calls.actual, targets.calls.target, 'var(--primary)')}
                {renderTargetProgress('🤝 Meetings', targets.meetings.actual, targets.meetings.target, '#3b82f6')}
                {renderTargetProgress('🏠 Site Visits', targets.visits.actual, targets.visits.target, '#eab308')}
                {renderTargetProgress('💰 Bookings', targets.bookings.actual, targets.bookings.target, 'var(--color-success)')}
                {renderTargetProgress('💵 Collections', targets.collections.actual, targets.collections.target, '#a855f7')}
              </div>
            </div>
          )}

          {/* Admin Leaderboard View */}
          {isAdmin && performance.length > 0 && (
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={18} className="text-gold" />
                <span>Employee Leaderboard</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {performance
                  .map((p) => {
                    const pct = p.todayTasks > 0 ? Math.round((p.completed / p.todayTasks) * 100) : 0;
                    return { ...p, completionPct: pct };
                  })
                  .sort((a, b) => b.completionPct - a.completionPct || b.bookings - a.bookings)
                  .map((p, idx) => {
                    let rankBadge = '👤';
                    if (idx === 0) rankBadge = '🥇';
                    else if (idx === 1) rankBadge = '🥈';
                    else if (idx === 2) rankBadge = '🥉';

                    return (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="leaderboard-badge">{rankBadge}</span>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{p.name}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 'bold' }}>
                            {p.completionPct}% Done
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="leaderboard-bar-bg">
                          <div className="leaderboard-bar-fill" style={{ width: `${p.completionPct}%` }} />
                        </div>
                        
                        {/* Stats counters row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', paddingTop: '4px' }}>
                          <span>Done: <strong>{p.completed}/{p.todayTasks}</strong></span>
                          <span>Visits: <strong>{p.siteVisits}</strong></span>
                          <span>Bookings: <strong>{p.bookings}</strong></span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Floating Action Button (FAB) for quick sync */}
      <div className="fab-container" title="Sync Daybook Metrics">
        <button className="fab-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={22} className={loading ? "spin-animation" : ""} />
        </button>
      </div>

      {/* MODALS RENDER SECTION */}
      {renderModals()}

    </div>
  );

  // Helper: dynamic briefing widget based on time
  function renderBriefingWidget() {
    const currentHour = new Date().getHours();
    const isMorning = currentHour < 15; // before 3:00 PM

    // Compute stats for the briefing
    const todayTasksList = tasks.filter(t => getTaskCategory(t) === 'today');
    const todayHot = todayTasksList.filter(t => getLeadPriorityText(t.lead) === 'Hot').length;
    const todayWarm = todayTasksList.filter(t => getLeadPriorityText(t.lead) === 'Warm').length;
    const completedToday = tasks.filter(t => {
      if (!t.is_completed || !t.completed_at) return false;
      const compDate = t.completed_at.split('T')[0];
      return compDate === '2026-06-23';
    }).length;

    const remainingTasksCount = tasks.filter(t => !t.is_completed).length;

    if (isMorning) {
      return (
        <div className="briefing-banner morning-briefing">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold', color: 'var(--primary)' }}>
            <span>🌅 Morning Briefing</span>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>| Focus Board</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '4px 0', background: 'linear-gradient(135deg, #ffffff 60%, var(--primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Good morning, {currentUser?.full_name || 'Partner'}!
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: 0, lineHeight: '1.4' }}>
            You have <strong style={{ color: 'var(--primary)' }}>{todayTasksList.length} activities</strong> scheduled for today. 
            This includes <strong style={{ color: 'var(--color-hot)' }}>{todayHot} Hot Leads</strong> and <strong style={{ color: 'var(--color-warm)' }}>{todayWarm} Warm Leads</strong> requiring urgent attention. 
            Focus on calling your Hot leads first to secure site visits.
          </p>
        </div>
      );
    } else {
      return (
        <div className="briefing-banner evening-briefing">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold', color: '#60a5fa' }}>
            <span>🌙 Evening Summary</span>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>| Progress Review</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '4px 0', background: 'linear-gradient(135deg, #ffffff 60%, #60a5fa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Good evening, {currentUser?.full_name || 'Partner'}!
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: 0, lineHeight: '1.4' }}>
            Excellent effort today. You completed <strong style={{ color: 'var(--color-success)' }}>{completedToday} follow-up tasks</strong> today. 
            There are currently <strong style={{ color: 'var(--primary)' }}>{remainingTasksCount} pending follow-ups</strong> remaining in your overall pipeline. 
            Review your calendar and prepare tomorrow's list to start strong.
          </p>
        </div>
      );
    }
  }

  // Helper: target progress bars
  function renderTargetProgress(label, actual, target, color) {
    const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-main)' }}>{label}</span>
          <span style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: color }}>{actual}</strong> / {target} ({pct}%)
          </span>
        </div>
        <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: color, width: `${pct}%`, borderRadius: '3px', transition: 'width 0.4s ease' }}></div>
        </div>
      </div>
    );
  }

  // Helper: single KPI counter renderer
  function renderKPICounter(category, label, count, color) {
    const isActive = activeCounterFilter === category;
    return (
      <div 
        onClick={() => setActiveCounterFilter(isActive ? 'all' : category)}
        className="glass-card glass-card-hover"
        style={{ 
          padding: '16px', 
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: isActive ? `1.5px solid ${color}` : '1px solid rgba(223, 177, 91, 0.12)',
          boxShadow: isActive ? `0 0 15px rgba(255,255,255,0.05), 0 0 10px ${color}22` : '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
        <span style={{ fontSize: '32px', fontWeight: 'bold', color: color, marginTop: '8px', filter: `drop-shadow(0 0 6px ${color}44)` }}>{count}</span>
        {isActive && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: color }}></div>
        )}
      </div>
    );
  }

  // Render card helper
  function renderTaskCard(task) {
    const priority = getLeadPriorityText(task.lead);
    const badgeClass = getPriorityBadgeClass(priority);
    const employeeName = employees.find(e => e.id === task.lead?.assigned_employee_id)?.full_name || 'Unassigned';
    const isHot = priority === 'Hot';

    return (
      <div 
        key={task.id} 
        className="glass-card glass-card-hover"
        style={{ 
          borderLeft: `4px solid ${isHot ? 'var(--color-hot)' : (priority === 'Warm' ? 'var(--color-warm)' : 'var(--border-color)')}`,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: isHot ? '0 8px 32px 0 rgba(255, 94, 94, 0.05)' : '0 8px 32px 0 rgba(0,0,0,0.2)'
        }}
      >
        {/* Top line: Task Title & Type badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>{task.type}</span>
            </div>
            <h4 style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '4px', color: 'var(--text-main)', margin: 0 }}>{task.title}</h4>
          </div>
          
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span className={`priority-badge ${badgeClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {isHot ? '🔥 Hot' : (priority === 'Warm' ? '🟡 Warm' : '⚪ Cold')}
            </span>
            {task.is_completed && <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', borderRadius: '4px', fontWeight: 600 }}>Completed</span>}
          </div>
        </div>

        {/* Client details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
          {task.lead && (
            <>
              <div style={{ color: 'var(--text-main)' }}>👤 <strong>{task.lead.name}</strong></div>
              <div>📞 {task.lead.phone1}</div>
              <div>📍 {task.lead.city || 'N/A'}</div>
              <div>🏢 Project: <strong>{task.lead.project}</strong></div>
              <div>💰 Budget: <strong>₹{task.lead.budget} L</strong></div>
              <div>📈 Status: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{task.lead.status}</span></div>
            </>
          )}
          <div>👤 Agent: {employeeName}</div>
          <div>📅 Date: {task.date}</div>
          <div>⏰ Time: {task.time}</div>
        </div>

        {/* Notes/Instructions */}
        {task.notes && (
          <div style={{ background: 'rgba(21, 34, 32, 0.6)', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', borderLeft: '3px solid var(--primary)', color: 'var(--text-main)' }}>
            <strong className="text-gold">Notes:</strong> {task.notes}
          </div>
        )}

        {/* Completed Metadata */}
        {task.is_completed && (
          <div style={{ borderTop: '1px dashed rgba(16, 185, 129, 0.2)', paddingTop: '10px', fontSize: '11px', color: 'var(--color-success)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div>✔️ Completed at: {new Date(task.completed_at).toLocaleString()}</div>
            {task.completion_notes && <div style={{ marginTop: '2px' }}>✏️ Completion Notes: {task.completion_notes}</div>}
          </div>
        )}

        {/* Quick Actions Panel - Icon-Only Round Actions */}
        {!task.is_completed && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary btn-icon-round" 
              style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '38px', height: '38px', border: '1px solid rgba(223, 177, 91, 0.15)', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-main)', cursor: 'pointer' }} 
              onClick={() => handleCallAction(task)} 
              title="Call Client"
            >
              <Phone size={16} className="text-gold" />
            </button>
            
            <button 
              className="btn btn-secondary btn-icon-round" 
              style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '38px', height: '38px', border: '1px solid rgba(37, 211, 102, 0.2)', background: 'rgba(255, 255, 255, 0.03)', cursor: 'pointer' }} 
              onClick={() => handleWhatsAppAction(task)} 
              title="WhatsApp Client"
            >
              <FaWhatsapp size={18} style={{ color: '#25D366' }} />
            </button>
            
            <button 
              className="btn btn-secondary btn-icon-round" 
              style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '38px', height: '38px', border: '1px solid rgba(223, 177, 91, 0.15)', background: 'rgba(255, 255, 255, 0.03)', cursor: 'pointer' }} 
              onClick={() => onOpenLeadDrawer(task.lead_id)} 
              title="Open Lead Profile"
            >
              <FolderOpen size={16} className="text-gold" />
            </button>
            
            <button 
              className="btn btn-icon-round" 
              style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '38px', height: '38px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: 'var(--color-success)', cursor: 'pointer' }} 
              onClick={() => handleCompleteAction(task)} 
              title="Mark Complete"
            >
              <CheckCircle size={16} />
            </button>
            
            <button 
              className="btn btn-secondary btn-icon-round" 
              style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '38px', height: '38px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-muted)', cursor: 'pointer' }} 
              onClick={() => handleRescheduleAction(task)} 
              title="Reschedule Task"
            >
              <Calendar size={16} />
            </button>
            
            <button 
              className="btn btn-secondary btn-icon-round" 
              style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '38px', height: '38px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-muted)', cursor: 'pointer' }} 
              onClick={() => handleAddNoteAction(task)} 
              title="Add Log Note"
            >
              <MoreVertical size={16} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Render all modals
  function renderModals() {
    return (
      <>
        {/* Outcome Select Modal */}
        {callOutcomeOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ padding: '24px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0 }}>
                Select Call Outcome
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                Call completed for <strong>{selectedTaskForCall?.lead?.name}</strong>. Choose outcome:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['No Response', 'Busy', 'Interested', 'Follow Up', 'Site Visit', 'Negotiation', 'Booked'].map((o, idx) => (
                  <button 
                    key={idx} 
                    className="btn btn-secondary" 
                    onClick={() => submitCallOutcome(o)}
                    style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer' }}
                  >
                    <span>{o}</span>
                    <ArrowRight size={14} className="text-gold" />
                  </button>
                ))}
              </div>
              <button className="btn btn-secondary" onClick={() => { setCallOutcomeOpen(false); setSelectedTaskForCall(null); }} style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Completion Notes Modal */}
        {completionNotesOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ padding: '24px', width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0 }}>
                Mark Task Complete
              </h3>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Completion Notes</label>
                <textarea 
                  className="form-control" 
                  rows="4" 
                  placeholder="Summarize details of this completed activity..."
                  value={completionNotesText}
                  onChange={(e) => setCompletionNotesText(e.target.value)}
                  style={{ background: 'rgba(21, 34, 32, 0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: 'var(--text-main)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => { setCompletionNotesOpen(false); setSelectedTaskForComplete(null); setCompletionNotesText(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={submitCompletion} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--primary)', color: '#060a09', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                  Submit & Complete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reschedule Modal */}
        {rescheduleOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ padding: '24px', width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0 }}>
                Reschedule Task
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => submitReschedule('30m')} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer' }}>+30 Minutes</button>
                <button className="btn btn-secondary" onClick={() => submitReschedule('1h')} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer' }}>+1 Hour</button>
                <button className="btn btn-secondary" onClick={() => submitReschedule('tomorrow')} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer' }}>+Tomorrow</button>
                <button className="btn btn-primary" onClick={() => submitReschedule('custom')} style={{ padding: '10px', borderRadius: '8px', background: 'var(--primary)', color: '#060a09', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Save Custom</button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Or pick custom date:</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={customRescheduleDate}
                    onChange={(e) => setCustomRescheduleDate(e.target.value)}
                    style={{ background: 'rgba(21, 34, 32, 0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', color: 'var(--text-main)', flex: 1 }}
                  />
                  <input 
                    type="time" 
                    className="form-control" 
                    value={customRescheduleTime}
                    onChange={(e) => setCustomRescheduleTime(e.target.value)}
                    style={{ background: 'rgba(21, 34, 32, 0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', color: 'var(--text-main)', width: '100px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button className="btn btn-secondary" onClick={() => { setRescheduleOpen(false); setSelectedTaskForReschedule(null); setCustomRescheduleDate(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Note Modal */}
        {noteOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ padding: '24px', width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0 }}>
                Add Activity Note
              </h3>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Notes</label>
                <textarea 
                  className="form-control" 
                  rows="4" 
                  placeholder="Type notes to append to this lead's activity history..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  style={{ background: 'rgba(21, 34, 32, 0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: 'var(--text-main)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => { setNoteOpen(false); setSelectedTaskForNote(null); setNoteText(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={submitNote} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--primary)', color: '#060a09', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                  Save Note
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}

