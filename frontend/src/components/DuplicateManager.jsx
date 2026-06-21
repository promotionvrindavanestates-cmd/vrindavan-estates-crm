import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { AlertTriangle, CheckCircle, RefreshCw, Layers } from 'lucide-react';

export default function DuplicateManager({ employees = [] }) {
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [primarySelections, setPrimarySelections] = useState({}); // groupIndex -> leadId

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const fetchDuplicates = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await api.getDuplicateLeads();
      setDuplicateGroups(data || []);
      
      // Auto-select first lead in each group as primary target by default
      const defaultSelections = {};
      data.forEach((group, idx) => {
        if (group.leads && group.leads.length > 0) {
          defaultSelections[idx] = group.leads[0].id;
        }
      });
      setPrimarySelections(defaultSelections);
    } catch (err) {
      console.error('Failed to load duplicates:', err);
      setError('Could not scan for duplicate records.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPrimary = (groupIdx, leadId) => {
    setPrimarySelections(prev => ({
      ...prev,
      [groupIdx]: leadId
    }));
  };

  const handleMerge = async (groupIdx) => {
    const group = duplicateGroups[groupIdx];
    const targetLeadId = primarySelections[groupIdx];
    if (!targetLeadId) {
      alert("Please select a primary target lead to merge into.");
      return;
    }

    const duplicateLeadIds = group.leads
      .map(l => l.id)
      .filter(id => id !== targetLeadId);

    const targetLead = group.leads.find(l => l.id === targetLeadId);
    const confirmMessage = `Are you sure you want to merge ${duplicateLeadIds.length} duplicate leads into "${targetLead.name}"?\n\n` +
      `This will:\n` +
      `1. Move all call logs, reminders, bookings, and site visits to "${targetLead.name}".\n` +
      `2. Consolidate missing phone numbers, emails, projects, and budgets.\n` +
      `3. Permanently delete the duplicate lead records.\n\n` +
      `THIS ACTION IS IRREVERSIBLE.`;

    if (!window.confirm(confirmMessage)) return;

    setMerging(true);
    setError('');
    setSuccess('');
    try {
      await api.mergeLeads(targetLeadId, duplicateLeadIds);
      setSuccess(`Successfully merged duplicate records into lead "${targetLead.name}".`);
      
      // Refresh list after merge
      await fetchDuplicates();
    } catch (err) {
      console.error('Merge execution failed:', err);
      setError(`Lead merge failed: ${err.message}`);
    } finally {
      setMerging(false);
    }
  };

  const getEmployeeName = (id) => {
    if (!id) return 'Unassigned';
    const emp = employees.find(e => e.id === id);
    return emp ? emp.full_name : 'Executive';
  };

  return (
    <div className="duplicate-manager-panel">
      <div className="table-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: 'var(--text-main)', fontSize: '20px', margin: 0, fontWeight: 700 }}>Duplicate Lead Resolution Center</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Scan and consolidate lead profiles sharing duplicate mobile numbers or email addresses
          </div>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={fetchDuplicates} 
          disabled={loading || merging}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={14} className={loading ? 'bell-animation' : ''} />
          {loading ? 'Scanning...' : 'Rescan System'}
        </button>
      </div>

      {error && (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.05)', 
          border: '1px solid #ef4444', 
          color: '#ef4444', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '20px', 
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {success && (
        <div style={{ 
          background: 'rgba(34, 197, 94, 0.05)', 
          border: '1px solid #22c55e', 
          color: '#22c55e', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '20px', 
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Scanning Vrindavan Estates database records for duplicates...
        </div>
      ) : duplicateGroups.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px', 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px',
          color: 'var(--text-muted)'
        }}>
          <CheckCircle size={48} style={{ color: '#22c55e', marginBottom: '15px' }} />
          <h3 style={{ color: 'var(--text-main)', fontSize: '16px', margin: '0 0 8px 0' }}>All Clear!</h3>
          <p style={{ margin: 0, fontSize: '13px' }}>No active duplicate lead records (matching phone or email) detected in the system.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {duplicateGroups.map((group, groupIdx) => (
            <div 
              key={groupIdx} 
              className="card" 
              style={{ 
                padding: '16px', 
                border: '1px solid var(--border-color)', 
                background: 'var(--bg-card)',
                borderRadius: '8px' 
              }}
            >
              {/* Group Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px',
                marginBottom: '12px'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>
                  <Layers size={16} />
                  Duplicate group detected by {group.type}: <strong style={{ color: 'var(--text-main)' }}>{group.value}</strong>
                </span>
                <button
                  className="btn btn-primary"
                  onClick={() => handleMerge(groupIdx)}
                  disabled={merging}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Consolidate Duplicates
                </button>
              </div>

              {/* Duplicate List Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '100px', textAlign: 'center' }}>Primary Target</th>
                      <th>Lead Name</th>
                      <th>Mobile</th>
                      <th>Email</th>
                      <th>Project / Budget</th>
                      <th>Created Date</th>
                      <th>Assigned To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.leads.map(lead => {
                      const isSelected = primarySelections[groupIdx] === lead.id;
                      return (
                        <tr 
                          key={lead.id} 
                          style={{ 
                            background: isSelected ? 'rgba(219, 178, 93, 0.03)' : 'inherit',
                            transition: 'background 0.2s'
                          }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="radio" 
                              name={`primary-target-${groupIdx}`}
                              checked={isSelected}
                              onChange={() => handleSelectPrimary(groupIdx, lead.id)}
                              disabled={merging}
                              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                              title="Keep this as the primary profile"
                            />
                          </td>
                          <td style={{ fontWeight: '600', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                            {lead.name}
                            {isSelected && <span style={{ fontSize: '9px', background: 'var(--primary)', color: '#000', padding: '1px 4px', borderRadius: '3px', marginLeft: '6px', fontWeight: 'bold' }}>KEEP</span>}
                          </td>
                          <td>{lead.phone1 || 'N/A'}</td>
                          <td>{lead.email || 'N/A'}</td>
                          <td>{lead.project || 'N/A'} {lead.budget ? `(₹${lead.budget})` : ''}</td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {new Date(lead.created_at).toLocaleDateString()}
                          </td>
                          <td>{getEmployeeName(lead.assigned_employee_id)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
