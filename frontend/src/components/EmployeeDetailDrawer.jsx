import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  X, User, Phone, Calendar, Clock, Award, Landmark, TrendingUp, BarChart2,
  MessageSquare, UserCheck, RefreshCw, Send, ArrowRightLeft, FileSpreadsheet,
  Activity, Smartphone, Laptop, Eye, HelpCircle, ChevronRight
} from 'lucide-react';

export default function EmployeeDetailDrawer({ 
  isOpen, 
  onClose, 
  employeeId,
  employees = [],
  currentUser,
  onRefreshData
}) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [trends, setTrends] = useState([]);
  const [funnel, setFunnel] = useState(null);

  // Tab states: 'assigned', 'hot', 'followups', 'visits', 'bookings', 'payments'
  const [activeTab, setActiveTab] = useState('assigned');
  
  // Lists data
  const [leads, setLeads] = useState([]);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPages, setLeadsPages] = useState(1);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadStatusFilter, setLeadStatusFilter] = useState(''); // Empty means show all assigned

  // Other lists
  const [otherList, setOtherList] = useState([]);
  const [otherLoading, setOtherLoading] = useState(false);

  // Quick Action panels
  const [showReassignPanel, setShowReassignPanel] = useState(false);
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  
  const [showWhatsAppPanel, setShowWhatsAppPanel] = useState(false);
  const [customMsg, setCustomMsg] = useState('');

  // Fetch employee performance stats
  useEffect(() => {
    if (isOpen && employeeId) {
      fetchPerformanceStats();
      setActiveTab('assigned');
      setLeadStatusFilter('');
      setLeads([]);
      setLeadsPage(1);
      setShowReassignPanel(false);
      setShowWhatsAppPanel(false);
    }
  }, [isOpen, employeeId]);

  // Handle tab and filter changes
  useEffect(() => {
    if (isOpen && employeeId) {
      if (activeTab === 'assigned' || activeTab === 'hot') {
        setLeads([]);
        setLeadsPage(1);
        fetchLeadsList(1, activeTab === 'hot' ? 'Hot' : leadStatusFilter);
      } else {
        fetchOtherList();
      }
    }
  }, [activeTab, leadStatusFilter, employeeId]);

  const fetchPerformanceStats = async () => {
    setLoading(true);
    try {
      const data = await api.getEmployeePerformance(employeeId);
      setProfile(data.profile);
      setMetrics(data.metrics);
      setTrends(data.trends || []);
      setFunnel(data.funnel);
    } catch (err) {
      console.error('Failed to fetch employee performance:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadsList = async (page = 1, status = '') => {
    setLeadsLoading(true);
    try {
      const filters = {
        assigned_employee_id: employeeId,
        page,
        limit: 15
      };
      if (status) {
        filters.status = status;
      }
      const data = await api.getLeads(filters);
      if (page === 1) {
        setLeads(data.leads || []);
      } else {
        setLeads(prev => [...prev, ...(data.leads || [])]);
      }
      setLeadsPage(data.page || 1);
      setLeadsTotal(data.total || 0);
      setLeadsPages(data.pages || 1);
    } catch (err) {
      console.error('Failed to load employee leads:', err);
    } finally {
      setLeadsLoading(false);
    }
  };

  const loadMoreLeads = () => {
    if (leadsPage < leadsPages) {
      fetchLeadsList(leadsPage + 1, activeTab === 'hot' ? 'Hot' : leadStatusFilter);
    }
  };

  const fetchOtherList = async () => {
    setOtherLoading(true);
    try {
      if (activeTab === 'followups') {
        // Fetch reminders and filter for this employee
        const allReminders = await api.getReminders();
        // Since api.getReminders returns a list, filter by employee ID
        const filtered = allReminders.filter(r => r.assigned_employee_id === employeeId);
        setOtherList(filtered);
      } else if (activeTab === 'visits') {
        // Fetch site visits
        const allVisits = await api.getSiteVisits();
        const filtered = allVisits.filter(v => v.leads?.assigned_employee_id === employeeId);
        setOtherList(filtered);
      } else if (activeTab === 'bookings') {
        // Fetch bookings
        const allBookings = await api.getBookings();
        const filtered = allBookings.filter(b => b.executive_id === employeeId);
        setOtherList(filtered);
      } else if (activeTab === 'payments') {
        // Fetch payments
        const allPayments = await api.getPayments();
        const filtered = allPayments.filter(p => p.bookings?.executive_id === employeeId);
        setOtherList(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch tab data:', err);
    } finally {
      setOtherLoading(false);
    }
  };

  // Click handler for KPI Metrics
  const handleMetricClick = (tabName, statusFilter = '') => {
    setActiveTab(tabName);
    if (tabName === 'assigned') {
      setLeadStatusFilter(statusFilter);
    }
  };

  // Quick Action: Reassign Leads
  const handleReassignLeads = async (e) => {
    e.preventDefault();
    if (!targetEmployeeId) return;
    
    const confirm = window.confirm('Are you sure you want to transfer ALL leads owned by this executive to the selected employee? This action is logged in audit trails.');
    if (!confirm) return;

    setReassigning(true);
    try {
      await api.transferEmployeeLeads(employeeId, targetEmployeeId);
      alert('All leads successfully reassigned/transferred!');
      setShowReassignPanel(false);
      fetchPerformanceStats();
      if (activeTab === 'assigned' || activeTab === 'hot') {
        fetchLeadsList(1, activeTab === 'hot' ? 'Hot' : leadStatusFilter);
      }
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(`Transfer failed: ${err.message}`);
    } finally {
      setReassigning(false);
    }
  };

  // Quick Action: Send WhatsApp
  const handleSendWhatsApp = () => {
    if (!profile || !profile.phone) return;
    const msg = customMsg || `Hello ${profile.full_name}, just checking in on your sales conversions and follow-up activities today. Let us review the outstanding collections. - Admin`;
    const url = `https://wa.me/${profile.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    setShowWhatsAppPanel(false);
  };

  // Quick Action: Export Employee Report
  const exportEmployeeReport = () => {
    if (!profile || !metrics) return;
    
    // Construct CSV content
    const rows = [
      ['Vrindavan Estates - Employee Performance Report'],
      ['Executive Name', profile.full_name],
      ['Username', profile.username],
      ['Role', profile.role],
      ['Status', profile.status],
      ['Joining Date', new Date(profile.created_at).toLocaleDateString()],
      ['Phone', profile.phone || 'N/A'],
      [],
      ['KPI Metrics', 'Value'],
      ['Total Leads Owned', metrics.leadsOwned],
      ['New Leads', metrics.newLeads],
      ['Hot Leads', metrics.hotLeads],
      ['Warm Leads', metrics.warmLeads],
      ['Cold Leads', metrics.coldLeads],
      ['Booked Leads', metrics.bookedLeads],
      ['Calls Made', metrics.callsMade],
      ['Connected Calls', metrics.connectedCalls],
      ['Not Connected Calls', metrics.notConnectedCalls],
      ['Follow-ups Pending', metrics.followUpsPending],
      ['Follow-ups Completed', metrics.followUpsCompleted],
      ['Site Visits Scheduled', metrics.visitsScheduled],
      ['Site Visits Completed', metrics.visitsCompleted],
      ['Site Visits Cancelled', metrics.visitsCancelled],
      ['Bookings Confirmed', metrics.totalBookings],
      ['Total Booking Value', `INR ${metrics.bookingValue}`],
      ['Collection Received', `INR ${metrics.collectionReceived}`],
      ['Pending Collection', `INR ${metrics.pendingCollection}`],
      ['Conversion Rate (%)', `${metrics.conversionRate}%`]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${profile.username}_performance_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render SVG charts
  const renderTrendChart = (title, key, color, formatter = (v) => v) => {
    if (trends.length === 0) return null;
    const maxVal = Math.max(...trends.map(t => t[key]), 1);

    return (
      <div className="chart-card" style={{ padding: '12px', flex: 1, minWidth: '170px', background: 'var(--bg-main)' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>{title}</div>
        <div style={{ height: '70px', position: 'relative' }}>
          <svg viewBox="0 0 200 60" width="100%" height="100%" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Draw sparkline */}
            {(() => {
              const points = trends.map((t, idx) => {
                const x = 10 + (idx * (180 / (trends.length - 1 || 1)));
                const y = 50 - ((t[key] / maxVal) * 40);
                return { x, y, label: t.month, val: t[key] };
              });
              const pathD = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
              const areaD = `${pathD} L ${points[points.length - 1].x} 50 L ${points[0].x} 50 Z`;
              
              return (
                <>
                  <path d={areaD} fill={`url(#grad-${key})`} />
                  <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" />
                  {points.map((p, idx) => (
                    <g key={idx}>
                      <circle cx={p.x} cy={p.y} r="2.5" fill="var(--bg-card)" stroke={color} strokeWidth="1" />
                      <title>{p.label}: {formatter(p.val)}</title>
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        </div>
        {/* Render Min / Max Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
          <span>{trends[0]?.month}</span>
          <span>{trends[trends.length - 1]?.month}</span>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 1050;
          animation: fadeIn 0.2s ease-out;
        }
        .drawer-content {
          position: fixed;
          top: 0;
          right: 0;
          width: 600px;
          max-width: 100%;
          height: 100%;
          background: var(--bg-card);
          border-left: 1px solid var(--border-color);
          box-shadow: -10px 0 35px rgba(0, 0, 0, 0.6);
          z-index: 1060;
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .drawer-tab {
          flex: 1;
          text-align: center;
          padding: 8px 10px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          transition: var(--transition);
          white-space: nowrap;
        }
        .drawer-tab.active {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(223, 177, 91, 0.03);
        }
        .metric-mini-card {
          background: var(--bg-main);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 10px;
          text-align: center;
          cursor: pointer;
          transition: var(--transition);
        }
        .metric-mini-card:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          background: var(--bg-card-hover);
        }
        .metric-mini-card.active {
          border-color: var(--primary);
          background: rgba(223, 177, 91, 0.03);
        }
        .metric-mini-title {
          font-size: 9.5px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .metric-mini-value {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-main);
        }
        .quick-action-btn-sm {
          padding: 6px 10px;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          border: 1px solid var(--border-color);
          background: var(--bg-input);
          color: var(--text-main);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: var(--transition);
        }
        .quick-action-btn-sm:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: var(--bg-card-hover);
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Overlay */}
      <div className="drawer-overlay" onClick={onClose}></div>

      {/* Drawer Container */}
      <div className="drawer-content">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User style={{ color: 'var(--primary)' }} size={20} />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
              {profile ? profile.full_name : 'Loading Executive Profile...'}
            </h3>
          </div>
          <button type="button" className="btn-close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ marginRight: '8px' }} /> Loading performance analytics...
          </div>
        ) : !profile || !metrics ? (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '20px' }}>
            Failed to load profile details. Executive record may be invalid.
          </div>
        ) : (
          <div className="drawer-body">
            {/* 1. Employee Profile Header Card */}
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Username: {profile.username}</span>
                  <strong style={{ fontSize: '16px', color: 'var(--text-main)' }}>{profile.full_name}</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Role: Sales Executive</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${profile.status === 'active' ? 'badge-success' : 'badge-cold'}`}>
                    {profile.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Joined: {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginTop: '10px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                <Phone size={12} />
                <span>Phone: {profile.phone || 'N/A'}</span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="quick-action-btn-sm" onClick={() => setShowReassignPanel(!showReassignPanel)}>
                <ArrowRightLeft size={12} /> Reassign Leads
              </button>
              <button className="quick-action-btn-sm" onClick={() => setShowWhatsAppPanel(!showWhatsAppPanel)}>
                <MessageSquare size={12} /> WhatsApp Employee
              </button>
              <button className="quick-action-btn-sm" onClick={exportEmployeeReport}>
                <FileSpreadsheet size={12} /> Export CSV Report
              </button>
            </div>

            {/* Sub-form Panel: Reassign Leads */}
            {showReassignPanel && (
              <form onSubmit={handleReassignLeads} style={{ background: 'rgba(239, 68, 68, 0.02)', border: '1px dashed rgba(239, 68, 68, 0.2)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-hot)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowRightLeft size={14} /> Bulk Lead Reassignment Panel
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Choose Executive to Transfer Leads To</label>
                  <select 
                    className="form-control" 
                    value={targetEmployeeId} 
                    onChange={e => setTargetEmployeeId(e.target.value)} 
                    style={{ fontSize: '12px', background: 'var(--bg-card)', marginTop: '4px' }}
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.filter(e => e.id !== employeeId).map(e => (
                      <option key={e.id} value={e.id}>{e.full_name} ({e.username})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setShowReassignPanel(false)}>Cancel</button>
                  <button type="submit" className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--color-hot)', color: '#fff' }} disabled={reassigning}>
                    {reassigning ? 'Transferring...' : 'Confirm Reassign'}
                  </button>
                </div>
              </form>
            )}

            {/* Sub-form Panel: Send WhatsApp */}
            {showWhatsAppPanel && (
              <div style={{ background: 'rgba(37, 211, 102, 0.02)', border: '1px dashed rgba(37, 211, 102, 0.2)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#25D366', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={14} /> Write WhatsApp Message
                </div>
                <div className="form-group">
                  <textarea 
                    className="form-control"
                    value={customMsg}
                    onChange={e => setCustomMsg(e.target.value)}
                    placeholder="Write a custom check-in message to this employee..."
                    rows={2}
                    style={{ fontSize: '12px', background: 'var(--bg-card)', padding: '6px', resize: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setShowWhatsAppPanel(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px', background: '#25D366', color: '#000', fontWeight: 'bold' }} onClick={handleSendWhatsApp}>
                    <Send size={11} /> Open WhatsApp
                  </button>
                </div>
              </div>
            )}

            {/* 2. Interactive Metrics Grid */}
            <div>
              <h4 style={{ fontSize: '12px', color: 'var(--text-main)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Performance KPI Metrics</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <div className={`metric-mini-card ${activeTab === 'assigned' && !leadStatusFilter ? 'active' : ''}`} onClick={() => handleMetricClick('assigned', '')}>
                  <div className="metric-mini-title">Total Leads</div>
                  <div className="metric-mini-value">{metrics.leadsOwned}</div>
                </div>
                <div className={`metric-mini-card ${activeTab === 'assigned' && leadStatusFilter === 'New' ? 'active' : ''}`} onClick={() => handleMetricClick('assigned', 'New')}>
                  <div className="metric-mini-title">New Leads</div>
                  <div className="metric-mini-value">{metrics.newLeads}</div>
                </div>
                <div className={`metric-mini-card ${activeTab === 'hot' ? 'active' : ''}`} onClick={() => handleMetricClick('hot', '')}>
                  <div className="metric-mini-title">Hot Leads</div>
                  <div className="metric-mini-value" style={{ color: 'var(--color-hot)' }}>{metrics.hotLeads}</div>
                </div>
                <div className="metric-mini-card" style={{ cursor: 'default' }}>
                  <div className="metric-mini-title">Conversion Rate</div>
                  <div className="metric-mini-value">{metrics.conversionRate}%</div>
                </div>
                
                <div className={`metric-mini-card ${activeTab === 'followups' ? 'active' : ''}`} onClick={() => handleMetricClick('followups')}>
                  <div className="metric-mini-title">Calls Made</div>
                  <div className="metric-mini-value">{metrics.callsMade}</div>
                </div>
                <div className={`metric-mini-card ${activeTab === 'followups' ? 'active' : ''}`} onClick={() => handleMetricClick('followups')}>
                  <div className="metric-mini-title">Connected Calls</div>
                  <div className="metric-mini-value" style={{ color: 'var(--color-info)' }}>{metrics.connectedCalls}</div>
                </div>
                <div className={`metric-mini-card ${activeTab === 'visits' ? 'active' : ''}`} onClick={() => handleMetricClick('visits')}>
                  <div className="metric-mini-title">visits done</div>
                  <div className="metric-mini-value" style={{ color: 'var(--primary)' }}>{metrics.visitsCompleted}</div>
                </div>
                <div className={`metric-mini-card ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => handleMetricClick('bookings')}>
                  <div className="metric-mini-title">Booked</div>
                  <div className="metric-mini-value" style={{ color: 'var(--color-success)' }}>{metrics.totalBookings}</div>
                </div>

                <div className={`metric-mini-card ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => handleMetricClick('payments')} style={{ gridColumn: 'span 2' }}>
                  <div className="metric-mini-title">Collections Received</div>
                  <div className="metric-mini-value" style={{ color: 'var(--color-success)', fontSize: '13px' }}>₹{metrics.collectionReceived.toLocaleString()}</div>
                </div>
                <div className={`metric-mini-card ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => handleMetricClick('payments')} style={{ gridColumn: 'span 2' }}>
                  <div className="metric-mini-title">Pending Collections</div>
                  <div className="metric-mini-value" style={{ color: 'var(--color-hot)', fontSize: '13px' }}>₹{metrics.pendingCollection.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* 3. Performance Trend SVG sparklines */}
            <div>
              <h4 style={{ fontSize: '12px', color: 'var(--text-main)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Acquisition & Revenue Trends</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {renderTrendChart('Calls Trend', 'calls', 'var(--color-info)')}
                {renderTrendChart('Site Visits Trend', 'visits', '#eab308')}
                {renderTrendChart('Bookings Trend', 'bookings', 'var(--color-success)')}
                {renderTrendChart('Revenue closed', 'revenue', 'var(--primary)', (v) => `₹${(v / 1000).toFixed(0)}k`)}
              </div>
            </div>

            {/* 4. Paginated Lists Tab Section */}
            <div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', marginBottom: '12px' }}>
                <div className={`drawer-tab ${activeTab === 'assigned' ? 'active' : ''}`} onClick={() => handleMetricClick('assigned', '')}>Assigned Leads</div>
                <div className={`drawer-tab ${activeTab === 'hot' ? 'active' : ''}`} onClick={() => handleMetricClick('hot', '')}>Hot Leads</div>
                <div className={`drawer-tab ${activeTab === 'followups' ? 'active' : ''}`} onClick={() => setActiveTab('followups')}>Follow-ups</div>
                <div className={`drawer-tab ${activeTab === 'visits' ? 'active' : ''}`} onClick={() => setActiveTab('visits')}>Site Visits</div>
                <div className={`drawer-tab ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>Bookings</div>
                <div className={`drawer-tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments</div>
              </div>

              {/* Tab Content rendering */}
              <div style={{ minHeight: '200px' }}>
                {/* 4A. Assigned or Hot Leads (Server-side paginated) */}
                {(activeTab === 'assigned' || activeTab === 'hot') && (
                  <div>
                    {leadsLoading && leads.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading leads...</div>
                    ) : leads.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>No matching leads assigned to this executive.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {leads.map(l => (
                          <div key={l.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>{l.name}</strong>
                              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{l.project || 'No project'} | {l.phone1}</span>
                            </div>
                            <span className={`badge badge-${l.status.toLowerCase()}`}>{l.status}</span>
                          </div>
                        ))}

                        {/* Load More Button for 50,000+ Leads Pagination */}
                        {leadsPage < leadsPages && (
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ alignSelf: 'center', fontSize: '11px', padding: '5px 12px', marginTop: '8px' }} 
                            onClick={loadMoreLeads}
                            disabled={leadsLoading}
                          >
                            {leadsLoading ? 'Loading more...' : 'Load More Leads'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 4B. Followups List */}
                {activeTab === 'followups' && (
                  <div>
                    {otherLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading calls and reminders...</div>
                    ) : otherList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>No reminders logged for this executive.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {otherList.map(r => (
                          <div key={r.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                              <strong style={{ color: 'var(--text-main)' }}>{r.leads?.name || 'Customer'}</strong>
                              <span className={`badge ${r.is_read ? 'badge-success' : 'badge-warm'}`} style={{ fontSize: '8px' }}>
                                {r.is_read ? 'Done' : 'Pending'}
                              </span>
                            </div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              Title: <span style={{ color: 'var(--text-main)' }}>{r.title}</span>
                            </p>
                            <span style={{ fontSize: '9px', color: 'var(--primary)' }}>Scheduled: {r.reminder_date}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4C. Site Visits List */}
                {activeTab === 'visits' && (
                  <div>
                    {otherLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading site visits...</div>
                    ) : otherList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>No site visits registered.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {otherList.map(v => (
                          <div key={v.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                              <strong style={{ color: 'var(--text-main)' }}>{v.leads?.name || 'Customer'}</strong>
                              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{v.outcome}</span>
                            </div>
                            {v.feedback && <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: 'var(--text-muted)' }}>Feedback: "{v.feedback}"</p>}
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Date: {v.visit_date}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4D. Bookings List */}
                {activeTab === 'bookings' && (
                  <div>
                    {otherLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading bookings...</div>
                    ) : otherList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>No bookings closed yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {otherList.map(b => (
                          <div key={b.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>{b.leads?.name || 'Customer'}</strong>
                              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>Unit Number: {b.unit_number || 'N/A'}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-success)' }}>₹{(parseFloat(b.token_amount) + parseFloat(b.booking_amount)).toLocaleString()}</span>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{new Date(b.booking_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4E. Payments List */}
                {activeTab === 'payments' && (
                  <div>
                    {otherLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading payment schedules...</div>
                    ) : otherList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>No payment records found.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {otherList.map(p => (
                          <div key={p.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <strong style={{ color: 'var(--text-main)' }}>{p.bookings?.leads?.name || 'Customer'}</strong>
                              <span className={`badge ${p.status === 'Completed' ? 'badge-success' : 'badge-warm'}`} style={{ fontSize: '8px' }}>{p.status}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0' }}>
                              <div>Total Cost: <strong style={{ color: 'var(--text-main)' }}>₹{p.total_cost?.toLocaleString()}</strong></div>
                              <div>Received: <strong style={{ color: 'var(--color-success)' }}>₹{p.amount_received?.toLocaleString()}</strong></div>
                              <div>Outstanding: <strong style={{ color: 'var(--color-hot)' }}>₹{p.balance?.toLocaleString()}</strong></div>
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>Due Date: {p.due_date}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
