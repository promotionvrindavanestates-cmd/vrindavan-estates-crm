import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Plus, Check, X, ShieldAlert, BadgeCent, FileText, Calendar, Landmark, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';

export default function BookingsRegistry({ currentUser, lastUpdated }) {
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [projects, setProjects] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('registry'); // 'registry' or 'payments'

  // Booking Form State
  const [isAddingBooking, setIsAddingBooking] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [bookingAmount, setBookingAmount] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [dueDays, setDueDays] = useState('30');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentPlanType, setPaymentPlanType] = useState('default');

  // Installment log modal state
  const [loggingPayment, setLoggingPayment] = useState(null); // holds payment record
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [remarks, setRemarks] = useState('');

  // Installment history details expand state
  const [expandedPaymentId, setExpandedPaymentId] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [installmentsLoading, setInstallmentsLoading] = useState(false);

  // Milestones and Payment Plan states
  const [milestones, setMilestones] = useState([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [selectedBookingForMilestone, setSelectedBookingForMilestone] = useState(null);
  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneAmount, setMilestoneAmount] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [lastUpdated]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const bData = await api.getBookings();
      setBookings(bData);
      const pData = await api.getPayments();
      setPayments(pData);
      const lData = await api.getLeads();
      // Filter leads to allow booking only for hot/negotiation/warm leads or any lead without booking
      setLeads(lData.filter(l => l.booking_status !== 'Confirmed'));
      const prData = await api.getProjects();
      setProjects(prData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch inventory for selected project in form
  useEffect(() => {
    if (selectedProjectId) {
      api.getInventory(selectedProjectId)
        .then(inv => {
          // Only show available units
          setInventory(inv.filter(i => i.status === 'Available'));
          if (inv.filter(i => i.status === 'Available').length > 0) {
            setSelectedInventoryId(inv.filter(i => i.status === 'Available')[0].id);
          } else {
            setSelectedInventoryId('');
          }
        })
        .catch(err => console.error(err));
    } else {
      setInventory([]);
      setSelectedInventoryId('');
    }
  }, [selectedProjectId]);

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!selectedLeadId || !selectedProjectId || !totalCost) {
      return alert('Lead, Project and Total Property Cost are required.');
    }

    const lead = leads.find(l => l.id === selectedLeadId);
    const project = projects.find(p => p.id === selectedProjectId);
    const unit = inventory.find(i => i.id === selectedInventoryId);

    const payload = {
      lead_id: selectedLeadId,
      project_id: selectedProjectId,
      inventory_id: selectedInventoryId || null,
      unit_number: unit ? unit.unit_number : '',
      token_amount: tokenAmount ? parseFloat(tokenAmount) : 0,
      booking_amount: bookingAmount ? parseFloat(bookingAmount) : 0,
      total_cost: parseFloat(totalCost),
      due_days: parseInt(dueDays),
      booking_date: bookingDate,
      payment_plan_type: paymentPlanType
    };

    try {
      await api.createBooking(payload);
      alert('Booking created successfully! Inventory locked and payments initialized.');
      setIsAddingBooking(false);
      // Reset form
      setSelectedLeadId('');
      setSelectedProjectId('');
      setSelectedInventoryId('');
      setTokenAmount('');
      setBookingAmount('');
      setTotalCost('');
      setDueDays('30');
      fetchInitialData();
    } catch (err) {
      alert(`Booking failed: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (bookingId, currentStatus, nextStatus) => {
    const isEmployee = currentUser.role === 'employee';
    if (nextStatus === 'Cancelled' && isEmployee) {
      return alert('Security Lockdown: Booking cancellation is restricted to Admin role only.');
    }

    if (!window.confirm(`Are you sure you want to change booking status from "${currentStatus}" to "${nextStatus}"?`)) return;

    try {
      await api.updateBookingStatus(bookingId, nextStatus);
      alert('Booking status updated!');
      fetchInitialData();
    } catch (e) {
      alert(`Update failed: ${e.message}`);
    }
  };

  const handleLogInstallmentSubmit = async (e) => {
    e.preventDefault();
    if (!installmentAmount) return alert('Please enter installment amount');

    try {
      await api.createPaymentInstallment(
        loggingPayment.id,
        parseFloat(installmentAmount),
        paymentMode,
        remarks
      );
      alert('Payment installment logged successfully!');
      setLoggingPayment(null);
      setInstallmentAmount('');
      setRemarks('');
      fetchInitialData();
      if (expandedPaymentId === loggingPayment.id) {
        // Refresh expanded installments history list
        fetchInstallmentsHistory(loggingPayment.id);
      }
    } catch (err) {
      alert(`Logging failed: ${err.message}`);
    }
  };

  const fetchInstallmentsHistory = async (paymentId) => {
    setInstallmentsLoading(true);
    try {
      const data = await api.getPaymentInstallments(paymentId);
      setInstallments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setInstallmentsLoading(false);
    }
  };

  const fetchMilestonesHistory = async (bookingId) => {
    setMilestonesLoading(true);
    try {
      const data = await api.getBookingMilestones(bookingId);
      setMilestones(data);
    } catch (err) {
      console.error(err);
    } finally {
      setMilestonesLoading(false);
    }
  };

  const toggleExpandPayment = (paymentId, bookingId) => {
    if (expandedPaymentId === paymentId) {
      setExpandedPaymentId(null);
      setInstallments([]);
      setMilestones([]);
    } else {
      setExpandedPaymentId(paymentId);
      fetchInstallmentsHistory(paymentId);
      if (bookingId) {
        fetchMilestonesHistory(bookingId);
      }
    }
  };

  const handleCreateMilestone = async (bookingId) => {
    if (!milestoneName || !milestoneAmount || !milestoneDueDate) {
      return alert('All milestone fields are required.');
    }
    try {
      await api.createBookingMilestone(bookingId, {
        milestone_name: milestoneName,
        amount: parseFloat(milestoneAmount),
        due_date: milestoneDueDate
      });
      alert('Milestone added successfully!');
      setIsAddingMilestone(false);
      setMilestoneName('');
      setMilestoneAmount('');
      setMilestoneDueDate('');
      fetchMilestonesHistory(bookingId);
      fetchInitialData();
    } catch (err) {
      alert(`Add failed: ${err.message}`);
    }
  };

  const handleUpdateMilestone = async (bookingId, milestoneId) => {
    if (!milestoneName || !milestoneAmount || !milestoneDueDate) {
      return alert('All milestone fields are required.');
    }
    try {
      await api.updateBookingMilestone(milestoneId, {
        milestone_name: milestoneName,
        amount: parseFloat(milestoneAmount),
        due_date: milestoneDueDate
      });
      alert('Milestone updated successfully!');
      setEditingMilestone(null);
      setMilestoneName('');
      setMilestoneAmount('');
      setMilestoneDueDate('');
      fetchMilestonesHistory(bookingId);
      fetchInitialData();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleDeleteMilestone = async (bookingId, milestoneId) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    try {
      await api.deleteBookingMilestone(milestoneId);
      fetchMilestonesHistory(bookingId);
      fetchInitialData();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return { bg: 'rgba(34, 197, 94, 0.1)', fg: '#22c55e' };
      case 'Partial': return { bg: 'rgba(234, 179, 8, 0.1)', fg: '#eab308' };
      case 'Pending': return { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3b82f6' };
      case 'Overdue': return { bg: 'rgba(239, 68, 68, 0.1)', fg: '#ef4444' };
      default: return { bg: 'rgba(255,255,255,0.05)', fg: '#fff' };
    }
  };

  return (
    <div style={{ marginTop: '20px' }}>
      
      {/* Sub Tabs Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          class={`btn ${activeSubTab === 'registry' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveSubTab('registry'); setIsAddingBooking(false); }}
        >
          📂 Booking Registry
        </button>
        <button 
          class={`btn ${activeSubTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveSubTab('payments'); setIsAddingBooking(false); }}
        >
          💰 Payment Tracking
        </button>
      </div>

      {/* Adding Booking form */}
      {isAddingBooking ? (
        <div class="card">
          <h2 style={{ marginBottom: '20px' }}>➕ Create Booking / Log Sale</h2>
          <form onSubmit={handleCreateBooking}>
            <div class="grid-3">
              <div class="form-group">
                <label>Select Customer Lead *</label>
                <select class="form-control" value={selectedLeadId} onChange={e => setSelectedLeadId(e.target.value)} required>
                  <option value="">Select Hot/Negotiating Lead</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.phone1}) - {l.status} Lead</option>
                  ))}
                </select>
              </div>
              <div class="form-group">
                <label>Select Project *</label>
                <select class="form-control" value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} required>
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div class="form-group">
                <label>Select Available Unit/Plot *</label>
                <select class="form-control" value={selectedInventoryId} onChange={e => setSelectedInventoryId(e.target.value)} required>
                  <option value="">Select Unit</option>
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>{i.unit_number} ({i.property_type}) - ₹{parseFloat(i.price).toLocaleString('en-IN')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div class="grid-3" style={{ marginTop: '15px' }}>
              <div class="form-group">
                <label>Token Amount (₹)</label>
                <input type="number" class="form-control" value={tokenAmount} onChange={e => setTokenAmount(e.target.value)} placeholder="e.g. 51000" />
              </div>
              <div class="form-group">
                <label>Initial Booking Amount (₹)</label>
                <input type="number" class="form-control" value={bookingAmount} onChange={e => setBookingAmount(e.target.value)} placeholder="e.g. 200000" />
              </div>
              <div class="form-group">
                <label>Total Agreed Cost (₹) *</label>
                <input type="number" class="form-control" value={totalCost} onChange={e => setTotalCost(e.target.value)} required placeholder="e.g. 4500000" />
              </div>
            </div>

            <div class="grid-3" style={{ marginTop: '15px' }}>
              <div class="form-group">
                <label>Booking Date</label>
                <input type="date" class="form-control" value={bookingDate} onChange={e => setBookingDate(e.target.value)} />
              </div>
              <div class="form-group">
                <label>Due Days for Balance Payment</label>
                <input type="number" class="form-control" value={dueDays} onChange={e => setDueDays(e.target.value)} placeholder="default 30 days" />
              </div>
              <div class="form-group">
                <label>Payment Plan Type</label>
                <select class="form-control" value={paymentPlanType} onChange={e => setPaymentPlanType(e.target.value)}>
                  <option value="default">Default Schedule (10:15:75)</option>
                  <option value="20:20:20:20:20">Flexible 20:20:20:20:20</option>
                  <option value="40:30:30">Standard 40:30:30 Plan</option>
                  <option value="custom">Custom Schedule (Configure details later)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
              <button type="submit" class="btn btn-primary">Confirm & Book Unit</button>
              <button type="button" class="btn btn-secondary" onClick={() => setIsAddingBooking(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Main Registry Tab */}
          {activeSubTab === 'registry' && (
            <div class="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>📂 Active Booking Records</h2>
                <button class="btn btn-primary" onClick={() => setIsAddingBooking(true)}>
                  <Plus size={16} /> New Booking
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Loading bookings list...</div>
              ) : bookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No bookings registered yet.</div>
              ) : (
                <div class="table-responsive">
                  <table class="leads-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Project</th>
                        <th>Unit</th>
                        <th>Token</th>
                        <th>Booking Amt</th>
                        <th>Executive</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map(b => (
                        <tr key={b.id}>
                          <td>{b.booking_date ? new Date(b.booking_date).toLocaleDateString() : '-'}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{b.leads ? b.leads.name : 'N/A'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.leads ? b.leads.phone1 : ''}</div>
                          </td>
                          <td>{b.projects ? b.projects.name : '-'}</td>
                          <td>
                            <strong style={{ color: 'var(--primary)' }}>{b.unit_number || '-'}</strong>
                          </td>
                          <td>₹{parseFloat(b.token_amount || 0).toLocaleString('en-IN')}</td>
                          <td>₹{parseFloat(b.booking_amount || 0).toLocaleString('en-IN')}</td>
                          <td>{b.users ? b.users.full_name : 'System'}</td>
                          <td>
                            <span style={{ 
                              fontSize: '12px', 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              fontWeight: 600,
                              backgroundColor: b.status === 'Cancelled' ? 'rgba(239, 68, 68, 0.1)' : (b.status === 'Registered' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)'),
                              color: b.status === 'Cancelled' ? '#ef4444' : (b.status === 'Registered' ? '#22c55e' : '#eab308')
                            }}>
                              {b.status || 'Token Received'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {b.status !== 'Cancelled' && b.status !== 'Registered' ? (
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button class="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', color: '#22c55e' }} onClick={() => handleUpdateStatus(b.id, b.status, 'Registered')} title="Complete registration">
                                  Register Unit
                                </button>
                                {currentUser.role === 'admin' && (
                                  <button class="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', color: '#ef4444' }} onClick={() => handleUpdateStatus(b.id, b.status, 'Cancelled')} title="Cancel booking">
                                    Cancel
                                  </button>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Payment tracking sub-tab */}
          {activeSubTab === 'payments' && (
            <div class="card">
              <h2 style={{ marginBottom: '20px' }}>💰 Payment Installment Trackers</h2>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Loading payments list...</div>
              ) : payments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No payment records generated.</div>
              ) : (
                <div class="table-responsive">
                  <table class="leads-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }} />
                        <th>Customer / Project</th>
                        <th>Total Cost</th>
                        <th>Received</th>
                        <th>Balance Due</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => {
                        const colors = getStatusColor(p.status);
                        const isExpanded = expandedPaymentId === p.id;
                        return (
                          <React.Fragment key={p.id}>
                            <tr>
                              <td>
                                <button 
                                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                                  onClick={() => toggleExpandPayment(p.id, p.booking_id)}
                                  title="View payments milestones & installments history"
                                >
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                  {p.bookings && p.bookings.leads ? p.bookings.leads.name : 'Unknown'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {p.bookings && p.bookings.projects ? p.bookings.projects.name : ''} - Unit {p.bookings ? p.bookings.unit_number : ''}
                                </div>
                              </td>
                              <td>₹{parseFloat(p.total_cost || 0).toLocaleString('en-IN')}</td>
                              <td style={{ color: '#22c55e', fontWeight: 600 }}>₹{parseFloat(p.amount_received || 0).toLocaleString('en-IN')}</td>
                              <td style={{ color: p.balance > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600 }}>
                                ₹{parseFloat(p.balance || 0).toLocaleString('en-IN')}
                              </td>
                              <td>{p.due_date ? new Date(p.due_date).toLocaleDateString() : '-'}</td>
                              <td>
                                <span style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontWeight: 600,
                                  backgroundColor: colors.bg,
                                  color: colors.fg
                                }}>
                                  {p.status || 'Pending'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {parseFloat(p.balance) > 0 ? (
                                  <button class="btn btn-secondary" style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--primary)' }} onClick={() => setLoggingPayment(p)}>
                                    <BadgeCent size={13} /> Add Payment
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#22c55e' }}>Fully Paid ✓</span>
                                )}
                              </td>
                            </tr>
                            
                            {/* Expanded installments history list */}
                            {isExpanded && (
                              <tr>
                                <td colSpan="8" style={{ background: 'rgba(255,255,255,0.01)', padding: '15px' }}>
                                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                    
                                    {/* Column 1: Milestones Schedule */}
                                    <div style={{ flex: '1 1 48%', borderLeft: '3px solid var(--primary)', paddingLeft: '15px', minWidth: '300px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <h4 style={{ color: 'var(--text-main)', fontSize: '13px', margin: 0 }}>Milestones Schedule (Payment Plan):</h4>
                                        <button 
                                          onClick={() => {
                                            setSelectedBookingForMilestone(p.booking_id);
                                            setIsAddingMilestone(true);
                                          }}
                                          class="btn btn-secondary" 
                                          style={{ padding: '2px 8px', fontSize: '11px', color: 'var(--primary)' }}
                                        >
                                          + Add Milestone
                                        </button>
                                      </div>

                                      {milestonesLoading ? (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading milestones...</div>
                                      ) : milestones.length === 0 ? (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No milestones created for this booking.</div>
                                      ) : (
                                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginTop: '5px' }}>
                                          <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                              <th style={{ textAlign: 'left', padding: '6px' }}>Milestone</th>
                                              <th style={{ textAlign: 'left', padding: '6px' }}>Due Date</th>
                                              <th style={{ textAlign: 'left', padding: '6px' }}>Amount</th>
                                              <th style={{ textAlign: 'left', padding: '6px' }}>Paid</th>
                                              <th style={{ textAlign: 'left', padding: '6px' }}>Status</th>
                                              <th style={{ textAlign: 'center', padding: '6px' }}>Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {milestones.map(m => (
                                              <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                <td style={{ padding: '6px' }}>{m.milestone_name}</td>
                                                <td style={{ padding: '6px' }}>{m.due_date}</td>
                                                <td style={{ padding: '6px', fontWeight: 600 }}>₹{m.amount.toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '6px', color: '#22c55e' }}>₹{m.amount_paid.toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '6px' }}>
                                                  <span style={{ 
                                                    fontSize: '9px', 
                                                    padding: '1px 5px', 
                                                    borderRadius: '4px',
                                                    background: m.status === 'Paid' ? 'rgba(34,197,94,0.1)' : (m.status === 'Overdue' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)'),
                                                    color: m.status === 'Paid' ? '#22c55e' : (m.status === 'Overdue' ? '#ef4444' : '#eab308')
                                                  }}>
                                                    {m.status}
                                                  </span>
                                                </td>
                                                <td style={{ padding: '6px', textAlign: 'center' }}>
                                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                    <button 
                                                      onClick={() => {
                                                        setEditingMilestone(m);
                                                        setMilestoneName(m.milestone_name);
                                                        setMilestoneAmount(m.amount);
                                                        setMilestoneDueDate(m.due_date);
                                                      }}
                                                      style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}
                                                    >
                                                      Edit
                                                    </button>
                                                    {currentUser.role === 'admin' && (
                                                      <button 
                                                        onClick={() => handleDeleteMilestone(p.booking_id, m.id)}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                                      >
                                                        Delete
                                                      </button>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>

                                    {/* Column 2: Logged Installments */}
                                    <div style={{ flex: '1 1 48%', borderLeft: '3px solid #10b981', paddingLeft: '15px', minWidth: '300px' }}>
                                      <h4 style={{ marginBottom: '10px', color: 'var(--text-main)', fontSize: '13px' }}>Installments Receipt History:</h4>
                                      {installmentsLoading ? (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading history details...</div>
                                      ) : installments.length === 0 ? (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No payment installments logged yet (Initial booking amount logged only).</div>
                                      ) : (
                                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginTop: '5px' }}>
                                          <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                              <th style={{ textAlign: 'left', padding: '6px' }}>Date</th>
                                              <th style={{ textAlign: 'left', padding: '6px' }}>Mode</th>
                                              <th style={{ textAlign: 'left', padding: '6px' }}>Amount (₹)</th>
                                              <th style={{ textAlign: 'left', padding: '6px' }}>Remarks</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {installments.map(ins => (
                                              <tr key={ins.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                <td style={{ padding: '6px' }}>{new Date(ins.payment_date).toLocaleDateString()}</td>
                                                <td style={{ padding: '6px' }}>{ins.payment_mode}</td>
                                                <td style={{ padding: '6px', fontWeight: 600, color: 'var(--text-main)' }}>₹{parseFloat(ins.amount_paid).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '6px', color: 'var(--text-muted)' }}>{ins.remarks || '-'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                    
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Log Payment Installment Dialog */}
      {loggingPayment && (
        <div class="modal-overlay">
          <div class="modal-content" style={{ maxWidth: '450px' }}>
            <div class="modal-header">
              <h3>💵 Log Payment Installment</h3>
              <button class="modal-close" onClick={() => setLoggingPayment(null)}>×</button>
            </div>
            
            <div style={{ padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', background: 'rgba(255,255,255,0.01)' }}>
              <div>Customer: <strong>{loggingPayment.bookings?.leads?.name}</strong></div>
              <div>Project/Unit: {loggingPayment.bookings?.projects?.name} - Unit {loggingPayment.bookings?.unit_number}</div>
              <div style={{ marginTop: '5px', color: '#ef4444' }}>Pending Balance: <strong>₹{parseFloat(loggingPayment.balance).toLocaleString('en-IN')}</strong></div>
            </div>

            <form onSubmit={handleLogInstallmentSubmit} style={{ padding: '20px' }}>
              <div class="form-group">
                <label>Installment Amount Received (₹) *</label>
                <input 
                  type="number" 
                  class="form-control" 
                  value={installmentAmount} 
                  onChange={e => setInstallmentAmount(e.target.value)} 
                  required 
                  placeholder="e.g. 150000" 
                  max={loggingPayment.balance}
                />
              </div>

              <div class="form-group" style={{ marginTop: '15px' }}>
                <label>Payment Mode</label>
                <select class="form-control" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="UPI">UPI / Net Banking</option>
                  <option value="Cash">Cash Payment</option>
                  <option value="Cheque">Cheque Payment</option>
                  <option value="NEFT/RTGS">NEFT / RTGS</option>
                  <option value="Other">Other Mode</option>
                </select>
              </div>

              <div class="form-group" style={{ marginTop: '15px' }}>
                <label>Remarks / Receipt Details</label>
                <input 
                  type="text" 
                  class="form-control" 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)} 
                  placeholder="e.g. Transaction ID, Cheque number" 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                <button type="submit" class="btn btn-primary" style={{ flex: 1 }}>Confirm Payment</button>
                <button type="button" class="btn btn-secondary" style={{ flex: 1 }} onClick={() => setLoggingPayment(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Milestone Modal */}
      {isAddingMilestone && (
        <div class="modal-overlay">
          <div class="modal-content" style={{ maxWidth: '400px' }}>
            <div class="modal-header">
              <h3>➕ Add Payment Milestone</h3>
              <button class="modal-close" onClick={() => setIsAddingMilestone(false)}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div class="form-group">
                <label>Milestone Name *</label>
                <input
                  type="text"
                  class="form-control"
                  required
                  value={milestoneName}
                  onChange={e => setMilestoneName(e.target.value)}
                  placeholder="e.g. Structure Cast, Brickwork Complete"
                />
              </div>

              <div class="form-group" style={{ marginTop: '15px' }}>
                <label>Milestone Amount (₹) *</label>
                <input
                  type="number"
                  class="form-control"
                  required
                  value={milestoneAmount}
                  onChange={e => setMilestoneAmount(e.target.value)}
                  placeholder="e.g. 200000"
                />
              </div>

              <div class="form-group" style={{ marginTop: '15px' }}>
                <label>Due Date *</label>
                <input
                  type="date"
                  class="form-control"
                  required
                  value={milestoneDueDate}
                  onChange={e => setMilestoneDueDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                <button onClick={() => handleCreateMilestone(selectedBookingForMilestone)} class="btn btn-primary" style={{ flex: 1 }}>Add Milestone</button>
                <button type="button" class="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsAddingMilestone(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Milestone Modal */}
      {editingMilestone && (
        <div class="modal-overlay">
          <div class="modal-content" style={{ maxWidth: '400px' }}>
            <div class="modal-header">
              <h3>✏️ Edit Payment Milestone</h3>
              <button class="modal-close" onClick={() => setEditingMilestone(null)}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div class="form-group">
                <label>Milestone Name *</label>
                <input
                  type="text"
                  class="form-control"
                  required
                  value={milestoneName}
                  onChange={e => setMilestoneName(e.target.value)}
                />
              </div>

              <div class="form-group" style={{ marginTop: '15px' }}>
                <label>Milestone Amount (₹) *</label>
                <input
                  type="number"
                  class="form-control"
                  required
                  value={milestoneAmount}
                  onChange={e => setMilestoneAmount(e.target.value)}
                />
              </div>

              <div class="form-group" style={{ marginTop: '15px' }}>
                <label>Due Date *</label>
                <input
                  type="date"
                  class="form-control"
                  required
                  value={milestoneDueDate}
                  onChange={e => setMilestoneDueDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                <button onClick={() => handleUpdateMilestone(editingMilestone.booking_id, editingMilestone.id)} class="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                <button type="button" class="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingMilestone(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
