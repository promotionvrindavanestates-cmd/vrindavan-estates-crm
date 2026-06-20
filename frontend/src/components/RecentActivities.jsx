import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Activity, Phone, Calendar, UserPlus, FileText, Smartphone, Laptop, Clock, MessageSquare, MapPin } from 'lucide-react';

export default function RecentActivities({ limit = 15 }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecentActivities();
    // Set up auto-refresh every 30 seconds for live updates
    const interval = setInterval(fetchRecentActivities, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  const fetchRecentActivities = async () => {
    try {
      const data = await api.getRecentActivities(limit);
      setActivities(data || []);
      setError('');
    } catch (err) {
      console.error('Failed to load recent activities:', err);
      setError('Could not sync global activities feed.');
    } finally {
      setLoading(false);
    }
  };

  // Helper for icons based on action type
  const getActivityIcon = (action) => {
    const act = String(action).toLowerCase();
    if (act.includes('call') || act.includes('dial')) {
      return <Phone size={14} style={{ color: 'var(--color-info)' }} />;
    }
    if (act.includes('site visit') || act.includes('check-in') || act.includes('check-out') || act.includes('gps')) {
      return <MapPin size={14} style={{ color: '#eab308' }} />;
    }
    if (act.includes('assign') || act.includes('transfer')) {
      return <UserPlus size={14} style={{ color: '#8b5cf6' }} />;
    }
    if (act.includes('whatsapp') || act.includes('message') || act.includes('campaign')) {
      return <MessageSquare size={14} style={{ color: '#10b981' }} />;
    }
    if (act.includes('reminder') || act.includes('follow-up') || act.includes('added')) {
      return <Calendar size={14} style={{ color: 'var(--primary)' }} />;
    }
    return <Activity size={14} style={{ color: 'var(--text-muted)' }} />;
  };

  // Relative time formatter
  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const diffMs = new Date() - new Date(dateStr);
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="card" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '16px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 15px 0', fontSize: '15px', color: 'var(--text-main)' }}>
        <Activity size={18} style={{ color: 'var(--primary)' }} />
        Live CRM Activity Feed
      </h3>

      {error && (
        <div style={{ fontSize: '11px', color: '#ef4444', padding: '6px 10px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '4px', marginBottom: '10px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
          Fetching active feed...
        </div>
      ) : activities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>
          No activities logged in the system yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, maxHeight: '350px', paddingRight: '4px' }}>
          {activities.map((item, idx) => {
            const device = item.device || 'Web Portal';
            const isMobile = device.toLowerCase().includes('apk') || device.toLowerCase().includes('mobile') || device.toLowerCase().includes('capacitor');

            return (
              <div 
                key={item.id || idx} 
                style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  paddingBottom: '12px', 
                  borderBottom: idx === activities.length - 1 ? 'none' : '1px solid var(--border-color)' 
                }}
              >
                {/* Icon Column */}
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  background: 'var(--bg-input)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {getActivityIcon(item.action)}
                </div>

                {/* Content Column */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '5px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.user_name || 'System'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                      <Clock size={10} />
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{item.action}:</span> {item.details}
                  </div>

                  {/* Metadata line */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '9px', color: 'var(--text-muted)' }}>
                    <span>
                      {item.leads?.name && (
                        <span>Lead: <strong style={{ color: 'var(--text-main)' }}>{item.leads.name}</strong></span>
                      )}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(255,255,255,0.03)', padding: '2px 4px', borderRadius: '3px' }}>
                      {isMobile ? <Smartphone size={8} /> : <Laptop size={8} />}
                      {device}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
