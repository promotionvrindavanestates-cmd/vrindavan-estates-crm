import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  X, Phone, Calendar, Clock, Award, PhoneCall, 
  Check, Compass, CheckCircle2, AlertCircle, ArrowRightLeft, 
  Database, User, MapPin, Building, DollarSign, ChevronRight,
  TrendingUp, RefreshCw
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

const CALL_RESPONSES = ['Connected', 'Not Picked', 'Busy', 'Interested', 'Site Visit', 'Follow Up', 'Not Interested', 'Booked'];

export default function LeadDetailDrawer({ 
  isOpen, 
  onClose, 
  leadId, 
  currentUser,
  employees = [],
  onRefreshData
}) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline', 'calls', 'whatsapp', 'gps'
  
  // Timeline Events
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  
  // Call logging
  const [callHistory, setCallHistory] = useState([]);
  const [callNotes, setCallNotes] = useState('');
  const [callResponse, setCallResponse] = useState('Connected');
  const [callSaving, setCallSaving] = useState(false);
  const [callHistoryLoading, setCallHistoryLoading] = useState(false);
  
  // GPS SITE VISIT check-in / check-out
  const [siteVisits, setSiteVisits] = useState([]);
  const [geoLoc, setGeoLoc] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [activeCheckInVisit, setActiveCheckInVisit] = useState(null);
  const [checkoutFeedback, setCheckoutFeedback] = useState('');
  const [checkoutOutcome, setCheckoutOutcome] = useState('Interested');
  
  // Click-to-WhatsApp template states
  const [whatsAppTemplates, setWhatsAppTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customWhatsAppText, setCustomWhatsAppText] = useState('');

  // Booking quick action panel
  const [showBookingPanel, setShowBookingPanel] = useState(false);
  const [bookingUnitNumber, setBookingUnitNumber] = useState('');
  const [bookingTokenAmount, setBookingTokenAmount] = useState('');
  const [bookingTotalCost, setBookingTotalCost] = useState('');
  const [bookingSaving, setBookingSaving] = useState(false);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadDetails();
      fetchWhatsAppTemplates();
    } else {
      setLead(null);
      setTimelineEvents([]);
      setCallHistory([]);
      setSiteVisits([]);
      setActiveCheckInVisit(null);
      setShowBookingPanel(false);
    }
  }, [isOpen, leadId]);

  const fetchLeadDetails = async () => {
    setLoading(true);
    setError('');
    try {
      // Get lead by ID
      const data = await api.getLeadById(leadId, currentUser.id, currentUser.role);
      setLead(data);
      
      // Fetch associated details in parallel
      fetchTimeline();
      fetchCallHistory();
      fetchGPSDetails();
    } catch (err) {
      console.error('Failed to load lead details in drawer:', err);
      setError('Unable to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    setTimelineLoading(true);
    try {
      const data = await api.getLeadTimeline(leadId);
      setTimelineEvents(data || []);
    } catch (e) {
      console.error('Failed to fetch timeline in drawer:', e);
    } finally {
      setTimelineLoading(false);
    }
  };

  const fetchCallHistory = async () => {
    setCallHistoryLoading(true);
    try {
      const data = await api.getCallLogs(leadId);
      setCallHistory(data || []);
    } catch (e) {
      console.error('Failed to fetch call logs in drawer:', e);
    } finally {
      setCallHistoryLoading(false);
    }
  };

  const fetchGPSDetails = async () => {
    try {
      const visits = await api.getSiteVisits(leadId);
      setSiteVisits(visits || []);
      const active = visits.find(v => !v.check_out_time);
      setActiveCheckInVisit(active || null);
    } catch (e) {
      console.error('Failed to fetch site visits:', e);
    }
  };

  const fetchWhatsAppTemplates = async () => {
    try {
      const list = await api.getWhatsAppTemplates();
      setWhatsAppTemplates(list || []);
      if (list && list.length > 0) {
        setSelectedTemplateId(list[0].id);
      }
    } catch (err) {
      console.warn('Failed to load whatsapp templates:', err);
    }
  };

  // Predefined Quick Actions
  const handleQuickAction = async (actionType) => {
    if (!lead) return;
    const device = window.Capacitor ? 'Android App' : 'Web Portal';
    
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      if (actionType === 'no_response') {
        // 1. Log call
        await api.logCall(lead.id, 'Not Picked', 'Quick Action: Call placed, no response.');
        // 2. Schedule Callback Tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        await api.createReminder({
          lead_id: lead.id,
          title: 'Callback - No Response',
          type: 'Callback',
          reminder_date: tomorrowStr,
          reminder_time: '11:00:00',
          notes: 'Predefined action: follow-up call after no response.'
        });
        
        alert('Logged: "Not Picked". Callback scheduled for tomorrow.');
      } 
      
      else if (actionType === 'busy_2h') {
        // 1. Log call
        await api.logCall(lead.id, 'Busy', 'Quick Action: Client is busy, requested callback in 2 hours.');
        // 2. Schedule Callback Today + 2 hours
        const targetTime = new Date();
        targetTime.setHours(targetTime.getHours() + 2);
        const targetTimeStr = targetTime.toTimeString().split(' ')[0];

        await api.createReminder({
          lead_id: lead.id,
          title: 'Callback - Busy client',
          type: 'Callback',
          reminder_date: todayStr,
          reminder_time: targetTimeStr,
          notes: 'Predefined action: callback in 2 hours.'
        });

        alert('Logged: "Busy". Callback scheduled in 2 hours.');
      } 
      
      else if (actionType === 'visit_sunday') {
        // Find next Sunday date
        const nextSunday = new Date();
        const daysToSunday = (7 - nextSunday.getDay()) || 7;
        nextSunday.setDate(nextSunday.getDate() + daysToSunday);
        const sundayStr = nextSunday.toISOString().split('T')[0];

        // 1. Update status
        await api.updateLead(lead.id, {
          ...lead,
          status: 'Site Visit Scheduled',
          site_visit_status: 'Scheduled',
          site_visit_date: sundayStr
        });
        // 2. Log call
        await api.logCall(lead.id, 'Site Visit', 'Quick Action: Site visit scheduled for next Sunday.');
        // 3. Create reminder
        await api.createReminder({
          lead_id: lead.id,
          title: 'Site Visit Tour',
          type: 'Site Visit',
          reminder_date: sundayStr,
          reminder_time: '12:00:00',
          notes: 'Predefined action: Sunday site visit tour.'
        });

        alert(`Status updated: "Site Visit Scheduled" for Sunday ${sundayStr}.`);
      } 
      
      else if (actionType === 'negotiation') {
        // Update status & log call
        await api.updateLead(lead.id, {
          ...lead,
          status: 'Negotiation'
        });
        await api.logCall(lead.id, 'Follow Up', 'Quick Action: Moved lead status to Negotiation.');
        alert('Status updated: "Negotiation".');
      }

      // Refresh data
      fetchLeadDetails();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(`Quick Action failed: ${err.message}`);
    }
  };

  // Submit Call Log
  const handleLogCallSubmit = async (e) => {
    e.preventDefault();
    if (!callNotes.trim()) return alert('Please enter call notes.');

    setCallSaving(true);
    try {
      await api.logCall(lead.id, callResponse, callNotes);
      setCallNotes('');
      setCallResponse('Connected');
      fetchLeadDetails();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(`Failed to log call: ${err.message}`);
    } finally {
      setCallSaving(false);
    }
  };

  // GPS Check-In / Check-Out
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

  const handleGPSCheckIn = async () => {
    if (!geoLoc) {
      return alert('Acquiring GPS Satellite coordinates. Please try in a moment.');
    }
    const remarks = window.prompt("Site Check-In remarks (optional):", "Vrindavan Project Site Tour");
    try {
      await api.checkInSiteVisit(lead.id, geoLoc.lat, geoLoc.lng, remarks || 'GPS Site Tour Checkin');
      alert('📍 Check-In logged successfully! Geofence verified.');
      fetchLeadDetails();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(`Geofence rejection: ${err.message}`);
    }
  };

  const handleGPSCheckOut = async (e) => {
    e.preventDefault();
    if (!geoLoc) return alert('GPS Coordinates are required to check-out.');
    try {
      await api.checkOutSiteVisit(
        lead.id,
        activeCheckInVisit.id,
        geoLoc.lat,
        geoLoc.lng,
        'GPS Site Check-Out',
        checkoutFeedback,
        checkoutOutcome,
        []
      );
      alert('📍 Checked-out successfully!');
      fetchLeadDetails();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(`Check-out failed: ${err.message}`);
    }
  };

  // WhatsApp click handler
  const getInterpolatedWhatsAppMessage = () => {
    if (!lead) return '';
    const template = whatsAppTemplates.find(t => t.id === selectedTemplateId);
    if (!template) return customWhatsAppText || 'Hi, greetings from Vrindavan Estates!';
    
    let text = template.body_text;
    text = text.replace(/{customer_name}/gi, lead.name || '');
    text = text.replace(/{project_name}/gi, lead.project || 'Vrindavan Estates');
    text = text.replace(/{price}/gi, lead.budget || 'N/A');
    text = text.replace(/{location}/gi, lead.city || 'Vrindavan');
    text = text.replace(/{executive_name}/gi, currentUser.full_name || 'Our Executive');
    text = text.replace(/{unit_number}/gi, lead.unit_number || 'your unit');
    text = text.replace(/{token_amount}/gi, lead.booking_token_amount || 'token amount');
    return text;
  };

  const handleSendWhatsApp = async () => {
    if (!lead) return;
    const msg = getInterpolatedWhatsAppMessage();
    const phone = lead.phone1;
    const cleanPhone = phone.replace(/\D/g, '');
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    
    try {
      await api.logWhatsAppClick(lead.id, phone, msg);
    } catch (e) {
      console.warn('Failed to log whatsapp click:', e);
    }
    
    window.open(url, window.Capacitor ? '_system' : '_blank');
    fetchTimeline();
  };

  // Quick booking submit
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookingUnitNumber || !bookingTokenAmount || !bookingTotalCost) {
      return alert('Please fill in all booking fields.');
    }

    setBookingSaving(true);
    try {
      // 1. Create Booking
      await api.createBooking({
        lead_id: lead.id,
        unit_number: bookingUnitNumber,
        token_amount: parseFloat(bookingTokenAmount),
        booking_amount: parseFloat(bookingTotalCost),
        booking_date: new Date().toISOString().split('T')[0],
        executive_id: currentUser.id,
        project_id: null, // Default
        inventory_id: null
      });

      // 2. Update Lead Status
      await api.updateLead(lead.id, {
        ...lead,
        status: 'Booked',
        booking_status: 'Confirmed',
        booking_token_amount: parseFloat(bookingTokenAmount),
        booking_date: new Date().toISOString().split('T')[0]
      });

      alert('🎉 Unit Booked successfully!');
      setShowBookingPanel(false);
      setBookingUnitNumber('');
      setBookingTokenAmount('');
      setBookingTotalCost('');
      fetchLeadDetails();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(`Booking failed: ${err.message}`);
    } finally {
      setBookingSaving(false);
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'call': return <PhoneCall size={12} style={{ color: 'var(--color-info)' }} />;
      case 'transfer': return <ArrowRightLeft size={12} style={{ color: 'var(--primary)' }} />;
      case 'site-visit-in': return <MapPin size={12} style={{ color: '#eab308' }} />;
      case 'site-visit-out': return <MapPin size={12} style={{ color: 'var(--color-success)' }} />;
      case 'booking': return <Award size={12} style={{ color: 'var(--color-success)' }} />;
      case 'whatsapp': return <FaWhatsapp size={12} style={{ color: '#25D366' }} />;
      default: return <AlertCircle size={12} style={{ color: 'var(--primary)' }} />;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 1050;
          animation: fadeIn 0.2s ease-out;
        }
        .drawer-content {
          position: fixed;
          top: 0;
          right: 0;
          width: 520px;
          max-width: 100%;
          height: 100%;
          background: var(--bg-card);
          border-left: 1px solid var(--border-color);
          box-shadow: -10px 0 35px rgba(0, 0, 0, 0.6);
          z-index: 1060;
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .drawer-tab {
          flex: 1;
          text-align: center;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          transition: var(--transition);
        }
        .drawer-tab.active {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(223, 177, 91, 0.03);
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .quick-action-btn {
          flex: 1;
          padding: 8px;
          font-size: 11px;
          text-align: center;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          color: var(--text-main);
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .quick-action-btn:hover {
          background: var(--bg-card-hover);
          border-color: var(--primary);
          color: var(--primary);
        }
      `}</style>

      {/* Overlay */}
      <div className="drawer-overlay" onClick={onClose}></div>

      {/* Drawer Panel */}
      <div className="drawer-content">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
              {lead ? lead.name : 'Loading Details...'}
            </h3>
            {lead && (
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                Status: {lead.status} | Project: {lead.project || 'N/A'}
              </span>
            )}
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Retrieving lead data records...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#ef4444', marginBottom: '15px', fontSize: '13px' }}>{error}</p>
            <button className="btn btn-primary" type="button" onClick={fetchLeadDetails} style={{ padding: '6px 16px', fontSize: '12px' }}>
              Retry
            </button>
          </div>
        ) : !lead ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No lead data available.
          </div>
        ) : (
          <div className="drawer-body">
            
            {/* Quick Profile Summary */}
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12px' }}>
              <div><strong style={{ color: 'var(--text-muted)' }}>Phone 1:</strong> {lead.phone1}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Phone 2:</strong> {lead.phone2 || 'N/A'}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>City / State:</strong> {lead.city || 'N/A'} {lead.state ? `, ${lead.state}` : ''}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Budget:</strong> {lead.budget || 'N/A'}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Source:</strong> {lead.lead_source || 'Website'}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Profile:</strong> {lead.investor_or_end_user || 'End User'}</div>
              {lead.follow_up_date && (
                <div style={{ gridColumn: 'span 2' }}>
                  <strong style={{ color: 'var(--text-muted)' }}>Next Follow-up:</strong>{' '}
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{lead.follow_up_date}</span>
                </div>
              )}
            </div>

            {/* Predefined One-Click Quick Actions */}
            <div>
              <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                One-Click Quick Actions
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="quick-action-btn" type="button" onClick={() => handleQuickAction('no_response')}>
                  <Phone size={14} style={{ color: 'var(--color-hot)' }} />
                  <span>No Response</span>
                </button>
                <button className="quick-action-btn" type="button" onClick={() => handleQuickAction('busy_2h')}>
                  <Clock size={14} style={{ color: 'var(--color-warm)' }} />
                  <span>Busy (2h)</span>
                </button>
                <button className="quick-action-btn" type="button" onClick={() => handleQuickAction('visit_sunday')}>
                  <MapPin size={14} style={{ color: '#eab308' }} />
                  <span>Visit (Sunday)</span>
                </button>
                <button className="quick-action-btn" type="button" onClick={() => handleQuickAction('negotiation')}>
                  <TrendingUp size={14} style={{ color: 'var(--primary)' }} />
                  <span>Negotiation</span>
                </button>
                <button 
                  className="quick-action-btn" 
                  type="button"
                  onClick={() => {
                    setShowBookingPanel(!showBookingPanel);
                    captureCoordinates(); // preload GPS just in case
                  }}
                  style={{ background: showBookingPanel ? 'var(--primary-glow)' : 'var(--bg-input)' }}
                >
                  <Award size={14} style={{ color: 'var(--color-success)' }} />
                  <span>Book Unit</span>
                </button>
              </div>
            </div>

            {/* Quick Booking Form */}
            {showBookingPanel && (
              <form onSubmit={handleBookingSubmit} style={{ background: 'rgba(16, 185, 129, 0.03)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={16} /> Confirm Unit Booking Details
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '10px' }}>Unit Number *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ padding: '6px 8px', fontSize: '12px' }}
                      value={bookingUnitNumber}
                      onChange={e => setBookingUnitNumber(e.target.value)}
                      placeholder="e.g. 302-A"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '10px' }}>Token Amount *</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      style={{ padding: '6px 8px', fontSize: '12px' }}
                      value={bookingTokenAmount}
                      onChange={e => setBookingTokenAmount(e.target.value)}
                      placeholder="e.g. 50000"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '10px' }}>Total Cost *</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      style={{ padding: '6px 8px', fontSize: '12px' }}
                      value={bookingTotalCost}
                      onChange={e => setBookingTotalCost(e.target.value)}
                      placeholder="e.g. 4500000"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setShowBookingPanel(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--color-success)', color: '#fff' }} disabled={bookingSaving}>
                    {bookingSaving ? 'Processing...' : 'Confirm Book'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab switchers */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginTop: '8px' }}>
              <div className={`drawer-tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>Timeline</div>
              <div className={`drawer-tab ${activeTab === 'calls' ? 'active' : ''}`} onClick={() => { setActiveTab('calls'); fetchCallHistory(); }}>Calls Log</div>
              <div className={`drawer-tab ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => setActiveTab('whatsapp')}>WhatsApp</div>
              <div className={`drawer-tab ${activeTab === 'gps' ? 'active' : ''}`} onClick={() => { setActiveTab('gps'); captureCoordinates(); fetchGPSDetails(); }}>GPS Geofence</div>
            </div>

            {/* Tab content 1: Timeline events */}
            {activeTab === 'timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {timelineLoading ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Loading timeline...</div>
                ) : timelineEvents.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No timeline events recorded.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '8px', borderLeft: '1px dashed var(--border-color)', marginLeft: '8px' }}>
                    {timelineEvents.slice(0, 15).map((ev, index) => (
                      <div key={ev.id || index} style={{ position: 'relative', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '12px' }}>
                        <div style={{ position: 'absolute', left: '-19px', top: '10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                          {getEventIcon(ev.type)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--primary)' }}>{ev.title}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(ev.date).toLocaleDateString()}</span>
                        </div>
                        <div style={{ color: 'var(--text-main)', fontSize: '11px' }}>{ev.description}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                          By: {ev.user} {ev.device ? `(${ev.device})` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab content 2: Calls log & history */}
            {activeTab === 'calls' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Form to log call */}
                <form onSubmit={handleLogCallSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-main)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', width: '120px' }}>Call Status</label>
                    <select className="form-control" value={callResponse} onChange={e => setCallResponse(e.target.value)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                      {CALL_RESPONSES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <textarea 
                    className="form-control"
                    rows="3"
                    value={callNotes}
                    onChange={e => setCallNotes(e.target.value)}
                    placeholder="Enter call notes... What was client response?"
                    style={{ fontSize: '12px' }}
                    required
                  ></textarea>
                  <button type="submit" className="btn btn-primary" style={{ padding: '6px', fontSize: '11px' }} disabled={callSaving}>
                    {callSaving ? 'Saving...' : 'Save Call Log'}
                  </button>
                </form>

                {/* History list */}
                <div>
                  <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Call Logs History</h4>
                  {callHistoryLoading ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Loading calls...</div>
                  ) : callHistory.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>No calls logged yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {callHistory.map(log => (
                        <div key={log.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '11.5px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span className="badge badge-info" style={{ fontSize: '8px', padding: '1px 5px' }}>{log.response}</span>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{new Date(log.call_date).toLocaleString()}</span>
                          </div>
                          <p style={{ margin: 0, color: 'var(--text-main)' }}>{log.notes}</p>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                            Caller: {log.caller ? log.caller.full_name : 'Executive'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab content 3: WhatsApp Click-to-Send templates */}
            {activeTab === 'whatsapp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>WhatsApp Template Variable Mappings</label>
                  <select className="form-control" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} style={{ fontSize: '12px' }}>
                    {whatsAppTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                </div>

                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '6px' }}>Message Preview:</div>
                  <p style={{ margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>{getInterpolatedWhatsAppMessage()}</p>
                </div>

                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', background: '#25D366', color: '#000', fontWeight: 700 }}
                  onClick={handleSendWhatsApp}
                >
                  <FaWhatsapp size={16} /> Send via WhatsApp Web
                </button>
              </div>
            )}

            {/* Tab content 4: GPS Geofence */}
            {activeTab === 'gps' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '11.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    {geoLoading ? (
                      <span style={{ color: 'var(--primary)' }}>Acquiring satellites...</span>
                    ) : geoError ? (
                      <span style={{ color: 'var(--color-hot)' }}>{geoError}</span>
                    ) : geoLoc ? (
                      <span>📍 GPS Status: <strong>{geoLoc.lat.toFixed(6)}, {geoLoc.lng.toFixed(6)}</strong></span>
                    ) : 'GPS Status: Idle.'}
                  </div>
                  <button type="button" className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '10px' }} onClick={captureCoordinates}>
                    Retry GPS
                  </button>
                </div>

                {activeCheckInVisit ? (
                  <form onSubmit={handleGPSCheckOut} style={{ background: 'rgba(234, 179, 8, 0.03)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#eab308', fontWeight: 600 }}>
                      ⚠️ Active GPS Tour Check-In logged at: {new Date(activeCheckInVisit.check_in_time).toLocaleTimeString()}
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '10px' }}>Site Outcome</label>
                      <select className="form-control" value={checkoutOutcome} onChange={e => setCheckoutOutcome(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--bg-card)' }}>
                        <option value="Interested">Interested / Hot</option>
                        <option value="Negotiation">Negotiation</option>
                        <option value="Booking Expected">Booking Expected</option>
                        <option value="Need Follow-up">Need Follow-up</option>
                        <option value="Not Interested">Not Interested</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '10px' }}>Customer Feedback Comments *</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={checkoutFeedback}
                        onChange={e => setCheckoutFeedback(e.target.value)}
                        placeholder="e.g. Customer loved the plot 25"
                        style={{ padding: '6px', fontSize: '12px', background: 'var(--bg-card)' }}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-danger" style={{ padding: '8px', fontSize: '11px', marginTop: '4px' }}>
                      Submit GPS Check-Out
                    </button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(223, 177, 91, 0.02)', border: '1px dashed var(--border-color)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, maxWidth: '70%', lineHeight: 1.4 }}>
                      Check-In at site. Coordinates must be within <strong>500 meters</strong> of the project site.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={handleGPSCheckIn} style={{ padding: '6px 12px', fontSize: '11px' }}>
                      📍 GPS Check-In
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}
