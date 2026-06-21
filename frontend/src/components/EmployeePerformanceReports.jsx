import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Award, PhoneCall, Calendar, TrendingUp, Landmark, FileText, CheckCircle, RefreshCw } from 'lucide-react';

export default function EmployeePerformanceReports({ onDrillDown }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCommissionId, setEditingCommissionId] = useState(null);
  const [newCommissionValue, setNewCommissionValue] = useState('');

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const data = await api.getEmployeePerformanceReports();
      setReports(data || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch employee reports:', err);
      setError('Failed to fetch executive performance registers.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditCommission = (emp) => {
    setEditingCommissionId(emp.employee_id);
    setNewCommissionValue(emp.commission_percentage.toString());
  };

  const handleSaveCommission = async (empId) => {
    const rate = parseFloat(newCommissionValue);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return alert('Please enter a valid commission percentage between 0 and 100.');
    }

    try {
      await api.updateEmployeeCommission(empId, rate);
      setEditingCommissionId(null);
      fetchReportData();
      alert('Commission rate updated successfully!');
    } catch (err) {
      alert(`Failed to update commission rate: ${err.message}`);
    }
  };

  const handleCellClick = (emp, type) => {
    if (!onDrillDown) return;
    
    const baseFilters = {
      assigned_employee_id: emp.employee_id,
      employee_name: emp.name,
      leads_count: emp.leads_count
    };

    switch (type) {
      case 'leads':
        // Filter by assigned employee
        onDrillDown('Employee Leads', baseFilters);
        break;
      case 'calls':
        // Filter by calls today or calls by employee (using employee ID)
        onDrillDown('Employee Leads', { ...baseFilters, status: '' });
        break;
      case 'visits':
        // Filter by site visit completed
        onDrillDown('Employee Leads', { ...baseFilters, site_visit_completed: 'true' });
        break;
      case 'bookings':
        // Filter by Booked status
        onDrillDown('Employee Leads', { ...baseFilters, status: 'Booked' });
        break;
      case 'collections':
        // Routes to payments/bookings registry for this employee
        onDrillDown('Employee Leads', { ...baseFilters, status: 'Booked' });
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
        <RefreshCw className="bell-animation" style={{ marginRight: '8px', display: 'inline-block' }} size={16} />
        Loading employee performance metrics...
      </div>
    );
  }

  if (error) {
    return <div style={{ color: '#ef4444', padding: '20px', textAlign: 'center' }}>{error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-main)' }}>📋 Employee Performance Report</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Compare operations efficiency (Calls, Follow-ups, Site Visits, Bookings, Collections) across sales executives.
          </p>
        </div>
        <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={fetchReportData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
        {reports.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>No active sales employees found.</div>
        ) : (
          <div className="table-responsive">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Executive Name</th>
                  <th style={{ textAlign: 'center' }}>Leads Owned</th>
                  <th style={{ textAlign: 'center' }}>Interested Leads</th>
                  <th style={{ textAlign: 'center' }}>Calls Made</th>
                  <th style={{ textAlign: 'center' }}>Connected Calls</th>
                  <th style={{ textAlign: 'center' }}>Follow-up Compliance</th>
                  <th style={{ textAlign: 'center' }}>Site Visits</th>
                  <th style={{ textAlign: 'center' }}>Bookings Confirmed</th>
                  <th style={{ textAlign: 'center' }}>Collections</th>
                  <th style={{ textAlign: 'center' }}>Conversion %</th>
                  <th style={{ textAlign: 'center' }}>Commission Rate</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{emp.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{emp.username} | {emp.status}</div>
                    </td>
                    
                    {/* Leads Owned */}
                    <td 
                      style={{ textAlign: 'center', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}
                      onClick={() => handleCellClick(emp, 'leads')}
                      title="Click to view assigned leads"
                    >
                      {emp.leads_count}
                    </td>

                    {/* Interested Leads */}
                    <td 
                      style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 600 }}
                      title="Leads in Interested, Warm, or Hot status"
                    >
                      {emp.interested_leads || 0}
                    </td>

                    {/* Calls Made */}
                    <td 
                      style={{ textAlign: 'center', cursor: 'pointer', color: 'var(--text-main)' }}
                      onClick={() => handleCellClick(emp, 'calls')}
                      title="Click to view leads assigned to caller"
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <PhoneCall size={12} style={{ color: 'var(--text-muted)' }} />
                        {emp.calls}
                      </span>
                    </td>

                    {/* Connected Calls */}
                    <td 
                      style={{ textAlign: 'center', color: '#22c55e', fontWeight: 600 }}
                      title="Calls not marked Busy or Not Picked"
                    >
                      {emp.connected_calls || 0}
                    </td>

                    {/* Follow-up Compliance */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: (emp.followup_compliance_pct || 0) >= 80 ? '#22c55e' : (emp.followup_compliance_pct || 0) >= 50 ? '#f59e0b' : '#ef4444' }}>
                        {emp.followup_compliance_pct || 0}%
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ({emp.follow_ups_completed} / {emp.follow_ups})
                      </div>
                    </td>

                    {/* Site Visits */}
                    <td 
                      style={{ textAlign: 'center', cursor: 'pointer', color: 'var(--color-info)', fontWeight: 600 }}
                      onClick={() => handleCellClick(emp, 'visits')}
                      title="Click to view site visits"
                    >
                      {emp.site_visits}
                    </td>

                    {/* Bookings */}
                    <td 
                      style={{ textAlign: 'center', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}
                      onClick={() => handleCellClick(emp, 'bookings')}
                      title="Click to view bookings"
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Award size={13} />
                        {emp.bookings}
                      </span>
                    </td>

                    {/* Collections */}
                    <td 
                      style={{ textAlign: 'center', cursor: 'pointer', color: '#22c55e', fontWeight: 600 }}
                      onClick={() => handleCellClick(emp, 'collections')}
                      title="Click to view bookings and ledger details"
                    >
                      ₹{emp.collections.toLocaleString('en-IN')}
                    </td>

                    {/* Conversion Rate */}
                    <td style={{ textAlign: 'center', fontWeight: 700, color: emp.conversion > 5 ? '#22c55e' : 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={12} />
                        {emp.conversion}%
                      </span>
                    </td>

                    {/* Inline Commission Rates Edit */}
                    <td style={{ textAlign: 'center' }}>
                      {editingCommissionId === emp.employee_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <input 
                            type="number" 
                            className="form-control"
                            value={newCommissionValue}
                            onChange={(e) => setNewCommissionValue(e.target.value)}
                            style={{ width: '60px', padding: '2px 6px', fontSize: '12px' }}
                            step="0.1"
                          />
                          <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => handleSaveCommission(emp.employee_id)}>
                            Save
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setEditingCommissionId(null)}>
                            X
                          </button>
                        </div>
                      ) : (
                        <span 
                          style={{ cursor: 'pointer', textDecoration: 'underline dashed var(--primary)', color: 'var(--primary)' }}
                          onClick={() => handleStartEditCommission(emp)}
                          title="Click to change commission percentage rate"
                        >
                          {emp.commission_percentage}%
                        </span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
