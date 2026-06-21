import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Download, Users, RefreshCw, BarChart2, Calendar, FileSpreadsheet, ShieldAlert, ArrowRight, Landmark, PhoneCall, Award, MapPin, TrendingUp, Trophy, BadgeCent } from 'lucide-react';
import RevenueAnalytics from './RevenueAnalytics';
import IncentiveCalculator from './IncentiveCalculator';
const SourceRoiDashboard = React.lazy(() => import('./SourceRoiDashboard'));
const EmployeePerformanceReports = React.lazy(() => import('./EmployeePerformanceReports'));
import EmployeeDashboardView from './EmployeeDashboardView';

export default function ReportsAnalytics({ currentUser, onDrillDown }) {
  const [stats, setStats] = useState(null);
  const [inactiveLeads, setInactiveLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('analytics'); // 'analytics', 'roi', 'emp_dashboard', 'incentives', 'funnel', 'performance', 'revenue', 'reports', 'inactive'

  // Conversion Funnel State
  const [funnelStats, setFunnelStats] = useState(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [funnelFilterEmployeeId, setFunnelFilterEmployeeId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'funnel') {
      fetchFunnelData();
    }
  }, [activeSubTab, funnelFilterEmployeeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const statsData = await api.getAdvancedDashboardStats();
      setStats(statsData);
      
      const empData = await api.getEmployees();
      setEmployees(empData);

      if (currentUser.role === 'admin') {
        const inactiveData = await api.getInactiveLeadsQueue();
        setInactiveLeads(inactiveData);
      }
    } catch (e) {
      console.error('Failed to fetch reports analytics data:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFunnelData = async () => {
    setFunnelLoading(true);
    try {
      const data = await api.getFunnelStats(funnelFilterEmployeeId);
      setFunnelStats(data);
    } catch (e) {
      console.error('Failed to fetch conversion funnel:', e);
    } finally {
      setFunnelLoading(false);
    }
  };

  const handleExportReport = async (type) => {
    try {
      await api.exportReport(type);
      alert(`${type.toUpperCase()} Report downloaded successfully!`);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleReassign = async (lead) => {
    const empId = window.prompt(
      `Enter Employee ID to assign to "${lead.name}":\n\n` + 
      employees.map(e => `${e.full_name}: ${e.id}`).join('\n')
    );
    if (!empId) return;

    const matchedEmp = employees.find(e => e.id === empId || e.full_name.toLowerCase().includes(empId.toLowerCase()));
    if (!matchedEmp) {
      alert("Invalid employee ID or name.");
      return;
    }

    try {
      await api.updateLead(lead.id, { ...lead, assigned_employee_id: matchedEmp.id });
      alert(`Lead reassigned to ${matchedEmp.full_name}!`);
      fetchData();
    } catch (err) {
      alert(`Failed to assign lead: ${err.message}`);
    }
  };

  const getDaysAgo = (dateStr) => {
    if (!dateStr) return 'N/A';
    const diffTime = Math.abs(new Date() - new Date(dateStr));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days ago`;
  };

  const handleFunnelStageClick = (stage) => {
    if (!onDrillDown) return;
    const filter = { 
      assigned_employee_id: funnelFilterEmployeeId,
      employee_name: employees.find(e => e.id === funnelFilterEmployeeId)?.full_name || ''
    };

    switch (stage) {
      case 'leads':
        onDrillDown('Leads', filter);
        break;
      case 'contacted':
        onDrillDown('Leads', { ...filter, status: 'Connected' }); // Drilldown to connected leads
        break;
      case 'site_visit':
        onDrillDown('Leads', { ...filter, site_visit_completed: 'true' });
        break;
      case 'negotiation':
        onDrillDown('Leads', { ...filter, status: 'Negotiation' });
        break;
      case 'booking':
        onDrillDown('Leads', { ...filter, status: 'Booked' });
        break;
      case 'revenue':
        // Drill down to Bookings Registry
        onDrillDown('Total Revenue', filter);
        break;
      default:
        break;
    }
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div style={{ marginTop: '20px' }}>
      
      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button 
          className={`btn ${activeSubTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('analytics')}
        >
          📈 Charts
        </button>
        <button 
          className={`btn ${activeSubTab === 'roi' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('roi')}
        >
          📊 Source ROI
        </button>
        <button 
          className={`btn ${activeSubTab === 'emp_dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('emp_dashboard')}
        >
          👤 Employee Dashboard
        </button>
        <button 
          className={`btn ${activeSubTab === 'incentives' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('incentives')}
        >
          🧮 Incentive Calc
        </button>
        <button 
          className={`btn ${activeSubTab === 'funnel' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('funnel')}
        >
          🌪️ Funnel Analytics
        </button>
        {isAdmin && (
          <button 
            className={`btn ${activeSubTab === 'performance' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('performance')}
          >
            📋 Performance Reports
          </button>
        )}
        <button 
          className={`btn ${activeSubTab === 'revenue' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('revenue')}
        >
          💰 Ledger
        </button>
        {isAdmin && (
          <button 
            className={`btn ${activeSubTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('reports')}
          >
            📥 Exports
          </button>
        )}
        {isAdmin && (
          <button 
            className={`btn ${activeSubTab === 'inactive' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('inactive')}
          >
            ⚠️ Inactive Queue ({inactiveLeads.length})
          </button>
        )}
      </div>

      {loading && activeSubTab !== 'funnel' ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading reports data...</div>
      ) : (
        <>
          {/* Dashboard Analytics Sub Tab */}
          {activeSubTab === 'analytics' && stats && (
            <div>
              {/* Stats Card Grid */}
              <div className="grid-4" style={{ marginBottom: '25px' }}>
                <div className="stat-card">
                  <div className="stat-title">New / Total Leads</div>
                  <div className="stat-value">{stats.summary.newLeads} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {stats.summary.totalLeads}</span></div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Site Visits Completed</div>
                  <div className="stat-value">{stats.summary.completedVisits} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {stats.summary.totalVisits}</span></div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Active Bookings</div>
                  <div className="stat-value" style={{ color: 'var(--primary)' }}>{stats.summary.totalBookedCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Revenue (Token + Bookings)</div>
                  <div className="stat-value" style={{ color: '#22c55e' }}>₹{stats.summary.revenueEarned.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Grid: Sources Comparison & Executive Performance */}
              <div className="grid-2">
                
                {/* Lead Source comparison bar chart lists */}
                <div className="card" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BarChart2 size={16} /> Lead Source Comparison
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.keys(stats?.sourceDistribution || {}).map(src => {
                      const count = (stats?.sourceDistribution || {})[src];
                      const pct = stats.summary.totalLeads > 0 ? (count / stats.summary.totalLeads) * 100 : 0;
                      return (
                        <div key={src}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                            <span>{src}</span>
                            <strong>{count} Leads</strong>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ background: 'var(--primary)', width: `${pct}%`, height: '100%', borderRadius: '4px', transition: 'width 0.5s ease-in-out' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Employee Performance lists */}
                <div className="card" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={16} /> Employee Sales Performance
                  </h3>
                  {isAdmin ? (
                    stats.employeePerformance.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No active executives to compare.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {stats.employeePerformance.map(emp => (
                          <div key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{emp.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Leads Owned: {emp.leadsCount}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{emp.bookingsCount} Bookings</div>
                              <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600 }}>Conv. Rate: {emp.conversionRate}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      Admin role required to view comparative performance summaries.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Phase 6: Source ROI Dashboard */}
          {activeSubTab === 'roi' && (
            <React.Suspense fallback={<div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading ROI Dashboard...</div>}>
              <SourceRoiDashboard onDrillDown={onDrillDown} />
            </React.Suspense>
          )}

          {/* Phase 6: Employee Dashboard */}
          {activeSubTab === 'emp_dashboard' && (
            <EmployeeDashboardView currentUser={currentUser} onDrillDown={onDrillDown} employees={employees} />
          )}

          {/* Phase 6: Incentive Calculator */}
          {activeSubTab === 'incentives' && (
            <IncentiveCalculator currentUser={currentUser} />
          )}

          {/* Phase 6: Funnel Analytics */}
          {activeSubTab === 'funnel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h2 style={{ margin: 0, color: 'var(--text-main)' }}>🌪️ Sales Conversion Funnel</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                    Visualize transition conversion efficiencies from lead ingestion to booking revenue. Click columns to inspect logs.
                  </p>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>Executive Filter:</span>
                    <select
                      className="form-control"
                      value={funnelFilterEmployeeId}
                      onChange={(e) => setFunnelFilterEmployeeId(e.target.value)}
                      style={{ width: '200px', padding: '6px 12px' }}
                    >
                      <option value="">All Executives</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {funnelLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading funnel calculations...</div>
              ) : funnelStats ? (
                <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '30px' }}>
                  
                  {/* Funnel Layout */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '800px', margin: '0 auto' }}>
                    
                    {/* Stage 1: Leads */}
                    <div 
                      className="clickable-card"
                      onClick={() => handleFunnelStageClick('leads')}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        background: 'rgba(6, 182, 212, 0.1)', 
                        border: '1px solid rgba(6, 182, 212, 0.2)',
                        padding: '16px 24px', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        width: '100%',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <strong style={{ color: 'var(--color-info)' }}>1. Total Leads</strong>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>{funnelStats.leads} records (100%)</span>
                    </div>

                    {/* Arrow Spacer */}
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>▼</div>

                    {/* Stage 2: Contacted */}
                    <div 
                      className="clickable-card"
                      onClick={() => handleFunnelStageClick('contacted')}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        background: 'rgba(59, 130, 246, 0.08)', 
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        padding: '16px 24px', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        width: '95%',
                        alignSelf: 'center',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <strong style={{ color: '#3b82f6' }}>2. Contacted / Engaged</strong>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {funnelStats.contacted} leads ({funnelStats.leads > 0 ? Math.round((funnelStats.contacted / funnelStats.leads) * 100) : 0}%)
                      </span>
                    </div>

                    {/* Arrow Spacer */}
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>▼</div>

                    {/* Stage 3: Site Visit */}
                    <div 
                      className="clickable-card"
                      onClick={() => handleFunnelStageClick('site_visit')}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        background: 'rgba(234, 179, 8, 0.08)', 
                        border: '1px solid rgba(234, 179, 8, 0.15)',
                        padding: '16px 24px', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        width: '90%',
                        alignSelf: 'center',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <strong style={{ color: '#eab308' }}>3. Site Visits Completed</strong>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {funnelStats.site_visit} visits ({funnelStats.leads > 0 ? Math.round((funnelStats.site_visit / funnelStats.leads) * 100) : 0}%)
                      </span>
                    </div>

                    {/* Arrow Spacer */}
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>▼</div>

                    {/* Stage 4: Negotiation */}
                    <div 
                      className="clickable-card"
                      onClick={() => handleFunnelStageClick('negotiation')}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        background: 'rgba(139, 92, 246, 0.08)', 
                        border: '1px solid rgba(139, 92, 246, 0.15)',
                        padding: '16px 24px', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        width: '85%',
                        alignSelf: 'center',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <strong style={{ color: '#8b5cf6' }}>4. Negotiation / Hot</strong>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {funnelStats.negotiation} deals ({funnelStats.leads > 0 ? Math.round((funnelStats.negotiation / funnelStats.leads) * 100) : 0}%)
                      </span>
                    </div>

                    {/* Arrow Spacer */}
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>▼</div>

                    {/* Stage 5: Booking */}
                    <div 
                      className="clickable-card"
                      onClick={() => handleFunnelStageClick('booking')}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        background: 'rgba(34, 197, 94, 0.1)', 
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        padding: '16px 24px', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        width: '80%',
                        alignSelf: 'center',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      <strong style={{ color: '#22c55e' }}>5. Booking Confirmed</strong>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-success)' }}>
                        {funnelStats.booking} units ({funnelStats.leads > 0 ? Math.round((funnelStats.booking / funnelStats.leads) * 100) : 0}%)
                      </span>
                    </div>

                    {/* Total Closed Revenue Banner */}
                    <div 
                      className="clickable-card"
                      onClick={() => handleFunnelStageClick('revenue')}
                      style={{ 
                        marginTop: '25px', 
                        textAlign: 'center', 
                        padding: '20px', 
                        background: 'var(--bg-main)', 
                        border: '2px dashed var(--color-success)', 
                        borderRadius: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Booking Revenue Closed</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#22c55e' }}>
                        ₹{funnelStats.revenue.toLocaleString('en-IN')}
                      </div>
                    </div>

                  </div>

                </div>
              ) : null}
            </div>
          )}

          {/* Phase 6: Employee Performance Reports */}
          {activeSubTab === 'performance' && isAdmin && (
            <React.Suspense fallback={<div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading Performance Reports...</div>}>
              <EmployeePerformanceReports onDrillDown={onDrillDown} />
            </React.Suspense>
          )}

          {/* CSV/Excel Exports Sub Tab (Admin only) */}
          {activeSubTab === 'reports' && isAdmin && (
            <div className="card">
              <h2 style={{ marginBottom: '10px' }}>📥 Download Excel/CSV Reports</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '14px' }}>
                Generate and download daily, weekly, or monthly registers for booking records, payment histories, and GPS check-in logs.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                {/* Leads CSV */}
                <div className="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <FileSpreadsheet size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Leads Register</h4>
                  <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('leads')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>

                {/* Follow-up CSV */}
                <div className="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <PhoneCall size={32} style={{ color: '#06b6d4', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Follow-Up Schedule</h4>
                  <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('followups')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>

                {/* Site Visit CSV */}
                <div className="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <MapPin size={32} style={{ color: '#eab308', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Site Visit Logs</h4>
                  <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('site-visits')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>

                {/* Booking CSV */}
                <div className="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <Award size={32} style={{ color: 'var(--color-success)', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Booking Register</h4>
                  <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('bookings')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>

                {/* Payments CSV */}
                <div className="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <Landmark size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Payments Ledger</h4>
                  <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('payments')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>

                {/* Employee Performance CSV */}
                <div className="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <Users size={32} style={{ color: '#8b5cf6', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Employee Analytics</h4>
                  <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('employees')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Inactive Leads Queue Sub Tab (Admin only) */}
          {activeSubTab === 'inactive' && isAdmin && (
            <div className="card">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
                <ShieldAlert size={20} style={{ color: '#f59e0b' }} /> Inactive Leads Queue (7+ Days Inactive)
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '13px' }}>
                These leads have had no phone calls logged, no status modifications, or no follow-up updates scheduled for 7 days or more. Reassign them to active employees to revive conversions.
              </p>

              {inactiveLeads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No leads flagged as inactive. Great work!</div>
              ) : (
                <div className="table-responsive">
                  <table className="leads-table">
                    <thead>
                      <tr>
                        <th>Lead Customer</th>
                        <th>Assigned Executive</th>
                        <th>Project / Budget</th>
                        <th>Last Activity Date</th>
                        <th>Inactive Duration</th>
                        <th style={{ textAlign: 'center' }}>Reassignment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inactiveLeads.map(l => (
                        <tr key={l.id}>
                          <td>
                            <strong style={{ color: 'var(--text-main)' }}>{l.name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.phone1}</div>
                          </td>
                          <td>{l.assigned_employee ? l.assigned_employee.full_name : 'Unassigned'}</td>
                          <td>{l.project} ({l.budget})</td>
                          <td>{l.last_activity_date ? new Date(l.last_activity_date).toLocaleDateString() : new Date(l.created_at).toLocaleDateString()}</td>
                          <td style={{ color: '#ef4444', fontWeight: 600 }}>{getDaysAgo(l.last_activity_date || l.created_at)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--primary)' }} onClick={() => handleReassign(l)}>
                              Reassign Owner <ArrowRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          
          {/* Revenue Ledger Tab */}
          {activeSubTab === 'revenue' && <RevenueAnalytics />}
        </>
      )}

    </div>
  );
}
