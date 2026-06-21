import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { PhoneCall, Calendar, Clock, Play, Pause } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

const RESPONSES = ['Connected', 'Not Picked', 'Busy', 'Interested', 'Site Visit', 'Follow Up', 'Not Interested', 'Booked'];
const ACTIONS = ['None', 'Callback Scheduled', 'Site Visit Scheduled', 'Meeting Arranged', 'Information Sent', 'Others'];

export default function CallLogModal({ isOpen, onClose, lead, onSaveSuccess }) {
  const [response, setResponse] = useState('Connected');
  const [notes, setNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('None');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [createReminder, setCreateReminder] = useState(true);
  const [sendWhatsAppReminder, setSendWhatsAppReminder] = useState(true);
  
  // Call History Sidebar
  const [callHistory, setCallHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Timer States
  const [duration, setDuration] = useState(0);
  const [timerActive, setTimerActive] = useState(true);
  
  // Modal Workflow States
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessPrompt, setShowSuccessPrompt] = useState(false);

  // Live Timer Effect
  useEffect(() => {
    let timer;
    if (isOpen && timerActive && !showSuccessPrompt) {
      timer = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, timerActive, showSuccessPrompt]);

  // Load Lead History on Open
  useEffect(() => {
    if (lead && isOpen) {
      setResponse('Connected');
      setNotes('');
      setActionTaken('None');
      setFollowUpDate('');
      setFollowUpTime('');
      setCreateReminder(true);
      setSendWhatsAppReminder(true);
      setDuration(0);
      setTimerActive(true);
      setError('');
      setShowSuccessPrompt(false);
      fetchCallLogs();
    }
  }, [lead, isOpen]);

  const fetchCallLogs = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getCallLogs(lead.id);
      setCallHistory(data || []);
    } catch (e) {
      console.error('Error fetching call logs:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  const formatDuration = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!response) {
      setError('Please select a call outcome status.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const hasFollowUp = actionTaken !== 'None';
      const extra = {
        duration,
        action_taken: hasFollowUp ? actionTaken : null,
        follow_up_date: hasFollowUp && followUpDate ? followUpDate : null,
        follow_up_time: hasFollowUp && followUpTime ? followUpTime : null,
        follow_up_datetime: hasFollowUp && followUpDate ? new Date(`${followUpDate}T${followUpTime || '09:00'}:00`).toISOString() : null,
        create_reminder: hasFollowUp ? createReminder : false
      };

      await api.logCall(lead.id, response, notes, extra);
      
      // Stop timer and show post-call action selector
      setTimerActive(false);
      setShowSuccessPrompt(true);
    } catch (err) {
      setError(err.message || 'Failed to log call.');
      setSaving(false);
    }
  };

  const handleSendWhatsAppNow = () => {
    const leadName = lead.name || 'Client';
    const dateStr = followUpDate ? new Date(followUpDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'soon';
    const timeStr = followUpTime || 'scheduled time';
    const phone = lead.phone1 || '';
    if (!phone) return alert('Phone number is missing.');

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const prefix = cleanPhone.length === 10 ? '91' : '';

    const message = `Hello ${leadName},\n\nThank you for speaking with me today. As discussed, I have scheduled our next follow-up call/meeting on *${dateStr}* at *${timeStr}*.\n\nRegards,\nIndiana Vrindavan Estates Team`;

    const url = `https://wa.me/${prefix}${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    // Close modal and refresh parent lists
    onSaveSuccess();
    onClose();
  };

  const handleSkipWhatsApp = () => {
    onSaveSuccess();
    onClose();
  };

  return (
    <div class="modal-overlay">
      <div class="modal-content" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', maxWidth: '900px', minHeight: '520px' }}>
        
        {/* Left Side: Call Form or Success Screen */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--border-color)' }}>
          {!showSuccessPrompt ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div class="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 class="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PhoneCall size={18} style={{ color: 'var(--primary)' }} />
                  Log Outcome: {lead.name}
                </h2>
                
                {/* Flashing premium timer widget */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    display: 'inline-block',
                    animation: timerActive ? 'pulse-glow 1s infinite alternate' : 'none',
                    boxShadow: timerActive ? '0 0 8px #ef4444' : 'none'
                  }} />
                  <strong style={{ color: '#ef4444', fontFamily: 'monospace' }}>{formatDuration(duration)}</strong>
                  <button 
                    type="button" 
                    onClick={() => setTimerActive(!timerActive)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: 0 }}
                  >
                    {timerActive ? <Pause size={10} /> : <Play size={10} />}
                  </button>
                </div>
              </div>

              <div class="modal-body" style={{ flex: 1, overflowY: 'auto', paddingRight: '15px' }}>
                {error && (
                  <div style={{ background: 'var(--color-hot-bg)', color: 'var(--color-hot)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', border: '1px solid rgba(255, 94, 94, 0.2)' }}>
                    {error}
                  </div>
                )}

                <style>{`
                  @keyframes pulse-glow {
                    from { transform: scale(0.9); opacity: 0.5; }
                    to { transform: scale(1.1); opacity: 1; }
                  }
                `}</style>

                {/* Lead Summary */}
                <div style={{ marginBottom: '16px', fontSize: '12px', background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px' }}>
                  <div><strong>Phone:</strong> {lead.phone1}</div>
                  <div><strong>City:</strong> {lead.city || 'N/A'}</div>
                  <div style={{ gridColumn: 'span 2' }}><strong>Requirement:</strong> {lead.requirement || 'No notes loaded'}</div>
                </div>

                {/* Outcome Dropdown */}
                <div class="form-group" style={{ marginBottom: '16px' }}>
                  <label>Call Outcome</label>
                  <select
                    class="form-control"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    disabled={saving}
                  >
                    {RESPONSES.map(resp => <option key={resp} value={resp}>{resp}</option>)}
                  </select>
                </div>

                {/* Remarks Notes */}
                <div class="form-group" style={{ marginBottom: '16px' }}>
                  <label>Call Notes / Response Remarks</label>
                  <textarea
                    class="form-control"
                    rows="3"
                    placeholder="Enter what was discussed during the call..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={saving}
                    required
                  ></textarea>
                </div>

                {/* Action Taken */}
                <div class="form-group" style={{ marginBottom: '16px' }}>
                  <label>Action Taken / Next Step</label>
                  <select
                    class="form-control"
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    disabled={saving}
                  >
                    {ACTIONS.map(act => <option key={act} value={act}>{act}</option>)}
                  </select>
                </div>

                {/* Follow-Up Scheduler Panel (Fades in if action is selected) */}
                {actionTaken !== 'None' && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: 'var(--radius-md)', animation: 'slideDown 0.2s ease-out', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '12.5px' }}>📅 Schedule Follow-Up Reminders</div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div class="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px' }}>Follow-Up Date</label>
                        <input
                          type="date"
                          class="form-control"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          required
                        />
                      </div>
                      <div class="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px' }}>Follow-Up Time</label>
                        <input
                          type="time"
                          class="form-control"
                          value={followUpTime}
                          onChange={(e) => setFollowUpTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'normal', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={createReminder}
                          onChange={(e) => setCreateReminder(e.target.checked)}
                        />
                        Create Automatic Reminder in Dashboard
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'normal', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={sendWhatsAppReminder}
                          onChange={(e) => setSendWhatsAppReminder(e.target.checked)}
                        />
                        Prompt to Send WhatsApp Confirmation Message
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
                <button type="submit" class="btn btn-primary" disabled={saving}>
                  {saving ? 'Logging Outcome...' : 'Save outcome'}
                </button>
              </div>
            </form>
          ) : (
            /* Post-call workflow prompt screen */
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '30px', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', marginBottom: '16px' }}>
                ✓
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Call Outcome Logged Successfully!</h2>
              
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', fontSize: '13px', width: '100%', maxWidth: '380px', margin: '15px 0', textAlign: 'left' }}>
                <div style={{ marginBottom: '4px' }}><strong>Call Duration:</strong> {formatDuration(duration)}</div>
                <div style={{ marginBottom: '4px' }}><strong>Outcome Selected:</strong> {response}</div>
                {actionTaken !== 'None' && followUpDate && (
                  <div><strong>Next Follow-up:</strong> {new Date(followUpDate).toLocaleDateString()} at {followUpTime || '09:00 AM'}</div>
                )}
              </div>

              {actionTaken !== 'None' && sendWhatsAppReminder ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '380px', marginTop: '10px' }}>
                  <button 
                    onClick={handleSendWhatsAppNow} 
                    className="whatsapp-action-btn"
                    style={{ justifyContent: 'center', padding: '12px', fontSize: '14px', width: '100%' }}
                  >
                    <FaWhatsapp size={18} /> Send WhatsApp Now
                  </button>
                  <button 
                    onClick={handleSkipWhatsApp} 
                    className="btn btn-secondary"
                    style={{ padding: '10px', fontSize: '13px' }}
                  >
                    Skip WhatsApp & Close
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleSkipWhatsApp} 
                  className="btn btn-primary"
                  style={{ padding: '10px 24px', fontSize: '13px', marginTop: '10px' }}
                >
                  Close outcome dialog
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Call History Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div class="modal-header">
            <h3 class="modal-title">Previous Call Records</h3>
          </div>
          
          <div class="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                Loading logs...
              </div>
            ) : callHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                No prior calls logged for this client.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {callHistory.map((log) => (
                  <div key={log.id} style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span class="badge badge-info" style={{ fontSize: '9px', padding: '1px 5px' }}>{log.response}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Clock size={8} />
                        {new Date(log.call_date).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <p style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '11.5px', whiteSpace: 'pre-line' }}>
                      {log.notes}
                    </p>

                    {log.duration > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        ⏱ Call Duration: <strong>{formatDuration(log.duration)}</strong>
                      </div>
                    )}
                    
                    {log.action_taken && (
                      <div style={{ fontSize: '10px', color: 'var(--primary)', marginBottom: '4px' }}>
                        Action: <strong>{log.action_taken}</strong>
                        {log.follow_up_date && ` on ${log.follow_up_date}`}
                      </div>
                    )}

                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right' }}>
                      Caller: {log.caller ? log.caller.full_name : 'Executive'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div class="modal-footer" style={{ borderTop: '1px solid var(--border-color)', justifyContent: 'flex-start' }}>
            <button type="button" class="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Close History</button>
          </div>
        </div>

      </div>
    </div>
  );
}
