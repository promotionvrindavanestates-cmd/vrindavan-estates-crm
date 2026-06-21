import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { PhoneCall, Calendar, Clock } from 'lucide-react';

const RESPONSES = ['Connected', 'Not Picked', 'Busy', 'Interested', 'Site Visit', 'Follow Up', 'Not Interested', 'Booked'];

export default function CallLogModal({ isOpen, onClose, lead, onSaveSuccess }) {
  const [response, setResponse] = useState('Connected');
  const [notes, setNotes] = useState('');
  const [callHistory, setCallHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (lead && isOpen) {
      setResponse('Connected');
      setNotes('');
      setError('');
      fetchCallLogs();
    }
  }, [lead, isOpen]);

  const fetchCallLogs = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getCallLogs(lead.id);
      setCallHistory(data);
    } catch (e) {
      console.error('Error fetching call logs:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!response) {
      setError('Please select a call response status.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.logCall(lead.id, response, notes);
      onSaveSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to log call.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="modal-overlay">
      <div class="modal-content" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', maxWidth: '850px' }}>
        
        {/* Left Side: Call Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--border-color)' }}>
          <div class="modal-header">
            <h2 class="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PhoneCall size={18} style={{ color: 'var(--primary)' }} />
              Log Call: {lead.name}
            </h2>
          </div>
          
          <div class="modal-body" style={{ flex: 1 }}>
            {error && (
              <div style={{ background: 'var(--color-hot-bg)', color: 'var(--color-hot)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', border: '1px solid rgba(255, 94, 94, 0.2)' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '16px', fontSize: '13px', background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div><strong>Client Phone:</strong> {lead.phone1} {lead.phone2 ? `/ ${lead.phone2}` : ''}</div>
              <div><strong>Requirement:</strong> {lead.requirement || 'No notes'}</div>
            </div>

            <div class="form-group" style={{ marginBottom: '16px' }}>
              <label>Call Response Status</label>
              <select
                class="form-control"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                disabled={saving}
              >
                {RESPONSES.map(resp => <option key={resp} value={resp}>{resp}</option>)}
              </select>
            </div>

            <div class="form-group">
              <label>Call Notes / Response Remarks</label>
              <textarea
                class="form-control"
                rows="5"
                placeholder="What did the client say? e.g. Call back in evening, agreed for site visit next Sunday..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={saving}
                required
              ></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" class="btn btn-primary" disabled={saving}>
              {saving ? 'Logging...' : 'Save Log'}
            </button>
          </div>
        </form>

        {/* Right Side: Call History Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div class="modal-header">
            <h3 class="modal-title">Call History</h3>
          </div>
          
          <div class="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                Loading call history...
              </div>
            ) : callHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                No prior calls logged for this lead.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {callHistory.map((log) => (
                  <div key={log.id} style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span class="badge badge-info" style={{ fontSize: '9px', padding: '2px 6px' }}>{log.response}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} />
                        {new Date(log.call_date).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', whiteSpace: 'pre-line' }}>{log.notes}</p>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'right' }}>
                      Caller: {log.caller ? log.caller.full_name : 'System'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div class="modal-footer" style={{ borderTop: '1px solid var(--border-color)', justifyContent: 'flex-start' }}>
            <button type="button" class="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Close Panel</button>
          </div>
        </div>

      </div>
    </div>
  );
}
