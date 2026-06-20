import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { MapPin, Calendar, Clock, Award, PhoneCall, Check, Compass, CheckCircle } from 'lucide-react';

export default function LeadDetailsModal({ isOpen, onClose, lead, onSaveSuccess }) {
  const [siteVisits, setSiteVisits] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
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
      // Auto capture GPS coordinates
      captureCoordinates();
    } else {
      setSiteVisits([]);
      setCallLogs([]);
      setActiveCheckInVisit(null);
      setCheckoutFeedback('');
    }
  }, [isOpen, lead]);

  const fetchHistoryDetails = async () => {
    setLoading(true);
    try {
      const visits = await api.getSiteVisits(lead.id);
      setSiteVisits(visits);
      
      // Find if there is an active check-in (visit_status/outcome is 'Scheduled' or check_out_time is null)
      const active = visits.find(v => !v.check_out_time);
      setActiveCheckInVisit(active || null);

      const calls = await api.getCallLogs(lead.id);
      setCallLogs(calls);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const captureCoordinates = () => {
    setGeoLoading(true);
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser/device.');
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

  if (!isOpen || !lead) return null;

  // Lead Journey Timeline Stepper helper
  const getStepperSteps = () => {
    const status = lead.status;
    const isBooked = lead.booking_status === 'Confirmed' || status === 'Booked';
    
    // Determine active indexes
    let currentStepIndex = 0; // Lead Created
    if (callLogs.length > 0) currentStepIndex = 1; // First Call
    if (lead.follow_up_date) currentStepIndex = 2; // Follow-up
    if (siteVisits.length > 0) {
      const hasCompleted = siteVisits.some(v => v.check_out_time);
      currentStepIndex = hasCompleted ? 4 : 3; // Site Visit done or scheduled
    }
    if (status === 'Negotiation') currentStepIndex = 5; // Negotiation
    if (isBooked) currentStepIndex = 6; // Booking

    return [
      { name: 'Lead Created', active: currentStepIndex >= 0 },
      { name: 'First Call', active: currentStepIndex >= 1 },
      { name: 'Follow-up', active: currentStepIndex >= 2 },
      { name: 'Site Visit', active: currentStepIndex >= 4 },
      { name: 'Negotiation', active: currentStepIndex >= 5 },
      { name: 'Booking', active: currentStepIndex >= 6 }
    ];
  };

  const steps = getStepperSteps();

  return (
    <div class="modal-overlay">
      <div class="modal-content" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div class="modal-header">
          <div>
            <h3>📋 Customer Lifecycle Details</h3>
            <span style={{ fontSize: '12px', color: 'var(--primary)' }}>Customer: <strong>{lead.name}</strong> ({lead.phone1})</span>
          </div>
          <button class="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '20px' }}>
          
          {/* A. Lead Journey Timeline Stepper */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '15px', color: 'var(--text-main)' }}>🛣️ Lead Journey Timeline</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '12px', left: '10px', right: '10px', height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 1 }} />
              {steps.map((st, i) => (
                <div key={st.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
                  <div style={{ 
                    width: '26px', 
                    height: '26px', 
                    borderRadius: '50%', 
                    backgroundColor: st.active ? 'var(--primary)' : 'var(--bg-main)', 
                    border: `2px solid ${st.active ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: st.active ? '#000' : 'var(--text-muted)'
                  }}>
                    {st.active ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '10px', marginTop: '6px', color: st.active ? 'var(--text-main)' : 'var(--text-muted)', textAlign: 'center', fontWeight: st.active ? 600 : 400 }}>{st.name}</span>
                </div>
              ))}
            </div>
          </div>

          <hr style={{ border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '20px 0' }} />

          {/* B. Site Visit GPS Tracker Panel */}
          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px', color: 'var(--text-main)' }}>
              <Compass size={16} style={{ color: 'var(--primary)' }} /> GPS Site Visit geofencing
            </h4>
            
            {/* GPS coordinates loading status info */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 15px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div>
                {geoLoading ? (
                  <span style={{ color: 'var(--primary)' }}>Acquiring high-accuracy GPS satellite signal...</span>
                ) : geoError ? (
                  <span style={{ color: '#ef4444' }}>{geoError}</span>
                ) : geoLoc ? (
                  <span>📍 GPS Captured: <strong>{geoLoc.lat.toFixed(6)}, {geoLoc.lng.toFixed(6)}</strong> (Accuracy: Verified)</span>
                ) : 'GPS idle.'}
              </div>
              <button type="button" class="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={captureCoordinates}>
                Retry GPS
              </button>
            </div>

            {/* Check-in / Check-out actions */}
            {activeCheckInVisit ? (
              // Show check-out form
              <form onSubmit={handleCheckOut} style={{ background: 'rgba(234, 179, 8, 0.02)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.1)' }}>
                <div style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--primary)' }}>
                  ⚠️ Active check-in logged at: <strong>{new Date(activeCheckInVisit.check_in_time).toLocaleTimeString()}</strong>. Please check-out to log outcome.
                </div>
                
                <div class="grid-2">
                  <div class="form-group">
                    <label>Site Visit Outcome *</label>
                    <select class="form-control" value={checkoutOutcome} onChange={e => setCheckoutOutcome(e.target.value)}>
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
                      placeholder="e.g. Liked Plot 45, asked for discount" 
                    />
                  </div>
                </div>

                <button type="submit" class="btn btn-primary" style={{ marginTop: '15px', background: '#ef4444', border: '1px solid #ef4444' }}>
                  Check-Out of Site Visit
                </button>
              </form>
            ) : (
              // Check-in trigger
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Click below to Check-In at site. The CRM verifies coordinates are within <strong>500 meters</strong> of project site.
                </p>
                <button type="button" class="btn btn-primary" onClick={handleCheckIn}>
                  📍 Log Site Visit Check-In
                </button>
              </div>
            )}

            {/* Site visits log history list */}
            {siteVisits.length > 0 && (
              <div style={{ marginTop: '15px' }}>
                <h5 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Previous Site Visits:</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {siteVisits.map(v => (
                    <div key={v.id} style={{ background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '6px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <strong>Date: {v.visit_date}</strong>
                        <span style={{ 
                          color: v.check_out_time ? '#22c55e' : '#eab308', 
                          fontWeight: 'bold'
                        }}>
                          {v.check_out_time ? `Outcome: ${v.outcome}` : 'In Progress (Checked-In)'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        In: {new Date(v.check_in_time).toLocaleTimeString()} ({v.check_in_lat?.toFixed(4)}, {v.check_in_lng?.toFixed(4)})
                        {v.check_out_time && ` | Out: ${new Date(v.check_out_time).toLocaleTimeString()}`}
                      </div>
                      {v.feedback && <div style={{ marginTop: '4px', fontStyle: 'italic' }}>Feedback: "{v.feedback}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '20px 0' }} />

          {/* C. Call Logs History */}
          <div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px', color: 'var(--text-main)' }}>
              <PhoneCall size={16} style={{ color: 'var(--primary)' }} /> Call Logging History
            </h4>
            {loading ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading logs...</div>
            ) : callLogs.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No calls recorded yet for this client.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {callLogs.map(log => (
                  <div key={log.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Outcome: {log.response}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(log.call_date).toLocaleString()}</span>
                    </div>
                    {log.notes && <div style={{ color: 'var(--text-muted)' }}>Remarks: {log.notes}</div>}
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>Logged by: {log.caller ? log.caller.full_name : 'System'}</div>
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
