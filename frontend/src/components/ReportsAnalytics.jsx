import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Download, Users, RefreshCw, BarChart2, Calendar, FileSpreadsheet, ShieldAlert, ArrowRight, Landmark, PhoneCall, Award, MapPin } from 'lucide-react';
import RevenueAnalytics from './RevenueAnalytics';

export default function ReportsAnalytics({ currentUser }) {
  const [stats, setStats] = useState(null);
  const [inactiveLeads, setInactiveLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('analytics'); // 'analytics', 'reports', 'inactive'

  useEffect(() => {
    fetchData();
  }, []);

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

  const isAdmin = currentUser.role === 'admin';

  return (
    <div style={{ marginTop: '20px' }}>
      
      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          class={`btn ${activeSubTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('analytics')}
        >
          📈 Analytics Charts
        </button>
        <button 
          class={`btn ${activeSubTab === 'revenue' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('revenue')}
        >
          💰 Revenue Ledger
        </button>
        {isAdmin && (
          <button 
            class={`btn ${activeSubTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('reports')}
          >
            📥 Excel/CSV Exports
          </button>
        )}
        {isAdmin && (
          <button 
            class={`btn ${activeSubTab === 'inactive' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('inactive')}
          >
            ⚠️ Inactive Queue ({inactiveLeads.length})
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading reports data...</div>
      ) : (
        <>
          {/* Dashboard Analytics Sub Tab */}
          {activeSubTab === 'analytics' && stats && (
            <div>
              {/* Stats Card Grid */}
              <div class="grid-4" style={{ marginBottom: '25px' }}>
                <div class="stat-card">
                  <div class="stat-title">New / Total Leads</div>
                  <div class="stat-value">{stats.summary.newLeads} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {stats.summary.totalLeads}</span></div>
                </div>
                <div class="stat-card">
                  <div class="stat-title">Site Visits Completed</div>
                  <div class="stat-value">{stats.summary.completedVisits} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {stats.summary.totalVisits}</span></div>
                </div>
                <div class="stat-card">
                  <div class="stat-title">Active Bookings</div>
                  <div class="stat-value" style={{ color: 'var(--primary)' }}>{stats.summary.totalBookedCount}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-title">Revenue (Token + Bookings)</div>
                  <div class="stat-value" style={{ color: '#22c55e' }}>₹{stats.summary.revenueEarned.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Grid: Sources Comparison & Executive Performance */}
              <div class="grid-2">
                
                {/* Lead Source comparison bar chart lists */}
                <div class="card" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BarChart2 size={16} /> Lead Source Comparison
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.keys(stats.sourceDistribution).map(src => {
                      const count = stats.sourceDistribution[src];
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
                <div class="card" style={{ background: 'rgba(255,255,255,0.01)' }}>
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

          {/* CSV/Excel Exports Sub Tab (Admin only) */}
          {activeSubTab === 'reports' && isAdmin && (
            <div class="card">
              <h2 style={{ marginBottom: '10px' }}>📥 Download Excel/CSV Reports</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '14px' }}>
                Generate and download daily, weekly, or monthly registers for booking records, payment histories, and GPS check-in logs.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {/* Leads CSV */}
                <div class="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <FileSpreadsheet size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Leads Register</h4>
                  <button class="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('leads')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>

                {/* Follow-up CSV */}
                <div class="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <PhoneCall size={32} style={{ color: '#06b6d4', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Follow-Up Schedule</h4>
                  <button class="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('followups')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>

                {/* Site Visit CSV */}
                <div class="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <MapPin size={32} style={{ color: '#eab308', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Site Visit Logs</h4>
                  <button class="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('site-visits')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>

                {/* Booking CSV */}
                <div class="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <Award size={32} style={{ color: 'var(--color-success)', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Booking Register</h4>
                  <button class="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('bookings')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>

                {/* Payments CSV */}
                <div class="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <Landmark size={32} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Payments Ledger</h4>
                  <button class="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('payments')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>

                {/* Employee Performance CSV */}
                <div class="stat-card" style={{ textAlign: 'center', padding: '20px' }}>
                  <Users size={32} style={{ color: '#8b5cf6', marginBottom: '12px' }} />
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Employee Analytics</h4>
                  <button class="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }} onClick={() => handleExportReport('employees')}>
                    <Download size={12} /> Download CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Inactive Leads Queue Sub Tab (Admin only) */}
          {activeSubTab === 'inactive' && isAdmin && (
            <div class="card">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
                <ShieldAlert size={20} style={{ color: '#f59e0b' }} /> Inactive Leads Queue (7+ Days Inactive)
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '13px' }}>
                These leads have had no phone calls logged, no status modifications, or no follow-up updates scheduled for 7 days or more. Reassign them to active employees to revive conversions.
              </p>

              {inactiveLeads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No leads flagged as inactive. Great work!</div>
              ) : (
                <div class="table-responsive">
                  <table class="leads-table">
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
                            <button class="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--primary)' }} onClick={() => handleReassign(l)}>
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
          
          {/* Revenue Analytics Tab */}
          {activeSubTab === 'revenue' && <RevenueAnalytics />}
        </>
      )}

    </div>
  );
}
