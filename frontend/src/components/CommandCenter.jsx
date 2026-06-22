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
  const [filterViewMode, setFilterViewMode] = useState('all'); // 'all', 'my-tasks'
  const [filterDateRange, setFilterDateRange] = useState('all'); // 'all', 'today', 'tomorrow', 'week', 'overdue'

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

      // 8. View Mode Filter ("My Tasks")
      if (filterViewMode === 'my-tasks' && t.lead?.assigned_employee_id !== currentUser?.id) return false;

      // 9. Date Range Filter
      if (filterDateRange !== 'all') {
        if (filterDateRange === 'today' && cat !== 'today') return false;
        if (filterDateRange === 'tomorrow' && cat !== 'tomorrow') return false;
        if (filterDateRange === 'week' && cat !== 'week') return false;
        if (filterDateRange === 'overdue' && cat !== 'overdue') return false;
      }

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
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100vh', background: '#05080F', color: '#f1f5f9', position: 'relative' }}>
      
      {/* 1. TOP HEADER */}
      <div className="glass-card" style={{ padding: '20px 24px', borderBottom: '1px solid rgba(212, 175, 55, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          {/* Left: Branding */}
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#D4AF37', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <Compass size={28} style={{ color: '#D4AF37' }} /> 
              <span className="text-gold-gradient" style={{ fontSize: '24px', fontWeight: 800 }}>Day Book</span>
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sales Command Center
            </p>
          </div>

          {/* Center: Large Search Bar */}
          <div style={{ flex: 1, maxWidth: '500px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#D4AF37' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search Name, Mobile, Project, City, Lead ID..." 
              style={{ 
                paddingLeft: '38px', 
                height: '40px', 
                borderRadius: '8px', 
                background: 'rgba(5, 8, 15, 0.8)', 
                border: '1px solid rgba(212, 175, 55, 0.25)', 
                color: '#f1f5f9',
                width: '100%'
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Right: Controls & User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
              title="Theme Toggle (Dark Mode Forced)"
            >
              <Clock size={18} />
            </button>
            
            <button 
              style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative' }} 
              title="Notifications"
            >
              <Award size={18} />
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--color-hot)', color: '#05080F', fontSize: '9px', fontWeight: 'bold', width: '14px', height: '14px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
                {counts.overdue}
              </span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.1)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#D4AF37', color: '#05080F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                {(currentUser?.full_name || 'Abhinav')[0].toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{currentUser?.full_name || 'Abhinav'}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{currentUser?.role || 'Admin'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TOP HEADER SUB-ROW: Morning Briefing / Evening Summary Widget */}
        {renderBriefingWidget()}
      </div>

      {/* 2. KPI ROW (One Horizontal Row, No Wrapping, No Stacking) */}
      <div className="kpi-row-layout">
        {renderKPICounter('overdue', '🔴 Overdue', counts.overdue, 'var(--color-hot)')}
        {renderKPICounter('today', '🟡 Today', counts.today, 'var(--color-warm)')}
        {renderKPICounter('tomorrow', '🔵 Tomorrow', counts.tomorrow, '#38bdf8')}
        {renderKPICounter('week', '🟣 This Week', counts.week, '#a855f7')}
        {renderKPICounter('completed', '🟢 Completed', counts.completed, 'var(--color-success)')}
      </div>

      {/* 3. WIDGET ROW (One Horizontal Row on Desktop, Tablet 2-col, Mobile Stack) */}
      <div className="widget-row-layout">
        {/* Widget 1: Missed Follow Ups & Revenue Risk */}
        <div className="glass-card-risk" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-hot)', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <AlertTriangle size={16} />
            <span>🚨 Missed Follow Ups</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Overdue Count:</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-hot)' }}>{missedStats.count} Tasks</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '10px', marginTop: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Estimated Revenue Risk:</span>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-hot)', marginTop: '2px', filter: 'drop-shadow(0 0 6px rgba(255, 94, 94, 0.2))' }}>
              ₹{missedStats.risk} Crore
            </div>
          </div>
        </div>

        {/* Widget 2: Today's Targets progress bars */}
        {targets && (
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', paddingBottom: '8px' }}>
              🎯 Today's Targets
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {renderTargetProgress('Calls', targets.calls.actual, targets.calls.target, '#D4AF37')}
              {renderTargetProgress('Meetings', targets.meetings.actual, targets.meetings.target, '#38bdf8')}
              {renderTargetProgress('Site Visits', targets.visits.actual, targets.visits.target, '#ffb830')}
              {renderTargetProgress('Bookings', targets.bookings.actual, targets.bookings.target, 'var(--color-success)')}
              {renderTargetProgress('Collections', targets.collections.actual, targets.collections.target, '#a855f7')}
            </div>
          </div>
        )}

        {/* Widget 3: Employee Productivity Leaderboard */}
        {isAdmin && performance.length > 0 && (
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', paddingBottom: '8px' }}>
              🏆 Employee Performance
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '160px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.15)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '4px' }}>Employee</th>
                    <th style={{ padding: '4px', textAlign: 'center' }}>Tasks</th>
                    <th style={{ padding: '4px', textAlign: 'center' }}>Done</th>
                    <th style={{ padding: '4px', textAlign: 'center' }}>Pending</th>
                    <th style={{ padding: '4px', textAlign: 'center' }}>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((p, idx) => {
                    let rankIcon = '👤';
                    if (idx === 0) rankIcon = '🥇';
                    else if (idx === 1) rankIcon = '🥈';
                    else if (idx === 2) rankIcon = '🥉';

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '6px 4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{rankIcon}</span>
                          <span>{p.name}</span>
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>{p.todayTasks}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: 'var(--color-success)', fontWeight: 'bold' }}>{p.completed}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>{p.todayTasks - p.completed}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: 'var(--color-hot)' }}>{p.overdue || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. FILTER ROW (Sticky single horizontal row) */}
      <div className="filter-row-layout">
        {/* View Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button 
            className={`filter-chip ${filterViewMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterViewMode('all')}
          >
            All
          </button>
          <button 
            className={`filter-chip ${filterViewMode === 'my-tasks' ? 'active' : ''}`}
            onClick={() => setFilterViewMode('my-tasks')}
          >
            My Tasks
          </button>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'rgba(212, 175, 55, 0.2)' }}></div>

        {/* Selector Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', flex: 1 }}>
          {/* Task Type */}
          <select 
            style={{ background: '#0e172a', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#f1f5f9' }}
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Task Type: All</option>
            <option value="call">📞 Calls</option>
            <option value="meeting">🤝 Meetings</option>
            <option value="visit">🏠 Site Visits</option>
            <option value="booking">💰 Token Bookings</option>
            <option value="collection">💵 Collections</option>
            <option value="reminder">📋 Reminders</option>
          </select>

          {/* Priority */}
          <select 
            style={{ background: '#0e172a', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#f1f5f9' }}
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="all">Priority: All</option>
            <option value="hot">🔥 Hot Leads</option>
            <option value="warm">🟡 Warm Leads</option>
            <option value="cold">⚪ Cold Leads</option>
          </select>

          {/* Date Range */}
          <select 
            style={{ background: '#0e172a', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#f1f5f9' }}
            value={filterDateRange} 
            onChange={(e) => setFilterDateRange(e.target.value)}
          >
            <option value="all">Date Range: All</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="week">This Week</option>
            <option value="overdue">Overdue</option>
          </select>

          {/* Project */}
          <select 
            style={{ background: '#0e172a', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#f1f5f9' }}
            value={filterProject} 
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="all">Project: All</option>
            <option value="skf">SKF</option>
            <option value="vrindavan">Vrindavan</option>
          </select>

          {/* Source */}
          <select 
            style={{ background: '#0e172a', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#f1f5f9' }}
            value={filterSource} 
            onChange={(e) => setFilterSource(e.target.value)}
          >
            <option value="all">Source: All</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Facebook">Facebook</option>
            <option value="Google">Google</option>
            <option value="Website">Website</option>
          </select>

          {/* Assigned Employee */}
          {isAdmin && (
            <select 
              style={{ background: '#0e172a', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#f1f5f9' }}
              value={filterEmployee} 
              onChange={(e) => setFilterEmployee(e.target.value)}
            >
              <option value="all">Employee: All</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 5. TASK SECTIONS */}
      {loading ? (
        <div className="glass-card" style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <RefreshCw size={24} className="spin-animation text-gold" />
          <span>Synchronizing Daybook metrics...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Overdue Section */}
          {grouped.overdue.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-hot)', borderBottom: '2px solid rgba(255, 94, 94, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-warm)', borderBottom: '2px solid rgba(255, 184, 48, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#38bdf8', borderBottom: '2px solid rgba(56, 189, 248, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>🔵 Tomorrow Activities</span>
                <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '10px' }}>{grouped.tomorrow.length}</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {grouped.tomorrow.map(t => renderTaskCard(t))}
              </div>
            </div>
          )}

          {/* This Week Section */}
          {grouped.week.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#a855f7', borderBottom: '2px solid rgba(168, 85, 247, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>📅 Later This Week</span>
                <span style={{ fontSize: '11px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', padding: '2px 8px', borderRadius: '10px' }}>{grouped.week.length}</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {grouped.week.map(t => renderTaskCard(t))}
              </div>
            </div>
          )}

          {/* Completed Section */}
          {grouped.completed.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-success)', borderBottom: '2px solid rgba(16, 185, 129, 0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
              No pending activities found matching filters.
            </div>
          )}

        </div>
      )}

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

    // Compute stats for today
    const todayTasksList = tasks.filter(t => getTaskCategory(t) === 'today');
    const todayCallsCount = todayTasksList.filter(t => t.type === '📞 Follow Up Call').length;
    const todayMeetingsCount = todayTasksList.filter(t => t.type === '🤝 Meeting').length;
    const todayVisitsCount = todayTasksList.filter(t => t.type === '🏠 Site Visit').length;
    const todayCollectionsCount = todayTasksList.filter(t => t.type === '💵 Collection').length;

    let todayPotentialRev = 0;
    todayTasksList.forEach(t => {
      if (t.lead?.budget) {
        const b = parseFloat(t.lead.budget);
        if (!isNaN(b)) todayPotentialRev += b;
      }
    });
    const todayPotentialRevCrores = (todayPotentialRev / 100).toFixed(2);

    // Compute stats for completed today
    const completedTodayTasks = tasks.filter(t => {
      if (!t.is_completed || !t.completed_at) return false;
      const compDate = t.completed_at.split('T')[0];
      return compDate === '2026-06-23';
    });
    const completedCallsCount = completedTodayTasks.filter(t => t.type === '📞 Follow Up Call').length;
    const completedMeetingsCount = completedTodayTasks.filter(t => t.type === '🤝 Meeting').length;
    const completedVisitsCount = completedTodayTasks.filter(t => t.type === '🏠 Site Visit').length;
    const completedBookingsCount = completedTodayTasks.filter(t => t.type === '💰 Token Booking').length;
    const completedCollectionsCount = completedTodayTasks.filter(t => t.type === '💵 Collection').length;
    const pendingTasksCount = tasks.filter(t => !t.is_completed).length;

    const welcomeName = currentUser?.full_name?.split(' ')[0] || 'Abhinav';

    if (isMorning) {
      return (
        <div style={{ background: 'rgba(212, 175, 55, 0.05)', padding: '16px', borderRadius: '12px', border: '1px dashed rgba(212, 175, 55, 0.3)', marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#D4AF37' }}>
              🌅 Good Morning, {welcomeName}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Morning Briefing Dashboard</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today's Calls</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#D4AF37', marginTop: '2px' }}>{todayCallsCount} Calls</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Meetings</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8', marginTop: '2px' }}>{todayMeetingsCount} Meets</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Site Visits</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffb830', marginTop: '2px' }}>{todayVisitsCount} Visits</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Collections</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#a855f7', marginTop: '2px' }}>{todayCollectionsCount} Bills</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Potential Revenue</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-success)', marginTop: '2px' }}>₹{todayPotentialRevCrores} Cr</div>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '16px', borderRadius: '12px', border: '1px dashed rgba(56, 189, 248, 0.3)', marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#38bdf8' }}>
              🌙 Good Evening, {welcomeName}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Evening Summary Dashboard</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Calls Completed</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#D4AF37', marginTop: '2px' }}>{completedCallsCount} Calls</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Meetings Completed</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8', marginTop: '2px' }}>{completedMeetingsCount} Meets</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Site Visits Completed</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffb830', marginTop: '2px' }}>{completedVisitsCount} Visits</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bookings Completed</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-success)', marginTop: '2px' }}>{completedBookingsCount} Book</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Collections Completed</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#a855f7', marginTop: '2px' }}>{completedCollectionsCount} Done</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Tasks</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-hot)', marginTop: '2px' }}>{pendingTasksCount} Left</div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Helper: target progress bars
  function renderTargetProgress(label, actual, target, color) {
    const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--text-main)' }}>{label}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            <strong style={{ color: color }}>{actual}</strong> / {target} ({pct}%)
          </span>
        </div>
        <div style={{ height: '4px', background: 'var(--bg-input)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: color, width: `${pct}%`, borderRadius: '2px', transition: 'width 0.4s ease' }}></div>
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
        className="glass-card"
        style={{ 
          padding: '16px', 
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: isActive ? `1.5px solid ${color}` : '1px solid rgba(212, 175, 55, 0.15)',
          boxShadow: isActive ? `0 0 15px rgba(255,255,255,0.05), 0 0 10px ${color}22` : '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
        <span style={{ fontSize: '28px', fontWeight: 'bold', color: color, marginTop: '8px', filter: `drop-shadow(0 0 6px ${color}44)` }}>{count}</span>
        {isActive && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: color }}></div>
        )}
      </div>
    );
  }

  // Render card helper: Redesigned into horizontal columns format
  function renderTaskCard(task) {
    const priority = getLeadPriorityText(task.lead);
    const badgeClass = getPriorityBadgeClass(priority);
    const employeeName = employees.find(e => e.id === task.lead?.assigned_employee_id)?.full_name || 'Unassigned';
    const isHot = priority === 'Hot';

    return (
      <div 
        key={task.id} 
        className="glass-card"
        style={{ 
          borderLeft: `4px solid ${isHot ? 'var(--color-hot)' : (priority === 'Warm' ? 'var(--color-warm)' : 'var(--border-color)')}`,
          padding: '16px 20px',
          boxShadow: isHot ? '0 8px 32px 0 rgba(255, 94, 94, 0.05)' : '0 8px 32px 0 rgba(0,0,0,0.2)'
        }}
      >
        <div className="task-card-grid">
          {/* Column 1: Time */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#D4AF37' }}>⏰ {task.time}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{task.date}</span>
          </div>

          {/* Column 2: Client Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {task.lead ? (
              <>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f1f5f9' }}>👤 {task.lead.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📞 {task.lead.phone1}</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>📍 {task.lead.city || 'N/A'}</span>
                  <span className={`priority-badge ${badgeClass}`} style={{ fontSize: '9px', padding: '1px 6px', display: 'inline-flex', alignItems: 'center' }}>
                    {isHot ? '🔥 Hot' : (priority === 'Warm' ? '🟡 Warm' : '⚪ Cold')}
                  </span>
                </div>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No client info</span>
            )}
          </div>

          {/* Column 3: Project Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {task.lead ? (
              <>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>🏢 {task.lead.project}</span>
                <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 600 }}>💰 ₹{task.lead.budget} L Budget</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Status: {task.lead.status}</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No project info</span>
            )}
          </div>

          {/* Column 4: Task Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#D4AF37' }}>{task.type}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{task.title}</span>
            {task.notes && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '4px 8px', borderRadius: '6px', marginTop: '2px' }}>
                ✏️ Notes: {task.notes}
              </span>
            )}
            {task.is_completed && (
              <span style={{ fontSize: '10px', color: 'var(--color-success)', marginTop: '2px' }}>
                ✔️ Completed: {new Date(task.completed_at).toLocaleDateString()} {task.completion_notes && `(${task.completion_notes})`}
              </span>
            )}
          </div>

          {/* Column 5: Assigned Employee */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Agent</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{employeeName}</span>
          </div>

          {/* Column 6: Quick Actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center' }}>
            {!task.is_completed ? (
              <>
                <button 
                  className="btn btn-secondary btn-icon-round" 
                  style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '34px', height: '34px', border: '1px solid rgba(212, 175, 55, 0.25)', background: 'rgba(255, 255, 255, 0.03)', color: '#D4AF37', cursor: 'pointer' }} 
                  onClick={() => handleCallAction(task)} 
                  title="Call Client"
                >
                  <Phone size={14} />
                </button>
                
                <button 
                  className="btn btn-secondary btn-icon-round" 
                  style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '34px', height: '34px', border: '1px solid rgba(37, 211, 102, 0.2)', background: 'rgba(255, 255, 255, 0.03)', cursor: 'pointer' }} 
                  onClick={() => handleWhatsAppAction(task)} 
                  title="WhatsApp Client"
                >
                  <FaWhatsapp size={16} style={{ color: '#25D366' }} />
                </button>
                
                <button 
                  className="btn btn-secondary btn-icon-round" 
                  style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '34px', height: '34px', border: '1px solid rgba(212, 175, 55, 0.25)', background: 'rgba(255, 255, 255, 0.03)', cursor: 'pointer' }} 
                  onClick={() => onOpenLeadDrawer(task.lead_id)} 
                  title="Open Lead Profile"
                >
                  <FolderOpen size={14} style={{ color: '#D4AF37' }} />
                </button>
                
                <button 
                  className="btn btn-icon-round" 
                  style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '34px', height: '34px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', color: 'var(--color-success)', cursor: 'pointer' }} 
                  onClick={() => handleCompleteAction(task)} 
                  title="Mark Complete"
                >
                  <CheckCircle size={14} />
                </button>
                
                <button 
                  className="btn btn-secondary btn-icon-round" 
                  style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '34px', height: '34px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)', cursor: 'pointer' }} 
                  onClick={() => handleRescheduleAction(task)} 
                  title="Reschedule Task"
                >
                  <Calendar size={14} />
                </button>
                
                <button 
                  className="btn btn-secondary btn-icon-round" 
                  style={{ padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '34px', height: '34px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)', cursor: 'pointer' }} 
                  onClick={() => handleAddNoteAction(task)} 
                  title="Add Log Note"
                >
                  <MoreVertical size={14} />
                </button>
              </>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>✔️ Activity Completed</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render all modals
  function renderModals() {
    return (
      <>
        {/* Outcome Select Modal */}
        {callOutcomeOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ padding: '24px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#D4AF37', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', paddingBottom: '10px', margin: 0 }}>
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
                    style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212, 175, 55, 0.15)', borderRadius: '8px', color: '#f1f5f9', cursor: 'pointer' }}
                  >
                    <span>{o}</span>
                    <ArrowRight size={14} style={{ color: '#D4AF37' }} />
                  </button>
                ))}
              </div>
              <button className="btn btn-secondary" onClick={() => { setCallOutcomeOpen(false); setSelectedTaskForCall(null); }} style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Completion Notes Modal */}
        {completionNotesOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ padding: '24px', width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#D4AF37', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', paddingBottom: '10px', margin: 0 }}>
                Mark Task Complete
              </h3>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>Completion Notes</label>
                <textarea 
                  className="form-control" 
                  rows="4" 
                  placeholder="Summarize details of this completed activity..."
                  value={completionNotesText}
                  onChange={(e) => setCompletionNotesText(e.target.value)}
                  style={{ background: 'rgba(5, 8, 15, 0.6)', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '8px', padding: '10px', color: '#f1f5f9' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => { setCompletionNotesOpen(false); setSelectedTaskForComplete(null); setCompletionNotesText(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={submitCompletion} style={{ padding: '8px 16px', borderRadius: '8px', background: '#D4AF37', color: '#05080F', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                  Submit & Complete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reschedule Modal */}
        {rescheduleOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ padding: '24px', width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#D4AF37', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', paddingBottom: '10px', margin: 0 }}>
                Reschedule Task
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => submitReschedule('30m')} style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', cursor: 'pointer' }}>+30 Minutes</button>
                <button className="btn btn-secondary" onClick={() => submitReschedule('1h')} style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', cursor: 'pointer' }}>+1 Hour</button>
                <button className="btn btn-secondary" onClick={() => submitReschedule('tomorrow')} style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', cursor: 'pointer' }}>+Tomorrow</button>
                <button className="btn btn-primary" onClick={() => submitReschedule('custom')} style={{ padding: '10px', borderRadius: '8px', background: '#D4AF37', color: '#05080F', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Save Custom</button>
              </div>

              <div style={{ borderTop: '1px solid rgba(212, 175, 55, 0.2)', paddingTop: '14px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Or pick custom date:</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={customRescheduleDate}
                    onChange={(e) => setCustomRescheduleDate(e.target.value)}
                    style={{ background: 'rgba(5, 8, 15, 0.6)', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '8px', padding: '8px', color: '#f1f5f9', flex: 1 }}
                  />
                  <input 
                    type="time" 
                    className="form-control" 
                    value={customRescheduleTime}
                    onChange={(e) => setCustomRescheduleTime(e.target.value)}
                    style={{ background: 'rgba(5, 8, 15, 0.6)', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '8px', padding: '8px', color: '#f1f5f9', width: '100px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button className="btn btn-secondary" onClick={() => { setRescheduleOpen(false); setSelectedTaskForReschedule(null); setCustomRescheduleDate(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Note Modal */}
        {noteOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ padding: '24px', width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#D4AF37', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', paddingBottom: '10px', margin: 0 }}>
                Add Activity Note
              </h3>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>Notes</label>
                <textarea 
                  className="form-control" 
                  rows="4" 
                  placeholder="Type notes to append to this lead's activity history..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  style={{ background: 'rgba(5, 8, 15, 0.6)', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '8px', padding: '10px', color: '#f1f5f9' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => { setNoteOpen(false); setSelectedTaskForNote(null); setNoteText(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={submitNote} style={{ padding: '8px 16px', borderRadius: '8px', background: '#D4AF37', color: '#05080F', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
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


