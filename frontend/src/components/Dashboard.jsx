import React from 'react';
import { Calendar, AlertTriangle, Users, TrendingUp, Compass, Award, Phone } from 'lucide-react';

export default function Dashboard({ leads = [], employees = [], onSelectLead }) {
  // Get today's date string in YYYY-MM-DD local format
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  // Helpers to categorize metrics
  const totalLeads = leads.length;
  const hotLeads = leads.filter(l => l.status === 'Hot').length;
  const warmLeads = leads.filter(l => l.status === 'Warm').length;
  const coldLeads = leads.filter(l => l.status === 'Cold').length;

  const siteVisits = leads.filter(l => l.site_visit_status === 'Completed' || l.site_visit_status === 'Scheduled').length;
  const bookings = leads.filter(l => l.booking_status === 'Confirmed' || l.booking_status === 'Pending').length;

  // Follow-ups logic
  const todayFollowUps = leads.filter(l => l.follow_up_date === todayStr);
  
  const overdueFollowUps = leads.filter(l => {
    if (!l.follow_up_date) return false;
    // Check if the follow up date is strictly in the past compared to todayStr
    return l.follow_up_date < todayStr && l.booking_status !== 'Confirmed';
  });

  // Chart Data Processing: Leads by Source
  const sources = ['Facebook Ads', 'Instagram Ads', 'Google Ads', 'Website', 'WhatsApp', 'Reference', 'Walk-in'];
  const sourceCounts = sources.map(src => ({
    name: src,
    count: leads.filter(l => l.lead_source === src).length
  }));
  const maxSourceCount = Math.max(...sourceCounts.map(s => s.count), 1);

  // Chart Data Processing: Leads by Project
  const projects = [...new Set(leads.map(l => l.project).filter(Boolean))];
  const projectCounts = projects.map(proj => ({
    name: proj,
    count: leads.filter(l => l.project === proj).length
  })).sort((a, b) => b.count - a.count).slice(0, 5); // Limit to top 5 projects
  const maxProjectCount = Math.max(...projectCounts.map(p => p.count), 1);

  // Chart Data Processing: Employee Performance
  const employeeStats = employees.map(emp => {
    const empLeads = leads.filter(l => l.assigned_employee_id === emp.id);
    const hotCount = empLeads.filter(l => l.status === 'Hot').length;
    const bookingCount = empLeads.filter(l => l.booking_status === 'Confirmed').length;
    const visitCount = empLeads.filter(l => l.site_visit_status === 'Completed').length;
    return {
      name: emp.full_name,
      total: empLeads.length,
      hot: hotCount,
      bookings: bookingCount,
      visits: visitCount
    };
  }).sort((a, b) => b.total - a.total);
  const maxEmployeeTotal = Math.max(...employeeStats.map(e => e.total), 1);

  // Chart Data Processing: Monthly Trend (last 6 months)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyCounts = {};
  
  // Seed last 6 months
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
    if (monthlyCounts[key]) {
      monthlyCounts[key].count++;
    }
  });

  const trendData = Object.values(monthlyCounts);
  const maxTrendCount = Math.max(...trendData.map(t => t.count), 1);

  return (
    <div>
      {/* Metric Cards Grid */}
      <div class="dashboard-grid">
        <div class="metric-card primary">
          <div class="metric-label">Total Leads</div>
          <div class="metric-value">{totalLeads}</div>
        </div>
        <div class="metric-card hot">
          <div class="metric-label">Hot Leads</div>
          <div class="metric-value">{hotLeads}</div>
        </div>
        <div class="metric-card warm">
          <div class="metric-label">Warm Leads</div>
          <div class="metric-value">{warmLeads}</div>
        </div>
        <div class="metric-card cold">
          <div class="metric-label">Cold Leads</div>
          <div class="metric-value">{coldLeads}</div>
        </div>
        <div class="metric-card info">
          <div class="metric-label">Today's Follow-Ups</div>
          <div class="metric-value">{todayFollowUps.length}</div>
        </div>
        <div class="metric-card success">
          <div class="metric-label">Site Visits</div>
          <div class="metric-value">{siteVisits}</div>
        </div>
        <div class="metric-card primary">
          <div class="metric-label">Bookings</div>
          <div class="metric-value">{bookings}</div>
        </div>
      </div>

      {/* Follow-up Alerts & Reminders */}
      <div class="alerts-section">
        {/* Today's Follow-Ups Panel */}
        <div class="alerts-panel">
          <div class="alerts-header">
            <h3 class="alerts-title">
              <Calendar size={18} style={{ color: 'var(--color-info)' }} />
              Today's Follow-Ups
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
              Overdue Follow-Ups
            </h3>
            <span class="alerts-count" style={{ borderColor: 'rgba(255, 94, 94, 0.3)', color: 'var(--color-hot)' }}>
              {overdueFollowUps.length} Overdue
            </span>
          </div>
          <div class="alerts-list">
            {overdueFollowUps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                No overdue follow-ups. Good job!
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
      <div class="charts-grid">
        {/* Leads by Source Chart */}
        <div class="chart-card">
          <h3 class="chart-title">
            <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }} />
            Leads by Source
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sourceCounts.map((s, idx) => {
              const widthPct = (s.count / maxSourceCount) * 80; // Scale to max 80% width
              return (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '100px', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg-input)', height: '14px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${Math.max(widthPct, 2)}%`, 
                      background: 'linear-gradient(90deg, var(--primary) 0%, #b88e3c 100%)', 
                      height: '100%', 
                      borderRadius: '4px',
                      transition: 'width 0.5s ease-out'
                    }}></div>
                  </div>
                  <div style={{ width: '25px', fontSize: '12px', fontWeight: '600', textAlign: 'right' }}>
                    {s.count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Projects Chart */}
        <div class="chart-card">
          <h3 class="chart-title">
            <Compass size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }} />
            Leads by Top Projects
          </h3>
          {projectCounts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No project data available.
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '180px', paddingTop: '20px' }}>
              {projectCounts.map((p) => {
                const heightPct = (p.count / maxProjectCount) * 120; // max height 120px
                return (
                  <div key={p.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>{p.count}</div>
                    <div style={{ 
                      height: `${Math.max(heightPct, 8)}px`, 
                      width: '24px', 
                      background: 'linear-gradient(180deg, var(--primary) 0%, rgba(223,177,91,0.2) 100%)', 
                      borderRadius: '4px 4px 0 0',
                      boxShadow: '0 0 10px var(--primary-glow)'
                    }}></div>
                    <div style={{ 
                      fontSize: '10px', 
                      color: 'var(--text-muted)', 
                      marginTop: '6px', 
                      textAlign: 'center',
                      width: '60px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {p.name}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Employee Performance Chart */}
        <div class="chart-card">
          <h3 class="chart-title">
            <Award size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }} />
            Employee Performance
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '220px', overflowY: 'auto' }}>
            {employeeStats.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No employee data available.
              </div>
            ) : (
              employeeStats.map(e => {
                const widthPct = (e.total / maxEmployeeTotal) * 75;
                return (
                  <div key={e.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ fontWeight: '500' }}>{e.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {e.total} Leads | {e.visits} Visits | <strong style={{ color: 'var(--color-success)' }}>{e.bookings} Booked</strong>
                      </span>
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-input)', height: '10px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${Math.max(widthPct, 2)}%`, 
                        background: 'linear-gradient(90deg, #10b981 0%, var(--primary) 100%)', 
                        height: '100%', 
                        borderRadius: '4px' 
                      }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Monthly Trend Area Chart (SVG) */}
        <div class="chart-card">
          <h3 class="chart-title">
            <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }} />
            Monthly Lead Trends
          </h3>
          <div style={{ height: '180px', width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 500 150" width="100%" height="100%" style={{ overflow: 'visible' }}>
              {/* Define Gradients */}
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="40" y1="70" x2="480" y2="70" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="40" y1="120" x2="480" y2="120" stroke="var(--border-color)" strokeWidth="0.5" />

              {/* Generate Graph Points */}
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
                    {/* Fill Area */}
                    <path d={areaD} fill="url(#trendGradient)" />
                    {/* Stroke Line */}
                    <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="3" />
                    
                    {/* Draw Circles and Text */}
                    {points.map((p, idx) => (
                      <g key={idx}>
                        <circle cx={p.x} cy={p.y} r="5" fill="var(--bg-card)" stroke="var(--primary)" strokeWidth="2" />
                        <text x={p.x} y={p.y - 10} fill="var(--text-main)" fontSize="10" textAnchor="middle" fontWeight="bold">
                          {p.count}
                        </text>
                        <text x={p.x} y="138" fill="var(--text-muted)" fontSize="10" textAnchor="middle">
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
    </div>
  );
}
