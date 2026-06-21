import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Facebook, Instagram, Search, Globe, Share2, TrendingUp, Trophy, BadgeCent, RefreshCw } from 'lucide-react';

export default function SourceRoiDashboard({ onDrillDown }) {
  const [roiData, setRoiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRoiData();
  }, []);

  const fetchRoiData = async () => {
    setLoading(true);
    try {
      const data = await api.getSourceRoiStats();
      setRoiData(data || []);
      setError('');
    } catch (err) {
      console.error('Failed to load Source ROI stats:', err);
      setError('Failed to fetch lead source ROI statistics.');
    } finally {
      setLoading(false);
    }
  };

  const getSourceIcon = (source) => {
    switch (source) {
      case 'Facebook':
        return <Facebook size={24} style={{ color: '#1877F2' }} />;
      case 'Instagram':
        return <Instagram size={24} style={{ color: '#E1306C' }} />;
      case 'Google':
        return <Search size={24} style={{ color: '#4285F4' }} />;
      case 'Website':
        return <Globe size={24} style={{ color: '#06b6d4' }} />;
      case 'Referral':
        return <Share2 size={24} style={{ color: '#8b5cf6' }} />;
      default:
        return <Globe size={24} style={{ color: 'var(--primary)' }} />;
    }
  };

  // Safe drilldown routing triggers
  const handleCardClick = (source, type) => {
    if (!onDrillDown) return;
    if (type === 'leads') {
      onDrillDown('Leads', { source });
    } else if (type === 'bookings') {
      onDrillDown('Bookings', { source, status: 'Booked' });
    } else if (type === 'revenue') {
      // Directs to bookings overview table (revenue)
      onDrillDown('Total Revenue', { source });
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
        <RefreshCw className="bell-animation" style={{ marginRight: '8px', display: 'inline-block' }} size={16} />
        Loading lead source ROI indicators...
      </div>
    );
  }

  if (error) {
    return <div style={{ color: '#ef4444', padding: '20px', textAlign: 'center' }}>{error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-main)' }}>📊 Lead Source ROI Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Track acquisition cost efficiency, booking rates, and generated revenue per campaign source.
          </p>
        </div>
        <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={fetchRoiData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {roiData.map((item) => (
          <div 
            key={item.source} 
            className="card" 
            style={{ 
              background: 'var(--card-bg)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '12px', 
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}
          >
            {/* Header: Source and Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {getSourceIcon(item.source)}
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)' }}>{item.source} Campaigns</h3>
              </div>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 600, 
                padding: '2px 8px', 
                borderRadius: '12px', 
                backgroundColor: 'rgba(6, 182, 212, 0.1)', 
                color: 'var(--color-info)' 
              }}>
                Source Tracking Active
              </span>
            </div>

            {/* Metrics Breakdown Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              
              {/* Metric 1: Leads */}
              <div 
                className="stat-card clickable-card"
                onClick={() => handleCardClick(item.source, 'leads')}
                style={{ 
                  padding: '12px', 
                  borderRadius: '8px', 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  border: '1px solid rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Leads Acquired</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>{item.leads}</div>
              </div>

              {/* Metric 2: Bookings */}
              <div 
                className="stat-card clickable-card"
                onClick={() => handleCardClick(item.source, 'bookings')}
                style={{ 
                  padding: '12px', 
                  borderRadius: '8px', 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  border: '1px solid rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Bookings Confirmed</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                  <Trophy size={14} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }} />
                  {item.bookings}
                </div>
              </div>

              {/* Metric 3: Conversion Rate */}
              <div 
                className="stat-card"
                style={{ 
                  padding: '12px', 
                  borderRadius: '8px', 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  border: '1px solid rgba(255, 255, 255, 0.02)'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Conversion %</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-success)' }}>
                  <TrendingUp size={14} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }} />
                  {item.conversion}%
                </div>
              </div>

              {/* Metric 4: Revenue */}
              <div 
                className="stat-card clickable-card"
                onClick={() => handleCardClick(item.source, 'revenue')}
                style={{ 
                  padding: '12px', 
                  borderRadius: '8px', 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  border: '1px solid rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Revenue Generated</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#22c55e', paddingTop: '4px' }}>
                  <BadgeCent size={14} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }} />
                  ₹{item.revenue.toLocaleString('en-IN')}
                </div>
              </div>

            </div>

            {/* Conversion bar display */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>Funnel Conversion Progress</span>
                <span>{item.conversion}% Complete</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ 
                  background: item.conversion > 10 ? 'var(--color-success)' : (item.conversion > 5 ? 'var(--primary)' : 'var(--text-muted)'), 
                  width: `${Math.min(item.conversion * 5, 100)}%`, // Scale progress visually for low-pct conversions
                  height: '100%', 
                  borderRadius: '3px' 
                }} />
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
