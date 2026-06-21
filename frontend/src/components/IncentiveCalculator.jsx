import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { BadgeCent, Award, Calculator, Calendar, Users, RefreshCw } from 'lucide-react';

export default function IncentiveCalculator({ currentUser }) {
  const [bookings, setBookings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [globalCommissionRate, setGlobalCommissionRate] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    fetchInitialData();
  }, [selectedEmployeeId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      if (isAdmin && employees.length === 0) {
        const empList = await api.getEmployees();
        setEmployees(empList || []);
      }
      
      const targetEmp = isAdmin ? selectedEmployeeId : currentUser.id;
      const data = await api.getIncentivesData(targetEmp);
      setBookings(data.bookings || []);
      
      // If employee has a specific commission_rate in their profile/booking, sync default rate
      if (data.bookings && data.bookings.length > 0) {
        const rate = data.bookings[0].commission_rate;
        setGlobalCommissionRate(rate);
      } else {
        setGlobalCommissionRate(data.default_commission || 1.5);
      }
      setError('');
    } catch (err) {
      console.error('Failed to fetch incentives data:', err);
      setError('Failed to fetch confirmed bookings for incentive calculations.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBaseCommission = async () => {
    if (!isAdmin || !selectedEmployeeId) return;
    try {
      await api.updateEmployeeCommission(selectedEmployeeId, globalCommissionRate);
      alert(`Base commission rate updated in database successfully to ${globalCommissionRate}%!`);
    } catch (err) {
      alert(`Failed to save commission rate: ${err.message}`);
    }
  };

  // Group bookings by Month
  const getMonthlyEarnings = () => {
    const monthly = {};
    bookings.forEach(b => {
      if (!b.booking_date) return;
      const date = new Date(b.booking_date);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      
      const val = parseFloat(b.booking_value) || 0;
      const incentive = (val * globalCommissionRate) / 100;

      if (!monthly[key]) {
        monthly[key] = { month: key, count: 0, bookingValue: 0, earnings: 0 };
      }
      monthly[key].count++;
      monthly[key].bookingValue += val;
      monthly[key].earnings += incentive;
    });
    return Object.values(monthly || {});
  };

  const totalBookingValue = bookings.reduce((sum, b) => sum + (parseFloat(b.booking_value) || 0), 0);
  const totalIncentives = (totalBookingValue * globalCommissionRate) / 100;
  const monthlySummaries = getMonthlyEarnings();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header and User Selection */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-main)' }}>🧮 Executive Incentive Calculator</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Calculate monthly incentives and commissions based on confirmed booking values.
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={16} style={{ color: 'var(--primary)' }} />
            <select 
              className="form-control"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              style={{ width: '220px', padding: '6px 12px' }}
            >
              <option value="">All Executive Bookings</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.username})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <RefreshCw className="bell-animation" style={{ marginRight: '8px', display: 'inline-block' }} size={16} />
          Aggregating verified bookings and totals...
        </div>
      ) : error ? (
        <div style={{ color: '#ef4444', padding: '20px', textAlign: 'center' }}>{error}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top Panel: Control Slider & High-level KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            
            {/* Commission Config Slider */}
            <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calculator size={16} /> Dynamic Commission Rate
              </h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                <span>Commission Percentage:</span>
                <strong style={{ color: 'var(--primary)', fontSize: '16px' }}>{globalCommissionRate}%</strong>
              </div>

              <input 
                type="range" 
                min="0.5" 
                max="5.0" 
                step="0.1"
                value={globalCommissionRate}
                onChange={(e) => setGlobalCommissionRate(parseFloat(e.target.value))}
                style={{ width: '100%', marginBottom: '15px', cursor: 'pointer' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Min: 0.5%</span>
                <span>Max: 5.0%</span>
              </div>

              {isAdmin && selectedEmployeeId && (
                <button 
                  className="btn btn-primary" 
                  onClick={handleUpdateBaseCommission} 
                  style={{ width: '100%', marginTop: '15px', fontSize: '12px', padding: '6px 12px' }}
                >
                  Save as Default Executive Rate
                </button>
              )}
            </div>

            {/* KPI 1: Bookings count & value */}
            <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Booking Value</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-main)' }}>
                ₹{totalBookingValue.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, marginTop: '4px' }}>
                Confirmed Bookings: {bookings.length} units
              </div>
            </div>

            {/* KPI 2: Total incentive */}
            <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Payout / Incentive</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#22c55e' }}>
                ₹{totalIncentives.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Calculated at {globalCommissionRate}% commission
              </div>
            </div>

          </div>

          {/* Monthly Earnings Rollup */}
          <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} /> Monthly Earnings Ledger
            </h3>
            
            {monthlySummaries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                No monthly earnings aggregated. Complete bookings to generate commissions.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                {monthlySummaries.map(summary => (
                  <div 
                    key={summary.month} 
                    style={{ 
                      padding: '15px', 
                      borderRadius: '8px', 
                      background: 'rgba(255,255,255,0.01)', 
                      border: '1px solid rgba(255,255,255,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>{summary.month}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bookings: {summary.count} Units</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Value: ₹{summary.bookingValue.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#22c55e', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                      ₹{summary.earnings.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Bookings List */}
          <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={16} /> Booking Commission Details
            </h3>

            {bookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>No bookings confirmed for this selector.</div>
            ) : (
              <div className="table-responsive">
                <table className="leads-table">
                  <thead>
                    <tr>
                      <th>Booking Date</th>
                      <th>Customer / Executive</th>
                      <th>Project / Unit</th>
                      <th>Booking Value</th>
                      <th>Commission</th>
                      <th>Incentive Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => {
                      const incentive = (parseFloat(b.booking_value) * globalCommissionRate) / 100;
                      return (
                        <tr key={b.id}>
                          <td>{b.booking_date ? new Date(b.booking_date).toLocaleDateString() : 'N/A'}</td>
                          <td>
                            <strong style={{ color: 'var(--text-main)' }}>{b.customer_name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Agent: {b.executive_name}</div>
                          </td>
                          <td>
                            <div>{b.project_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>Unit: {b.unit_number}</div>
                          </td>
                          <td>₹{parseFloat(b.booking_value || 0).toLocaleString('en-IN')}</td>
                          <td>{globalCommissionRate}%</td>
                          <td style={{ color: '#22c55e', fontWeight: 600 }}>₹{incentive.toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
