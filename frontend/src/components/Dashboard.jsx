import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Calendar, AlertTriangle, Users, TrendingUp, Compass, Award, Phone, CheckCircle, RefreshCw, BarChart2, Award as Trophy, Eye } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import RecentActivities from './RecentActivities';

export default function Dashboard({ leads = [], employees = [], onSelectLead, onDrillDown, onOpenLeadDrawer }) {
  const [stats, setStats] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFollowUpTab, setActiveFollowUpTab] = useState('today'); // 'today', 'missed', 'upcoming'

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
      await api.logWhatsAppClick(activeWhatsAppLead.id, activeWhatsAppPhone, messageText);
    } catch (err) {
      console.warn('Failed to log WhatsApp click activity:', err);
    }
    window.open(url, '_blank');
    setWhatsAppModalOpen(false);
  };

  useEffect(() => {
    fetchDashboardStats();
    fetchRemindersList();
  }, [leads, employees]); // Refresh when core data changes

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const data = await api.getAdvancedDashboardStats();
      setStats(data);
    } catch (e) {
      console.error('Failed to load dashboard stats:', e);
      setError('Failed to fetch real-time dashboard statistics. Showing client-side estimation.');
    } finally {
      setLoading(false);
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
      {/* Metric Cards Grid */}
      <div class="dashboard-grid">
        <div class="metric-card primary" onClick={() => onDrillDown && onDrillDown('Total Leads', {})}>
          <div class="metric-label">Total Leads</div>
          <div class="metric-value">{stats ? stats.summary.totalLeads : leads.length}</div>
        </div>
        <div class="metric-card hot" onClick={() => onDrillDown && onDrillDown('New Leads', { status: 'New' })}>
          <div class="metric-label">New Leads</div>
          <div class="metric-value">{stats ? stats.summary.newLeads : leads.filter(l => l.status === 'New').length}</div>
        </div>
        <div class="metric-card warm" onClick={() => onDrillDown && onDrillDown('Calls Today', { calls_today: 'true' })}>
          <div class="metric-label">Calls Today</div>
          <div class="metric-value">{stats ? stats.summary.callsToday : 0}</div>
        </div>
        <div class="metric-card info" onClick={() => onDrillDown && onDrillDown('Completed Visits', { site_visit_completed: 'true' })}>
          <div class="metric-label">Completed Visits</div>
          <div class="metric-value">{stats ? stats.summary.completedVisits : 0}</div>
        </div>
        <div class="metric-card success" onClick={() => onDrillDown && onDrillDown('Bookings Confirmed', { status: 'Booked' })}>
          <div class="metric-label">Bookings Confirmed</div>
          <div class="metric-value">{stats ? stats.summary.totalBookedCount : 0}</div>
        </div>
        <div class="metric-card primary" onClick={() => onDrillDown && onDrillDown('Total Revenue', {})}>
          <div class="metric-label">Total Revenue (Token)</div>
          <div class="metric-value">₹{(stats ? stats.summary.revenueEarned : 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Sales Funnel Section */}
      <div class="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
          Sales Conversion Funnel
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {stats && stats.funnel ? (
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



      {/* Operations & Analytics Section (Replacing Heatmaps) */}
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
        </div>
        {/* Widget 5: Lead Aging Analysis */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: '350px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: 'var(--text-main)', fontSize: '15px' }}>
            <Compass size={18} style={{ color: 'var(--primary)' }} />
            Lead Aging Analysis
          </h3>
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
        </div>

        {/* Widget 6: Follow-up Compliance */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: '350px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: 'var(--text-main)', fontSize: '15px' }}>
            <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
            Follow-up Compliance
          </h3>
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
        </div>

      </div>

      {/* Widget 7: Employee Performance Snapshot */}
      <div className="table-panel" style={{ margin: 0 }}>
        <div className="table-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} style={{ color: 'var(--primary)' }} />
            Vrindavan Estates Employee Performance Snapshot
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click columns/rows to filter leads directory</span>
        </div>

        <div className="table-container">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              Calculating conversion rates and rankings...
            </div>
          ) : !stats || stats.employeePerformance.length === 0 ? (
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

    </div>
  );
}
