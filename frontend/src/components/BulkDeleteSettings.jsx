import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function BulkDeleteSettings() {
  const [requireBackup, setRequireBackup] = useState(true);
  const [threshold, setThreshold] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.getBulkDeleteSettings();
      setRequireBackup(res.requireBackup ?? true);
      setThreshold(res.threshold ?? 20);
    } catch (e) {
      console.error('Failed to fetch bulk delete settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    try {
      await api.updateBulkDeleteSettings({ requireBackup, threshold: parseInt(threshold) });
      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading settings...</div>;
  }

  return (
    <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(212,175,55,0.15)', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px' }}>
      <h4 style={{ margin: 0, fontSize: '16px', color: '#D4AF37', fontWeight: 600 }}>Smart Bulk Delete Safety Rules</h4>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={requireBackup} 
            onChange={(e) => setRequireBackup(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: '#D4AF37', marginTop: '2px' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: 500 }}>Require Backup before deleting large datasets</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Forces a safety backup when selected leads exceed the threshold limit.</span>
          </div>
        </label>

        {requireBackup && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '30px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Safety Threshold (Selected Leads):</label>
            <select 
              value={threshold} 
              onChange={(e) => setThreshold(e.target.value)}
              style={{ 
                background: 'rgba(5, 8, 15, 0.95)', 
                border: '1.5px solid rgba(212, 175, 55, 0.3)', 
                borderRadius: '8px', 
                padding: '10px 16px', 
                color: '#f1f5f9', 
                fontSize: '13px',
                outline: 'none',
                maxWidth: '150px'
              }}
            >
              <option value="10">10 Leads</option>
              <option value="20">20 Leads</option>
              <option value="50">50 Leads</option>
              <option value="100">100 Leads</option>
              <option value="500">500 Leads</option>
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
        <button 
          className="btn btn-primary" 
          onClick={handleSave} 
          disabled={saving}
          style={{ padding: '8px 20px', borderRadius: '8px', background: '#D4AF37', color: '#05080F', border: 'none', fontWeight: 600, cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {successMsg && <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 500 }}>{successMsg}</span>}
      </div>
    </div>
  );
}
