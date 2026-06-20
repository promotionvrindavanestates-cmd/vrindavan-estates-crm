import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Landmark, TrendingUp, DollarSign, Calendar, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

export default function RevenueAnalytics() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPaymentsData();
  }, []);

  const fetchPaymentsData = async () => {
    setLoading(true);
    try {
      const data = await api.getPayments();
      setPayments(data || []);
      setError('');
    } catch (err) {
      console.error('Failed to load payments:', err);
      setError('Failed to load payments ledger data.');
    } finally {
      setLoading(false);
    }
  };

  // Summarize metrics
  const totalSales = payments.reduce((sum, p) => sum + (parseFloat(p.total_cost) || 0), 0);
  const totalReceived = payments.reduce((sum, p) => sum + (parseFloat(p.amount_received) || 0), 0);
  const totalOutstanding = payments.reduce((sum, p) => sum + (parseFloat(p.balance) || 0), 0);
  const collectionRate = totalSales > 0 ? Math.round((totalReceived / totalSales) * 100) : 0;

  // Filter outstandings
  const outstandings = payments
    .filter(p => (parseFloat(p.balance) || 0) > 0)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  // Monthly collections calculation for SVG line chart
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyCollections = {};
  const now = new Date();
  
  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyCollections[key] = { label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`, amount: 0 };
  }

  payments.forEach(p => {
    if (!p.created_at) return;
    const date = new Date(p.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyCollections[key]) {
      monthlyCollections[key].amount += (parseFloat(p.amount_received) || 0);
    }
  });

  const trendData = Object.values(monthlyCollections);
  const maxTrendAmount = Math.max(...trendData.map(t => t.amount), 1);

  // Quick WhatsApp reminder
  const sendWhatsAppReminder = (payment) => {
    const leadName = payment.bookings?.leads?.name || 'Customer';
    const phone = payment.bookings?.leads?.phone1 || '';
    const projectName = payment.bookings?.projects?.name || 'Vrindavan Estates';
    const unitNo = payment.bookings?.unit_number || 'N/A';
    const outstandingVal = payment.balance?.toLocaleString('en-IN');
    const dueDateVal = payment.due_date ? new Date(payment.due_date).toLocaleDateString() : 'N/A';

    const message = `Hello ${leadName}, this is a gentle reminder regarding your outstanding balance of ₹${outstandingVal} for Unit ${unitNo} at ${projectName}, due on ${dueDateVal}. Please let us know if you have completed the payment. - Vrindavan Estates CRM`;
    const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--text-main)' }}>
          <Landmark style={{ color: 'var(--primary)' }} />
          Revenue & Payments Ledger Analytics
        </h3>
        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={fetchPaymentsData}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px', padding: '10px 14px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Computing balances and revenue metrics...
        </div>
      ) : (
        <div>
          {/* Revenue KPI Cards */}
          <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
            <div className="metric-card primary">
              <div className="metric-label">Total Contracted Cost</div>
              <div className="metric-value">₹{totalSales.toLocaleString('en-IN')}</div>
            </div>
            <div className="metric-card success">
              <div className="metric-label">Total Received / Collected</div>
              <div className="metric-value">₹{totalReceived.toLocaleString('en-IN')}</div>
            </div>
            <div className="metric-card warm">
              <div className="metric-label">Outstanding Balance</div>
              <div className="metric-value" style={{ color: 'var(--color-hot)' }}>
                ₹{totalOutstanding.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="metric-card info">
              <div className="metric-label">Collection Efficiency</div>
              <div className="metric-value">{collectionRate}%</div>
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '4px', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ background: 'var(--color-success)', width: `${collectionRate}%`, height: '100%' }} />
              </div>
            </div>
          </div>

          <div className="charts-grid" style={{ marginBottom: '24px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {/* SVG Monthly Collection Trends */}
            <div className="chart-card" style={{ flex: 1, minWidth: '400px' }}>
              <h3 className="chart-title">
                <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }} />
                Monthly Collection History (Last 6 Months)
              </h3>
              <div style={{ height: '180px', width: '100%', position: 'relative', marginTop: '15px' }}>
                <svg viewBox="0 0 500 150" width="100%" height="100%" style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line x1="40" y1="20" x2="480" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
                  <line x1="40" y1="70" x2="480" y2="70" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
                  <line x1="40" y1="120" x2="480" y2="120" stroke="var(--border-color)" strokeWidth="0.5" />

                  {(() => {
                    const points = trendData.map((t, idx) => {
                      const x = 40 + (idx * (440 / (trendData.length - 1 || 1)));
                      const y = 120 - ((t.amount / maxTrendAmount) * 100);
                      return { x, y, label: t.label, amount: t.amount };
                    });
                    if (points.length === 0) return null;
                    const pathD = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
                    const areaD = `${pathD} L ${points[points.length - 1].x} 120 L ${points[0].x} 120 Z`;
                    return (
                      <>
                        <path d={areaD} fill="url(#revGradient)" />
                        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" />
                        {points.map((p, idx) => (
                          <g key={idx}>
                            <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-card)" stroke="#10b981" strokeWidth="2" />
                            <text x={p.x} y={p.y - 10} fill="var(--text-main)" fontSize="8" textAnchor="middle" fontWeight="bold">
                              ₹{(p.amount / 1000).toFixed(0)}k
                            </text>
                            <text x={p.x} y="138" fill="var(--text-muted)" fontSize="9" textAnchor="middle">
                              {p.label}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Outstandings Warning Info */}
            <div className="card" style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: '15px' }}>
                <AlertCircle size={36} style={{ color: 'var(--color-hot)', marginBottom: '12px' }} />
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--text-main)' }}>Outstanding Alert System</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 15px 0' }}>
                  There are currently <strong style={{ color: 'var(--color-hot)' }}>{outstandings.length} bookings</strong> with pending payments. Make sure to follow up with clients regularly.
                </p>
                <div style={{ display: 'inline-block', background: 'rgba(255, 94, 94, 0.05)', border: '1px solid rgba(255, 94, 94, 0.1)', padding: '10px 14px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Total Outstanding Balance</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-hot)' }}>₹{totalOutstanding.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Outstandings Registry Table */}
          <div className="table-panel">
            <div className="table-header-row">
              <h3>Outstanding Balances Registry</h3>
              <span className="alerts-count" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', color: 'var(--color-hot)' }}>
                {outstandings.length} Pending
              </span>
            </div>

            <div className="table-container">
              {outstandings.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No outstanding payments pending. Outstanding collection record!
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Project / Unit</th>
                      <th style={{ textAlign: 'right' }}>Total Cost</th>
                      <th style={{ textAlign: 'right' }}>Received</th>
                      <th style={{ textAlign: 'right' }}>Outstanding</th>
                      <th style={{ textAlign: 'center' }}>Due Date</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandings.map(p => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.bookings?.leads?.name || 'Customer'}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {p.bookings?.leads?.phone1 || 'No Phone'}
                          </div>
                        </td>
                        <td>
                          {p.bookings?.projects?.name || 'N/A'}
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--primary)' }}>
                            Unit No: {p.bookings?.unit_number || 'N/A'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>₹{p.total_cost?.toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>₹{p.amount_received?.toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'right', color: 'var(--color-hot)', fontWeight: 'bold' }}>
                          ₹{p.balance?.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${new Date(p.due_date) < new Date() ? 'badge-cold' : 'badge-warm'}`}>
                            {p.due_date ? new Date(p.due_date).toLocaleDateString() : 'N/A'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '11px', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              color: 'var(--primary)',
                              border: '1px solid rgba(223, 177, 91, 0.2)'
                            }}
                            onClick={() => sendWhatsAppReminder(p)}
                            title="Send WhatsApp Payment Reminder"
                          >
                            <MessageSquare size={12} /> Remind
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
