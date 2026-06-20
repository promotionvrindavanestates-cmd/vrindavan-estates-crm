import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Plus, Edit2, Trash2, MapPin, FileText, Link, Shield } from 'lucide-react';

export default function ProjectMaster({ currentUser }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [rera, setRera] = useState('');
  const [mvda, setMvda] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [description, setDescription] = useState('');
  const [approvalDetails, setApprovalDetails] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (project) => {
    setIsEditing(true);
    setEditingId(project.id);
    setName(project.name);
    setType(project.type || '');
    setLocation(project.location || '');
    setRera(project.rera || '');
    setMvda(project.mvda || '');
    setMapLink(project.map_link || '');
    setDescription(project.description || '');
    setApprovalDetails(project.approval_details || '');
    // Coordinates are stored in price_list_url if using cloud database/migration schema:
    if (project.price_list_url && project.price_list_url.includes(',')) {
      const parts = project.price_list_url.split(',');
      setLatitude(parts[0]);
      setLongitude(parts[1]);
    } else {
      setLatitude(project.latitude || '');
      setLongitude(project.longitude || '');
    }
  };

  const handleReset = () => {
    setIsEditing(false);
    setEditingId(null);
    setName('');
    setType('');
    setLocation('');
    setRera('');
    setMvda('');
    setMapLink('');
    setDescription('');
    setApprovalDetails('');
    setLatitude('');
    setLongitude('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return alert('Project Name is required');

    // Combine lat/lng in price_list_url to support standard schema if lat/lng columns aren't seeded yet
    const priceListUrl = (latitude && longitude) ? `${latitude},${longitude}` : '';

    const payload = {
      name,
      type,
      location,
      rera,
      mvda,
      map_link: mapLink,
      price_list_url: priceListUrl,
      description,
      approval_details: approvalDetails,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null
    };

    try {
      if (isEditing) {
        await api.updateProject(editingId, payload);
        alert('Project updated successfully!');
      } else {
        await api.createProject(payload);
        alert('Project created successfully!');
      }
      handleReset();
      fetchProjects();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.deleteProject(id);
      fetchProjects();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div class="card" style={{ marginTop: '20px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        🏢 Project Master Directory
      </h2>

      {/* Admin project input form */}
      {isAdmin && (
        <form onSubmit={handleSubmit} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '25px' }}>
          <h3 style={{ marginBottom: '15px' }}>{isEditing ? '✏️ Edit Project' : '➕ Add New Project'}</h3>
          
          <div class="grid-3">
            <div class="form-group">
              <label>Project Name *</label>
              <input type="text" class="form-control" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Vrindavan Heights" />
            </div>
            <div class="form-group">
              <label>Project Type</label>
              <select class="form-control" value={type} onChange={e => setType(e.target.value)}>
                <option value="">Select Type</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Township">Township</option>
                <option value="Mixed Use">Mixed Use</option>
              </select>
            </div>
            <div class="form-group">
              <label>Location / Address</label>
              <input type="text" class="form-control" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Chhatikara Road, Vrindavan" />
            </div>
          </div>

          <div class="grid-3" style={{ marginTop: '15px' }}>
            <div class="form-group">
              <label>RERA Number</label>
              <input type="text" class="form-control" value={rera} onChange={e => setRera(e.target.value)} placeholder="e.g. UPRERAPRJ12345" />
            </div>
            <div class="form-group">
              <label>Approval Authority (MVDA etc)</label>
              <input type="text" class="form-control" value={mvda} onChange={e => setMvda(e.target.value)} placeholder="e.g. MVDA Approved" />
            </div>
            <div class="form-group">
              <label>Google Maps Link</label>
              <input type="text" class="form-control" value={mapLink} onChange={e => setMapLink(e.target.value)} placeholder="https://maps.google.com/..." />
            </div>
          </div>

          {/* Latitude & Longitude Geofence settings */}
          <div class="grid-3" style={{ marginTop: '15px' }}>
            <div class="form-group">
              <label>Project Latitude (for GPS Geofencing)</label>
              <input type="number" step="any" class="form-control" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 27.5650" />
            </div>
            <div class="form-group">
              <label>Project Longitude (for GPS Geofencing)</label>
              <input type="number" step="any" class="form-control" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. 77.6850" />
            </div>
            <div class="form-group">
              <label>Approval Status Details</label>
              <input type="text" class="form-control" value={approvalDetails} onChange={e => setApprovalDetails(e.target.value)} placeholder="e.g. 143 Approved, Freehold" />
            </div>
          </div>

          <div class="form-group" style={{ marginTop: '15px' }}>
            <label>Project Description</label>
            <textarea class="form-control" rows="3" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe project layout, amenities, price ranges, nearby landmarks..."></textarea>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button type="submit" class="btn btn-primary">{isEditing ? 'Save Changes' : 'Create Project'}</button>
            <button type="button" class="btn btn-secondary" onClick={handleReset}>Cancel</button>
          </div>
        </form>
      )}

      {/* Projects list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>Loading projects list...</div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No projects defined yet.</div>
      ) : (
        <div class="grid-2">
          {projects.map(project => (
            <div key={project.id} class="card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <h3 style={{ color: 'var(--primary)' }}>{project.name}</h3>
                <span style={{ fontSize: '12px', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px' }}>
                  {project.type || 'Standard'}
                </span>
              </div>

              {project.description && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '15px', lineHeight: '1.4' }}>
                  {project.description}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} style={{ color: 'var(--primary)' }} />
                  <span>{project.location || 'No location address'}</span>
                </div>
                {project.rera && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} style={{ color: 'var(--color-success)' }} />
                    <span>RERA ID: <strong>{project.rera}</strong></span>
                  </div>
                )}
                {project.approval_details && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} style={{ color: 'var(--color-info)' }} />
                    <span>Approvals: {project.approval_details}</span>
                  </div>
                )}
                {(project.latitude || project.price_list_url) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>📍 GPS: {project.latitude || project.price_list_url.split(',')[0]} , {project.longitude || project.price_list_url.split(',')[1]} (Geofenced SITE)</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {project.map_link ? (
                  <a href={project.map_link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--color-info)' }}>
                    <Link size={12} /> View Location on Map
                  </a>
                ) : <span />}

                {isAdmin && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button class="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => handleEdit(project)} title="Edit Project">
                      <Edit2 size={13} />
                    </button>
                    <button class="btn btn-secondary" style={{ padding: '6px 10px', color: '#ef4444' }} onClick={() => handleDelete(project.id)} title="Delete Project">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
