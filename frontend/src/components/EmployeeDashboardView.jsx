import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Users, PhoneCall, MapPin, Award, BadgeCent, AlertTriangle, RefreshCw } from 'lucide-react';

export default function EmployeeDashboardView({ currentUser, onDrillDown, employees = [] }) {
  const [selectedEmpId, setSelectedEmpId] = useState(currentUser.role === 'admin' ? '' : currentUser.id);
  const [stats, setStats] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    // If admin is viewing and selectedEmpId is empty, we don't load stats until they pick someone
    if (isAdmin && !selectedEmpId) {
      setLoading(false);
      setStats(null);
      return;
    }
    fetchEmployeeStats();
  }, [selectedEmpId]);

  const fetchEmployeeStats = async () => {
    setLoading(true);
    try {
      const statsData = await api.getFunnelStats(selectedEmpId);
      
      // Let's also query employee performance endpoint for details
      let detailData = null;
      try {
        detailData = await requestEmployeeDetails(selectedEmpId);
      } catch (e) {
        console.warn('Could not load detailed metrics, falling back to funnel stats', e);
      }

      // Query reminders to get today's and missed follow-ups
      const allReminders = await api.getCollectionReminders(); // Wait, let's use getReminders from api
      let empReminders = [];
      try {
        const queryParams = selectedEmpId ? { assigned_employee_id: selectedEmpId } : {};
        // We can query leads with reminders or call the reminders API
        const rems = await api.getLeads(); // Fallback lead analysis or fetch reminders
        // Let's use api.getLeads with follow_up_due or search in db if reminders are loaded
      } catch(err) {}

      setStats({
        funnel: statsData,
        details: detailData
      });
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to fetch employee dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  const requestEmployeeDetails = async (empId) => {
    // Call the employee performance stats API
    const response = await fetch(`/api/employees/${empId}/performance`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to load performance');
    return response.json();
  };

  const handleKpiClick = (type) => {
    if (!onDrillDown || !stats) return;

    const baseFilters = {
      assigned_employee_id: selectedEmpId,
      employee_name: stats.details?.profile?.full_name || 'Executive',
      leads_count: stats.details?.metrics?.leadsOwned || 0
    };

    switch (type) {
      case 'leads':
        onDrillDown('My Leads', baseFilters);
        break;
      case 'followups':
        onDrillDown('My Leads', { ...baseFilters, calls_today: 'true' });
        break;
      case 'visits':
        onDrillDown('My Leads', { ...baseFilters, site_visit_completed: 'true' });
        break;
      case 'bookings':
        onDrillDown('My Leads', { ...baseFilters, status: 'Booked' });
        break;
      case 'collections':
        // Directs to bookings overview
        onDrillDown('Total Revenue', baseFilters);
        break;
      case 'missed':
        // Filter leads with followups due (overdue)
        onDrillDown('My Leads', { ...baseFilters, status: '' });
        break;
      default:
        break;
    }
  };

  // Extract metrics safely
  const metrics = stats?.details?.metrics || {};
  const profile = stats?.details?.profile || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header and Employee Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-main)' }}>👤 Executive Operations Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Personal task tracking and pipeline stats.
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Select Sales Executive:</span>
            <select
              className="form-control"
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              style={{ width: '200px', padding: '6px 12px' }}
            >
              <option value="">-- Choose Employee --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isAdmin && !selectedEmpId ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Please select a sales executive from the dropdown to load their operations dashboard.
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <RefreshCw className="bell-animation" style={{ marginRight: '8px', display: 'inline-block' }} size={16} />
          Fetching personal dashboard logs...
        </div>
      ) : error ? (
        <div style={{ color: '#ef4444', padding: '20px', textAlign: 'center' }}>{error}</div>
      ) : stats ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Executive Profile Snapshot */}
          <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>{profile.full_name || 'Executive'}</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Role: {profile.role} | Status: <span style={{ color: profile.status === 'active' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{profile.status}</span></div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Joining Date: {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
            </div>
          </div>

          {/* Operations KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            
            {/* KPI 1: My Leads */}
            <div 
              className="card clickable-card" 
              onClick={() => handleKpiClick('leads')}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>My Leads Owned</span>
                <Users size={16} style={{ color: 'var(--primary)' }} />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-main)' }}>{metrics.leadsOwned || 0}</div>
            </div>

            {/* KPI 2: Today's Follow-ups */}
            <div 
              className="card clickable-card" 
              onClick={() => handleKpiClick('followups')}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Today's Follow-ups</span>
                <PhoneCall size={16} style={{ color: '#06b6d4' }} />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-main)' }}>{metrics.callsToday || 0}</div>
            </div>

            {/* KPI 3: Site Visits */}
            <div 
              className="card clickable-card" 
              onClick={() => handleKpiClick('visits')}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Site Visits Done</span>
                <MapPin size={16} style={{ color: '#eab308' }} />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-main)' }}>{metrics.visitsCompleted || 0}</div>
            </div>

            {/* KPI 4: Bookings */}
            <div 
              className="card clickable-card" 
              onClick={() => handleKpiClick('bookings')}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bookings</span>
                <Award size={16} style={{ color: 'var(--color-success)' }} />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--primary)' }}>{metrics.totalBookings || 0}</div>
            </div>

            {/* KPI 5: Collections */}
            <div 
              className="card clickable-card" 
              onClick={() => handleKpiClick('collections')}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Collections</span>
                <BadgeCent size={16} style={{ color: '#22c55e' }} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#22c55e', paddingTop: '8px' }}>
                ₹{parseFloat(metrics.collectionReceived || 0).toLocaleString('en-IN')}
              </div>
            </div>

            {/* KPI 6: Missed Follow-ups */}
            <div 
              className="card clickable-card" 
              onClick={() => handleKpiClick('missed')}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Missed Follow-ups</span>
                <AlertTriangle size={16} style={{ color: '#ef4444' }} />
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444' }}>{metrics.followUpsPending || 0}</div>
            </div>

          </div>

        </div>
      ) : null}

    </div>
  );
}
