import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { BadgeCent, Landmark, ShieldAlert, Calendar, Phone, Plus, Filter, Clock, CheckCircle, Search } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

export default function CollectionDashboard({ currentUser, onOpenLeadDrawer }) {
  const [analytics, setAnalytics] = useState(null);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [overdueReminders, setOverdueReminders] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('All'); // 'All', 'Due Month', 'Overdue', 'Pending', 'Paid'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Installment modal logging state
  const [loggingPayment, setLoggingPayment] = useState(null);
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const anData = await api.getCollectionAnalytics();
      setAnalytics(anData);
      
      const remData = await api.getCollectionReminders();
      setUpcomingReminders(remData.upcoming || []);
      setOverdueReminders(remData.overdue || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = (m) => {
    const leadName = m.bookings?.leads?.name || 'Valued Customer';
    const phone = m.bookings?.leads?.phone1 || '';
    const unit = m.bookings?.unit_number || 'N/A';
    const project = m.bookings?.projects?.name || 'Indiana Vrindavan Estates';
    const milestone = m.milestone_name;
    const balance = m.amount - m.amount_paid;
    const dueDate = m.due_date;

    if (!phone) return alert('Phone number is missing on this lead.');

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const prefix = cleanPhone.length === 10 ? '91' : '';
    
    const greeting = `Dear ${leadName},\n\nThis is a payment reminder for Indiana Vrindavan Estates. An installment of *₹${balance.toLocaleString('en-IN')}* for your booked Unit *${unit}* (${project}) under milestone *"${milestone}"* is scheduled for *${dueDate}*.\n\nKindly complete the transfer at your earliest convenience. Please ignore if already paid.\n\nThank you,\nIndiana Vrindavan Estates Team`;
    
    const url = `https://wa.me/${prefix}${cleanPhone}?text=${encodeURIComponent(greeting)}`;
    window.open(url, '_blank');
  };

  const handleLogPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!installmentAmount) return alert('Please enter installment amount');

    try {
      // Fetch the overall payment record ID linked to this booking
      const paymentsList = await api.getPayments();
      const linkedPayment = paymentsList.find(p => p.booking_id === loggingPayment.booking_id);
      if (!linkedPayment) throw new Error('Payment record not found for this booking.');

      await api.createPaymentInstallment(
        linkedPayment.id,
        parseFloat(installmentAmount),
        paymentMode,
        remarks
      );
      alert('Payment installment logged and allocated successfully!');
      setLoggingPayment(null);
      setInstallmentAmount('');
      setRemarks('');
      fetchInitialData();
    } catch (err) {
      alert(`Logging failed: ${err.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return { bg: 'rgba(34, 197, 94, 0.1)', fg: '#22c55e' };
      case 'Partial': return { bg: 'rgba(234, 179, 8, 0.1)', fg: '#eab308' };
      case 'Pending': return { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3b82f6' };
      case 'Overdue': return { bg: 'rgba(239, 68, 68, 0.1)', fg: '#ef4444' };
      default: return { bg: 'rgba(255,255,255,0.05)', fg: '#fff' };
    }
  };

  // Combine reminders lists for table display
  const nowStr = new Date().toISOString().split('T')[0];
  const curMonthStr = nowStr.substring(0, 7);

  const allMilestones = [...overdueReminders, ...upcomingReminders];

  const filteredMilestones = allMilestones.filter(m => {
    // 1. Apply Search Query
    const clientName = (m.bookings?.leads?.name || '').toLowerCase();
    const unitNo = (m.bookings?.unit_number || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = clientName.includes(query) || unitNo.includes(query);

    if (!matchesSearch) return false;

    // 2. Apply KPI Card Filter
    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Due Month') return m.due_date && m.due_date.substring(0, 7) === curMonthStr && m.status !== 'Paid';
    if (selectedFilter === 'Overdue') return m.due_date < nowStr && m.status !== 'Paid';
    if (selectedFilter === 'Pending') return m.status === 'Pending' || m.status === 'Partial';
    return true;
  });

  return (
    <div style={{ marginTop: '20px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        💰 Collection & Financial Dashboard
      </h2>

      {/* KPI Cards Grid */}
      {analytics && (
        <div class="grid-5" style={{ marginBottom: '25px' }}>
          <div 
            class="kpi-card clickable" 
            onClick={() => setSelectedFilter('All')}
            style={{ 
              background: selectedFilter === 'All' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.02)',
              border: selectedFilter === 'All' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer'
            }}
          >
            <div class="kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}><BadgeCent size={20} /></div>
            <div class="kpi-label">Total Collection</div>
            <div class="kpi-value" style={{ fontSize: '18px' }}>₹{analytics.totalCollection.toLocaleString('en-IN')}</div>
          </div>

          <div 
            class="kpi-card clickable"
            onClick={() => setSelectedFilter('All')}
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div class="kpi-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}><CheckCircle size={20} /></div>
            <div class="kpi-label">Total Received</div>
            <div class="kpi-value" style={{ fontSize: '18px', color: '#22c55e' }}>₹{analytics.receivedCollection.toLocaleString('en-IN')}</div>
          </div>

          <div 
            class="kpi-card clickable"
            onClick={() => setSelectedFilter('Pending')}
            style={{ 
              background: selectedFilter === 'Pending' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
              border: selectedFilter === 'Pending' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer'
            }}
          >
            <div class="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><Landmark size={20} /></div>
            <div class="kpi-label">Pending Collection</div>
            <div class="kpi-value" style={{ fontSize: '18px', color: '#3b82f6' }}>₹{analytics.pendingCollection.toLocaleString('en-IN')}</div>
          </div>

          <div 
            class="kpi-card clickable"
            onClick={() => setSelectedFilter('Due Month')}
            style={{ 
              background: selectedFilter === 'Due Month' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255,255,255,0.02)',
              border: selectedFilter === 'Due Month' ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer'
            }}
          >
            <div class="kpi-icon" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308' }}><Calendar size={20} /></div>
            <div class="kpi-label">Due This Month</div>
            <div class="kpi-value" style={{ fontSize: '18px', color: '#eab308' }}>₹{analytics.dueThisMonth.toLocaleString('en-IN')}</div>
          </div>

          <div 
            class="kpi-card clickable"
            onClick={() => setSelectedFilter('Overdue')}
            style={{ 
              background: selectedFilter === 'Overdue' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.02)',
              border: selectedFilter === 'Overdue' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer'
            }}
          >
            <div class="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><ShieldAlert size={20} /></div>
            <div class="kpi-label">Overdue Amount</div>
            <div class="kpi-value" style={{ fontSize: '18px', color: '#ef4444' }}>₹{analytics.overdueAmount.toLocaleString('en-IN')}</div>
          </div>
        </div>
      )}

      {/* Payment mode break down */}
      {analytics && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', marginBottom: '25px' }}>
          <h3 style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '15px' }}>💳 Collections by Mode of Payment</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            {Object.keys(analytics?.modeBreakdown || {}).map(mode => {
              const amount = (analytics?.modeBreakdown || {})[mode];
              const pct = analytics.receivedCollection > 0 ? (amount / analytics.receivedCollection) * 100 : 0;
              return (
                <div key={mode} style={{ flex: '1 0 150px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{mode}</div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', margin: '4px 0' }}>₹{amount.toLocaleString('en-IN')}</div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#a855f7', width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Milestones Schedule Table */}
      <div class="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>📋 Payment Milestones Schedule</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Search Client or Unit..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '220px', paddingLeft: '30px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
            </div>
            
            <button 
              onClick={() => setSelectedFilter('All')} 
              className={`btn btn-secondary ${selectedFilter === 'All' ? 'btn-primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>Loading schedule...</div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Project & Unit</th>
                  <th>Milestone Name</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMilestones.map(m => {
                  const balance = m.amount - m.amount_paid;
                  const statusColors = getStatusColor(m.status);

                  return (
                    <tr key={m.id}>
                      <td>
                        <span 
                          onClick={() => m.bookings?.lead_id && onOpenLeadDrawer(m.bookings.lead_id)}
                          className="clickable-link"
                          style={{ cursor: 'pointer', fontWeight: '500', color: '#a855f7' }}
                        >
                          {m.bookings?.leads?.name || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px' }}>{m.bookings?.projects?.name || 'N/A'}</span>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Unit: {m.bookings?.unit_number || 'N/A'}</div>
                      </td>
                      <td>{m.milestone_name}</td>
                      <td>{m.due_date}</td>
                      <td>₹{m.amount.toLocaleString('en-IN')}</td>
                      <td>₹{balance.toLocaleString('en-IN')}</td>
                      <td>
                        <span style={{ background: statusColors.bg, color: statusColors.fg, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                          {m.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleSendWhatsApp(m)}
                            className="whatsapp-action-btn"
                            title="WhatsApp Customer"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                          >
                            <FaWhatsapp size={12} /> WhatsApp
                          </button>
                          
                          {balance > 0 && (
                            <button
                              onClick={() => setLoggingPayment(m)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}
                            >
                              <Plus size={13} style={{ color: '#a855f7' }} /> Log Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredMilestones.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.3)' }}>
                      No milestones matching selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Payment Dialog */}
      {loggingPayment && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={handleLogPaymentSubmit} style={{ background: 'rgba(30, 30, 45, 0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '25px', borderRadius: '16px', width: '90%', maxWidth: '400px', backdropFilter: 'blur(10px)' }}>
            <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              💵 Log Payment Installment
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Client Name</label>
                <div style={{ fontWeight: '500' }}>{loggingPayment.bookings?.leads?.name}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Milestone</label>
                  <div>{loggingPayment.milestone_name}</div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Remaining Balance</label>
                  <div style={{ color: '#ef4444', fontWeight: 'bold' }}>
                    ₹{(loggingPayment.amount - loggingPayment.amount_paid).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>Amount Paid (₹) *</label>
                <input
                  type="number"
                  class="form-control"
                  required
                  value={installmentAmount}
                  onChange={e => setInstallmentAmount(e.target.value)}
                  placeholder="e.g. 50000"
                />
              </div>

              <div class="form-group">
                <label>Payment Mode</label>
                <select class="form-control" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="NEFT/RTGS">NEFT/RTGS</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div class="form-group">
                <label>Remarks</label>
                <input
                  type="text"
                  class="form-control"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Txn ID, Cheque details, etc."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" class="btn btn-primary" style={{ flex: 1 }}>Submit Payment</button>
              <button type="button" class="btn btn-secondary" style={{ flex: 1 }} onClick={() => setLoggingPayment(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
