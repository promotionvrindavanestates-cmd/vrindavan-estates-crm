import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { 
  Phone, MessageSquare, Plus, MoreHorizontal, User,
  ChevronRight, Calendar, Building, DollarSign, RefreshCw,
  ChevronLeft
} from 'lucide-react';

const STAGES = [
  { id: 'New', name: 'New Inquiries', statuses: ['New'], defaultStatus: 'New' },
  { id: 'Contacted', name: 'Contacted', statuses: ['Attempted', 'Connected', 'Warm', 'Cold', 'Interested'], defaultStatus: 'Connected' },
  { id: 'SiteVisit', name: 'Site Visits', statuses: ['Site Visit Scheduled', 'Site Visit Done'], defaultStatus: 'Site Visit Scheduled' },
  { id: 'Negotiation', name: 'Negotiations', statuses: ['Negotiation', 'Hot'], defaultStatus: 'Negotiation' },
  { id: 'Booked', name: 'Bookings', statuses: ['Booked'], defaultStatus: 'Booked' }
];

export default function LeadPipeline({ currentUser, onOpenLeadDrawer }) {
  // Column-specific states
  const [columnsData, setColumnsData] = useState({
    New: { leads: [], total: 0, page: 1, loading: false, hasMore: true },
    Contacted: { leads: [], total: 0, page: 1, loading: false, hasMore: true },
    SiteVisit: { leads: [], total: 0, page: 1, loading: false, hasMore: true },
    Negotiation: { leads: [], total: 0, page: 1, loading: false, hasMore: true },
    Booked: { leads: [], total: 0, page: 1, loading: false, hasMore: true }
  });

  // Mobile active column selector
  const [activeMobileColumn, setActiveMobileColumn] = useState('New');
  
  // Reload trigger
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Load first page for all columns on mount / reload
  useEffect(() => {
    STAGES.forEach(stage => {
      fetchColumnLeads(stage.id, 1, true);
    });
  }, [reloadTrigger]);

  const fetchColumnLeads = async (columnId, page = 1, reset = false) => {
    const stage = STAGES.find(s => s.id === columnId);
    if (!stage) return;

    setColumnsData(prev => ({
      ...prev,
      [columnId]: { ...prev[columnId], loading: true }
    }));

    try {
      // Query parameters for status columns
      // For groups like 'Contacted', we will query each status individually or fetch and filter
      // To support 50,000+ leads, we query the server using pagination.
      // But wait! The server's GET /api/leads supports filtering by a single status.
      // To fetch a multi-status group, we can make parallel queries or we can fetch them iteratively.
      // Let's perform parallel queries for all statuses in the column, combining the results.
      const limit = 15;
      const queries = stage.statuses.map(status => 
        api.getLeads({ 
          status, 
          page, 
          limit 
        })
      );
      
      const results = await Promise.all(queries);
      
      let combinedLeads = [];
      let totalCount = 0;
      
      results.forEach(res => {
        if (res && res.leads) {
          combinedLeads = combinedLeads.concat(res.leads);
          totalCount += res.total || 0;
        } else if (Array.isArray(res)) {
          combinedLeads = combinedLeads.concat(res);
          totalCount += res.length;
        }
      });

      // Sort by creation date descending
      combinedLeads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setColumnsData(prev => {
        const existingLeads = reset ? [] : prev[columnId].leads;
        const newLeadsList = reset ? combinedLeads : [...existingLeads, ...combinedLeads];
        
        // De-duplicate leads by ID just in case
        const uniqueLeadsMap = new Map();
        newLeadsList.forEach(l => uniqueLeadsMap.set(l.id, l));
        const uniqueLeads = Array.from(uniqueLeadsMap.values());

        return {
          ...prev,
          [columnId]: {
            leads: uniqueLeads,
            total: totalCount,
            page,
            loading: false,
            hasMore: combinedLeads.length >= (stage.statuses.length * limit)
          }
        };
      });
    } catch (err) {
      console.error(`Failed to fetch leads for column ${columnId}:`, err);
      setColumnsData(prev => ({
        ...prev,
        [columnId]: { ...prev[columnId], loading: false }
      }));
    }
  };

  // Scroll load more handler
  const handleColumnScroll = (e, columnId) => {
    const target = e.target;
    // Check if scrolled near bottom
    const isNearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 40;
    const colState = columnsData[columnId];
    
    if (isNearBottom && !colState.loading && colState.hasMore) {
      const nextPage = colState.page + 1;
      fetchColumnLeads(columnId, nextPage, false);
    }
  };

  // Drag and Drop implementation
  const handleDragStart = (e, lead, sourceColumnId) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      leadId: lead.id,
      sourceColumnId,
      leadName: lead.name,
      leadProject: lead.project,
      leadBudget: lead.budget
    }));
    e.currentTarget.style.opacity = '0.4';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
  };

  const handleDrop = async (e, targetColumnId) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { leadId, sourceColumnId } = JSON.parse(dataStr);
      
      if (sourceColumnId === targetColumnId) return;

      const targetStage = STAGES.find(s => s.id === targetColumnId);
      const newStatus = targetStage.defaultStatus;

      // Optimistic updates on client UI for fast responsiveness
      setColumnsData(prev => {
        const sourceCol = { ...prev[sourceColumnId] };
        const targetCol = { ...prev[targetColumnId] };
        
        const draggedLeadIdx = sourceCol.leads.findIndex(l => l.id === leadId);
        if (draggedLeadIdx === -1) return prev;
        
        const [draggedLead] = sourceCol.leads.splice(draggedLeadIdx, 1);
        draggedLead.status = newStatus;
        
        targetCol.leads.unshift(draggedLead);
        
        sourceCol.total = Math.max(sourceCol.total - 1, 0);
        targetCol.total += 1;

        return {
          ...prev,
          [sourceColumnId]: sourceCol,
          [targetColumnId]: targetCol
        };
      });

      // Server-side API update
      // First, get the lead fields
      const leadDetails = await api.getLeadById(leadId, currentUser.id, currentUser.role);
      await api.updateLead(leadId, {
        ...leadDetails,
        status: newStatus
      });

      // Trigger re-fetch for safety
      setReloadTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Drop handling failed:', err);
      alert('Failed to update lead status: ' + err.message);
      setReloadTrigger(prev => prev + 1);
    }
  };

  // Predefined shift action for mobile view (click instead of drag)
  const handleShiftColumn = async (lead, targetColumnId, sourceColumnId) => {
    try {
      const targetStage = STAGES.find(s => s.id === targetColumnId);
      const newStatus = targetStage.defaultStatus;

      const leadDetails = await api.getLeadById(lead.id, currentUser.id, currentUser.role);
      await api.updateLead(lead.id, {
        ...leadDetails,
        status: newStatus
      });

      alert(`Lead status updated to: ${newStatus}`);
      setReloadTrigger(prev => prev + 1);
    } catch (err) {
      alert('Shift failed: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'New': return 'badge badge-cold';
      case 'Hot': return 'badge badge-hot';
      case 'Warm': return 'badge badge-warm';
      case 'Cold': return 'badge badge-cold';
      case 'Booked': return 'badge badge-success';
      default: return 'badge badge-info';
    }
  };

  return (
    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 190px)' }}>
      <style>{`
        .kanban-board {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          flex: 1;
          overflow: hidden;
          padding-bottom: 10px;
        }
        .kanban-column {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          max-height: 100%;
          overflow: hidden;
          box-shadow: var(--shadow);
        }
        .kanban-column-header {
          padding: 14px 16px;
          border-bottom: 2px solid var(--border-color);
          font-weight: 700;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .kanban-leads-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .kanban-card {
          background: var(--bg-main);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 12px;
          cursor: grab;
          transition: var(--transition);
          position: relative;
        }
        .kanban-card:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: 0 4px 15px var(--primary-glow);
        }
        .kanban-card-title {
          font-weight: 700;
          font-size: 13px;
          color: var(--primary);
          margin-bottom: 6px;
        }
        .kanban-card-meta {
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        
        /* Mobile tab layouts */
        .mobile-kanban-tabs {
          display: none;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .mobile-kanban-tab {
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          color: var(--text-muted);
          white-space: nowrap;
          cursor: pointer;
        }
        .mobile-kanban-tab.active {
          background: var(--primary);
          color: #000;
          border-color: var(--primary);
        }

        @media (max-width: 992px) {
          .kanban-board {
            grid-template-columns: 1fr;
          }
          .kanban-column {
            display: none;
          }
          .kanban-column.mobile-active {
            display: flex;
            height: 100%;
          }
          .mobile-kanban-tabs {
            display: flex;
          }
        }
      `}</style>

      {/* Mobile Column selector tabs */}
      <div className="mobile-kanban-tabs">
        {STAGES.map(stage => {
          const count = columnsData[stage.id].total;
          return (
            <button 
              key={stage.id} 
              className={`mobile-kanban-tab ${activeMobileColumn === stage.id ? 'active' : ''}`}
              onClick={() => setActiveMobileColumn(stage.id)}
            >
              {stage.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Kanban Board Grid */}
      <div className="kanban-board">
        {STAGES.map(stage => {
          const colState = columnsData[stage.id];
          const isMobileActive = activeMobileColumn === stage.id;
          
          return (
            <div 
              key={stage.id} 
              className={`kanban-column ${isMobileActive ? 'mobile-active' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Column Header */}
              <div className="kanban-column-header">
                <span>{stage.name}</span>
                <span className="alerts-count" style={{ borderColor: 'rgba(223, 177, 91, 0.2)', fontSize: '10px' }}>
                  {colState.total} leads
                </span>
              </div>

              {/* Leads Card Container */}
              <div 
                className="kanban-leads-list" 
                onScroll={(e) => handleColumnScroll(e, stage.id)}
              >
                {colState.leads.length === 0 && !colState.loading ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    No leads in this stage.
                  </div>
                ) : (
                  colState.leads.map((l, index) => (
                    <div 
                      key={l.id || index}
                      className="kanban-card"
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, l, stage.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onOpenLeadDrawer && onOpenLeadDrawer(l.id)}
                    >
                      <div className="kanban-card-title">{l.name}</div>
                      <div className="kanban-card-meta">📁 Project: {l.project || 'N/A'}</div>
                      <div className="kanban-card-meta">💰 Budget: {l.budget || 'N/A'}</div>
                      <div className="kanban-card-meta">📞 Contact: {l.phone1}</div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <span className={getStatusBadge(l.status)} style={{ fontSize: '8px', padding: '1px 5px' }}>{l.status}</span>
                        
                        {/* Mobile column shifters */}
                        <div className="mobile-only-flex" style={{ display: 'none', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          {STAGES.findIndex(s => s.id === stage.id) > 0 && (
                            <button 
                              type="button" 
                              className="action-icon-btn" 
                              style={{ width: '20px', height: '20px' }} 
                              onClick={() => {
                                const idx = STAGES.findIndex(s => s.id === stage.id);
                                handleShiftColumn(l, STAGES[idx - 1].id, stage.id);
                              }}
                            >
                              <ChevronLeft size={10} />
                            </button>
                          )}
                          {STAGES.findIndex(s => s.id === stage.id) < STAGES.length - 1 && (
                            <button 
                              type="button" 
                              className="action-icon-btn" 
                              style={{ width: '20px', height: '20px' }} 
                              onClick={() => {
                                const idx = STAGES.findIndex(s => s.id === stage.id);
                                handleShiftColumn(l, STAGES[idx + 1].id, stage.id);
                              }}
                            >
                              <ChevronRight size={10} />
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  ))
                )}

                {colState.loading && (
                  <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-muted)', fontSize: '11px' }}>
                    Loading more leads...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Hide mobile shifter on desktop viewports */}
      <style>{`
        @media (max-width: 992px) {
          .mobile-only-flex {
            display: flex !important;
          }
        }
      `}</style>

    </div>
  );
}
