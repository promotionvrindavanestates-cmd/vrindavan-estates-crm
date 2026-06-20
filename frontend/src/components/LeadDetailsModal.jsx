import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { MapPin, Calendar, Clock, Award, PhoneCall, Check, Compass, CheckCircle2, AlertCircle, MessageSquare, ArrowRightLeft, Database } from 'lucide-react';

export default function LeadDetailsModal({ isOpen, onClose, lead, onSaveSuccess }) {
  const [siteVisits, setSiteVisits] = useState([]);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Geolocation capture state
  const [geoLoc, setGeoLoc] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);

  // Check-out form state
  const [activeCheckInVisit, setActiveCheckInVisit] = useState(null);
  const [checkoutFeedback, setCheckoutFeedback] = useState('');
  const [checkoutOutcome, setCheckoutOutcome] = useState('Interested');

  useEffect(() => {
    if (isOpen && lead) {
      fetchHistoryDetails();
      captureCoordinates();
    } else {
      setSiteVisits([]);
      setTimelineEvents([]);
      setActiveCheckInVisit(null);
      setCheckoutFeedback('');
    }
  }, [isOpen, lead]);

  const fetchHistoryDetails = async () => {
    setLoading(true);
    try {
      const visits = await api.getSiteVisits(lead.id);
      setSiteVisits(visits);
      
      const active = visits.find(v => !v.check_out_time);
      setActiveCheckInVisit(active || null);

      const timeline = await api.getLeadTimeline(lead.id);
      setTimelineEvents(timeline);
    } catch (e) {
      console.error('Failed to load timeline:', e);
    } finally {
      setLoading(false);
    }
  };

  const captureCoordinates = () => {
    setGeoLoading(true);
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser/device.');
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(`Unable to retrieve location: ${err.message}`);
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCheckIn = async () => {
    if (!geoLoc) {
      return alert('Coordinates not loaded yet! Please enable GPS and allow location access.');
    }
    const address = window.prompt("Enter current site address or remarks (optional):", "Vrindavan Project Site");
    
    try {
      await api.checkInSiteVisit(lead.id, geoLoc.lat, geoLoc.lng, address || 'Vrindavan Site Visit Checkin');
      alert('Checked-in successfully! Geofence verified and logged.');
      fetchHistoryDetails();
      if (onSaveSuccess) onSaveSuccess();
    } catch (err) {
      alert(`Check-in denied: ${err.message}`);
    }
  };

  const handleCheckOut = async (e) => {
    e.preventDefault();
    if (!geoLoc) return alert('GPS Coordinates are required for Check-out verification.');

    try {
      await api.checkOutSiteVisit(
        lead.id,
        activeCheckInVisit.id,
        geoLoc.lat,
        geoLoc.lng,
        'Site Visit Checkout',
        checkoutFeedback,
        checkoutOutcome,
        []
      );
      alert('Site Visit Check-out complete! Lead status updated.');
      setActiveCheckInVisit(null);
      setCheckoutFeedback('');
      fetchHistoryDetails();
      if (onSaveSuccess) onSaveSuccess();
    } catch (err) {
      alert(`Check-out failed: ${err.message}`);
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'call':
        return <PhoneCall size={14} style={{ color: 'var(--color-info)' }} />;
      case 'transfer':
        return <ArrowRightLeft size={14} style={{ color: 'var(--primary)' }} />;
      case 'site-visit-in':
        return <MapPin size={14} style={{ color: '#eab308' }} />;
      case 'site-visit-out':
        return <MapPin size={14} style={{ color: 'var(--color-success)' }} />;
      case 'booking':
        return <Award size={14} style={{ color: 'var(--color-success)' }} />;
      case 'whatsapp':
        return <MessageSquare size={14} style={{ color: '#128C7E' }} />;
      default:
        return <AlertCircle size={14} style={{ color: 'var(--primary)' }} />;
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div class="modal-overlay">
      <div class="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div class="modal-header">
          <div>
            <h3>📋 Lead Timeline & GPS Check-In</h3>
            <span style={{ fontSize: '12px', color: 'var(--primary)' }}>Customer: <strong>{lead.name}</strong> ({lead.phone1})</span>
          </div>
          <button class="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '20px' }}>
          
          {/* Site Visit GPS Tracker Panel */}
          <div style={{ marginBottom: '25px', background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--text-main)', fontSize: '14px' }}>
              <Compass size={16} style={{ color: 'var(--primary)' }} /> GPS Geofenced Site Visit
            </h4>
            
            {/* GPS coordinates loading status info */}
            <div style={{ background: 'var(--bg-card)', padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div>
                {geoLoading ? (
                  <span style={{ color: 'var(--primary)' }}>Acquiring GPS satellite coordinates...</span>
                ) : geoError ? (
                  <span style={{ color: 'var(--color-hot)' }}>{geoError}</span>
                ) : geoLoc ? (
                  <span>📍 GPS Status: <strong>{geoLoc.lat.toFixed(6)}, {geoLoc.lng.toFixed(6)}</strong> (Verified)</span>
                ) : 'GPS idle.'}
              </div>
              <button type="button" class="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={captureCoordinates}>
                Retry GPS
              </button>
            </div>

            {/* Check-in / Check-out actions */}
            {activeCheckInVisit ? (
              // Show check-out form
              <form onSubmit={handleCheckOut} style={{ background: 'rgba(234, 179, 8, 0.05)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                <div style={{ fontSize: '13px', marginBottom: '12px', color: '#eab308', fontWeight: 600 }}>
                  ⚠️ Active check-in logged at: {new Date(activeCheckInVisit.check_in_time).toLocaleTimeString()}. Please check-out before leaving site.
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div class="form-group">
                    <label>Site Visit Outcome *</label>
                    <select class="form-control" value={checkoutOutcome} onChange={e => setCheckoutOutcome(e.target.value)} style={{ background: 'var(--bg-card)' }}>
                      <option value="Interested">Interested / Hot</option>
                      <option value="Negotiation">Negotiation Phase</option>
                      <option value="Booking Expected">Booking Expected</option>
                      <option value="Need Follow-up">Need Follow-up</option>
                      <option value="Not Interested">Not Interested</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Client Feedback Remarks *</label>
                    <input 
                      type="text" 
                      class="form-control" 
                      value={checkoutFeedback} 
                      onChange={e => setCheckoutFeedback(e.target.value)} 
                      required 
                      placeholder="e.g. Liked plot 45, asked for discount" 
                      style={{ background: 'var(--bg-card)' }}
                    />
                  </div>
                </div>

                <button type="submit" class="btn btn-danger" style={{ marginTop: '14px', width: '100%' }}>
                  Submit GPS Check-Out
                </button>
              </form>
            ) : (
              // Check-in trigger
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, maxWidth: '70%' }}>
                  Check-In at site. The CRM geofence verifies coordinates are within <strong>500 meters</strong> of the project site.
                </p>
                <button type="button" class="btn btn-primary" onClick={handleCheckIn} style={{ fontSize: '12px' }}>
                  📍 GPS Check-In
                </button>
              </div>
            )}
          </div>

          {/* C. Unified Permanent Lead Timeline */}
          <div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', color: 'var(--text-main)', fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <Clock size={16} style={{ color: 'var(--primary)' }} /> Lead Activity Timeline Logs
            </h4>
            
            {loading ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>Loading timeline events...</div>
            ) : timelineEvents.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>No timeline events recorded.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingLeft: '8px', borderLeft: '2px dashed var(--border-color)', marginLeft: '12px' }}>
                {timelineEvents.map((event, idx) => (
                  <div 
                    key={event.id || idx} 
                    style={{ 
                      position: 'relative', 
                      background: 'var(--bg-main)', 
                      padding: '12px 16px', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-color)',
                      fontSize: '13px'
                    }}
                  >
                    {/* Floating Node Icon */}
                    <div 
                      style={{ 
                        position: 'absolute', 
                        left: '-23px', 
                        top: '12px', 
                        background: 'var(--bg-card)', 
                        border: '2px solid var(--border-color)', 
                        borderRadius: '50%', 
                        width: '24px', 
                        height: '24px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      {getEventIcon(event.type)}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{event.title}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(event.date).toLocaleString()}</span>
                    </div>

                    <div style={{ color: 'var(--text-main)', fontSize: '12.5px' }}>{event.description}</div>
                    
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Actor: {event.user}</span>
                      {event.device && (
                        <span>Device: <strong style={{ color: 'var(--primary)' }}>{event.device}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
