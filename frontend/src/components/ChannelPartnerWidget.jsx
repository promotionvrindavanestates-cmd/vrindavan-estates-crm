import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Award, TrendingUp, DollarSign, Percent } from 'lucide-react';

export default function ChannelPartnerWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.getChannelPartnerReports();
      setData(res || []);
    } catch (e) {
      console.error('Failed to load CP reports:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatRevenue = (val) => {
    const num = parseFloat(val) || 0;
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(2)} L`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>Loading leaderboard...</div>;
  }

  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '340px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '16px', color: '#D4AF37', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={18} style={{ color: '#D4AF37' }} /> Top Channel Partners
        </h4>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', padding: '4px 8px', borderRadius: '12px' }}>
          Live Leaderboard
        </span>
      </div>

      {data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          No referral leads registered yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <th style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500 }}>CP Code</th>
                <th style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500 }}>Total Leads</th>
                <th style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500 }}>Bookings</th>
                <th style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500 }}>Revenue</th>
                <th style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500 }}>Conversion</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 5).map((cp, idx) => (
                <tr 
                  key={cp.cp_code} 
                  style={{ 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx === 0 ? 'rgba(212, 175, 55, 0.03)' : 'transparent' 
                  }}
                >
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '6px', 
                      background: idx === 0 ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                      border: idx === 0 ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: idx === 0 ? '#D4AF37' : '#f1f5f9',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: idx === 0 ? '0 0 10px rgba(212,175,55,0.1)' : 'none'
                    }}>
                      {cp.cp_code}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '13px', color: '#f1f5f9' }}>{cp.leads}</td>
                  <td style={{ padding: '12px 8px', fontSize: '13px', color: '#f1f5f9' }}>{cp.bookings}</td>
                  <td style={{ padding: '12px 8px', fontSize: '13px', color: '#D4AF37', fontWeight: 600 }}>{formatRevenue(cp.revenue)}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: cp.conversion >= 15 ? '#22c55e' : (cp.conversion >= 5 ? '#eab308' : '#ef4444'), fontWeight: 600 }}>
                        {cp.conversion}%
                      </span>
                      <div style={{ width: '48px', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(cp.conversion, 100)}%`, height: '100%', background: cp.conversion >= 15 ? '#22c55e' : (cp.conversion >= 5 ? '#eab308' : '#ef4444') }}></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
