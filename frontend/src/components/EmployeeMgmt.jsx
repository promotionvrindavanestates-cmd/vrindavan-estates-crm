import React, { useState } from 'react';
import { api } from '../utils/api';
import { UserPlus, ShieldAlert, CheckCircle, ShieldCheck, UserX, UserCheck } from 'lucide-react';

export default function EmployeeMgmt({ employees = [], onRefreshEmployees }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

      if (selection === null) return; // user cancelled prompt
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

  return (
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
  );
}
