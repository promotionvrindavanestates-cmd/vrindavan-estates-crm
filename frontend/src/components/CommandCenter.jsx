import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Phone, Clock, MessageSquare, Plus, CheckCircle, Calendar, RefreshCw, BarChart2, Award, Users, AlertTriangle, TrendingUp, Compass, Search, Filter, ArrowRight, User, MapPin, DollarSign, Award as Trophy } from 'lucide-react';
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
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Compass size={28} /> Sales Command Center
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Daybook - Live Pending Activities & Targets
          </p>
        </div>
        
        <button className="btn btn-primary" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} /> Sync Daybook
        </button>
      </div>

      {/* Counters Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div 
          onClick={() => setActiveCounterFilter(activeCounterFilter === 'overdue' ? 'all' : 'overdue')}
          style={{ 
            background: 'var(--bg-card)', 
            padding: '16px', 
            borderRadius: 'var(--radius-md)', 
            border: activeCounterFilter === 'overdue' ? '2px solid var(--color-hot)' : '1px solid var(--border-color)',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
            transition: 'transform 0.2s',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          className="command-counter-card"
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>🔴 Overdue</span>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-hot)', marginTop: '10px' }}>{counts.overdue}</span>
        </div>

        <div 
          onClick={() => setActiveCounterFilter(activeCounterFilter === 'today' ? 'all' : 'today')}
          style={{ 
            background: 'var(--bg-card)', 
            padding: '16px', 
            borderRadius: 'var(--radius-md)', 
            border: activeCounterFilter === 'today' ? '2px solid var(--color-warm)' : '1px solid var(--border-color)',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          className="command-counter-card"
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>🟡 Today</span>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-warm)', marginTop: '10px' }}>{counts.today}</span>
        </div>

        <div 
          onClick={() => setActiveCounterFilter(activeCounterFilter === 'tomorrow' ? 'all' : 'tomorrow')}
          style={{ 
            background: 'var(--bg-card)', 
            padding: '16px', 
            borderRadius: 'var(--radius-md)', 
            border: activeCounterFilter === 'tomorrow' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          className="command-counter-card"
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>🔵 Tomorrow</span>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6', marginTop: '10px' }}>{counts.tomorrow}</span>
        </div>

        <div 
          onClick={() => setActiveCounterFilter(activeCounterFilter === 'week' ? 'all' : 'week')}
          style={{ 
            background: 'var(--bg-card)', 
            padding: '16px', 
            borderRadius: 'var(--radius-md)', 
            border: activeCounterFilter === 'week' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          className="command-counter-card"
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>📅 This Week</span>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)', marginTop: '10px' }}>{counts.week}</span>
        </div>

        <div 
          onClick={() => setActiveCounterFilter(activeCounterFilter === 'completed' ? 'all' : 'completed')}
          style={{ 
            background: 'var(--bg-card)', 
            padding: '16px', 
            borderRadius: 'var(--radius-md)', 
            border: activeCounterFilter === 'completed' ? '2px solid var(--color-success)' : '1px solid var(--border-color)',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          className="command-counter-card"
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>✅ Completed</span>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-success)', marginTop: '10px' }}>{counts.completed}</span>
        </div>
      </div>

      {/* Main Grid View */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px' }} className="command-grid-layout">
        
        {/* Left Column: Tasks Board */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Filters and Search Bar */}
          <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search client by Name, Mobile, City, Project..." 
                  style={{ paddingLeft: '36px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={12} /> Filters:
              </span>

              <select className="form-control" style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">All Tasks</option>
                <option value="call">Calls</option>
                <option value="meeting">Meetings</option>
                <option value="visit">Site Visits</option>
                <option value="booking">Bookings</option>
                <option value="collection">Collections</option>
                <option value="reminder">Reminders</option>
              </select>

              <select className="form-control" style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                <option value="all">All Priorities</option>
                <option value="hot">🔥 Hot Leads</option>
                <option value="warm">Warm Leads</option>
                <option value="cold">Cold Leads</option>
              </select>

              <select className="form-control" style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                <option value="all">All Projects</option>
                <option value="skf">SKF</option>
                <option value="vrindavan">Vrindavan</option>
              </select>

              <select className="form-control" style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }} value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                <option value="all">All Sources</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Facebook">Facebook</option>
                <option value="Google">Google</option>
                <option value="Website">Website</option>
              </select>

              {isAdmin && (
                <select className="form-control" style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }} value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
                  <option value="all">All Employees</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Grouped Tasks Lists */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              Loading task lists...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Overdue Section */}
              {grouped.overdue.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-hot)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '6px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🔴 Overdue Activities
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {grouped.overdue.map(t => renderTaskCard(t))}
                  </div>
                </div>
              )}

              {/* Today Section */}
              {grouped.today.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-warm)', borderBottom: '1px solid rgba(245, 158, 11, 0.2)', paddingBottom: '6px', marginBottom: '12px' }}>
                    🟡 Today ({formatDateHeader('2026-06-23')})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {grouped.today.map(t => renderTaskCard(t))}
                  </div>
                </div>
              )}

              {/* Tomorrow Section */}
              {grouped.tomorrow.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#3b82f6', borderBottom: '1px solid rgba(59, 130, 246, 0.2)', paddingBottom: '6px', marginBottom: '12px' }}>
                    🔵 Tomorrow ({formatDateHeader('2026-06-24')})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {grouped.tomorrow.map(t => renderTaskCard(t))}
                  </div>
                </div>
              )}

              {/* This Week Section */}
              {grouped.week.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
                    📅 Later This Week
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {grouped.week.map(t => renderTaskCard(t))}
                  </div>
                </div>
              )}

              {/* Completed Section */}
              {grouped.completed.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-success)', borderBottom: '1px solid rgba(34, 197, 94, 0.2)', paddingBottom: '6px', marginBottom: '12px' }}>
                    ✅ Completed Tasks
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {grouped.completed.map(t => renderTaskCard(t))}
                  </div>
                </div>
              )}

              {filteredTasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  No pending activities found matching filters.
                </div>
              )}

            </div>
          )}

        </div>

        {/* Right Column: Widgets / Admin View */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Lost Follow-Up Alerts Widget */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%)', 
            padding: '16px', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-hot)', fontWeight: 'bold', fontSize: '13px' }}>
              <AlertTriangle size={16} /> Lost Follow-Up Alerts
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {missedStats.count} Missed Activities
            </div>
            <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '8px', marginTop: '4px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estimated Revenue Risk</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-hot)', marginTop: '2px' }}>
                ₹{missedStats.risk} Crore
              </div>
            </div>
          </div>

          {/* Daily Target Widget */}
          {targets && (
            <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                🎯 Daily Targets Widget
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Calls */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span>📞 Call Logs</span>
                    <span>{targets.calls.actual} / {targets.calls.target}</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--primary)', width: `${Math.min(100, (targets.calls.actual / targets.calls.target) * 100)}%` }}></div>
                  </div>
                </div>

                {/* Meetings */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span>🤝 Meetings</span>
                    <span>{targets.meetings.actual} / {targets.meetings.target}</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#3b82f6', width: `${Math.min(100, (targets.meetings.actual / targets.meetings.target) * 100)}%` }}></div>
                  </div>
                </div>

                {/* Visits */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span>🏠 Site Visits</span>
                    <span>{targets.visits.actual} / {targets.visits.target}</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#eab308', width: `${Math.min(100, (targets.visits.actual / targets.visits.target) * 100)}%` }}></div>
                  </div>
                </div>

                {/* Bookings */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span>💰 Token Bookings</span>
                    <span>{targets.bookings.actual} / {targets.bookings.target}</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--color-success)', width: `${Math.min(100, (targets.bookings.actual / targets.bookings.target) * 100)}%` }}></div>
                  </div>
                </div>

                {/* Collections */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span>💵 Collections</span>
                    <span>{targets.collections.actual} / {targets.collections.target}</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#a855f7', width: `${Math.min(100, (targets.collections.actual / targets.collections.target) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Performance View */}
          {isAdmin && performance.length > 0 && (
            <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                📊 Employee Productivity (Today)
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px 4px' }}>Employee</th>
                      <th style={{ padding: '6px 4px', textAlign: 'center' }}>Tasks</th>
                      <th style={{ padding: '6px 4px', textAlign: 'center' }}>Done</th>
                      <th style={{ padding: '6px 4px', textAlign: 'center' }}>Visits</th>
                      <th style={{ padding: '6px 4px', textAlign: 'center' }}>Book</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.map((p, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>{p.todayTasks}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--color-success)' }}>{p.completed}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>{p.siteVisits}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>{p.bookings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Outcome Select Modal */}
      {callOutcomeOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              Select Call Outcome
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Call completed for <strong>{selectedTaskForCall?.lead?.name}</strong>. Choose status to update:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['No Response', 'Busy', 'Interested', 'Follow Up', 'Site Visit', 'Negotiation', 'Booked'].map((o, idx) => (
                <button 
                  key={idx} 
                  className="btn btn-secondary" 
                  onClick={() => submitCallOutcome(o)}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', padding: '10px 14px' }}
                >
                  <span>{o}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={() => { setCallOutcomeOpen(false); setSelectedTaskForCall(null); }} style={{ marginTop: '8px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Completion Notes Modal */}
      {completionNotesOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              Mark Task Complete
            </h3>
            <div className="form-group">
              <label>Completion Notes</label>
              <textarea 
                className="form-control" 
                rows="4" 
                placeholder="Enter summary details of the activity completion..."
                value={completionNotesText}
                onChange={(e) => setCompletionNotesText(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setCompletionNotesOpen(false); setSelectedTaskForComplete(null); setCompletionNotesText(''); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitCompletion}>
                Submit & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              Reschedule Task
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => submitReschedule('30m')}>+30 Minutes</button>
              <button className="btn btn-secondary" onClick={() => submitReschedule('1h')}>+1 Hour</button>
              <button className="btn btn-secondary" onClick={() => submitReschedule('tomorrow')}>+Tomorrow</button>
              <button className="btn btn-primary" onClick={() => submitReschedule('custom')}>Save Custom</button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Or pick custom date:</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="date" 
                  className="form-control" 
                  value={customRescheduleDate}
                  onChange={(e) => setCustomRescheduleDate(e.target.value)}
                />
                <input 
                  type="time" 
                  className="form-control" 
                  value={customRescheduleTime}
                  onChange={(e) => setCustomRescheduleTime(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button className="btn btn-secondary" onClick={() => { setRescheduleOpen(false); setSelectedTaskForReschedule(null); setCustomRescheduleDate(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', width: '90%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              Add Activity Note
            </h3>
            <div className="form-group">
              <label>Notes</label>
              <textarea 
                className="form-control" 
                rows="4" 
                placeholder="Type your notes about this lead activity..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setNoteOpen(false); setSelectedTaskForNote(null); setNoteText(''); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitNote}>
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  // Render card helper
  function renderTaskCard(task) {
    const priority = getLeadPriorityText(task.lead);
    const badgeClass = getPriorityBadgeClass(priority);
    const employeeName = employees.find(e => e.id === task.lead?.assigned_employee_id)?.full_name || 'Unassigned';

    return (
      <div 
        key={task.id} 
        style={{ 
          background: 'var(--bg-card)', 
          borderLeft: `4px solid ${priority === 'Hot' ? 'var(--color-hot)' : (priority === 'Warm' ? 'var(--color-warm)' : 'var(--border-color)')}`,
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)', 
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Top line: Task Title & Type badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>{task.type}</div>
            <h4 style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '2px' }}>{task.title}</h4>
          </div>
          
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span className={`priority-badge ${badgeClass}`}>{priority === 'Hot' ? '🔥 Hot' : (priority === 'Warm' ? '🟡 Warm' : '⚪ Cold')}</span>
            {task.is_completed && <span style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)', borderRadius: '3px', fontWeight: 600 }}>Completed</span>}
          </div>
        </div>

        {/* Client details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {task.lead && (
            <>
              <div>👤 <strong>{task.lead.name}</strong></div>
              <div>📞 {task.lead.phone1}</div>
              <div>📍 {task.lead.city || 'N/A'}</div>
              <div>🏢 {task.lead.project}</div>
              <div>💰 ₹{task.lead.budget} Lakhs</div>
              <div>📈 {task.lead.status}</div>
            </>
          )}
          <div>👤 Owner: {employeeName}</div>
          <div>📅 Date: {task.date}</div>
          <div>⏰ Time: {task.time}</div>
        </div>

        {/* Notes/Instructions */}
        {task.notes && (
          <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '12px', borderLeft: '3px solid var(--border-color)' }}>
            <strong>Notes:</strong> {task.notes}
          </div>
        )}

        {/* Completed Metadata */}
        {task.is_completed && (
          <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px', fontSize: '11px', color: 'var(--color-success)' }}>
            <div>✔️ Completed at: {new Date(task.completed_at).toLocaleString()}</div>
            {task.completion_notes && <div style={{ marginTop: '2px' }}>✏️ Notes: {task.completion_notes}</div>}
          </div>
        )}

        {/* Quick Actions Panel */}
        {!task.is_completed && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleCallAction(task)}>
              📞 Call
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleWhatsAppAction(task)}>
              <FaWhatsapp size={12} style={{ color: '#25D366' }} /> WhatsApp
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onOpenLeadDrawer(task.lead_id)}>
              📂 Open Lead
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleAddNoteAction(task)}>
              📝 Add Note
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleRescheduleAction(task)}>
              ⏰ Reschedule
            </button>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-success-bg)', border: '1px solid var(--color-success)', color: 'var(--color-success)' }} onClick={() => handleCompleteAction(task)}>
              ✅ Complete
            </button>
          </div>
        )}
      </div>
    );
  }
}
