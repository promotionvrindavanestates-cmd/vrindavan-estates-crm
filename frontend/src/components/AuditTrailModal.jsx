import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { History, ArrowRightLeft, Clock, User } from 'lucide-react';

export default function AuditTrailModal({ isOpen, onClose, lead }) {
  const [audits, setAudits] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('audit'); // 'audit' | 'transfers'

  useEffect(() => {
    if (lead && isOpen) {
      fetchHistoryData();
    }
  }, [lead, isOpen]);

  const fetchHistoryData = async () => {
    setLoading(true);
    try {
      const auditLogs = await api.getLeadsAuditTrail(lead.id);
      setAudits(auditLogs);

      const transferLogs = await api.getLeadsTransferHistory(lead.id);
      setTransfers(transferLogs);
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setLoading(false);
    }
  };

  // Add API mappings to api helper on the fly if not defined
  // Wait, in our api.js we should make sure these endpoints are defined!
  // In `api.js`, we did not write `getLeadsAuditTrail` or `getLeadsTransferHistory`! Let's check:
  // Ah! In `api.js` we did not write them!
  // Let's add them to `api.js` (we can update `api.js` to add them, or write them directly inside this component or edit `api.js`).
  // Let's look at `api.js` endpoints:
  // In `api.js`:
  // api.getLeadsAuditTrail = (leadId) => request(`/api/leads/${leadId}/audit-trail`)
  // api.getLeadsTransferHistory = (leadId) => request(`/api/leads/${leadId}/transfer-history`)
  // Let's edit `api.js` first to add them, or we can just call fetch directly or edit `api.js` in a minute. We will edit `api.js` to include them.

  if (!isOpen || !lead) return null;

  return (
    <div class="modal-overlay">
      <div class="modal-content" style={{ maxWidth: '680px', minHeight: '500px' }}>
        <div class="modal-header">
          <h2 class="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} style={{ color: 'var(--primary)' }} />
            History Log: {lead.name}
          </h2>
          <button class="action-icon-btn" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
        </div>

        {/* Sub tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-main)', padding: '0 20px' }}>
          <button 
            type="button"
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeSubTab === 'audit' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeSubTab === 'audit' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}
            onClick={() => setActiveSubTab('audit')}
          >
            Audit Trail Logs
          </button>
          <button 
            type="button"
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeSubTab === 'transfers' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeSubTab === 'transfers' ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}
            onClick={() => setActiveSubTab('transfers')}
          >
            Ownership Transfer History
          </button>
        </div>

        <div class="modal-body" style={{ flex: 1, maxHeight: '420px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              Loading logs...
            </div>
          ) : activeSubTab === 'audit' ? (
            /* Audit Trail Timeline */
            audits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                No audits recorded for this lead.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '16px', position: 'relative', borderLeft: '2px solid var(--border-color)', margin: '10px 0 10px 10px' }}>
                {audits.map((item, idx) => (
                  <div key={item.id} style={{ position: 'relative', marginBottom: '20px' }}>
                    {/* Timeline Node dot */}
                    <div style={{
                      position: 'absolute',
                      left: '-23px',
                      top: '2px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      border: '3px solid var(--bg-card)',
                      boxShadow: '0 0 5px var(--primary-glow)'
                    }}></div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{item.action}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} />
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>{item.details}</p>
                    
                    <div style={{ fontSize: '11px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={10} />
                      Logged by: {item.user_name || 'System'}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Transfer Logs List */
            transfers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                This lead has never been reassigned. Initial owner assignment only.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {transfers.map((item) => (
                  <div key={item.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowRightLeft size={12} /> Reassigned
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(item.transfer_date).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>From:</span>
                      <strong style={{ color: 'var(--color-hot)' }}>{item.from_employee ? item.from_employee.full_name : 'Unassigned'}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                      <span style={{ color: 'var(--text-muted)' }}>To:</span>
                      <strong style={{ color: 'var(--color-success)' }}>{item.to_employee ? item.to_employee.full_name : 'Unassigned'}</strong>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                      Assigned by: {item.assigner ? item.assigner.full_name : 'Admin'}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div class="modal-footer" style={{ borderTop: '1px solid var(--border-color)' }}>
          <button type="button" class="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Close History Log</button>
        </div>
      </div>
    </div>
  );
}
