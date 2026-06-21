import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { Calendar, AlertTriangle, Users, TrendingUp, Compass, Award, Phone, CheckCircle, RefreshCw, BarChart2, Award as Trophy, Eye, LayoutGrid, DollarSign, PhoneCall, MessageSquare, Percent, Landmark, Activity } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import RecentActivities from './RecentActivities';

export default function Dashboard({ leads = [], employees = [], lastUpdated, onSelectLead, onDrillDown, onOpenLeadDrawer }) {
  const [stats, setStats] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLazyLoading, setIsLazyLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeFollowUpTab, setActiveFollowUpTab] = useState('today'); // 'today', 'missed', 'upcoming'

  // Sales Intelligence & Performance tracking states
  const [activeView, setActiveView] = useState('overview'); // 'overview' or 'sales-intelligence'
  const [salesIntelligenceData, setSalesIntelligenceData] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [salesError, setSalesError] = useState('');

  const fetchSalesIntelligence = async () => {
    setSalesLoading(true);
    setSalesError('');
    try {
      const data = await api.getSalesIntelligenceDashboard();
      setSalesIntelligenceData(data);
    } catch (e) {
      console.error('Failed to load sales intelligence dashboard stats:', e);
      setSalesError('Failed to fetch sales intelligence metrics.');
    } finally {
      setSalesLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'sales-intelligence') {
      fetchSalesIntelligence();
    }
  }, [activeView]);

  // Sync Mobile Calls Enhancement States
  const [pendingCalls, setPendingCalls] = useState([]);
  const [selectedCallForNotes, setSelectedCallForNotes] = useState(null);
  const [callNotesModalOpen, setCallNotesModalOpen] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [actionTaken, setActionTaken] = useState('None');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [createReminder, setCreateReminder] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);

  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [activeWhatsAppLead, setActiveWhatsAppLead] = useState(null);
  const [activeWhatsAppPhone, setActiveWhatsAppPhone] = useState('');
  const [whatsAppTemplates, setWhatsAppTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customWhatsAppText, setCustomWhatsAppText] = useState('');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const list = await api.getWhatsAppTemplates();
        setWhatsAppTemplates(list || []);
        if (list && list.length > 0) {
          setSelectedTemplateId(list[0].id);
        }
      } catch (err) {
        console.warn('Failed to load templates in Dashboard:', err);
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
    text = text.replace(/{executive_name}/gi, 'Our Executive');
    text = text.replace(/{unit_number}/gi, activeWhatsAppLead.unit_number || 'your unit');
    text = text.replace(/{token_amount}/gi, activeWhatsAppLead.booking_token_amount || 'token amount');
    return text;
  };

  const handleSendWhatsAppMessage = async () => {
    if (!activeWhatsAppLead) return;
    const messageText = getInterpolatedWhatsAppMessage();
    const cleanPhone = activeWhatsAppPhone.replace(/\D/g, '');
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(messageText)}`;
    
    try {
      await api.logWhatsAppActivity({ leadId: activeWhatsAppLead.id, actionType: 'WhatsApp Opened' });
      await api.logWhatsAppClick(activeWhatsAppLead.id, activeWhatsAppPhone, messageText);
    } catch (err) {
      console.warn('Failed to log WhatsApp click activity:', err);
    }
    window.open(url, '_blank');
    setWhatsAppModalOpen(false);
  };

  const fetchPendingCalls = async () => {
    try {
      const data = await api.getPendingMobileCalls();
      setPendingCalls(data || []);
    } catch (e) {
      console.warn('Failed to fetch pending mobile calls:', e);
    }
  };

  const handleSaveCallNotes = async (e) => {
    e.preventDefault();
    if (!selectedCallForNotes) return;
    setSavingNotes(true);
    try {
      const followUpDatetime = (actionTaken !== 'None' && followUpDate) 
        ? new Date(`${followUpDate}T${followUpTime || '09:00'}:00`).toISOString() 
        : null;

      await api.savePendingCallNotes(selectedCallForNotes.id, {
        notes: notesText,
        action_taken: actionTaken,
        follow_up_date: followUpDate || null,
        follow_up_time: followUpTime || null,
        follow_up_datetime: followUpDatetime,
        create_reminder: createReminder
      });

      alert('Call notes saved successfully!');
      setCallNotesModalOpen(false);
      setSelectedCallForNotes(null);
      await Promise.all([
        fetchPendingCalls(),
        fetchDashboardStats(),
        fetchRemindersList()
      ]);
    } catch (err) {
      alert(`Failed to save notes: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  };

  const lastFetchRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastFetchRef.current < 3000) {
      console.log('Skipping duplicate stats fetch (debounced)');
      return;
    }
    lastFetchRef.current = now;

    loadInitialDashboardData();
  }, [lastUpdated]); // Depend on primitive lastUpdated

  const loadInitialDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch basic stats, reminders, and pending calls in parallel for faster startup
      const [basicData, remindersData, pendingCallsData] = await Promise.all([
        api.getAdvancedDashboardStats({ basic: true }),
        api.getReminders(),
        api.getPendingMobileCalls()
      ]);

      setStats(basicData);
      setReminders(remindersData || []);
      setPendingCalls(pendingCallsData || []);
      setLoading(false); // Unblock KPI cards render immediately

      // Fetch full stats in the background (lazy load remaining widgets)
      setIsLazyLoading(true);
      const fullData = await api.getAdvancedDashboardStats();
      setStats(fullData);
    } catch (e) {
      console.error('Failed to load initial dashboard data:', e);
      setError('Failed to fetch real-time dashboard statistics.');
    } finally {
      setLoading(false);
      setIsLazyLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const basicData = await api.getAdvancedDashboardStats({ basic: true });
      setStats(basicData);
      setLoading(false);

      setIsLazyLoading(true);
      const fullData = await api.getAdvancedDashboardStats();
      setStats(fullData);
    } catch (e) {
      console.error('Failed to load dashboard stats:', e);
    } finally {
      setLoading(false);
      setIsLazyLoading(false);
    }
  };

  const fetchRemindersList = async () => {
    try {
      const data = await api.getReminders();
      setReminders(data || []);
    } catch (e) {
      console.error('Failed to fetch reminders for dashboard:', e);
    }
  };

  // Scalable server-driven follow-ups matching active reminders
  const todayStr = new Date().toLocaleDateString('en-CA');
  const activeReminders = reminders.filter(r => !r.is_read);
  
  const todayFollowUps = activeReminders
    .filter(r => r.reminder_date === todayStr && r.leads)
    .map(r => r.leads);
    
  const overdueFollowUps = activeReminders
    .filter(r => r.reminder_date < todayStr && r.leads)
    .map(r => r.leads);

  // SVG Chart Scaling Helpers
  const maxSourceCount = stats ? Math.max(...Object.values(stats.sourceDistribution), 1) : 1;
  const sourceCounts = stats ? Object.entries(stats.sourceDistribution).map(([name, count]) => ({ name, count })) : [];

  // Monthly Trend Area Chart (SVG)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyCounts = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyCounts[key] = { label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`, count: 0 };
  }
  leads.forEach(l => {
    if (!l.created_at) return;
    const date = new Date(l.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyCounts[key]) monthlyCounts[key].count++;
  });
  const trendData = Object.values(monthlyCounts);
  const maxTrendCount = Math.max(...trendData.map(t => t.count), 1);

  return (
    <div>
      {/* Dashboard View Switcher */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button 
          type="button"
          onClick={() => setActiveView('overview')}
          style={{
            background: activeView === 'overview' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeView === 'overview' ? '#000' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'var(--transition)'
          }}
        >
          <LayoutGrid size={16} /> Overview
        </button>
        <button 
          type="button"
          onClick={() => setActiveView('sales-intelligence')}
          style={{
            background: activeView === 'sales-intelligence' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeView === 'sales-intelligence' ? '#000' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'var(--transition)'
          }}
        >
          <BarChart2 size={16} /> Sales Intelligence
        </button>
      </div>

      {activeView === 'overview' ? (
        <>
          {/* Metric Cards Grid */}
          <div className="dashboard-grid">
            <div className="metric-card primary" onClick={() => onDrillDown && onDrillDown('Total Leads', {})}>
              <div className="metric-label">Total Leads</div>
              <div className="metric-value">{stats ? stats.summary.totalLeads : leads.length}</div>
            </div>
            <div className="metric-card hot" onClick={() => onDrillDown && onDrillDown('New Leads', { status: 'New' })}>
              <div className="metric-label">New Leads</div>
              <div className="metric-value">{stats ? stats.summary.newLeads : leads.filter(l => l.status === 'New').length}</div>
            </div>
            <div className="metric-card warm" onClick={() => onDrillDown && onDrillDown('Calls Today', { calls_today: 'true' })}>
              <div className="metric-label">Calls Today</div>
              <div className="metric-value">{stats ? stats.summary.callsToday : 0}</div>
              {stats && (
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8, display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <span>Conn: {stats.summary.connectedCallsToday || 0}</span>
                  <span>Missed: {stats.summary.missedCallsToday || 0}</span>
                </div>
              )}
            </div>
            <div className="metric-card info" onClick={() => onDrillDown && onDrillDown('Completed Visits', { site_visit_completed: 'true' })}>
              <div className="metric-label">Completed Visits</div>
              <div className="metric-value">{stats ? stats.summary.completedVisits : 0}</div>
            </div>
            <div className="metric-card success" onClick={() => onDrillDown && onDrillDown('Bookings Confirmed', { status: 'Booked' })}>
              <div className="metric-label">Bookings Confirmed</div>
              <div className="metric-value">{stats ? stats.summary.totalBookedCount : 0}</div>
            </div>
            <div className="metric-card primary" onClick={() => onDrillDown && onDrillDown('Total Revenue', {})}>
              <div className="metric-label">Total Revenue (Token)</div>
              <div className="metric-value">₹{(stats ? stats.summary.revenueEarned : 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Sales Funnel Section */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
              <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
              Sales Conversion Funnel
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {!isLazyLoading && stats && stats.funnel ? (
                (() => {
                  const funnelStages = [
                    { key: 'new', label: 'New Inquiries', count: stats.funnel.new, color: '#6366f1', description: 'Fresh incoming leads', filter: { status: 'New' } },
                    { key: 'contacted', label: 'Contacted / Engaged', count: stats.funnel.contacted, color: '#06b6d4', description: 'Calls made & warm prospects', filter: { status: 'Connected' } },
                    { key: 'visit', label: 'Site Visits', count: stats.funnel.visit, color: '#f59e0b', description: 'Visits scheduled or done', filter: { site_visit_completed: 'true' } },
                    { key: 'negotiation', label: 'Negotiations', count: stats.funnel.negotiation, color: '#ec4899', description: 'Hot leads in discussions', filter: { status: 'Negotiation' } },
                    { key: 'booked', label: 'Bookings Confirmed', count: stats.funnel.booked, color: '#10b981', description: 'Converted customers', filter: { status: 'Booked' } }
                  ];
                  const maxCount = Math.max(...funnelStages.map(s => s.count), 1);
                  
                  return funnelStages.map((stage, idx) => {
                    const pct = (stage.count / maxCount) * 100;
                    const conversionFromPrevious = idx === 0 ? 100 : (funnelStages[idx - 1].count > 0 ? Math.round((stage.count / funnelStages[idx - 1].count) * 100) : 0);
                    
                    return (
                      <div 
                        key={stage.key} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px', 
                          background: 'rgba(255, 255, 255, 0.01)', 
                          padding: '10px 14px', 
                          borderRadius: 'var(--radius-md)', 
                          border: '1px solid var(--border-color)', 
                          flexWrap: 'wrap',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onClick={() => onDrillDown && onDrillDown(stage.label, stage.filter)}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(223, 177, 91, 0.04)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)'}
                      >
                        <div style={{ width: '180px', minWidth: '150px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)' }}>{stage.label}</span>
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{stage.description}</span>
                        </div>
                        
                        <div style={{ flex: 1, minWidth: '200px', background: 'var(--bg-input)', height: '20px', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${Math.max(pct, 2)}%`, 
                              background: `linear-gradient(90deg, ${stage.color}aa 0%, ${stage.color} 100%)`, 
                              height: '100%', 
                              borderRadius: '4px',
                              transition: 'width 0.8s ease-out'
                            }}
                          />
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', fontWeight: 'bold', color: '#fff' }}>
                            {stage.count} leads
                          </span>
                        </div>

                        <div style={{ width: '150px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold' }}>
                          {idx === 0 ? (
                            <span style={{ color: 'var(--text-muted)' }}>Baseline</span>
                          ) : (
                            <span style={{ color: stage.count > 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                              ↓ {conversionFromPrevious}% conversion
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading funnel metrics...</div>
              )}
            </div>
          </div>

          {/* Operations & Analytics Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            
            {/* Widget 1: Unified Follow-Ups Controller */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: '380px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontSize: '14px', margin: 0 }}>
                  <Calendar size={16} style={{ color: 'var(--color-info)' }} />
                  Follow-Up Control Center
                </h3>
                
                {/* Tab Selectors */}
                <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-main)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button 
                    type="button"
                    onClick={() => setActiveFollowUpTab('today')}
                    style={{
                      background: activeFollowUpTab === 'today' ? 'var(--primary)' : 'transparent',
                      color: activeFollowUpTab === 'today' ? '#000' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Today ({activeReminders.filter(r => r.reminder_date === todayStr && r.leads).length})
                  </button>
                  <button 
                    type="button"
                    onClick={() => setActiveFollowUpTab('missed')}
                    style={{
                      background: activeFollowUpTab === 'missed' ? '#ef4444' : 'transparent',
                      color: activeFollowUpTab === 'missed' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Missed ({activeReminders.filter(r => r.reminder_date < todayStr && r.leads).length})
                  </button>
                  <button 
                    type="button"
                    onClick={() => setActiveFollowUpTab('upcoming')}
                    style={{
                      background: activeFollowUpTab === 'upcoming' ? '#06b6d4' : 'transparent',
                      color: activeFollowUpTab === 'upcoming' ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Upcoming ({activeReminders.filter(r => r.reminder_date > todayStr && r.leads).length})
                  </button>
                </div>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, maxHeight: '280px' }}>
                <table style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Lead Name</th>
                      <th>Mobile</th>
                      <th>{activeFollowUpTab === 'today' ? 'Time' : 'Date'}</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let filtered = [];
                      if (activeFollowUpTab === 'today') {
                        filtered = activeReminders.filter(r => r.reminder_date === todayStr && r.leads);
                      } else if (activeFollowUpTab === 'missed') {
                        filtered = activeReminders.filter(r => r.reminder_date < todayStr && r.leads);
                      } else {
                        filtered = activeReminders.filter(r => r.reminder_date > todayStr && r.leads);
                      }

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                              No {activeFollowUpTab} follow-ups scheduled.
                            </td>
                          </tr>
                        );
                      }
                      
                      return filtered.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: '600' }}>{r.leads.name}</td>
                          <td>{r.leads.phone1}</td>
                          <td>
                            {activeFollowUpTab === 'today' 
                              ? (r.reminder_time || 'N/A') 
                              : `${new Date(r.reminder_date).toLocaleDateString('en-CA', {month: 'short', day: 'numeric'})} ${r.reminder_time || ''}`
                            }
                          </td>
                          <td style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                            <button 
                              className="call-action-btn" 
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => onSelectLead && onSelectLead(r.leads)}
                              title="Call Lead"
                            >
                              📞 Call
                            </button>
                            <button 
                              className="whatsapp-action-btn" 
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => handleWhatsAppClick(r.leads.phone1, r.leads)}
                              title="WhatsApp Customer"
                            >
                              <FaWhatsapp size={12} /> WhatsApp
                            </button>
                            <button 
                              className="open-action-btn" 
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => onOpenLeadDrawer && onOpenLeadDrawer(r.leads.id)}
                              title="Open Lead"
                            >
                              👁 Open
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Widget: Pending Mobile Call Notes Synchronization */}
            {pendingCalls.length > 0 && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: '380px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontSize: '14px', margin: 0 }}>
                    <Phone size={16} style={{ color: '#f59e0b' }} />
                    Pending Mobile Call Notes ({pendingCalls.length})
                  </h3>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, maxHeight: '280px' }}>
                  <table style={{ width: '100%', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Lead Name</th>
                        <th>Call Detail</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCalls.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: '600' }}>{c.leads?.name || 'Unknown Lead'}</td>
                          <td>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {c.call_type} ({c.duration}s)
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {new Date(c.created_at || c.call_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="open-action-btn"
                              style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                              onClick={() => {
                                setSelectedCallForNotes(c);
                                setNotesText('');
                                setActionTaken('None');
                                setFollowUpDate('');
                                setFollowUpTime('');
                                setCreateReminder(true);
                                setCallNotesModalOpen(true);
                              }}
                            >
                              📝 Notes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Widget 2: Hot Leads Widget */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: '350px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: 'var(--text-main)', fontSize: '15px' }}>
                <TrendingUp size={18} style={{ color: 'var(--color-hot)' }} />
                Top 10 Hot Leads
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, maxHeight: '300px' }}>
                {(() => {
                  const topHotLeads = [...leads]
                    .filter(l => l.status === 'Hot')
                    .sort((a, b) => new Date(b.created_at || b.updated_at) - new Date(a.created_at || a.updated_at))
                    .slice(0, 10);
                  
                  if (topHotLeads.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                        No active hot leads found.
                      </div>
                    );
                  }
                  return topHotLeads.map(l => (
                    <div 
                      key={l.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '8px 12px', 
                        background: 'rgba(255, 255, 255, 0.01)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onClick={() => onOpenLeadDrawer && onOpenLeadDrawer(l.id)}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(223, 177, 91, 0.04)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)'}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)' }}>{l.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.project || 'No Project'} | {l.phone1}</div>
                      </div>
                      <span className="badge badge-hot" style={{ fontSize: '10px' }}>HOT</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Widget 3: Recent Activities Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '350px' }}>
              <RecentActivities limit={10} />
            </div>

            {/* Widget 4: Booking & Revenue Summary */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: '350px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: 'var(--text-main)', fontSize: '15px' }}>
                <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
                Booking & Revenue Summary
              </h3>
              {isLazyLoading || !stats || stats.basic ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: '13px' }}>
                  Loading booking & collection analytics...
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', flex: 1, alignContent: 'center' }}>
                  <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Today's Bookings</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '4px' }}>
                      {stats?.summary?.todayBookingsCount || 0}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monthly Bookings</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '4px' }}>
                      {stats?.summary?.monthlyBookingsCount || 0}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Collection Received</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e', marginTop: '4px' }}>
                      ₹{(stats?.summary?.collectionReceived || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending Collection</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-hot)', marginTop: '4px' }}>
                      ₹{(stats?.summary?.pendingCollection || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Widget 5: Lead Aging Analysis */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: '350px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: 'var(--text-main)', fontSize: '15px' }}>
                <Compass size={18} style={{ color: 'var(--primary)' }} />
                Lead Aging Analysis
              </h3>
              {isLazyLoading || !stats || stats.basic ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: '13px' }}>
                  Analyzing lead aging...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
                  {(() => {
                    const buckets = [
                      { label: 'Active (<7 Days)', count: stats?.leadAging?.active || 0, color: '#22c55e', daysStart: 7, daysEnd: 0 },
                      { label: 'Stagnant (7-15 Days)', count: stats?.leadAging?.stagnant || 0, color: '#eab308', daysStart: 15, daysEnd: 7 },
                      { label: 'Cold (15-30 Days)', count: stats?.leadAging?.cold || 0, color: '#f97316', daysStart: 30, daysEnd: 15 },
                      { label: 'Critical (30+ Days)', count: stats?.leadAging?.critical || 0, color: '#ef4444', daysStart: 9999, daysEnd: 30 }
                    ];
                    const getPastDateStr = (days) => {
                      if (days === 9999) return '';
                      const d = new Date();
                      d.setDate(d.getDate() - days);
                      return d.toISOString().split('T')[0];
                    };
                    
                    const totalAgingLeads = buckets.reduce((sum, b) => sum + b.count, 0) || 1;

                    return buckets.map(b => {
                      const pct = Math.round((b.count / totalAgingLeads) * 100);
                      const start = getPastDateStr(b.daysStart);
                      const end = getPastDateStr(b.daysEnd);

                      return (
                        <div 
                          key={b.label}
                          style={{ cursor: 'pointer' }}
                          onClick={() => onDrillDown && onDrillDown('Lead Aging', { created_start: start, created_end: end })}
                          title={`View ${b.count} leads`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{b.label}</span>
                            <span style={{ color: b.color, fontWeight: 'bold' }}>{b.count} ({pct}%)</span>
                          </div>
                          <div style={{ background: 'var(--bg-input)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, background: b.color, height: '100%', borderRadius: '4px' }}></div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Widget 6: Follow-up Compliance */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: '350px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: 'var(--text-main)', fontSize: '15px' }}>
                <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
                Follow-up Compliance
              </h3>
              {isLazyLoading || !stats || stats.basic ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: '13px' }}>
                  Calculating compliance score...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  
                  {/* Big Circular Compliance Indicator */}
                  <div style={{ 
                    position: 'relative', 
                    width: '100px', 
                    height: '100px', 
                    borderRadius: '50%', 
                    background: `conic-gradient(var(--color-success) ${stats?.compliance?.rate || 100}%, var(--bg-input) 0)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{ 
                      width: '84px', 
                      height: '84px', 
                      borderRadius: '50%', 
                      background: 'var(--bg-card)', 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {stats?.compliance?.rate || 100}%
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Compliance
                      </span>
                    </div>
                  </div>

                  {/* Metrics list */}
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around', fontSize: '12px' }}>
                    <div 
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => onDrillDown && onDrillDown('Completed Follow-ups', {})}
                    >
                      <div style={{ color: 'var(--color-success)', fontWeight: 'bold', fontSize: '14px' }}>
                        {stats?.compliance?.completed || 0}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Completed</div>
                    </div>
                    
                    <div 
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        onDrillDown && onDrillDown('Missed Follow-ups', { followup_end: today });
                      }}
                    >
                      <div style={{ color: 'var(--color-hot)', fontWeight: 'bold', fontSize: '14px' }}>
                        {stats?.compliance?.missed || 0}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Missed</div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--color-info)', fontWeight: 'bold', fontSize: '14px' }}>
                        {stats?.compliance?.pending || 0}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Pending</div>
                    </div>
                  </div>

                </div>
              )}
            </div>

          </div>

          {/* Employee Performance Snapshot */}
          <div className="table-panel" style={{ margin: 0 }}>
            <div className="table-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={18} style={{ color: 'var(--primary)' }} />
                Vrindavan Estates Employee Performance Snapshot
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click columns/rows to filter leads directory</span>
            </div>

            <div className="table-container">
              {isLazyLoading || loading || !stats || stats.basic ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  Calculating conversion rates and rankings...
                </div>
              ) : !stats.employeePerformance || stats.employeePerformance.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  No employee data registered in system.
                </div>
              ) : (
                <>
                  <style>{`
                    .snapshot-row {
                      cursor: pointer;
                      transition: background 0.15s ease;
                    }
                    .snapshot-row:hover {
                      background: rgba(223, 177, 91, 0.04) !important;
                    }
                    .snapshot-clickable-cell {
                      text-align: center;
                      cursor: pointer;
                      text-decoration: underline;
                      color: var(--primary);
                      font-weight: 600;
                      transition: color 0.15s ease;
                    }
                    .snapshot-clickable-cell:hover {
                      color: #fff;
                    }
                  `}</style>
                  <table style={{ width: '100%', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                        <th>Employee Name</th>
                        <th style={{ textAlign: 'center' }}>Leads Assigned</th>
                        <th style={{ textAlign: 'center' }}>Calls Today</th>
                        <th style={{ textAlign: 'center' }}>Site Visits</th>
                        <th style={{ textAlign: 'center' }}>Bookings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.employeePerformance.map((emp, idx) => {
                        const rank = idx + 1;
                        let rankBadgeColor = 'var(--text-muted)';
                        let trophyEmoji = '';
                        
                        if (rank === 1) {
                          rankBadgeColor = '#dfb15b';
                          trophyEmoji = '🏆';
                        } else if (rank === 2) {
                          rankBadgeColor = '#94a3b8';
                          trophyEmoji = '🥈';
                        } else if (rank === 3) {
                          rankBadgeColor = '#b45309';
                          trophyEmoji = '🥉';
                        }

                        return (
                          <tr 
                            key={emp.id} 
                            className="snapshot-row"
                            style={{ background: rank <= 3 ? 'rgba(219, 178, 93, 0.02)' : 'inherit' }}
                          >
                            <td 
                              style={{ textAlign: 'center', fontWeight: 'bold' }}
                              onClick={() => onDrillDown && onDrillDown('Employee Leads', { assigned_employee_id: emp.id, employee_name: emp.name, leads_count: emp.leadsCount })}
                            >
                              <span 
                                style={{ 
                                  background: rank <= 3 ? rankBadgeColor : 'none', 
                                  color: rank <= 3 ? '#000' : 'var(--text-muted)',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px'
                                }}
                              >
                                #{rank} {trophyEmoji}
                              </span>
                            </td>
                            <td 
                              style={{ fontWeight: '600' }}
                              onClick={() => onDrillDown && onDrillDown('Employee Leads', { assigned_employee_id: emp.id, employee_name: emp.name, leads_count: emp.leadsCount })}
                            >
                              {emp.name}
                            </td>
                            <td 
                              className="snapshot-clickable-cell"
                              onClick={() => onDrillDown && onDrillDown('Employee Leads', { assigned_employee_id: emp.id, employee_name: emp.name, leads_count: emp.leadsCount })}
                            >
                              {emp.leadsCount}
                            </td>
                            <td 
                              className="snapshot-clickable-cell"
                              style={{ color: 'var(--color-info)' }}
                              onClick={() => onDrillDown && onDrillDown('Employee Leads', { assigned_employee_id: emp.id, employee_name: emp.name, leads_count: emp.leadsCount, calls_today: 'true' })}
                            >
                              {emp.callsTodayCount || 0}
                            </td>
                            <td 
                              className="snapshot-clickable-cell"
                              style={{ color: 'var(--primary)' }}
                              onClick={() => onDrillDown && onDrillDown('Employee Leads', { assigned_employee_id: emp.id, employee_name: emp.name, leads_count: emp.leadsCount, site_visit_completed: 'true' })}
                            >
                              {emp.siteVisitsCount}
                            </td>
                            <td 
                              className="snapshot-clickable-cell"
                              style={{ color: 'var(--color-success)', fontWeight: 'bold' }}
                              onClick={() => onDrillDown && onDrillDown('Employee Leads', { assigned_employee_id: emp.id, employee_name: emp.name, leads_count: emp.leadsCount, status: 'Booked' })}
                            >
                              {emp.bookingsCount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          {salesLoading ? (
            <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
              <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 16px', color: 'var(--primary)', display: 'block' }} />
              <p>Analyzing Sales Performance & Marketing ROI...</p>
            </div>
          ) : salesError ? (
            <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--color-error)', border: '1px solid var(--color-error)' }}>
              <AlertTriangle size={32} style={{ margin: '0 auto 16px' }} />
              <p>{salesError}</p>
              <button className="btn btn-primary" onClick={fetchSalesIntelligence} style={{ marginTop: '12px' }}>
                Retry
              </button>
            </div>
          ) : salesIntelligenceData ? (
            (() => {
              const { kpis = {}, sourceROI = [], leaderboard = [], reports = {} } = salesIntelligenceData;
              
              const kpiList = [
                { label: 'Total Leads', value: kpis.totalLeads || 0, icon: <Users size={20} style={{ color: 'var(--primary)' }} /> },
                { label: 'Total Calls', value: kpis.totalCalls || 0, icon: <PhoneCall size={20} style={{ color: 'var(--color-info)' }} /> },
                { label: 'Connected Calls', value: kpis.connectedCalls || 0, icon: <Phone size={20} style={{ color: 'var(--color-success)' }} /> },
                { label: 'WhatsApp Activity', value: kpis.whatsappActivity || 0, icon: <FaWhatsapp size={20} style={{ color: '#25D366' }} /> },
                { label: 'Site Visits', value: kpis.siteVisits || 0, icon: <Compass size={20} style={{ color: 'var(--color-warm)' }} /> },
                { label: 'Bookings Confirmed', value: kpis.bookings || 0, icon: <Award size={20} style={{ color: 'var(--color-success)' }} /> },
                { label: 'Collections Received', value: `₹${(kpis.collections || 0).toLocaleString()}`, icon: <Landmark size={20} style={{ color: 'var(--primary)' }} /> },
                { label: 'Revenue Generated', value: `₹${(kpis.revenue || 0).toLocaleString()}`, icon: <TrendingUp size={20} style={{ color: 'var(--primary)' }} /> },
                { label: 'Conversion Rate', value: `${kpis.conversionRate || 0}%`, icon: <Percent size={20} style={{ color: 'var(--color-hot)' }} /> }
              ];

              const formatDuration = (seconds) => {
                if (!seconds || seconds <= 0) return '0s';
                const hrs = Math.floor(seconds / 3600);
                const mins = Math.floor((seconds % 3600) / 60);
                const secs = seconds % 60;
                if (hrs > 0) return `${hrs}h ${mins}m`;
                if (mins > 0) return `${mins}m ${secs}s`;
                return `${secs}s`;
              };

              return (
                <>
                  {/* Intelligence KPIs Grid */}
                  <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
                    {kpiList.map((kpi, idx) => (
                      <div key={idx} className="metric-card primary" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '110px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          {kpi.icon}
                          <div className="metric-label" style={{ margin: 0 }}>{kpi.label}</div>
                        </div>
                        <div className="metric-value" style={{ fontSize: '20px' }}>{kpi.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Marketing Channel Source ROI Table */}
                  <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: 'var(--text-main)' }}>
                      <Activity size={18} style={{ color: 'var(--primary)' }} />
                      Marketing Channel ROI & Performance
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ textAlign: 'left', padding: '12px', color: 'var(--text-muted)' }}>Channel Source</th>
                            <th style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>Leads Generated</th>
                            <th style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>Site Visits</th>
                            <th style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>Bookings Confirmed</th>
                            <th style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>Estimated Cost</th>
                            <th style={{ textAlign: 'right', padding: '12px', color: 'var(--text-muted)' }}>Revenue Closed</th>
                            <th style={{ textAlign: 'right', padding: '12px', color: 'var(--text-muted)' }}>ROI %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sourceROI.map((row, idx) => {
                            const costMap = {
                              'Facebook Ads': 15000,
                              'Google Ads': 25000,
                              'MagicBricks': 10000,
                              '99acres': 10000,
                              'Walk-ins': 0,
                              'Referrals': 5000
                            };
                            const cost = costMap[row.source] !== undefined ? costMap[row.source] : 5000;
                            const roiColor = row.roi > 0 ? 'var(--color-success)' : row.roi < 0 ? 'var(--color-error)' : 'var(--text-muted)';
                            const roiText = row.roi > 0 ? `+${row.roi}%` : `${row.roi}%`;
                            
                            return (
                              <tr key={row.source} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>{row.source}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{row.leads}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{row.visits}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{row.bookings}</td>
                                <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>₹{cost.toLocaleString()}</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: 'var(--primary)' }}>₹{row.revenue.toLocaleString()}</td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: roiColor }}>{roiText}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Executive Leaderboard & Scorecards */}
                  <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--text-main)' }}>
                      <Trophy size={18} style={{ color: 'var(--primary)' }} />
                      Executive Performance Leaderboard
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                      {leaderboard.map((card, index) => {
                        const rank = index + 1;
                        let rankColor = 'var(--text-muted)';
                        let trophy = '';
                        if (rank === 1) { rankColor = '#dfb15b'; trophy = '🏆'; }
                        else if (rank === 2) { rankColor = '#94a3b8'; trophy = '🥈'; }
                        else if (rank === 3) { rankColor = '#b45309'; trophy = '🥉'; }
                        
                        return (
                          <div 
                            key={card.id} 
                            className="card" 
                            style={{ 
                              background: 'rgba(13, 20, 19, 0.6)', 
                              border: rank <= 3 ? `1px solid ${rankColor}88` : '1px solid var(--border-color)',
                              boxShadow: rank === 1 ? '0 0 15px rgba(223, 177, 91, 0.15)' : 'none',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              transition: 'transform 0.2s, box-shadow 0.2s',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                          >
                            {rank <= 3 && (
                              <div style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                fontSize: '20px'
                              }}>
                                {trophy}
                              </div>
                            )}
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: rankColor,
                                color: rank <= 3 ? '#000' : 'var(--text-main)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '14px'
                              }}>
                                #{rank}
                              </div>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)' }}>{card.name}</h4>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{card.username}</span>
                              </div>
                            </div>

                            <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />

                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', fontWeight: 'bold' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Performance Index</span>
                                <span style={{ color: 'var(--primary)' }}>{card.performanceScore}/100</span>
                              </div>
                              <div style={{ background: 'var(--bg-input)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ 
                                  width: `${card.performanceScore}%`, 
                                  background: 'linear-gradient(90deg, var(--primary-glow) 0%, var(--primary) 100%)', 
                                  height: '100%' 
                                }} />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '11px' }}>
                              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Calls / Talk Time</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                                  {card.calls} ({formatDuration(card.talkTime)})
                                </span>
                              </div>
                              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block' }}>WhatsApp Chats</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{card.whatsappActivity} msgs</span>
                              </div>
                              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Compliance</span>
                                <span style={{ fontWeight: 'bold', color: card.compliance >= 80 ? 'var(--color-success)' : 'var(--color-error)' }}>
                                  {card.compliance}%
                                </span>
                              </div>
                              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Site Visits</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{card.siteVisits} visits</span>
                              </div>
                              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Bookings / Conv. %</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>
                                  {card.bookings} ({card.conversion}%)
                                </span>
                              </div>
                              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Revenue / Collections</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                  ₹{card.revenueGenerated.toLocaleString()} / ₹{card.collections.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Management Reports Section */}
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontSize: '15px', margin: 0 }}>
                        <Calendar size={18} style={{ color: 'var(--color-info)' }} />
                        Management Operations Reports
                      </h3>
                      
                      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-main)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {['daily', 'weekly', 'monthly'].map(tab => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveReportTab(tab)}
                            style={{
                              background: activeReportTab === tab ? 'var(--primary)' : 'transparent',
                              color: activeReportTab === tab ? '#000' : 'var(--text-muted)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              transition: 'all 0.2s'
                            }}
                          >
                            {tab} Report
                          </button>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const report = reports[activeReportTab];
                      if (!report) return null;
                      
                      const reportItems = [
                        { label: 'New Leads Ingested', value: report.leads, color: 'var(--text-main)' },
                        { label: 'Total Calls Logged', value: report.calls, color: 'var(--color-info)' },
                        { label: 'Connected Calls', value: report.connectedCalls, color: 'var(--color-success)' },
                        { label: 'WhatsApp Chats Logged', value: report.whatsapp, color: '#25D366' },
                        { label: 'Site Visits Conducted', value: report.siteVisits, color: 'var(--color-warm)' },
                        { label: 'Bookings Secured', value: report.bookings, color: 'var(--color-success)' },
                        { label: 'Collections Realized', value: `₹${(report.collections || 0).toLocaleString()}`, color: 'var(--primary)' },
                        { label: 'Total Sales Revenue', value: `₹${(report.revenue || 0).toLocaleString()}`, color: 'var(--primary)' }
                      ];

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                          {reportItems.map(item => (
                            <div key={item.label} style={{ background: 'var(--bg-input)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>{item.label}</span>
                              <span style={{ fontSize: '18px', fontWeight: 'bold', color: item.color }}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              );
            })()
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No intelligence data available.
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Modal */}
      {whatsAppModalOpen && (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Send WhatsApp Assistant</h3>
              <button className="close-btn" onClick={() => setWhatsAppModalOpen(false)}>&times;</button>
            </div>
            
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Select WhatsApp Template</label>
              <select 
                className="form-control" 
                value={selectedTemplateId} 
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                {whatsAppTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                ))}
                <option value="">Custom Message (No Template)</option>
              </select>
            </div>

            {selectedTemplateId ? (
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Template Preview</label>
                <div style={{ 
                  background: 'var(--bg-input)', 
                  padding: '10px', 
                  borderRadius: '4px', 
                  fontSize: '12px',
                  color: 'var(--text-main)',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid var(--border-color)',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  {getInterpolatedWhatsAppMessage()}
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Custom Message Text</label>
                <textarea 
                  className="form-control" 
                  rows={4}
                  value={customWhatsAppText}
                  onChange={(e) => setCustomWhatsAppText(e.target.value)}
                  placeholder="Type your custom greeting..."
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '15px' }}>
              <button className="btn btn-secondary" onClick={() => setWhatsAppModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSendWhatsAppMessage}>Send WhatsApp</button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Mobile Call Notes Modal */}
      {callNotesModalOpen && selectedCallForNotes && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">📝 Add Call Notes: {selectedCallForNotes.leads?.name}</h3>
            </div>
            <form onSubmit={handleSaveCallNotes}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Call Details</label>
                  <div style={{ background: 'var(--bg-main)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                    <strong>Type:</strong> {selectedCallForNotes.call_type} | <strong>Duration:</strong> {selectedCallForNotes.duration}s | <strong>Time:</strong> {new Date(selectedCallForNotes.created_at || selectedCallForNotes.call_date).toLocaleString()}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Employee Call Notes *</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Enter discussion details, customer response, etc."
                    required
                  ></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Next Scheduled Action</label>
                  <select 
                    className="form-control"
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                  >
                    <option value="None">None</option>
                    <option value="Callback Scheduled">Callback Scheduled</option>
                    <option value="Site Visit Scheduled">Site Visit Scheduled</option>
                    <option value="Meeting Arranged">Meeting Arranged</option>
                    <option value="Information Sent">Information Sent</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                {actionTaken !== 'None' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div className="form-group">
                      <label className="form-label">Follow-Up Date *</label>
                      <input 
                        type="date"
                        className="form-control"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Follow-Up Time</label>
                      <input 
                        type="time"
                        className="form-control"
                        value={followUpTime}
                        onChange={(e) => setFollowUpTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {actionTaken !== 'None' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                    <input 
                      type="checkbox"
                      id="create_reminder_cb"
                      checked={createReminder}
                      onChange={(e) => setCreateReminder(e.target.checked)}
                    />
                    <label htmlFor="create_reminder_cb" style={{ fontSize: '13px', cursor: 'pointer' }}>
                      Automatically create reminder on Dashboard
                    </label>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setCallNotesModalOpen(false);
                    setSelectedCallForNotes(null);
                  }}
                  disabled={savingNotes}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={savingNotes}
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
