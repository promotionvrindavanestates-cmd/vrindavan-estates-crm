import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Calendar, AlertTriangle, Users, TrendingUp, Compass, Award, Phone, CheckCircle, RefreshCw, BarChart2, MessageSquare, Award as Trophy } from 'lucide-react';
import HeatMapWidgets from './HeatMapWidgets';
import RecentActivities from './RecentActivities';

export default function Dashboard({ leads = [], employees = [], onSelectLead, onDrillDown }) {
  const [stats, setStats] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
                { key: 'new', label: 'New Inquiries', count: stats.funnel.new, color: '#6366f1', description: 'Fresh incoming leads' },
                { key: 'contacted', label: 'Contacted / Engaged', count: stats.funnel.contacted, color: '#06b6d4', description: 'Calls made & warm prospects' },
                { key: 'visit', label: 'Site Visits', count: stats.funnel.visit, color: '#f59e0b', description: 'Visits scheduled or done' },
                { key: 'negotiation', label: 'Negotiations', count: stats.funnel.negotiation, color: '#ec4899', description: 'Hot leads in discussions' },
                { key: 'booked', label: 'Bookings Confirmed', count: stats.funnel.booked, color: '#10b981', description: 'Converted customers' }
              ];
              const maxCount = Math.max(...funnelStages.map(s => s.count), 1);
              
              return funnelStages.map((stage, idx) => {
                const pct = (stage.count / maxCount) * 100;
                const conversionFromPrevious = idx === 0 ? 100 : (funnelStages[idx - 1].count > 0 ? Math.round((stage.count / funnelStages[idx - 1].count) * 100) : 0);
                
                return (
                  <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.01)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
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

      {/* Follow-up Alerts & Reminders */}
      <div class="alerts-section">
        {/* Today's Follow-Ups Panel */}
        <div class="alerts-panel">
          <div class="alerts-header">
            <h3 class="alerts-title">
              <Calendar size={18} style={{ color: 'var(--color-info)' }} />
              Today's Scheduled Follow-Ups
            </h3>
            <span class="alerts-count" style={{ borderColor: 'rgba(6, 182, 212, 0.3)', color: 'var(--color-info)' }}>
              {todayFollowUps.length} Due
            </span>
          </div>
          <div class="alerts-list">
            {todayFollowUps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                No follow-ups scheduled for today.
              </div>
            ) : (
              todayFollowUps.map(l => (
                <div key={l.id} class="alert-item" onClick={() => onSelectLead(l)}>
                  <div class="alert-info">
                    <span class="alert-name">{l.name}</span>
                    <span class="alert-subtext">{l.project || 'No project'} | {l.phone1}</span>
                  </div>
                  <span class={`badge badge-${l.status.toLowerCase()}`}>{l.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Overdue Follow-Ups Panel */}
        <div class="alerts-panel">
          <div class="alerts-header">
            <h3 class="alerts-title">
              <AlertTriangle size={18} style={{ color: 'var(--color-hot)' }} />
              Missed & Overdue Follow-Ups
            </h3>
            <span class="alerts-count" style={{ borderColor: 'rgba(255, 94, 94, 0.3)', color: 'var(--color-hot)' }}>
              {overdueFollowUps.length} Overdue
            </span>
          </div>
          <div class="alerts-list">
            {overdueFollowUps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                No overdue follow-ups. Outstanding progress!
              </div>
            ) : (
              overdueFollowUps.map(l => (
                <div key={l.id} class="alert-item" onClick={() => onSelectLead(l)}>
                  <div class="alert-info">
                    <span class="alert-name">{l.name}</span>
                    <span class="alert-subtext" style={{ color: 'var(--color-hot)' }}>
                      Missed on: {l.follow_up_date}
                    </span>
                  </div>
                  <span class={`badge badge-${l.status.toLowerCase()}`}>{l.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SVG Dashboard Charts Grid */}
      <div class="charts-grid" style={{ marginBottom: '24px' }}>
        {/* Leads by Source Chart */}
        <div class="chart-card">
          <h3 class="chart-title">
            <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }} />
            Leads by Source Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>Loading...</div>
            ) : sourceCounts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>No source data.</div>
            ) : (
              sourceCounts.map((s) => {
                const widthPct = (s.count / maxSourceCount) * 80;
                return (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '100px', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-input)', height: '12px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${Math.max(widthPct, 2)}%`, 
                        background: 'linear-gradient(90deg, var(--primary) 0%, #b88e3c 100%)', 
                        height: '100%', 
                        borderRadius: '4px',
                      }}></div>
                    </div>
                    <div style={{ width: '25px', fontSize: '11px', fontWeight: '600', textAlign: 'right' }}>
                      {s.count}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Monthly Trend Area Chart */}
        <div class="chart-card">
          <h3 class="chart-title">
            <BarChart2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }} />
            Monthly Lead Acquisition Trends
          </h3>
          <div style={{ height: '160px', width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 500 150" width="100%" height="100%" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="40" y1="20" x2="480" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="40" y1="70" x2="480" y2="70" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="40" y1="120" x2="480" y2="120" stroke="var(--border-color)" strokeWidth="0.5" />

              {(() => {
                const points = trendData.map((t, idx) => {
                  const x = 40 + (idx * (440 / (trendData.length - 1 || 1)));
                  const y = 120 - ((t.count / maxTrendCount) * 100);
                  return { x, y, label: t.label, count: t.count };
                });
                if (points.length === 0) return null;
                const pathD = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
                const areaD = `${pathD} L ${points[points.length - 1].x} 120 L ${points[0].x} 120 Z`;
                return (
                  <>
                    <path d={areaD} fill="url(#trendGradient)" />
                    <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
                    {points.map((p, idx) => (
                      <g key={idx}>
                        <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-card)" stroke="var(--primary)" strokeWidth="2" />
                        <text x={p.x} y={p.y - 10} fill="var(--text-main)" fontSize="9" textAnchor="middle" fontWeight="bold">
                          {p.count}
                        </text>
                        <text x={p.x} y="138" fill="var(--text-muted)" fontSize="9" textAnchor="middle">
                          {p.label}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      </div>

      {/* CRM Activity & Heatmaps */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
          <RecentActivities limit={10} />
        </div>
      </div>
      
      <div style={{ marginBottom: '24px' }}>
        <HeatMapWidgets leads={leads} />
      </div>

      {/* Employee Performance Dashboard: Leaderboard Ranking Board */}
      <div class="table-panel" style={{ margin: 0 }}>
        <div class="table-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} style={{ color: 'var(--primary)' }} />
            Vrindavan Estates Employee Ranking Board
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Updated live based on bookings and conversions</span>
        </div>

        <div class="table-container">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              Calculating conversion rates and rankings...
            </div>
          ) : !stats || stats.employeePerformance.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              No employee data registered in system.
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                  <th>Executive Name</th>
                  <th style={{ textAlign: 'center' }}>Leads Owned</th>
                  <th style={{ textAlign: 'center' }}>Calls Made</th>
                  <th style={{ textAlign: 'center' }}>Connected Calls</th>
                  <th style={{ textAlign: 'center' }}>Site Visits Completed</th>
                  <th style={{ textAlign: 'center' }}>Bookings Confirmed</th>
                  <th style={{ textAlign: 'right', paddingRight: '15px' }}>Revenue Closed</th>
                  <th style={{ textAlign: 'center' }}>Conversion %</th>
                </tr>
              </thead>
              <tbody>
                {stats.employeePerformance.map((emp, idx) => {
                  const rank = idx + 1;
                  let rankBadgeColor = 'var(--text-muted)';
                  let trophyEmoji = '';
                  
                  if (rank === 1) {
                    rankBadgeColor = '#dfb15b'; // gold
                    trophyEmoji = '🏆';
                  } else if (rank === 2) {
                    rankBadgeColor = '#94a3b8'; // silver
                    trophyEmoji = '🥈';
                  } else if (rank === 3) {
                    rankBadgeColor = '#b45309'; // bronze
                    trophyEmoji = '🥉';
                  }

                  return (
                    <tr key={emp.id} style={{ background: rank <= 3 ? 'rgba(219, 178, 93, 0.02)' : 'inherit' }}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
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
                      <td style={{ fontWeight: '600' }}>{emp.name}</td>
                      <td style={{ textAlign: 'center' }}>{emp.leadsCount}</td>
                      <td style={{ textAlign: 'center' }}>{emp.callsCount}</td>
                      <td style={{ textAlign: 'center', color: 'var(--color-info)' }}>{emp.connectedCallsCount}</td>
                      <td style={{ textAlign: 'center', color: 'var(--primary)' }}>{emp.siteVisitsCount}</td>
                      <td style={{ textAlign: 'center', color: 'var(--color-success)', fontWeight: 'bold' }}>{emp.bookingsCount}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#22c55e', paddingRight: '15px' }}>₹{(emp.revenueClosed || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        <span class={`badge ${emp.conversionRate >= 15 ? 'badge-success' : (emp.conversionRate >= 5 ? 'badge-warm' : 'badge-cold')}`}>
                          {emp.conversionRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
