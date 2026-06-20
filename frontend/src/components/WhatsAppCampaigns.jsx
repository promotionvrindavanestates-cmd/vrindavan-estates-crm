import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { MessageSquare, Plus, Send, RefreshCw, Eye, ListFilter, Users } from 'lucide-react';

export default function WhatsAppCampaigns({ currentUser }) {
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('campaigns'); // 'campaigns', 'templates', 'logs'

  // Selected Campaign for Detail view
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [campaignLogs, setCampaignLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Template Form State
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Utility');
  const [templateBody, setTemplateBody] = useState('');

  // Campaign Builder State
  const [isAddingCampaign, setIsAddingCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // Filtering Recipients
  const [filterProject, setFilterProject] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterExecutive, setFilterExecutive] = useState('');
  const [filterSource, setFilterSource] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const temps = await api.getWhatsAppTemplates();
      setTemplates(temps);
      if (temps.length > 0) setSelectedTemplateId(temps[0].id);
      
      const camps = await api.getWhatsAppCampaigns();
      setCampaigns(camps);

      const lData = await api.getLeads();
      setLeads(lData);

      const empData = await api.getEmployees();
      setEmployees(empData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async (e) => {
    e.preventDefault();
    if (!templateName || !templateBody) return alert('Name and Body text are required');

    // Parse variables in text, e.g. {customer_name}
    const variables = [];
    const rx = /{([a-zA-Z0-9_]+)}/g;
    let match;
    while ((match = rx.exec(templateBody)) !== null) {
      if (!variables.includes(match[1])) variables.push(match[1]);
    }

    try {
      await api.createWhatsAppTemplate({
        name: templateName,
        category: templateCategory,
        body_text: templateBody,
        variables
      });
      alert('WhatsApp Template created successfully!');
      setIsAddingTemplate(false);
      setTemplateName('');
      setTemplateBody('');
      fetchInitialData();
    } catch (err) {
      alert(`Failed to save template: ${err.message}`);
    }
  };

  // Filter recipients matching campaign filters
  const getFilteredRecipients = () => {
    return leads.filter(l => {
      const matchProj = !filterProject || l.project === filterProject;
      const matchBudget = !filterBudget || l.budget === filterBudget;
      const matchCity = !filterCity || l.city === filterCity;
      const matchStatus = !filterStatus || l.status === filterStatus;
      const matchExec = !filterExecutive || l.assigned_employee_id === filterExecutive;
      const matchSource = !filterSource || l.lead_source === filterSource;
      return matchProj && matchBudget && matchCity && matchStatus && matchExec && matchSource;
    });
  };

  const handleLaunchCampaign = async (e) => {
    e.preventDefault();
    if (!campaignName || !selectedTemplateId) return alert('Campaign Name and Template are required');

    const recipients = getFilteredRecipients();
    if (recipients.length === 0) return alert('No recipients match selected filters! Cannot launch campaign.');

    if (!window.confirm(`Launch campaign "${campaignName}" to ${recipients.length} leads now?`)) return;

    const filters = {
      project: filterProject,
      budget: filterBudget,
      city: filterCity,
      status: filterStatus,
      assigned_employee_id: filterExecutive,
      lead_source: filterSource
    };

    try {
      await api.createWhatsAppCampaign(campaignName, selectedTemplateId, filters, recipients);
      alert(`WhatsApp Campaign "${campaignName}" launched successfully! Sending bulk queue...`);
      setIsAddingCampaign(false);
      setCampaignName('');
      fetchInitialData();
    } catch (err) {
      alert(`Campaign failed: ${err.message}`);
    }
  };

  const viewCampaignLogs = async (campaignId) => {
    setSelectedCampaignId(campaignId);
    setActiveSubTab('logs');
    setLogsLoading(true);
    try {
      const logs = await api.getWhatsAppCampaignLogs(campaignId);
      setCampaignLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  const getLogStatusStyle = (status) => {
    switch (status) {
      case 'Replied': return { bg: 'rgba(34, 197, 94, 0.1)', fg: '#22c55e' }; // Green
      case 'Read': return { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3b82f6' };  // Blue
      case 'Delivered': return { bg: 'rgba(6, 182, 212, 0.1)', fg: '#06b6d4' }; // Cyan
      case 'Sent': return { bg: 'rgba(234, 179, 8, 0.1)', fg: '#eab308' };  // Yellow
      case 'Failed': return { bg: 'rgba(239, 68, 68, 0.1)', fg: '#ef4444' }; // Red
      default: return { bg: 'rgba(255,255,255,0.05)', fg: '#fff' };
    }
  };

  const recipientsCount = getFilteredRecipients().length;
  const isAdmin = currentUser.role === 'admin';

  return (
    <div style={{ marginTop: '20px' }}>
      
      {/* Sub Tabs Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          class={`btn ${activeSubTab === 'campaigns' && !isAddingCampaign ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveSubTab('campaigns'); setIsAddingCampaign(false); setSelectedCampaignId(null); }}
        >
          🚀 Bulk Campaigns
        </button>
        <button 
          class={`btn ${activeSubTab === 'templates' && !isAddingTemplate ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveSubTab('templates'); setIsAddingTemplate(false); setSelectedCampaignId(null); }}
        >
          📝 WhatsApp Templates
        </button>
        {selectedCampaignId && (
          <button class="btn btn-primary" onClick={() => setActiveSubTab('logs')}>
            📊 Logs: {campaigns.find(c => c.id === selectedCampaignId)?.name || 'Campaign'}
          </button>
        )}
      </div>

      {/* Adding template form */}
      {isAddingTemplate ? (
        <div class="card">
          <h2>➕ Create WhatsApp Template</h2>
          <form onSubmit={handleAddTemplate} style={{ marginTop: '15px' }}>
            <div class="grid-2">
              <div class="form-group">
                <label>Template Name *</label>
                <input type="text" class="form-control" value={templateName} onChange={e => setTemplateName(e.target.value)} required placeholder="e.g. site_visit_followup" />
              </div>
              <div class="form-group">
                <label>Category</label>
                <select class="form-control" value={templateCategory} onChange={e => setTemplateCategory(e.target.value)}>
                  <option value="Utility">Utility / Transactional</option>
                  <option value="Marketing">Marketing / Offers</option>
                </select>
              </div>
            </div>

            <div class="form-group" style={{ marginTop: '15px' }}>
              <label>Message Body Text *</label>
              <textarea 
                class="form-control" 
                rows="5" 
                value={templateBody} 
                onChange={e => setTemplateBody(e.target.value)} 
                required 
                placeholder="Write your template. Use placeholder variables like {customer_name}, {project_name}, {price}, {location}, {executive_name}."
              />
            </div>

            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Variables checklist: Write exactly <code>{"{customer_name}"}</code> to substitute the client's name dynamically.
            </div>

            <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
              <button type="submit" class="btn btn-primary">Save Template</button>
              <button type="button" class="btn btn-secondary" onClick={() => setIsAddingTemplate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : isAddingCampaign ? (
        // Launch campaign builder
        <div class="card">
          <h2>🚀 Create Bulk WhatsApp Campaign</h2>
          <form onSubmit={handleLaunchCampaign} style={{ marginTop: '15px' }}>
            <div class="grid-2">
              <div class="form-group">
                <label>Campaign Name *</label>
                <input type="text" class="form-control" value={campaignName} onChange={e => setCampaignName(e.target.value)} required placeholder="e.g. Vrindavan Heights Launch" />
              </div>
              <div class="form-group">
                <label>Select WhatsApp Template *</label>
                <select class="form-control" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} required>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Campaign Filters */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', marginTop: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px', fontSize: '15px' }}>
                <ListFilter size={16} /> Filter Target Recipients
              </h3>
              <div class="grid-3">
                <div class="form-group">
                  <label>Project</label>
                  <input type="text" class="form-control" value={filterProject} onChange={e => setFilterProject(e.target.value)} placeholder="All projects" />
                </div>
                <div class="form-group">
                  <label>Budget</label>
                  <input type="text" class="form-control" value={filterBudget} onChange={e => setFilterBudget(e.target.value)} placeholder="All budgets" />
                </div>
                <div class="form-group">
                  <label>City</label>
                  <input type="text" class="form-control" value={filterCity} onChange={e => setFilterCity(e.target.value)} placeholder="All cities" />
                </div>
              </div>
              
              <div class="grid-3" style={{ marginTop: '15px' }}>
                <div class="form-group">
                  <label>Lead Status</label>
                  <select class="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="New">New</option>
                    <option value="Attempted">Attempted</option>
                    <option value="Connected">Connected</option>
                    <option value="Interested">Interested</option>
                    <option value="Hot">Hot</option>
                    <option value="Warm">Warm</option>
                    <option value="Cold">Cold</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Booked">Booked</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Assigned Executive</label>
                  <select class="form-control" value={filterExecutive} onChange={e => setFilterExecutive(e.target.value)}>
                    <option value="">All executives</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
                <div class="form-group">
                  <label>Lead Source</label>
                  <select class="form-control" value={filterSource} onChange={e => setFilterSource(e.target.value)}>
                    <option value="">All sources</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Google">Google</option>
                    <option value="Website">Website</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '15px', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} />
                <span>Selected Recipients: {recipientsCount} leads matched.</span>
              </div>
            </div>

            <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
              <button type="submit" class="btn btn-primary" disabled={recipientsCount === 0}>
                <Send size={14} /> Launch Campaign
              </button>
              <button type="button" class="btn btn-secondary" onClick={() => setIsAddingCampaign(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Campaigns registry view */}
          {activeSubTab === 'campaigns' && (
            <div class="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>🚀 Sent Campaigns Analytics</h2>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button class="btn btn-primary" onClick={() => setIsAddingCampaign(true)}>
                      <Send size={14} /> New Campaign
                    </button>
                  </div>
                )}
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Loading campaigns list...</div>
              ) : campaigns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No campaigns executed yet.</div>
              ) : (
                <div class="table-responsive">
                  <table class="leads-table">
                    <thead>
                      <tr>
                        <th>Date Launched</th>
                        <th>Campaign Name</th>
                        <th>Selected Template</th>
                        <th>Target Filter details</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map(camp => (
                        <tr key={camp.id}>
                          <td>{new Date(camp.created_at).toLocaleString()}</td>
                          <td>
                            <strong>{camp.name}</strong>
                          </td>
                          <td>{camp.whatsapp_templates ? camp.whatsapp_templates.name : 'Unknown template'}</td>
                          <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {Object.keys(camp.filters_used || {}).map(k => camp.filters_used[k] ? `${k}: ${camp.filters_used[k]}` : '').filter(Boolean).join(', ') || 'All Recipient Leads'}
                          </td>
                          <td>
                            <span style={{ 
                              fontSize: '11px', 
                              padding: '2px 8px', 
                              borderRadius: '12px',
                              backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                              color: '#22c55e', 
                              fontWeight: 600
                            }}>
                              {camp.status || 'Completed'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button class="btn btn-secondary" style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--primary)' }} onClick={() => viewCampaignLogs(camp.id)}>
                              <Eye size={12} /> View Logs
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Templates view tab */}
          {activeSubTab === 'templates' && (
            <div class="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>📝 Predefined Message Templates</h2>
                {isAdmin && (
                  <button class="btn btn-primary" onClick={() => setIsAddingTemplate(true)}>
                    <Plus size={16} /> Add Template
                  </button>
                )}
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Loading templates...</div>
              ) : templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No templates defined yet.</div>
              ) : (
                <div class="grid-2">
                  {templates.map(temp => (
                    <div key={temp.id} class="card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h4 style={{ color: 'var(--primary)' }}>{temp.name}</h4>
                        <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px' }}>{temp.category}</span>
                      </div>
                      
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)', fontSize: '13px', color: 'var(--text-main)', minHeight: '80px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                        {temp.body_text}
                      </div>

                      {temp.variables && temp.variables.length > 0 && (
                        <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          Variables: {temp.variables.map(v => `{${v}}`).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Logs sub tab view */}
          {activeSubTab === 'logs' && selectedCampaignId && (
            <div class="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>📊 Message Logs details</h2>
                <button class="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => viewCampaignLogs(selectedCampaignId)}>
                  <RefreshCw size={12} /> Refresh logs
                </button>
              </div>

              {logsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Loading campaign log entries...</div>
              ) : campaignLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No logs matched.</div>
              ) : (
                <div class="table-responsive">
                  <table class="leads-table">
                    <thead>
                      <tr>
                        <th>Recipient Customer</th>
                        <th>WhatsApp Phone</th>
                        <th>Message Text Sent</th>
                        <th>Delivery Status</th>
                        <th>Response Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignLogs.map(log => {
                        const style = getLogStatusStyle(log.status);
                        return (
                          <tr key={log.id}>
                            <td>
                              <strong>{log.leads ? log.leads.name : 'Unknown Customer'}</strong>
                            </td>
                            <td>{log.phone || '-'}</td>
                            <td style={{ fontSize: '12px', maxWidth: '350px', whiteSpace: 'normal', color: 'var(--text-main)' }}>
                              {log.message_text}
                            </td>
                            <td>
                              <span style={{ 
                                display: 'inline-block',
                                fontSize: '11px',
                                padding: '2px 8px', 
                                borderRadius: '12px',
                                fontWeight: 600,
                                backgroundColor: style.bg,
                                color: style.fg
                              }}>
                                {log.status}
                              </span>
                            </td>
                            <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {log.response_details || '-'}
                            </td>
                          </tr>
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

    </div>
  );
}
