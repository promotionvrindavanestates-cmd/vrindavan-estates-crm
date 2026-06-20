import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Bell, Check, Trash2, Calendar, Phone, Clock, AlertTriangle, AlertCircle } from 'lucide-react';

export default function RemindersModal({ isOpen, onClose, onSelectLead, currentUser = {} }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('active'); // active, all

  useEffect(() => {
    if (isOpen) {
      fetchReminders();
    }
  }, [isOpen]);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const data = await api.getReminders();
      setReminders(data);
    } catch (e) {
      console.error('Failed to fetch reminders:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markReminderAsRead(id);
      // Refresh list
      fetchReminders();
    } catch (e) {
      alert('Failed to mark reminder as completed.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteReminder(id);
      fetchReminders();
    } catch (e) {
      alert('Failed to delete reminder.');
    }
  };

  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  // Categorize reminders
  const activeReminders = reminders.filter(r => !r.is_read);
  const displayedReminders = filter === 'active' ? activeReminders : reminders;

  const overdue = displayedReminders.filter(r => r.reminder_date < todayStr && !r.is_read);
  const today = displayedReminders.filter(r => r.reminder_date === todayStr && !r.is_read);
  const upcoming = displayedReminders.filter(r => r.reminder_date > todayStr || r.is_read);

  return (
    <div class="modal-backdrop">
      <div class="modal-card" style={{ maxWidth: '600px' }}>
        <div class="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={20} style={{ color: 'var(--primary)' }} />
            Follow-Up Reminders & Alerts
          </h2>
          <button class="close-btn" onClick={onClose}>×</button>
        </div>

        <div class="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <button 
              type="button"
              class={`btn ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => setFilter('active')}
            >
              Active Reminders ({activeReminders.length})
            </button>
            <button 
              type="button"
              class={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => setFilter('all')}
            >
              All History ({reminders.length})
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading reminders...
            </div>
          ) : displayedReminders.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No reminders scheduled.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              
              {/* Overdue/Missed Section */}
              {overdue.length > 0 && (
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-hot)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    <AlertTriangle size={14} /> Overdue / Missed Reminders
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {overdue.map(r => (
                      <ReminderRow 
                        key={r.id} 
                        reminder={r} 
                        onMarkRead={handleMarkRead} 
                        onDelete={handleDelete} 
                        onSelectLead={onSelectLead} 
                        onClose={onClose}
                        isOverdue={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Today Section */}
              {today.length > 0 && (
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-info)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    <Clock size={14} /> Scheduled For Today
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {today.map(r => (
                      <ReminderRow 
                        key={r.id} 
                        reminder={r} 
                        onMarkRead={handleMarkRead} 
                        onDelete={handleDelete} 
                        onSelectLead={onSelectLead} 
                        onClose={onClose}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming / Read Section */}
              {upcoming.length > 0 && (
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    <Calendar size={14} /> Upcoming & Completed Reminders
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {upcoming.map(r => (
                      <ReminderRow 
                        key={r.id} 
                        reminder={r} 
                        onMarkRead={handleMarkRead} 
                        onDelete={handleDelete} 
                        onSelectLead={onSelectLead} 
                        onClose={onClose}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        <div class="modal-footer" style={{ display: 'flex', justifySelf: 'flex-end', marginTop: '16px' }}>
          <button class="btn btn-secondary" onClick={onClose}>Close Dashboard</button>
        </div>
      </div>
    </div>
  );
}

function ReminderRow({ reminder, onMarkRead, onDelete, onSelectLead, onClose, isOverdue = false }) {
  const l = reminder.leads || {};
  return (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: 'var(--bg-main)', 
        padding: '12px', 
        borderRadius: 'var(--radius-md)', 
        borderLeft: isOverdue ? '4px solid var(--color-hot)' : (reminder.is_read ? '4px solid var(--text-muted)' : '4px solid var(--primary)'),
        opacity: reminder.is_read ? 0.6 : 1
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', textDecoration: reminder.is_read ? 'line-line-through' : 'none' }}>
          {reminder.title} ({reminder.type})
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Lead: <strong style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => { onSelectLead(l); onClose(); }}>{l.name || 'Unknown'}</strong> | Date: {reminder.reminder_date} {reminder.reminder_time || ''}
        </span>
        {reminder.notes && (
          <span style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '4px', color: 'var(--text-main)' }}>
            Notes: "{reminder.notes}"
          </span>
        )}
      </div>

      <div style={{ display: 'inline-flex', gap: '6px' }}>
        {!reminder.is_read && (
          <button 
            type="button" 
            class="action-icon-btn call" 
            style={{ padding: '4px', width: '26px', height: '26px', background: 'var(--color-success-bg)', color: 'var(--color-success)', border: 'none' }}
            title="Call Client"
            onClick={() => {
              if (l.phone1) {
                window.location.href = `tel:${l.phone1}`;
                onSelectLead(l);
                onClose();
              } else {
                alert('No phone number recorded for this lead.');
              }
            }}
          >
            <Phone size={12} />
          </button>
        )}
        
        {!reminder.is_read && (
          <button 
            type="button" 
            class="action-icon-btn" 
            style={{ padding: '4px', width: '26px', height: '26px', background: 'var(--color-info-bg)', color: 'var(--color-info)', border: 'none' }}
            title="Mark as Done"
            onClick={() => onMarkRead(reminder.id)}
          >
            <Check size={12} />
          </button>
        )}

        <button 
          type="button" 
          class="action-icon-btn" 
          style={{ padding: '4px', width: '26px', height: '26px', background: 'var(--color-hot-bg)', color: 'var(--color-hot)', border: 'none' }}
          title="Delete Reminder"
          onClick={() => onDelete(reminder.id)}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
