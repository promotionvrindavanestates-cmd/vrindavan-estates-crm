import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const SOURCES = ['Facebook', 'Instagram', 'Google', 'Website', 'WhatsApp', 'Walk-In', 'Referral', 'MagicBricks', '99acres', 'Housing'];
const STATUSES = ['Hot', 'Warm', 'Cold'];
const VISIT_STATUSES = ['None', 'Scheduled', 'Completed', 'Cancelled'];
const BOOKING_STATUSES = ['None', 'Pending', 'Confirmed', 'Cancelled'];

export default function LeadModal({ isOpen, onClose, onSave, lead = null, employees = [], currentUser = {} }) {
  const [name, setName] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [city, setCity] = useState('');
  const [budget, setBudget] = useState('');
  const [project, setProject] = useState('');
  const [leadSource, setLeadSource] = useState('Website');
  const [status, setStatus] = useState('Warm');
  const [followUpDate, setFollowUpDate] = useState('');
  const [requirement, setRequirement] = useState('');
  const [comments, setComments] = useState('');
  
  // Site Visit
  const [siteVisitDate, setSiteVisitDate] = useState('');
  const [siteVisitStatus, setSiteVisitStatus] = useState('None');
  const [siteVisitRemarks, setSiteVisitRemarks] = useState('');

  // Booking
  const [bookingTokenAmount, setBookingTokenAmount] = useState('0');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingStatus, setBookingStatus] = useState('None');

  // Assignment
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Enterprise Duplicate State
  const [duplicateInfo, setDuplicateInfo] = useState(null);

  useEffect(() => {
    const checkDuplicate = async () => {
      const cleanP1 = phone1 ? phone1.replace(/\D/g, '') : '';
      const cleanP2 = phone2 ? phone2.replace(/\D/g, '') : '';
      if (cleanP1.length >= 10 || cleanP2.length >= 10) {
        try {
          const res = await api.checkDuplicateLead(phone1, phone2, lead?.id || null);
          if (res.duplicate) {
            setDuplicateInfo(res.duplicateLead);
          } else {
            setDuplicateInfo(null);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setDuplicateInfo(null);
      }
    };

    const debounceTimer = setTimeout(checkDuplicate, 500);
    return () => clearTimeout(debounceTimer);
  }, [phone1, phone2, lead]);

  useEffect(() => {
    if (lead) {
      setName(lead.name || '');
      setPhone1(lead.phone1 || '');
      setPhone2(lead.phone2 || '');
      setCity(lead.city || '');
      setBudget(lead.budget || '');
      setProject(lead.project || '');
      setLeadSource(lead.lead_source || 'Website');
      setStatus(lead.status || 'Warm');
      setFollowUpDate(lead.follow_up_date || '');
      setRequirement(lead.requirement || '');
      setComments(lead.comments || '');
      
      setSiteVisitDate(lead.site_visit_date || '');
      setSiteVisitStatus(lead.site_visit_status || 'None');
      setSiteVisitRemarks(lead.site_visit_remarks || '');
      
      setBookingTokenAmount(lead.booking_token_amount ? String(lead.booking_token_amount) : '0');
      setBookingDate(lead.booking_date || '');
      setBookingStatus(lead.booking_status || 'None');
      
      setAssignedEmployeeId(lead.assigned_employee_id || '');
    } else {
      // Clear fields for fresh add
      setName('');
      setPhone1('');
      setPhone2('');
      setCity('');
      setBudget('');
      setProject('');
      setLeadSource('Website');
      setStatus('Warm');
      setFollowUpDate('');
      setRequirement('');
      setComments('');
      setSiteVisitDate('');
      setSiteVisitStatus('None');
      setSiteVisitRemarks('');
      setBookingTokenAmount('0');
      setBookingDate('');
      setBookingStatus('None');
      setAssignedEmployeeId(currentUser.role === 'employee' ? currentUser.id : '');
    }
    setError('');
  }, [lead, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !phone1) {
      setError('Name and Phone 1 are required fields.');
      return;
    }

    setLoading(true);
    setError('');

    const leadPayload = {
      name,
      phone1,
      phone2,
      city,
      budget,
      project,
      lead_source: leadSource,
      status,
      follow_up_date: followUpDate || null,
      requirement,
      comments,
      site_visit_date: siteVisitDate || null,
      site_visit_status: siteVisitStatus,
      site_visit_remarks: siteVisitRemarks,
      booking_token_amount: parseFloat(bookingTokenAmount) || 0,
      booking_date: bookingDate || null,
      booking_status: bookingStatus,
      assigned_employee_id: assignedEmployeeId || null
    };

    try {
      await onSave(leadPayload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save lead.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">{lead ? 'Edit Lead Details' : 'Add New Real Estate Lead'}</h2>
          <button class="action-icon-btn" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div class="modal-body">
            {error && (
              <div style={{ background: 'var(--color-hot-bg)', color: 'var(--color-hot)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', border: '1px solid rgba(255, 94, 94, 0.2)' }}>
                {error}
              </div>
            )}

            {/* Basic Info */}
            <h4 style={{ color: 'var(--primary)', marginBottom: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>Basic Details</h4>
            <div class="grid-2-col" style={{ marginBottom: '14px' }}>
              <div class="form-group">
                <label>Client Name * {lead && currentUser.role === 'employee' && <span style={{ color: 'var(--text-muted)' }}>(Locked)</span>}</label>
                <input
                  type="text"
                  class="form-control"
                  placeholder="e.g. Gopal Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading || (!!lead && currentUser.role === 'employee')}
                />
              </div>
              <div class="form-group">
                <label>City</label>
                <input
                  type="text"
                  class="form-control"
                  placeholder="e.g. Vrindavan"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div class="grid-2-col" style={{ marginBottom: '14px' }}>
              <div class="form-group">
                <label>Primary Phone * {lead && currentUser.role === 'employee' && <span style={{ color: 'var(--text-muted)' }}>(Locked)</span>}</label>
                <input
                  type="tel"
                  class="form-control"
                  placeholder="10-digit mobile number"
                  value={phone1}
                  onChange={(e) => setPhone1(e.target.value)}
                  disabled={loading || (!!lead && currentUser.role === 'employee')}
                />
              </div>
              <div class="form-group">
                <label>Secondary Phone (Optional) {lead && currentUser.role === 'employee' && <span style={{ color: 'var(--text-muted)' }}>(Locked)</span>}</label>
                <input
                  type="tel"
                  class="form-control"
                  placeholder="Alternate mobile number"
                  value={phone2}
                  onChange={(e) => setPhone2(e.target.value)}
                  disabled={loading || (!!lead && currentUser.role === 'employee')}
                />
              </div>

              {duplicateInfo && (
                <div style={{
                  gridColumn: 'span 2',
                  background: 'var(--color-warm-bg)',
                  color: 'var(--color-warm)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12.5px',
                  border: '1px solid rgba(255, 184, 48, 0.2)',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>⚠️ <strong>Duplicate Lead Warning:</strong> "{duplicateInfo.name}" is already registered (Assigned Executive: <strong>{duplicateInfo.owner}</strong>).</span>
                </div>
              )}
            </div>

            {/* Project & Budget */}
            <h4 style={{ color: 'var(--primary)', marginBottom: '10px', marginTop: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>Property Requirement</h4>
            <div class="grid-2-col" style={{ marginBottom: '14px' }}>
              <div class="form-group">
                <label>Vrindavan Project</label>
                <input
                  type="text"
                  class="form-control"
                  placeholder="e.g. Krishna County Villas"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div class="form-group">
                <label>Budget Range</label>
                <input
                  type="text"
                  class="form-control"
                  placeholder="e.g. 60-80 Lakhs"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Lead Tracking & Source */}
            <h4 style={{ color: 'var(--primary)', marginBottom: '10px', marginTop: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>Lead Status & Source</h4>
            <div class="grid-2-col" style={{ marginBottom: '14px' }}>
              <div class="form-group">
                <label>Lead Source</label>
                <select
                  class="form-control"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  disabled={loading}
                >
                  {SOURCES.map(src => <option key={src} value={src}>{src}</option>)}
                </select>
              </div>
              <div class="form-group">
                <label>Status (Temperature)</label>
                <select
                  class="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={loading}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div class="grid-2-col" style={{ marginBottom: '14px' }}>
              <div class="form-group">
                <label>Next Follow Up Date</label>
                <input
                  type="date"
                  class="form-control"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              {currentUser.role === 'admin' && (
                <div class="form-group">
                  <label>Assign to Employee</label>
                  <select
                    class="form-control"
                    value={assignedEmployeeId}
                    onChange={(e) => setAssignedEmployeeId(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Site Visit Module */}
            <h4 style={{ color: 'var(--primary)', marginBottom: '10px', marginTop: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>Site Visit Module</h4>
            <div class="grid-2-col" style={{ marginBottom: '14px' }}>
              <div class="form-group">
                <label>Site Visit Date</label>
                <input
                  type="date"
                  class="form-control"
                  value={siteVisitDate}
                  onChange={(e) => setSiteVisitDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div class="form-group">
                <label>Site Visit Status</label>
                <select
                  class="form-control"
                  value={siteVisitStatus}
                  onChange={(e) => setSiteVisitStatus(e.target.value)}
                  disabled={loading}
                >
                  {VISIT_STATUSES.map(vs => <option key={vs} value={vs}>{vs}</option>)}
                </select>
              </div>
            </div>
            <div class="form-group" style={{ marginBottom: '14px' }}>
              <label>Site Visit Remarks</label>
              <textarea
                class="form-control"
                rows="2"
                placeholder="Details of client's feedback during site visit..."
                value={siteVisitRemarks}
                onChange={(e) => setSiteVisitRemarks(e.target.value)}
                disabled={loading}
              ></textarea>
            </div>

            {/* Booking Module */}
            <h4 style={{ color: 'var(--primary)', marginBottom: '10px', marginTop: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>Booking Details</h4>
            <div class="grid-2-col" style={{ marginBottom: '14px' }}>
              <div class="form-group">
                <label>Booking Status</label>
                <select
                  class="form-control"
                  value={bookingStatus}
                  onChange={(e) => setBookingStatus(e.target.value)}
                  disabled={loading}
                >
                  {BOOKING_STATUSES.map(bs => <option key={bs} value={bs}>{bs}</option>)}
                </select>
              </div>
              <div class="form-group">
                <label>Booking Date</label>
                <input
                  type="date"
                  class="form-control"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <div class="form-group" style={{ marginBottom: '14px' }}>
              <label>Token Amount Received (INR)</label>
              <input
                type="number"
                class="form-control"
                placeholder="e.g. 51000"
                value={bookingTokenAmount}
                onChange={(e) => setBookingTokenAmount(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Requirements & Comments Text Areas */}
            <h4 style={{ color: 'var(--primary)', marginBottom: '10px', marginTop: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>Notes & Comments</h4>
            <div class="form-group" style={{ marginBottom: '14px' }}>
              <label>Lead Requirements</label>
              <textarea
                class="form-control"
                rows="3"
                placeholder="Specific property dimensions, facing direction, preferred floor..."
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                disabled={loading}
              ></textarea>
            </div>
            <div class="form-group" style={{ marginBottom: '14px' }}>
              <label>Admin/Employee Comments</label>
              <textarea
                class="form-control"
                rows="2"
                placeholder="Any general comments, conversation snippets, or next steps..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                disabled={loading}
              ></textarea>
            </div>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" class="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
