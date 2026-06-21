import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { ArrowRight, ChevronRight, Building, User, Calendar, CreditCard, Filter, CheckCircle } from 'lucide-react';

export default function BookingPipeline({ currentUser }) {
  const [bookings, setBookings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(false);

  const statuses = ['Token Booking', 'Booking Confirmed', 'Agreement Pending', 'Registry Pending', 'Registry Complete'];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const projs = await api.getProjects();
      setProjects(projs);
      const bData = await api.getBookings();
      setBookings(bData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceStatus = async (bookingId, currentStatus) => {
    const currentIndex = statuses.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex === statuses.length - 1) return;
    
    const nextStatus = statuses[currentIndex + 1];
    
    if (!window.confirm(`Are you sure you want to transition booking status to "${nextStatus}"?`)) return;

    try {
      await api.updateBookingStatus(bookingId, nextStatus);
      alert('Booking status updated successfully!');
      fetchInitialData();
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Token Booking': return { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' };
      case 'Booking Confirmed': return { bg: 'rgba(168, 85, 247, 0.1)', fg: '#a855f7', border: 'rgba(168, 85, 247, 0.2)' };
      case 'Agreement Pending': return { bg: 'rgba(234, 179, 8, 0.1)', fg: '#eab308', border: 'rgba(234, 179, 8, 0.2)' };
      case 'Registry Pending': return { bg: 'rgba(249, 115, 22, 0.1)', fg: '#f97316', border: 'rgba(249, 115, 22, 0.2)' };
      case 'Registry Complete': return { bg: 'rgba(34, 197, 94, 0.1)', fg: '#22c55e', border: 'rgba(34, 197, 94, 0.2)' };
      default: return { bg: 'rgba(255, 255, 255, 0.05)', fg: '#fff', border: 'rgba(255, 255, 255, 0.1)' };
    }
  };

  const filteredBookings = bookings.filter(b => {
    return !selectedProjectId || b.project_id === selectedProjectId;
  });

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          🤝 Booking Pipeline
        </h2>
        
        {/* Project Filter Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
          <select 
            class="form-control" 
            style={{ width: '220px', background: 'rgba(30, 30, 40, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>Loading bookings...</div>
      ) : (
        <div className="pipeline-container" style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '15px', minHeight: '60vh' }}>
          {statuses.map(status => {
            // Support backward compatible status strings mappings in DB
            const items = filteredBookings.filter(b => {
              if (status === 'Token Booking') return b.status === 'Token Booking' || b.status === 'Token Received';
              if (status === 'Registry Complete') return b.status === 'Registry Complete' || b.status === 'Registered';
              return b.status === status;
            });
            const colorScheme = getStatusColor(status);
            const isLastColumn = status === 'Registry Complete';

            return (
              <div 
                key={status} 
                className="pipeline-column" 
                style={{ 
                  flex: '0 0 300px', 
                  background: 'rgba(20, 20, 30, 0.4)', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  padding: '15px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: '600', color: colorScheme.fg, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: colorScheme.fg }} />
                    {status}
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>
                    {items.length}
                  </span>
                </div>

                <div className="pipeline-cards" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '55vh' }}>
                  {items.map(item => (
                    <div 
                      key={item.id}
                      className="pipeline-card"
                      style={{
                        background: 'rgba(30, 30, 45, 0.6)',
                        border: `1px solid ${colorScheme.border}`,
                        borderRadius: '8px',
                        padding: '12px',
                        position: 'relative'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
                        {item.leads?.name || 'Unknown Client'}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building size={12} /> {item.projects?.name || 'Vrindavan'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Unit: <strong>{item.unit_number || 'N/A'}</strong></span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={12} /> {item.booking_date}
                          </span>
                        </div>
                      </div>

                      {/* Financial info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', display: 'block' }}>Token Amt</span>
                          <strong style={{ color: '#3b82f6' }}>₹{(item.token_amount || 0).toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', display: 'block' }}>Booking Conf</span>
                          <strong style={{ color: '#a855f7' }}>₹{(item.booking_amount || 0).toLocaleString('en-IN')}</strong>
                        </div>
                      </div>

                      {/* Transition button */}
                      {!isLastColumn && (
                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleAdvanceStatus(item.id, status)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: '11px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                          >
                            Advance <ArrowRight size={12} />
                          </button>
                        </div>
                      )}

                      {isLastColumn && (
                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', color: '#22c55e', fontSize: '11px', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Complete
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
                      No bookings
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
