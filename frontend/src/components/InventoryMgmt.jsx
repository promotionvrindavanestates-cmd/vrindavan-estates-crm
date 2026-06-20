import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Plus, Edit2, Trash2, Home, Landmark } from 'lucide-react';

export default function InventoryMgmt({ currentUser }) {
  const [projects, setProjects] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filter state
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Add/Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form values
  const [projectId, setProjectId] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [propertyType, setPropertyType] = useState('Flat');
  const [status, setStatus] = useState('Available');
  const [price, setPrice] = useState('');
  const [block, setBlock] = useState('');
  const [area, setArea] = useState(''); // in sq yards/sq ft

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const projs = await api.getProjects();
      setProjects(projs);
      if (projs.length > 0) {
        setProjectId(projs[0].id);
      }
      const invData = await api.getInventory();
      setInventory(invData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setIsEditing(true);
    setEditingId(item.id);
    setProjectId(item.project_id);
    setUnitNumber(item.unit_number);
    setPropertyType(item.property_type || 'Flat');
    setStatus(item.status || 'Available');
    setPrice(item.price || '');
    setBlock(item.details?.block || '');
    setArea(item.details?.area || '');
  };

  const handleReset = () => {
    setIsEditing(false);
    setEditingId(null);
    setUnitNumber('');
    setPropertyType('Flat');
    setStatus('Available');
    setPrice('');
    setBlock('');
    setArea('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId || !unitNumber) return alert('Project and Unit Number are required.');

    const payload = {
      project_id: projectId,
      unit_number: unitNumber,
      property_type: propertyType,
      status,
      price: price ? parseFloat(price) : 0,
      details: {
        block,
        area
      }
    };

    try {
      if (isEditing) {
        await api.updateInventory(editingId, payload);
        alert('Inventory unit updated successfully!');
      } else {
        await api.createInventory(payload);
        alert('Inventory unit created successfully!');
      }
      handleReset();
      fetchInitialData();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this inventory unit?')) return;
    try {
      await api.deleteInventory(id);
      fetchInitialData();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  // Filter logic
  const filteredInventory = inventory.filter(item => {
    const projMatch = !selectedProjectFilter || item.project_id === selectedProjectFilter;
    const statusMatch = !selectedStatusFilter || item.status === selectedStatusFilter;
    return projMatch && statusMatch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return { bg: 'rgba(34, 197, 94, 0.1)', fg: '#22c55e' };
      case 'Hold': return { bg: 'rgba(234, 179, 8, 0.1)', fg: '#eab308' };
      case 'Reserved': return { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3b82f6' };
      case 'Booked': return { bg: 'rgba(168, 85, 247, 0.1)', fg: '#a855f7' };
      case 'Sold': return { bg: 'rgba(100, 116, 139, 0.1)', fg: '#64748b' };
      default: return { bg: 'rgba(255, 255, 255, 0.05)', fg: '#fff' };
    }
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div class="card" style={{ marginTop: '20px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        🔑 Inventory Management
      </h2>

      {/* Admin CRUD Inventory input */}
      {isAdmin && (
        <form onSubmit={handleSubmit} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '25px' }}>
          <h3 style={{ marginBottom: '15px' }}>{isEditing ? '✏️ Edit Unit' : '➕ Add Inventory Unit'}</h3>
          
          <div class="grid-3">
            <div class="form-group">
              <label>Select Project *</label>
              <select class="form-control" value={projectId} onChange={e => setProjectId(e.target.value)} required>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div class="form-group">
              <label>Unit / Plot / Villa Number *</label>
              <input type="text" class="form-control" value={unitNumber} onChange={e => setUnitNumber(e.target.value)} required placeholder="e.g. Plot-45, Flat-201" />
            </div>
            <div class="form-group">
              <label>Property Type</label>
              <select class="form-control" value={propertyType} onChange={e => setPropertyType(e.target.value)}>
                <option value="Plot">Plot</option>
                <option value="Flat">Flat</option>
                <option value="Villa">Villa</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>
          </div>

          <div class="grid-4" style={{ marginTop: '15px' }}>
            <div class="form-group">
              <label>Status</label>
              <select class="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="Available">Available</option>
                <option value="Hold">Hold</option>
                <option value="Reserved">Reserved</option>
                <option value="Booked">Booked</option>
                <option value="Sold">Sold</option>
              </select>
            </div>
            <div class="form-group">
              <label>Price (₹)</label>
              <input type="number" class="form-control" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 4500000" />
            </div>
            <div class="form-group">
              <label>Block / Phase</label>
              <input type="text" class="form-control" value={block} onChange={e => setBlock(e.target.value)} placeholder="e.g. Sector-A, Phase-2" />
            </div>
            <div class="form-group">
              <label>Area Size (sq yds / sq ft)</label>
              <input type="text" class="form-control" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. 150 Sq Yds" />
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button type="submit" class="btn btn-primary">{isEditing ? 'Update Unit' : 'Add Unit'}</button>
            <button type="button" class="btn btn-secondary" onClick={handleReset}>Cancel</button>
          </div>
        </form>
      )}

      {/* Filters Toolbar */}
      <div style={{ display: 'flex', gap: '15px', background: 'rgba(255,255,255,0.01)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Filter by Project</label>
          <select class="form-control" value={selectedProjectFilter} onChange={e => setSelectedProjectFilter(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Filter by Status</label>
          <select class="form-control" value={selectedStatusFilter} onChange={e => setSelectedStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Hold">Hold</option>
            <option value="Reserved">Reserved</option>
            <option value="Booked">Booked</option>
            <option value="Sold">Sold</option>
          </select>
        </div>
      </div>

      {/* Inventory items Table / Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>Loading inventory...</div>
      ) : filteredInventory.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No inventory units match selection.</div>
      ) : (
        <div class="table-responsive">
          <table class="leads-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Unit / Number</th>
                <th>Property Type</th>
                <th>Block/Phase</th>
                <th>Area Size</th>
                <th>Price (₹)</th>
                <th>Status</th>
                {isAdmin && <th style={{ textAlign: 'center' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map(item => {
                const colors = getStatusColor(item.status);
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {item.projects ? item.projects.name : 'Unknown Project'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                        <Home size={14} />
                        <strong>{item.unit_number}</strong>
                      </div>
                    </td>
                    <td>{item.property_type || 'Flat'}</td>
                    <td>{item.details?.block || '-'}</td>
                    <td>{item.details?.area || '-'}</td>
                    <td>
                      {item.price ? (
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          ₹{parseFloat(item.price).toLocaleString('en-IN')}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span style={{ 
                        display: 'inline-block', 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '12px', 
                        fontWeight: 600,
                        backgroundColor: colors.bg, 
                        color: colors.fg,
                        border: `1px solid ${colors.fg}22`
                      }}>
                        {item.status || 'Available'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button class="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => handleEdit(item)} title="Edit Unit">
                            <Edit2 size={12} />
                          </button>
                          <button class="btn btn-secondary" style={{ padding: '6px 10px', color: '#ef4444' }} onClick={() => handleDelete(item.id)} title="Delete Unit">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
