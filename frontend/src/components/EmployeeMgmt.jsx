import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { UserPlus, ShieldAlert, CheckCircle, UserX, UserCheck, Clock, RefreshCw, ArrowRightLeft } from 'lucide-react';

export default function EmployeeMgmt({ employees = [], onRefreshEmployees }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Inactive Queue States
  const [inactiveDays, setInactiveDays] = useState(7); // 3, 7, 15
  const [inactiveLeads, setInactiveLeads] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  useEffect(() => {
    fetchInactiveQueue();
  }, [inactiveDays]);

  const fetchInactiveQueue = async () => {
    setLoadingQueue(true);
    try {
      const data = await api.getInactiveLeadsQueue(inactiveDays);
      setInactiveLeads(data);
      setSelectedLeadIds([]);
    } catch (e) {
      console.error('Failed to fetch inactive leads:', e);
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password || !fullName) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.createEmployee({ username, password, full_name: fullName, phone });
      setSuccess('Employee account created successfully!');
      setUsername('');
      setPassword('');
      setFullName('');
      setPhone('');
      onRefreshEmployees();
    } catch (err) {
      setError(err.message || 'Failed to create employee account.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (emp) => {
    const otherActive = employees.filter(e => e.id !== emp.id && e.status !== 'disabled');
    let targetEmpId = null;

    if (otherActive.length > 0) {
      const selectText = otherActive.map((e, i) => `${i + 1}. ${e.full_name}`).join('\n');
      const selection = window.prompt(
        `To deactivate "${emp.full_name}", you must transfer their assigned leads to another active employee.\n\n` +
        `Enter the index number of the employee to receive their leads:\n` +
        selectText
      );

      if (selection === null) return;
      const idx = parseInt(selection) - 1;
      if (isNaN(idx) || idx < 0 || idx >= otherActive.length) {
        alert('Invalid employee selection. Deactivation aborted.');
        return;
      }
      targetEmpId = otherActive[idx].id;
    } else {
      const confirmNoTransfer = window.confirm(
        `There are no other active employees to receive their leads. If you proceed, all leads assigned to ${emp.full_name} will be left unassigned. Do you want to continue?`
      );
      if (!confirmNoTransfer) return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (targetEmpId) {
        await api.transferEmployeeLeads(emp.id, targetEmpId);
      }
      await api.toggleEmployeeStatus(emp.id, 'disabled');
      setSuccess(`Deactivated employee "${emp.full_name}". Forced logout triggered on all devices.`);
      onRefreshEmployees();
      fetchInactiveQueue();
    } catch (err) {
      setError(err.message || 'Deactivation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (emp) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.toggleEmployeeStatus(emp.id, 'active');
      setSuccess(`Activated employee "${emp.full_name}" successfully.`);
      onRefreshEmployees();
    } catch (err) {
      setError(err.message || 'Activation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReassignInactiveLeads = async () => {
    const targetIds = selectedLeadIds.length > 0 ? selectedLeadIds : null;
    if (!targetIds || targetIds.length === 0) {
      alert('Please select at least one inactive lead to reassign.');
      return;
    }

    const activeEmployees = employees.filter(e => e.status === 'active');
    if (activeEmployees.length === 0) {
      alert('No active employees available to receive reassigned leads.');
      return;
    }

    const selectText = activeEmployees.map((e, i) => `${i + 1}. ${e.full_name}`).join('\n');
    const selection = window.prompt(
      `Reassign ${targetIds.length} Selected Inactive Leads.\n\n` +
      `Enter the index number of the executive to receive these leads:\n` +
      selectText
    );

    if (selection === null) return;
    const idx = parseInt(selection) - 1;
    if (isNaN(idx) || idx < 0 || idx >= activeEmployees.length) {
      alert('Invalid employee selection.');
      return;
    }
    const targetEmpId = activeEmployees[idx].id;

    setLoadingQueue(true);
    try {
      // Execute bulk assign Manual
      await api.bulkAssignLeads(targetIds, targetEmpId, 'Manual');
      alert(`Successfully reassigned ${targetIds.length} leads.`);
      fetchInactiveQueue();
      onRefreshEmployees();
    } catch (err) {
      alert(`Reassignment failed: ${err.message}`);
    } finally {
      setLoadingQueue(false);
    }
  };

  const toggleSelectLead = (id) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllLeads = () => {
    if (selectedLeadIds.length === inactiveLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(inactiveLeads.map(l => l.id));
    }
  };

  const getIdleDays = (dateStr) => {
    if (!dateStr) return 'N/A';
    const diff = new Date() - new Date(dateStr);
    return Math.max(Math.floor(diff / (1000 * 60 * 60 * 24)), 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Section: Employee Creation and Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '24px' }}>
        
        {/* Add Employee Form */}
        <div class="alerts-panel" style={{ maxHeight: 'none', height: 'fit-content' }}>
          <div class="alerts-header">
            <h3 class="alerts-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={18} style={{ color: 'var(--primary)' }} />
              Add New Employee
            </h3>
          </div>

          {error && (
            <div style={{ background: 'var(--color-hot-bg)', color: 'var(--color-hot)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', border: '1px solid rgba(255, 94, 94, 0.2)' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={14} />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div class="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                class="form-control"
                placeholder="e.g. Gopal Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div class="form-group">
              <label>Mobile Number</label>
              <input
                type="tel"
                class="form-control"
                placeholder="10-digit number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>

            <div class="form-group">
              <label>Username *</label>
              <input
                type="text"
                class="form-control"
                placeholder="Unique login username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>

            <div class="form-group" style={{ marginBottom: '8px' }}>
              <label>Login Password *</label>
              <input
                type="password"
                class="form-control"
                placeholder="Secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" class="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Employee Account'}
            </button>
          </form>
        </div>

        {/* Employees List */}
        <div class="table-panel" style={{ margin: 0 }}>
          <div class="table-header-row">
            <h3>Employees Directory ({employees.length})</h3>
          </div>

          <div class="table-container">
            {employees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                No employees registered. Use the form to add one.
              </div>
            ) : (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Employee Info</th>
                    <th>Username</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{emp.full_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {emp.id}</div>
                      </td>
                      <td>{emp.username}</td>
                      <td>{emp.phone || <span style={{ color: 'var(--text-muted)' }}>N/A</span>}</td>
                      <td>
                        {emp.status === 'disabled' ? (
                          <span class="badge badge-hot" style={{ fontSize: '10px' }}>Disabled</span>
                        ) : (
                          <span class="badge badge-success" style={{ fontSize: '10px' }}>Active</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {emp.status === 'disabled' ? (
                          <button 
                            class="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--color-success)', color: 'var(--color-success)', display: 'inline-flex', gap: '4px', alignItems: 'center' }}
                            onClick={() => handleActivate(emp)}
                            disabled={loading}
                          >
                            <UserCheck size={12} /> Enable
                          </button>
                        ) : (
                          <button 
                            class="btn btn-danger" 
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', gap: '4px', alignItems: 'center' }}
                            onClick={() => handleDeactivate(emp)}
                            disabled={loading}
                          >
                            <UserX size={12} /> Disable
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Section: Inactive Leads Reassignment Queue */}
      <div class="table-panel" style={{ margin: 0 }}>
        <div class="table-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: 'var(--primary)' }} />
              Inactive Lead Reassignment Queue
            </h3>
            {selectedLeadIds.length > 0 && (
              <button 
                type="button" 
                class="btn btn-primary" 
                style={{ padding: '4px 12px', fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}
                onClick={handleReassignInactiveLeads}
              >
                <ArrowRightLeft size={12} /> Reassign Selected ({selectedLeadIds.length})
              </button>
            )}
          </div>

          {/* Queue Tab Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              class={`btn ${inactiveDays === 3 ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '11px' }}
              onClick={() => setInactiveDays(3)}
            >
              3 Day Queue
            </button>
            <button 
              type="button" 
              class={`btn ${inactiveDays === 7 ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '11px' }}
              onClick={() => setInactiveDays(7)}
            >
              7 Day Queue
            </button>
            <button 
              type="button" 
              class={`btn ${inactiveDays === 15 ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '11px' }}
              onClick={() => setInactiveDays(15)}
            >
              15 Day Queue
            </button>
            <button 
              type="button" 
              class="btn btn-secondary" 
              style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={fetchInactiveQueue}
              title="Refresh Queue"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        <div class="table-container">
          {loadingQueue ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Scanning database for inactive records...
            </div>
          ) : inactiveLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              No leads currently flagged as inactive in the {inactiveDays}-day queue.
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedLeadIds.length === inactiveLeads.length} 
                      onChange={toggleSelectAllLeads}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Lead Name</th>
                  <th>Current Owner</th>
                  <th>Last Activity Date</th>
                  <th>Idle Time</th>
                  <th>Project & City</th>
                  <th style={{ textAlign: 'right' }}>Reassign Action</th>
                </tr>
              </thead>
              <tbody>
                {inactiveLeads.map(lead => {
                  const isSelected = selectedLeadIds.includes(lead.id);
                  const idleDays = getIdleDays(lead.last_activity_date || lead.created_at);
                  return (
                    <tr key={lead.id} style={{ background: isSelected ? 'rgba(219,178,93,0.05)' : 'inherit' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelectLead(lead.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <strong style={{ color: 'var(--text-main)' }}>{lead.name}</strong>
                      </td>
                      <td>
                        {lead.assigned_employee ? lead.assigned_employee.full_name : 'Unassigned'}
                      </td>
                      <td>
                        {lead.last_activity_date ? new Date(lead.last_activity_date).toLocaleString() : new Date(lead.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <span 
                          style={{ 
                            color: idleDays >= 15 ? 'var(--color-hot)' : (idleDays >= 7 ? 'var(--primary)' : 'inherit'),
                            fontWeight: 'bold'
                          }}
                        >
                          {idleDays} Days Idle
                        </span>
                      </td>
                      <td>
                        {lead.project || 'N/A'} | {lead.city || 'N/A'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          type="button" 
                          class="btn btn-secondary" 
                          style={{ padding: '4px 10px', fontSize: '11px', display: 'inline-flex', gap: '4px', alignItems: 'center' }}
                          onClick={() => {
                            setSelectedLeadIds([lead.id]);
                            handleReassignInactiveLeads();
                          }}
                        >
                          <ArrowRightLeft size={11} /> Assign Owner
                        </button>
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
