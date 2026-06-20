import React, { useState, useEffect } from 'react';
import { api, setAuthToken } from './utils/api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import LeadTable from './components/LeadTable';
import LeadModal from './components/LeadModal';
import CallLogModal from './components/CallLogModal';
import EmployeeMgmt from './components/EmployeeMgmt';
import BackupMgmt from './components/BackupMgmt';
import AuditTrailModal from './components/AuditTrailModal';
import ProjectMaster from './components/ProjectMaster';
import InventoryMgmt from './components/InventoryMgmt';
import BookingsRegistry from './components/BookingsRegistry';
import WhatsAppCampaigns from './components/WhatsAppCampaigns';
import ReportsAnalytics from './components/ReportsAnalytics';
import LeadDetailsModal from './components/LeadDetailsModal';
import RemindersModal from './components/RemindersModal';
import { LogOut, Home, Users, Database, FileSpreadsheet, KeyRound, BellRing, Building, LayoutGrid, MessageSquare, BarChart3, Receipt } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCloud, setIsCloud] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Active View Tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // Core Data
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Modal Control
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedLeadForEdit, setSelectedLeadForEdit] = useState(null);

  const [callLogModalOpen, setCallLogModalOpen] = useState(false);
  const [selectedLeadForCall, setSelectedLeadForCall] = useState(null);
  
  // History Audit Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedLeadForHistory, setSelectedLeadForHistory] = useState(null);
  
  // Reminders Modal State
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [remindersCount, setRemindersCount] = useState(0);

  // Check login on startup
  useEffect(() => {
    const token = localStorage.getItem('token');
    const cloud = localStorage.getItem('isCloud') === 'true';
    setIsCloud(cloud);
    if (token) {
      checkSession();
    } else {
      setAuthLoading(false);
    }
  }, []);

  // Check if session token is valid
  const checkSession = async () => {
    try {
      const user = await api.getCurrentUser();
      setCurrentUser(user);
      fetchCRMData(user);
    } catch (e) {
      console.error('Session validation failed:', e);
      setAuthToken('');
      localStorage.removeItem('isCloud');
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchCRMData = async (user = currentUser) => {
    if (!user) return;
    setDataLoading(true);
    try {
      // Limit to 100 on startup to prevent crashing on large datasets
      const leadsData = await api.getLeads({ limit: 100, page: 1 });
      setLeads(leadsData.leads || leadsData);
      
      // Fetch active follow-ups count from widgets API
      const widgets = await api.getReminderWidgets();
      setRemindersCount(widgets.today || 0);

      if (window.Capacitor) {
        try {
          const { scheduleAllFollowUps } = await import('./utils/localNotifications');
          await scheduleAllFollowUps(leadsData.leads || leadsData);
        } catch (e) {
          console.error('Failed to schedule notifications:', e);
        }
      }

      if (user.role === 'admin') {
        const employeesData = await api.getEmployees();
        setEmployees(employeesData);
      }
    } catch (err) {
      console.error('Failed to load CRM data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleLoginSuccess = (user, cloudStatus) => {
    setCurrentUser(user);
    setIsCloud(cloudStatus);
    localStorage.setItem('isCloud', cloudStatus ? 'true' : 'false');
    fetchCRMData(user);
  };

  const handleLogout = () => {
    setAuthToken('');
    localStorage.removeItem('isCloud');
    setCurrentUser(null);
    setLeads([]);
    setEmployees([]);
    setActiveTab('dashboard');
  };

  // Lead CRUD Operations
  const handleSaveLead = async (leadData) => {
    if (selectedLeadForEdit) {
      // Edit mode
      await api.updateLead(selectedLeadForEdit.id, leadData);
    } else {
      // Add mode
      await api.createLead(leadData);
    }
    fetchCRMData();
  };

  const handleDeleteLead = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this lead?");
    if (!confirmDelete) return;

    try {
      await api.deleteLead(id);
      fetchCRMData();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSelectLeadFromDashboard = (lead) => {
    // Open call logger for the selected lead from dashboard follow-ups
    setSelectedLeadForCall(lead);
    setCallLogModalOpen(true);
  };

  const handleReassignEmployee = async (lead) => {
    const empId = window.prompt(
      `Enter Employee ID to assign to "${lead.name}":\n\n` + 
      employees.map(e => `${e.full_name}: ${e.id}`).join('\n')
    );
    if (!empId) return;

    const matchedEmp = employees.find(e => e.id === empId || e.full_name.toLowerCase().includes(empId.toLowerCase()));
    if (!matchedEmp) {
      alert("Invalid employee ID or name.");
      return;
    }

    try {
      await api.updateLead(lead.id, { ...lead, assigned_employee_id: matchedEmp.id });
      fetchCRMData();
    } catch (err) {
      alert(`Failed to assign lead: ${err.message}`);
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--primary)', fontSize: '18px' }}>
        <div>Loading Vrindavan Estates CRM Portal...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Daily Follow-Ups Alert Reminder Notification count (fetched via server-side reminders API)
  const todayReminderCount = remindersCount;

  return (
    <div class="app-container">
      <div class="main-content">
        
        {/* Demo Mode Banner fallback info */}
        {!isCloud && (
          <div class="demo-banner">
            <span>⚠️ DEMO MODE: Currently using local JSON storage database.json.</span>
            <span>Configure <strong style={{ color: '#fff' }}>SUPABASE_URL</strong> and <strong style={{ color: '#fff' }}>SUPABASE_KEY</strong> in backend `.env` for production cloud storage.</span>
          </div>
        )}

        {/* Brand Header & User Info */}
        <div class="top-navbar">
          <div class="brand-section">
            <span class="brand-logo">🕉️</span>
            <div>
              <h1 class="brand-name">Vrindavan Estates</h1>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>PREMIUM CRM PORTAL</div>
            </div>
          </div>
          
          <div class="user-controls">
            <div 
              onClick={() => {
                console.log("Reminder clicked");
                setRemindersOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: todayReminderCount > 0 ? 'var(--color-info-bg)' : 'var(--bg-card)',
                color: todayReminderCount > 0 ? 'var(--color-info)' : 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                border: todayReminderCount > 0 ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid var(--border-color)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title={`${todayReminderCount} follow-ups scheduled for today`}
            >
              <BellRing size={14} class={todayReminderCount > 0 ? "bell-animation" : ""} />
              <span>{todayReminderCount} Reminders</span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{currentUser.full_name}</div>
              <div style={{ fontSize: '11px', color: 'var(--primary)', textTransform: 'capitalize' }}>Role: {currentUser.role}</div>
            </div>

            <button class="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={handleLogout} title="Log Out">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div class="nav-tabs" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div 
            class={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Home size={15} /> Dashboard
          </div>
          <div 
            class={`nav-tab ${activeTab === 'leads' ? 'active' : ''}`}
            onClick={() => setActiveTab('leads')}
          >
            <FileSpreadsheet size={15} /> Leads Manager
          </div>
          <div 
            class={`nav-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <Building size={15} /> Projects
          </div>
          <div 
            class={`nav-tab ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <LayoutGrid size={15} /> Inventory
          </div>
          <div 
            class={`nav-tab ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <Receipt size={15} /> Bookings
          </div>
          <div 
            class={`nav-tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
            onClick={() => setActiveTab('whatsapp')}
          >
            <MessageSquare size={15} /> WhatsApp
          </div>
          <div 
            class={`nav-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart3 size={15} /> Reports
          </div>
          {currentUser.role === 'admin' && (
            <div 
              class={`nav-tab ${activeTab === 'employees' ? 'active' : ''}`}
              onClick={() => setActiveTab('employees')}
            >
              <Users size={15} /> Employees
            </div>
          )}
          {currentUser.role === 'admin' && (
            <div 
              class={`nav-tab ${activeTab === 'backup' ? 'active' : ''}`}
              onClick={() => setActiveTab('backup')}
            >
              <Database size={15} /> Imports & Backups
            </div>
          )}
        </div>

        {/* Main Tab Views Switcher */}
        {dataLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Refreshing database data...
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard 
                leads={leads} 
                employees={employees} 
                onSelectLead={handleSelectLeadFromDashboard} 
              />
            )}

            {activeTab === 'leads' && (
              <LeadTable 
                leads={leads} 
                employees={employees} 
                currentUser={currentUser}
                onAddLead={() => {
                  setSelectedLeadForEdit(null);
                  setLeadModalOpen(true);
                }}
                onEditLead={(lead) => {
                  setSelectedLeadForEdit(lead);
                  setLeadModalOpen(true);
                }}
                onDeleteLead={handleDeleteLead}
                onLogCall={(lead) => {
                  setSelectedLeadForCall(lead);
                  setCallLogModalOpen(true);
                }}
                onAssignLead={handleReassignEmployee}
                onViewHistory={(lead) => {
                  setSelectedLeadForHistory(lead);
                  setHistoryModalOpen(true);
                }}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectMaster currentUser={currentUser} />
            )}

            {activeTab === 'inventory' && (
              <InventoryMgmt currentUser={currentUser} />
            )}

            {activeTab === 'bookings' && (
              <BookingsRegistry currentUser={currentUser} />
            )}

            {activeTab === 'whatsapp' && (
              <WhatsAppCampaigns currentUser={currentUser} />
            )}

            {activeTab === 'reports' && (
              <ReportsAnalytics currentUser={currentUser} />
            )}

            {activeTab === 'employees' && currentUser.role === 'admin' && (
              <EmployeeMgmt 
                employees={employees} 
                onRefreshEmployees={fetchCRMData} 
              />
            )}

            {activeTab === 'backup' && (
              <BackupMgmt 
                onRefreshLeads={fetchCRMData} 
                currentUser={currentUser}
              />
            )}
          </>
        )}

        {/* Lead CRUD Form Modal */}
        <LeadModal 
          isOpen={leadModalOpen} 
          onClose={() => setLeadModalOpen(false)} 
          onSave={handleSaveLead}
          lead={selectedLeadForEdit}
          employees={employees}
          currentUser={currentUser}
        />

        {/* Call Notes Outcome Modal */}
        <CallLogModal 
          isOpen={callLogModalOpen} 
          onClose={() => setCallLogModalOpen(false)} 
          lead={selectedLeadForCall}
          onSaveSuccess={fetchCRMData}
        />

        {/* Lead Journey details & GPS verification Modal */}
        <LeadDetailsModal 
          isOpen={historyModalOpen} 
          onClose={() => setHistoryModalOpen(false)} 
          lead={selectedLeadForHistory}
          onSaveSuccess={fetchCRMData}
        />

        {/* Reminders list & action shortcuts Modal */}
        <RemindersModal
          isOpen={remindersOpen}
          onClose={() => setRemindersOpen(false)}
          onSelectLead={handleSelectLeadFromDashboard}
          currentUser={currentUser}
        />

      </div>
    </div>
  );
}
