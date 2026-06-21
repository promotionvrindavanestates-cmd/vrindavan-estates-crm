import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { ShieldAlert, Lock, Unlock, Clock, Filter, Building, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

export default function InventoryPipeline({ currentUser }) {
  const [projects, setProjects] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [blockDuration, setBlockDuration] = useState('24');

  const statuses = ['Available', 'Blocked', 'Token', 'Booked', 'Registry Pending', 'Registered'];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const projs = await api.getProjects();
      setProjects(projs);
      const inv = await api.getInventory();
      setInventory(inv);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUnit = async (id) => {
    try {
      await api.blockInventoryUnit(id, parseInt(blockDuration));
      alert('Unit blocked successfully!');
      setSelectedUnit(null);
      fetchInitialData();
    } catch (err) {
      alert(`Failed to block unit: ${err.message}`);
    }
  };

  const handleUnblockUnit = async (id) => {
    try {
      await api.unblockInventoryUnit(id);
      alert('Unit unblocked/released successfully!');
      setSelectedUnit(null);
      fetchInitialData();
    } catch (err) {
      alert(`Failed to release unit: ${err.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return { bg: 'rgba(34, 197, 94, 0.1)', fg: '#22c55e', border: 'rgba(34, 197, 94, 0.2)' };
      case 'Blocked': return { bg: 'rgba(234, 179, 8, 0.1)', fg: '#eab308', border: 'rgba(234, 179, 8, 0.2)' };
      case 'Token': return { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' };
      case 'Booked': return { bg: 'rgba(168, 85, 247, 0.1)', fg: '#a855f7', border: 'rgba(168, 85, 247, 0.2)' };
      case 'Registry Pending': return { bg: 'rgba(249, 115, 22, 0.1)', fg: '#f97316', border: 'rgba(249, 115, 22, 0.2)' };
      case 'Registered': return { bg: 'rgba(100, 116, 139, 0.1)', fg: '#94a3b8', border: 'rgba(100, 116, 139, 0.2)' };
      default: return { bg: 'rgba(255, 255, 255, 0.05)', fg: '#fff', border: 'rgba(255, 255, 255, 0.1)' };
    }
  };

  const filteredInventory = inventory.filter(item => {
    return !selectedProjectId || item.project_id === selectedProjectId;
  });

  const getRemainingBlockTime = (blockedUntilStr) => {
    if (!blockedUntilStr) return '';
    const diff = new Date(blockedUntilStr) - new Date();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m left`;
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          📊 Inventory Pipeline
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
        <div style={{ textAlign: 'center', padding: '50px' }}>Loading pipeline...</div>
      ) : (
        <div className="pipeline-container" style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '15px', minHeight: '60vh' }}>
          {statuses.map(status => {
            const items = filteredInventory.filter(item => item.status === status);
            const colorScheme = getStatusColor(status);

            return (
              <div 
                key={status} 
                className="pipeline-column" 
                style={{ 
                  flex: '0 0 280px', 
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
                      className="pipeline-card clickable"
                      onClick={() => setSelectedUnit(item)}
                      style={{
                        background: 'rgba(30, 30, 45, 0.6)',
                        border: `1px solid ${colorScheme.border}`,
                        borderRadius: '8px',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#fff', marginBottom: '4px' }}>
                        {item.unit_number}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                        <Building size={12} /> {item.projects?.name || 'Vrindavan'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#a855f7' }}>
                          ₹{(item.price || 0).toLocaleString('en-IN')}
                        </span>
                        <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                          {item.property_type}
                        </span>
                      </div>

                      {item.status === 'Blocked' && item.blocked_until && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#eab308', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(234, 179, 8, 0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                          <Clock size={11} />
                          {getRemainingBlockTime(item.blocked_until)}
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
                      No units
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details / Action Drawer Modal */}
      {selectedUnit && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'rgba(30, 30, 45, 0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '25px', borderRadius: '16px', width: '90%', maxWidth: '450px', backdropFilter: 'blur(10px)' }}>
            <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              🔑 Unit Details: {selectedUnit.unit_number}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Project Name</label>
                <div style={{ fontWeight: '500' }}>{selectedUnit.projects?.name || 'N/A'}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Price</label>
                  <div style={{ fontWeight: '600', color: '#22c55e' }}>₹{(selectedUnit.price || 0).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Property Type</label>
                  <div>{selectedUnit.property_type || 'N/A'}</div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Current Status</label>
                <div style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '6px', fontSize: '12px', ...getStatusColor(selectedUnit.status) }}>
                  {selectedUnit.status}
                </div>
              </div>

              {selectedUnit.status === 'Blocked' && selectedUnit.blocked_until && (
                <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', padding: '10px', borderRadius: '8px', color: '#eab308', fontSize: '13px' }}>
                  <strong>Blocked Hold:</strong> {getRemainingBlockTime(selectedUnit.blocked_until)}
                </div>
              )}
            </div>

            {/* Actions Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedUnit.status === 'Available' && (
                <div style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
                  <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>
                    Block Unit Duration
                  </label>
                  <select 
                    class="form-control" 
                    value={blockDuration} 
                    onChange={e => setBlockDuration(e.target.value)}
                    style={{ marginBottom: '10px', background: '#1c1c28' }}
                  >
                    <option value="12">12 Hours</option>
                    <option value="24">24 Hours (1 Day)</option>
                    <option value="48">48 Hours (2 Days)</option>
                    <option value="72">72 Hours (3 Days)</option>
                  </select>
                  <button 
                    onClick={() => handleBlockUnit(selectedUnit.id)} 
                    class="btn btn-primary" 
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Lock size={16} /> Block/Hold Unit
                  </button>
                </div>
              )}

              {selectedUnit.status === 'Blocked' && (
                <button 
                  onClick={() => handleUnblockUnit(selectedUnit.id)} 
                  class="btn btn-primary" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#ef4444' }}
                >
                  <Unlock size={16} /> Release Block / Make Available
                </button>
              )}

              <button 
                onClick={() => setSelectedUnit(null)} 
                class="btn btn-secondary" 
                style={{ width: '100%' }}
              >
                Close Dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
