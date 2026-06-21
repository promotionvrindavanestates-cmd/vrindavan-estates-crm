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
const ACTIONS = ['None', 'Callback Scheduled', 'Site Visit Scheduled', 'Meeting Arranged', 'Information Sent', 'Others'];

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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'calls', 'whatsapp', 'site_visits', 'bookings', 'payments'
  
  // Timeline Events
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  
  // Call logging
  const [callHistory, setCallHistory] = useState([]);
  const [callNotes, setCallNotes] = useState('');
  const [callResponse, setCallResponse] = useState('Connected');
  const [callSaving, setCallSaving] = useState(false);
  const [callHistoryLoading, setCallHistoryLoading] = useState(false);
  const [callActionTaken, setCallActionTaken] = useState('None');
  const [callFollowUpDate, setCallFollowUpDate] = useState('');
  const [callFollowUpTime, setCallFollowUpTime] = useState('');
  const [callCreateReminder, setCallCreateReminder] = useState(true);
  const [callSendWhatsAppReminder, setCallSendWhatsAppReminder] = useState(true);
  const [callDuration, setCallDuration] = useState('');

  // Sync Mobile Calls Enhancement States
  const [activeInlineCallNotesId, setActiveInlineCallNotesId] = useState(null);
  const [inlineNotesText, setInlineNotesText] = useState('');
  const [inlineActionTaken, setInlineActionTaken] = useState('None');
  const [inlineFollowUpDate, setInlineFollowUpDate] = useState('');
  const [inlineFollowUpTime, setInlineFollowUpTime] = useState('');
  const [inlineCreateReminder, setInlineCreateReminder] = useState(true);
  const [inlineSaving, setInlineSaving] = useState(false);
  
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

  // WhatsApp Chats Sync states
  const [whatsAppChats, setWhatsAppChats] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [simMsgText, setSimMsgText] = useState('');
  const [simDirection, setSimDirection] = useState('Incoming');
  const [simulating, setSimulating] = useState(false);

  // Phase 8B WhatsApp Center States
  const [whatsappHistory, setWhatsappHistory] = useState([]);
  const [whatsappHistoryLoading, setWhatsappHistoryLoading] = useState(false);
  const [waNotesSummary, setWaNotesSummary] = useState('');
  const [waNotesInterest, setWaNotesInterest] = useState('');
  const [waNotesBudget, setWaNotesBudget] = useState('');
  const [waNotesObjections, setWaNotesObjections] = useState('');
  const [waNotesNextAction, setWaNotesNextAction] = useState('');
  const [waNotesSaving, setWaNotesSaving] = useState(false);

  const [waFollowUpDate, setWaFollowUpDate] = useState('');
  const [waFollowUpTime, setWaFollowUpTime] = useState('');
  const [waFollowUpNotes, setWaFollowUpNotes] = useState('');
  const [waFollowUpPriority, setWaFollowUpPriority] = useState('Medium');
  const [waFollowUpSaving, setWaFollowUpSaving] = useState(false);

  // Bookings & Payments tabs states
  const [drawerBookings, setDrawerBookings] = useState([]);
  const [drawerBookingsLoading, setDrawerBookingsLoading] = useState(false);
  const [drawerPayments, setDrawerPayments] = useState([]);
  const [drawerPaymentsLoading, setDrawerPaymentsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadDetails();
      fetchWhatsAppTemplates();
      fetchWhatsAppHistory();
      fetchDrawerBookings();
      fetchDrawerPayments();
    } else {
      setLead(null);
      setTimelineEvents([]);
      setCallHistory([]);
      setSiteVisits([]);
      setActiveCheckInVisit(null);
      setShowBookingPanel(false);
      setWhatsAppChats([]);
      setSimMsgText('');
      setSimDirection('Incoming');
      setWhatsappHistory([]);
      setDrawerBookings([]);
      setDrawerPayments([]);
    }
  }, [isOpen, leadId]);

  useEffect(() => {
    if (isOpen && leadId && activeTab === 'whatsapp') {
      fetchWhatsAppChats();
      fetchWhatsAppHistory();
    }
  }, [activeTab, isOpen, leadId]);

  useEffect(() => {
    if (isOpen && leadId) {
      if (activeTab === 'bookings') {
        fetchDrawerBookings();
      } else if (activeTab === 'payments') {
        fetchDrawerPayments();
      } else if (activeTab === 'site_visits') {
        fetchGPSDetails();
      }
    }
  }, [activeTab, isOpen, leadId]);

  const fetchWhatsAppHistory = async () => {
    setWhatsappHistoryLoading(true);
    try {
      const data = await api.getWhatsAppCommunicationHistory(leadId);
      setWhatsappHistory(data || []);
    } catch (e) {
      console.error('Error fetching whatsapp communication history:', e);
    } finally {
      setWhatsappHistoryLoading(false);
    }
  };

  const fetchDrawerBookings = async () => {
    setDrawerBookingsLoading(true);
    try {
      const data = await api.getBookingsForLead(leadId);
      setDrawerBookings(data || []);
    } catch (e) {
      console.error('Error fetching bookings for lead:', e);
    } finally {
      setDrawerBookingsLoading(false);
    }
  };

  const fetchDrawerPayments = async () => {
    setDrawerPaymentsLoading(true);
    try {
      const data = await api.getPaymentsForLead(leadId);
      setDrawerPayments(data || []);
    } catch (e) {
      console.error('Error fetching payments for lead:', e);
    } finally {
      setDrawerPaymentsLoading(false);
    }
  };

  const handleSendWhatsAppWithLogging = async (actionType = 'WhatsApp Opened') => {
    if (!lead) return;
    const msg = getInterpolatedWhatsAppMessage();
    const phone = lead.phone_whatsapp || lead.phone1 || '';
    const cleanPhone = phone.replace(/\D/g, '');
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    
    try {
      await api.logWhatsAppActivity({ leadId, actionType });
      await api.logWhatsAppClick(lead.id, phone, msg);
    } catch (e) {
      console.warn('Failed to log WhatsApp activity:', e);
    }
    
    window.open(url, '_blank');
    fetchTimeline();
    fetchWhatsAppHistory();
  };

  const handleWhatsAppNotesSubmit = async (e) => {
    e.preventDefault();
    if (!waNotesSummary) {
      return alert('Discussion summary is required.');
    }
    setWaNotesSaving(true);
    try {
      await api.saveWhatsAppNotes({
        leadId,
        discussionSummary: waNotesSummary,
        customerInterest: waNotesInterest,
        budgetDiscussion: waNotesBudget,
        objections: waNotesObjections,
        nextAction: waNotesNextAction
      });
      alert('WhatsApp notes saved!');
      setWaNotesSummary('');
      setWaNotesInterest('');
      setWaNotesBudget('');
      setWaNotesObjections('');
      setWaNotesNextAction('');
      fetchTimeline();
      fetchWhatsAppHistory();
    } catch (err) {
      alert(`Failed to save notes: ${err.message}`);
    } finally {
      setWaNotesSaving(false);
    }
  };

  const handleWhatsAppFollowUpSubmit = async (e) => {
    e.preventDefault();
    if (!waFollowUpDate || !waFollowUpNotes) {
      return alert('Date and reminder notes are required.');
    }
    setWaFollowUpSaving(true);
    try {
      await api.createWhatsAppFollowUp({
        leadId,
        title: `WhatsApp Follow-up: ${waFollowUpNotes.substring(0, 30)}`,
        reminder_date: waFollowUpDate,
        reminder_time: waFollowUpTime || '09:00:00',
        notes: waFollowUpNotes,
        priority: waFollowUpPriority
      });
      alert('Follow-up scheduled!');
      setWaFollowUpDate('');
      setWaFollowUpTime('');
      setWaFollowUpNotes('');
      setWaFollowUpPriority('Medium');
      fetchTimeline();
    } catch (err) {
      alert(`Failed to schedule follow-up: ${err.message}`);
    } finally {
      setWaFollowUpSaving(false);
    }
  };

  const fetchWhatsAppChats = async () => {
    setChatLoading(true);
    try {
      const data = await api.getWhatsAppChats(leadId);
      setWhatsAppChats(data || []);
    } catch (e) {
      console.error('Error fetching whatsapp chats:', e);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSimulateMsgSubmit = async (e) => {
    e.preventDefault();
    if (!simMsgText) return;
    setSimulating(true);
    try {
      await api.simulateWhatsAppMessage(leadId, simMsgText, simDirection);
      setSimMsgText('');
      fetchWhatsAppChats();
      fetchWhatsAppHistory();
      fetchTimeline();
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const handleSaveInlineNotes = async (e, callId) => {
    e.preventDefault();
    setInlineSaving(true);
    try {
      const followUpDatetime = (inlineActionTaken !== 'None' && inlineFollowUpDate)
        ? new Date(`${inlineFollowUpDate}T${inlineFollowUpTime || '09:00'}:00`).toISOString()
        : null;

      await api.savePendingCallNotes(callId, {
        notes: inlineNotesText,
        action_taken: inlineActionTaken,
        follow_up_date: inlineFollowUpDate || null,
        follow_up_time: inlineFollowUpTime || null,
        follow_up_datetime: followUpDatetime,
        create_reminder: inlineCreateReminder
      });

      alert('Call notes saved successfully!');
      setActiveInlineCallNotesId(null);
      fetchLeadDetails();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(`Failed to save notes: ${err.message}`);
    } finally {
      setInlineSaving(false);
    }
  };

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
      fetchWhatsAppHistory();
      fetchDrawerBookings();
      fetchDrawerPayments();
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
      const hasFollowUp = callActionTaken !== 'None';
      const extra = {
        duration: callDuration ? parseInt(callDuration) : 0,
        action_taken: hasFollowUp ? callActionTaken : null,
        follow_up_date: hasFollowUp ? callFollowUpDate : null,
        follow_up_time: hasFollowUp ? callFollowUpTime : null,
        follow_up_datetime: hasFollowUp && callFollowUpDate ? new Date(`${callFollowUpDate}T${callFollowUpTime || '09:00'}:00`).toISOString() : null,
        create_reminder: hasFollowUp ? callCreateReminder : false
      };

      await api.logCall(lead.id, callResponse, callNotes, extra);
      setCallNotes('');
      setCallResponse('Connected');
      setCallActionTaken('None');
      setCallFollowUpDate('');
      setCallFollowUpTime('');
      setCallDuration('');

      // WhatsApp launch check
      if (hasFollowUp && callSendWhatsAppReminder) {
        const dateStr = callFollowUpDate ? new Date(callFollowUpDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'soon';
        const timeStr = callFollowUpTime || 'scheduled time';
        const phone = lead.phone1 || '';
        if (phone) {
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          const prefix = cleanPhone.length === 10 ? '91' : '';
          const message = `Hello ${lead.name || 'Client'},\n\nThank you for speaking with me today. As discussed, I have scheduled our next follow-up call/meeting on *${dateStr}* at *${timeStr}*.\n\nRegards,\nIndiana Vrindavan Estates Team`;
          const url = `https://wa.me/${prefix}${cleanPhone}?text=${encodeURIComponent(message)}`;
          window.open(url, '_blank');
        }
      }

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
      fetchDrawerBookings();
      fetchDrawerPayments();
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
      case 'whatsapp-chat': return <FaWhatsapp size={12} style={{ color: '#10B981' }} />;
      case 'whatsapp-activity': return <FaWhatsapp size={12} style={{ color: '#10B981' }} />;
      case 'whatsapp-notes': return <Compass size={12} style={{ color: '#8b5cf6' }} />;
      case 'reminder': return <Calendar size={12} style={{ color: '#F59E0B' }} />;
      case 'payment': return <DollarSign size={12} style={{ color: '#10B981' }} />;
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
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginTop: '8px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
              <div className={`drawer-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</div>
              <div className={`drawer-tab ${activeTab === 'calls' ? 'active' : ''}`} onClick={() => { setActiveTab('calls'); fetchCallHistory(); }}>Calls</div>
              <div className={`drawer-tab ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => setActiveTab('whatsapp')}>WhatsApp</div>
              <div className={`drawer-tab ${activeTab === 'site_visits' ? 'active' : ''}`} onClick={() => { setActiveTab('site_visits'); captureCoordinates(); fetchGPSDetails(); }}>Site Visits</div>
              <div className={`drawer-tab ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => { setActiveTab('bookings'); fetchDrawerBookings(); }}>Bookings</div>
              <div className={`drawer-tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => { setActiveTab('payments'); fetchDrawerPayments(); }}>Payments</div>
            </div>

            {/* Tab content 1: Timeline events */}
            {activeTab === 'overview' && (
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
                        {ev.type === 'call' && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px', marginBottom: '4px' }}>
                            <span style={{ 
                              fontSize: '9.5px', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              background: ev.call_type === 'Missed' ? 'rgba(239, 68, 68, 0.15)' : ev.call_type === 'Incoming' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: ev.call_type === 'Missed' ? '#ef4444' : ev.call_type === 'Incoming' ? '#10b981' : '#3b82f6',
                              fontWeight: 'bold'
                            }}>
                              📞 {ev.call_type || 'Outgoing'}
                            </span>
                            <span style={{ 
                              fontSize: '9.5px', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-muted)'
                            }}>
                              💻 {ev.synced_from_device ? 'Mobile Sync' : 'Manual Log'}
                            </span>
                          </div>
                        )}
                        {ev.type === 'call' && ev.duration > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            ⏱ Duration: {Math.floor(ev.duration / 60)}m {ev.duration % 60}s
                          </div>
                        )}
                        {ev.type === 'call' && ev.action_taken && (
                          <div style={{ fontSize: '10px', color: 'var(--primary)', marginTop: '2px' }}>
                            🗓 Next Action: {ev.action_taken} {ev.follow_up_date ? `on ${ev.follow_up_date}` : ''}
                          </div>
                        )}
                        {ev.type === 'call' && ev.needs_notes && activeInlineCallNotesId !== ev.id && (
                          <button 
                            type="button" 
                            onClick={() => {
                              setActiveInlineCallNotesId(ev.id);
                              setInlineNotesText('');
                              setInlineActionTaken('None');
                              setInlineFollowUpDate('');
                              setInlineFollowUpTime('');
                              setInlineCreateReminder(true);
                            }}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: '11px', 
                              marginTop: '6px', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              color: 'var(--primary)',
                              borderColor: 'var(--primary)',
                              background: 'rgba(223, 177, 91, 0.05)'
                            }}
                          >
                            📝 Add Call Notes
                          </button>
                        )}
                        {ev.type === 'call' && activeInlineCallNotesId === ev.id && (
                          <form 
                            onSubmit={(e) => handleSaveInlineNotes(e, ev.id)} 
                            style={{ 
                              marginTop: '10px', 
                              padding: '12px', 
                              background: 'var(--bg-card)', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <strong style={{ fontSize: '11.5px', color: 'var(--primary)' }}>Add Call Notes & Next Steps</strong>
                              <button 
                                type="button" 
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                                onClick={() => setActiveInlineCallNotesId(null)}
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Notes / Remarks *</label>
                              <textarea 
                                className="form-control"
                                rows="2"
                                value={inlineNotesText}
                                onChange={e => setInlineNotesText(e.target.value)}
                                placeholder="Enter details of the call..."
                                style={{ fontSize: '11.5px', padding: '6px' }}
                                required
                              />
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Next Action</label>
                              <select 
                                className="form-control" 
                                value={inlineActionTaken} 
                                onChange={e => setInlineActionTaken(e.target.value)} 
                                style={{ padding: '4px 8px', fontSize: '11.5px' }}
                              >
                                {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                              </select>
                            </div>

                            {inlineActionTaken !== 'None' && (
                              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Date</label>
                                    <input 
                                      type="date" 
                                      className="form-control" 
                                      value={inlineFollowUpDate} 
                                      onChange={e => setInlineFollowUpDate(e.target.value)} 
                                      style={{ padding: '4px 6px', fontSize: '11px' }} 
                                      required 
                                    />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Time</label>
                                    <input 
                                      type="time" 
                                      className="form-control" 
                                      value={inlineFollowUpTime} 
                                      onChange={e => setInlineFollowUpTime(e.target.value)} 
                                      style={{ padding: '4px 6px', fontSize: '11px' }} 
                                      required 
                                    />
                                  </div>
                                </div>
                                
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', cursor: 'pointer', fontWeight: 'normal', margin: 0 }}>
                                  <input type="checkbox" checked={inlineCreateReminder} onChange={e => setInlineCreateReminder(e.target.checked)} />
                                  Create automatic reminder
                                </label>
                              </div>
                            )}

                            <button 
                              type="submit" 
                              className="btn btn-primary" 
                              style={{ padding: '6px', fontSize: '11px', marginTop: '4px' }} 
                              disabled={inlineSaving}
                            >
                              {inlineSaving ? 'Saving...' : 'Save Notes'}
                            </button>
                          </form>
                        )}
                        {ev.type === 'call' && ev.recording_url && (
                          <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>🎙 Call Recording Available ({ev.recording_duration || 0}s)</span>
                            { (currentUser.role === 'admin' || lead.assigned_employee_id === currentUser.id) ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <audio src={ev.recording_url} controls style={{ height: '20px', width: '130px' }} />
                                <a href={ev.recording_url} download style={{ padding: '2px 6px', fontSize: '9px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--primary)', textDecoration: 'none' }}>Download</a>
                              </div>
                            ) : (
                              <span style={{ fontSize: '9px', color: '#ef4444', fontStyle: 'italic' }}>🔐 Access Restricted</span>
                            )}
                          </div>
                        )}
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
                <form onSubmit={handleLogCallSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-main)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Call Status</label>
                      <select className="form-control" value={callResponse} onChange={e => setCallResponse(e.target.value)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                        {CALL_RESPONSES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duration (sec)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={callDuration} 
                        onChange={e => setCallDuration(e.target.value)} 
                        placeholder="e.g. 45"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Notes / Remarks</label>
                    <textarea 
                      className="form-control"
                      rows="2"
                      value={callNotes}
                      onChange={e => setCallNotes(e.target.value)}
                      placeholder="Enter call notes..."
                      style={{ fontSize: '12px' }}
                      required
                    ></textarea>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Action Taken</label>
                    <select className="form-control" value={callActionTaken} onChange={e => setCallActionTaken(e.target.value)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                      {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  {callActionTaken !== 'None' && (
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Date</label>
                          <input type="date" className="form-control" value={callFollowUpDate} onChange={e => setCallFollowUpDate(e.target.value)} style={{ padding: '4px 8px', fontSize: '11px' }} required />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Time</label>
                          <input type="time" className="form-control" value={callFollowUpTime} onChange={e => setCallFollowUpTime(e.target.value)} style={{ padding: '4px 8px', fontSize: '11px' }} required />
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'normal', margin: 0 }}>
                          <input type="checkbox" checked={callCreateReminder} onChange={e => setCallCreateReminder(e.target.checked)} />
                          Create automatic reminder
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'normal', margin: 0 }}>
                          <input type="checkbox" checked={callSendWhatsAppReminder} onChange={e => setCallSendWhatsAppReminder(e.target.checked)} />
                          Prompt WhatsApp message
                        </label>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary" style={{ padding: '8px', fontSize: '11px', marginTop: '4px' }} disabled={callSaving}>
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
                          <p style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>{log.notes}</p>
                          {log.duration > 0 && (
                            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                              ⏱ Duration: {Math.floor(log.duration / 60)}m {log.duration % 60}s
                            </div>
                          )}
                          {log.action_taken && (
                            <div style={{ fontSize: '9.5px', color: 'var(--primary)', marginBottom: '2px' }}>
                              Action: {log.action_taken} {log.follow_up_date ? `on ${log.follow_up_date}` : ''}
                            </div>
                          )}
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

            {/* Tab content 3: WhatsApp Center */}
            {activeTab === 'whatsapp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Stats Header */}
                <div style={{ display: 'flex', gap: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Messages</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {whatsappHistory.filter(h => h.type === 'message').length}
                    </div>
                  </div>
                  <div style={{ flex: 1, borderLeft: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Conversation</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
                      {(() => {
                        const msgs = whatsappHistory.filter(h => h.type === 'message');
                        if (msgs.length === 0) return 'No conversation';
                        const last = msgs[msgs.length - 1];
                        return new Date(last.timestamp).toLocaleDateString();
                      })()}
                    </div>
                  </div>
                </div>

                {/* Quick Action Open WhatsApp */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', background: '#25D366', color: '#000', fontWeight: 700, padding: '8px', fontSize: '11px' }}
                    onClick={() => handleSendWhatsAppWithLogging('WhatsApp Opened')}
                  >
                    <FaWhatsapp size={15} /> Open WhatsApp
                  </button>

                  <select 
                    className="form-control" 
                    value={selectedTemplateId} 
                    onChange={e => setSelectedTemplateId(e.target.value)} 
                    style={{ fontSize: '12px', height: '34px', background: 'var(--bg-card)', padding: '6px' }}
                  >
                    {whatsAppTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                </div>

                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '11.5px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>Message Preview:</div>
                  <p style={{ margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>{getInterpolatedWhatsAppMessage()}</p>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', background: '#10B981', color: '#000', fontWeight: 700, padding: '6px', fontSize: '10.5px', marginTop: '8px', width: '100%' }}
                    onClick={() => handleSendWhatsAppWithLogging('WhatsApp Template Sent')}
                  >
                    <FaWhatsapp size={13} /> Send Template
                  </button>
                </div>

                {/* Unified WhatsApp History Feed */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>WhatsApp Chat & Log History</h4>
                  {whatsappHistoryLoading ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>Loading history...</div>
                  ) : whatsappHistory.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>No interactions recorded yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', padding: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                      {whatsappHistory.map(item => {
                        if (item.type === 'message') {
                          return (
                            <div 
                              key={item.id} 
                              style={{ 
                                alignSelf: item.direction === 'Outgoing' ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                padding: '8px 10px',
                                borderRadius: '8px',
                                background: item.direction === 'Outgoing' ? 'rgba(37, 211, 102, 0.08)' : 'rgba(255,255,255,0.03)',
                                border: item.direction === 'Outgoing' ? '1px solid rgba(37, 211, 102, 0.3)' : '1px solid var(--border-color)',
                                fontSize: '11px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}
                            >
                              <div style={{ color: 'var(--text-main)', wordBreak: 'break-word' }}>{item.text}</div>
                              {item.template_name && <span style={{ fontSize: '8px', color: 'var(--primary)', fontStyle: 'italic' }}>Template: {item.template_name}</span>}
                              <span style={{ fontSize: '8px', color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        } else if (item.type === 'activity') {
                          return (
                            <div 
                              key={item.id} 
                              style={{ 
                                alignSelf: 'center',
                                background: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '9.5px',
                                color: '#3b82f6',
                                textAlign: 'center'
                              }}
                            >
                              📱 {item.action_type} by {item.user} at {new Date(item.timestamp).toLocaleString()}
                            </div>
                          );
                        } else if (item.type === 'notes') {
                          return (
                            <div 
                              key={item.id} 
                              style={{ 
                                alignSelf: 'stretch',
                                background: 'rgba(139, 92, 246, 0.05)',
                                border: '1px solid rgba(139, 92, 246, 0.15)',
                                borderRadius: '6px',
                                padding: '8px 10px',
                                fontSize: '11px',
                                color: 'var(--text-main)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}
                            >
                              <div style={{ fontWeight: 600, color: '#8b5cf6', display: 'flex', justifyContent: 'space-between' }}>
                                <span>📝 WhatsApp Notes Saved (by {item.user})</span>
                                <span style={{ fontSize: '9px', fontWeight: 'normal', color: 'var(--text-muted)' }}>{new Date(item.timestamp).toLocaleDateString()}</span>
                              </div>
                              <div><strong>Summary:</strong> {item.discussion_summary || 'N/A'}</div>
                              <div><strong>Interest:</strong> {item.customer_interest || 'N/A'}</div>
                              <div><strong>Budget:</strong> {item.budget_discussion || 'N/A'}</div>
                              {item.objections && <div><strong>Objections:</strong> {item.objections}</div>}
                              {item.next_action && <div style={{ color: 'var(--primary)' }}><strong>Next Action:</strong> {item.next_action}</div>}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>

                {/* Simulator Panel */}
                <form onSubmit={handleSimulateMsgSubmit} style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--primary)' }}>⚡ Sync Simulator (Test Tool)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <select className="form-control" value={simDirection} onChange={e => setSimDirection(e.target.value)} style={{ padding: '4px', fontSize: '11px', height: '28px', background: 'var(--bg-card)' }}>
                      <option value="Incoming">Incoming (Client)</option>
                      <option value="Outgoing">Outgoing (Agent)</option>
                    </select>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Type message..." 
                      value={simMsgText} 
                      onChange={e => setSimMsgText(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '11px', height: '28px' }}
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '10px', alignSelf: 'flex-end' }} disabled={simulating}>
                    {simulating ? 'Syncing...' : 'Simulate WhatsApp Msg'}
                  </button>
                </form>

                {/* Structured Follow-Up Notes Form */}
                <form onSubmit={handleWhatsAppNotesSubmit} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#8b5cf6', margin: 0 }}>📝 Structured WhatsApp Notes</h4>
                  
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Discussion Summary *</label>
                    <textarea 
                      className="form-control" 
                      value={waNotesSummary} 
                      onChange={e => setWaNotesSummary(e.target.value)}
                      placeholder="Summary of what was discussed..."
                      style={{ fontSize: '11.5px', padding: '6px', background: 'var(--bg-card)' }}
                      rows={2}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Customer Interest</label>
                      <select 
                        className="form-control" 
                        value={waNotesInterest} 
                        onChange={e => setWaNotesInterest(e.target.value)}
                        style={{ fontSize: '11.5px', padding: '4px', background: 'var(--bg-card)', height: '28px' }}
                      >
                        <option value="">Select interest...</option>
                        <option value="Very High">Very High</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                        <option value="Not Interested">Not Interested</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Budget Discussion</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={waNotesBudget} 
                        onChange={e => setWaNotesBudget(e.target.value)}
                        placeholder="e.g. Max 45L"
                        style={{ fontSize: '11.5px', padding: '4px 8px', height: '28px' }}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Objections / Concerns</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={waNotesObjections} 
                      onChange={e => setWaNotesObjections(e.target.value)}
                      placeholder="e.g. RERA approval, road width..."
                      style={{ fontSize: '11.5px', padding: '6px', height: '28px' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Next Action / Commitment</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={waNotesNextAction} 
                      onChange={e => setWaNotesNextAction(e.target.value)}
                      placeholder="e.g. Schedule site visit for Sunday"
                      style={{ fontSize: '11.5px', padding: '6px', height: '28px' }}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ background: '#8b5cf6', border: 'none', color: '#fff', fontSize: '11px', padding: '8px', fontWeight: 600 }} disabled={waNotesSaving}>
                    {waNotesSaving ? 'Saving...' : 'Save WhatsApp Notes'}
                  </button>
                </form>

                {/* Priority Follow-Up Scheduler Form */}
                <form onSubmit={handleWhatsAppFollowUpSubmit} style={{ background: 'rgba(245, 158, 11, 0.02)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', margin: 0 }}>⏰ Priority Follow-Up Scheduler</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Date *</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={waFollowUpDate} 
                        onChange={e => setWaFollowUpDate(e.target.value)}
                        style={{ fontSize: '11.5px', padding: '4px', height: '28px' }}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Time</label>
                      <input 
                        type="time" 
                        className="form-control" 
                        value={waFollowUpTime} 
                        onChange={e => setWaFollowUpTime(e.target.value)}
                        style={{ fontSize: '11.5px', padding: '4px', height: '28px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Reminder Details *</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={waFollowUpNotes} 
                        onChange={e => setWaFollowUpNotes(e.target.value)}
                        placeholder="e.g. Call to discuss objections"
                        style={{ fontSize: '11.5px', padding: '6px', height: '28px' }}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Priority</label>
                      <select 
                        className="form-control" 
                        value={waFollowUpPriority} 
                        onChange={e => setWaFollowUpPriority(e.target.value)}
                        style={{ fontSize: '11.5px', padding: '4px', height: '28px', background: 'var(--bg-card)' }}
                      >
                        <option value="Low">🟢 Low</option>
                        <option value="Medium">🟡 Medium</option>
                        <option value="High">🔴 High</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ background: '#f59e0b', border: 'none', color: '#000', fontSize: '11px', padding: '8px', fontWeight: 700 }} disabled={waFollowUpSaving}>
                    {waFollowUpSaving ? 'Scheduling...' : 'Create Reminder'}
                  </button>
                </form>

              </div>
            )}

            {/* Tab content 4: Site Visits & GPS Geofence */}
            {activeTab === 'site_visits' && (
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

                {/* Site Visits History list */}
                <div style={{ marginTop: '10px' }}>
                  <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Site Visit History</h4>
                  {siteVisits.length === 0 ? (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No site visits logged yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {siteVisits.map(v => (
                        <div key={v.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: '11.5px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                            <span>📅 {new Date(v.visit_date).toLocaleDateString()}</span>
                            <span style={{ color: v.outcome === 'Cancelled' ? 'var(--color-hot)' : 'var(--color-success)', fontWeight: 'bold' }}>{v.outcome || 'Scheduled'}</span>
                          </div>
                          {v.check_in_time && <div>Check-In: {new Date(v.check_in_time).toLocaleTimeString()}</div>}
                          {v.check_out_time && <div>Check-Out: {new Date(v.check_out_time).toLocaleTimeString()}</div>}
                          {v.feedback && <div style={{ fontStyle: 'italic', marginTop: '4px', color: 'var(--text-muted)' }}>"{v.feedback}"</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab content 5: Bookings */}
            {activeTab === 'bookings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Confirmed Bookings</h4>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={() => setShowBookingPanel(!showBookingPanel)}
                    style={{ padding: '4px 8px', fontSize: '10.5px' }}
                  >
                    {showBookingPanel ? 'Cancel' : '+ Book New Unit'}
                  </button>
                </div>

                {drawerBookingsLoading ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>Loading bookings...</div>
                ) : drawerBookings.length === 0 && !showBookingPanel ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>No bookings confirmed yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {drawerBookings.map(b => (
                      <div key={b.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '11.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                          <span>🏠 Unit {b.unit_number || 'N/A'}</span>
                          <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>{b.status || 'Confirmed'}</span>
                        </div>
                        <div>Project: {b.projects ? b.projects.name : 'Vrindavan Estates'}</div>
                        <div>Booking Date: {b.booking_date}</div>
                        <div>Token Amount: ₹{parseFloat(b.token_amount).toLocaleString()}</div>
                        <div>Total Booking Amount: ₹{parseFloat(b.booking_amount).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab content 6: Payments */}
            {activeTab === 'payments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Payment Installments & Schedule</h4>
                {drawerPaymentsLoading ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>Loading payment records...</div>
                ) : drawerPayments.length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>No payment schedules found. Make sure a unit booking is confirmed first.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {drawerPayments.map(p => (
                      <div key={p.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '11.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                          <span>💰 Payment Record</span>
                          <span style={{ color: p.status === 'Completed' ? 'var(--color-success)' : '#eab308', fontWeight: 'bold' }}>{p.status || 'Pending'}</span>
                        </div>
                        <div>Unit: {p.bookings ? p.bookings.unit_number : 'N/A'}</div>
                        <div>Total Cost: ₹{parseFloat(p.total_cost).toLocaleString()}</div>
                        <div>Received: ₹{parseFloat(p.amount_received).toLocaleString()}</div>
                        <div style={{ fontWeight: 600, color: 'var(--color-hot)' }}>Balance: ₹{parseFloat(p.balance).toLocaleString()}</div>
                        {p.due_date && <div>Due Date: {p.due_date}</div>}
                      </div>
                    ))}
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
