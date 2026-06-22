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
const ReportsAnalytics = React.lazy(() => import('./components/ReportsAnalytics'));
import LeadDetailsModal from './components/LeadDetailsModal';
import RemindersModal from './components/RemindersModal';
import LeadDetailDrawer from './components/LeadDetailDrawer';
import LeadPipeline from './components/LeadPipeline';
import DuplicateManager from './components/DuplicateManager';
import InventoryPipeline from './components/InventoryPipeline';
import BookingPipeline from './components/BookingPipeline';
const CollectionDashboard = React.lazy(() => import('./components/CollectionDashboard'));
import { LogOut, Home, Users, Database, FileSpreadsheet, KeyRound, BellRing, Building, LayoutGrid, BarChart3, Receipt, Trello, Copy, ShieldAlert, BadgeCent, PhoneCall, Compass } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import CommandCenter from './components/CommandCenter';
import { requestNotificationPermission, showPushNotification } from './utils/pushNotifications';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCloud, setIsCloud] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Active View Tab
  const [activeTab, setActiveTab] = useState('command-center');
  const [kpiFilters, setKpiFilters] = useState(null);
  const [drawerLeadId, setDrawerLeadId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleOpenLeadDrawer = (leadId) => {
    setDrawerLeadId(leadId);
    setDrawerOpen(true);
  };

  const handleDrillDown = (metricName, filterParams) => {
    if (metricName === 'Total Revenue') {
      setActiveTab('bookings');
    } else {
      setKpiFilters(filterParams);
      setActiveTab('leads');
    }
  };


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
  const [activeToast, setActiveToast] = useState(null);
  
  // 15-minute advance reminder check state
  const [activeAlertReminder, setActiveAlertReminder] = useState(null);

  // Keep track of when data was last updated for dashboard reloading
  const [lastUpdated, setLastUpdated] = useState(Date.now());

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

  // Polling Alerts Sync hook
  useEffect(() => {
    if (!currentUser) return;

    requestNotificationPermission();

    let lastPollTime = new Date().toISOString();

    const pollAlerts = async () => {
      try {
        const res = await api.getNotificationsAlerts(lastPollTime);
        lastPollTime = res.timestamp || new Date().toISOString();

        const { newLeads, newBookings, dueReminders, missedReminders } = res;

        // 1. Process New Leads
        newLeads.forEach(lead => {
          const title = '📥 New Lead Assigned';
          const body = `Lead "${lead.name}" has been assigned to you for "${lead.project || 'Vrindavan Estates'}".`;
          showPushNotification(title, body, { leadId: lead.id });
          setActiveToast({ title, body, lead });
        });

        // 2. Process New Bookings
        newBookings.forEach(booking => {
          const title = '🎉 Booking Confirmed!';
          const body = `Unit ${booking.unit_number || 'N/A'} booked for "${booking.leads ? booking.leads.name : 'Unknown'}" in "${booking.projects ? booking.projects.name : 'N/A'}".`;
          showPushNotification(title, body, { bookingId: booking.id });
          setActiveToast({ title, body });
        });

        // 3. Process Due/Missed Reminders
        const alertedIds = JSON.parse(sessionStorage.getItem('alerted_reminders') || '[]');
        let updatedAlerted = false;

        dueReminders.forEach(r => {
          if (!alertedIds.includes(r.id)) {
            alertedIds.push(r.id);
            updatedAlerted = true;
            const title = '🔔 Due Follow-Up Reminder';
            const body = `${r.title} (${r.type}) is due now.`;
            showPushNotification(title, body, { reminderId: r.id });
            setActiveToast({ title, body, lead: r.leads });
          }
        });

        missedReminders.forEach(r => {
          if (!alertedIds.includes(r.id)) {
            alertedIds.push(r.id);
            updatedAlerted = true;
            const title = '⚠️ Missed Follow-Up Reminder';
            const body = `Follow-up "${r.title}" scheduled for ${r.reminder_date} was missed.`;
            showPushNotification(title, body, { reminderId: r.id });
            setActiveToast({ title, body, lead: r.leads });
          }
        });

        if (updatedAlerted) {
          sessionStorage.setItem('alerted_reminders', JSON.stringify(alertedIds));
        }

        // Keep reminders badge count synced
        const widgets = await api.getReminderWidgets();
        setRemindersCount(widgets.today || 0);

      } catch (err) {
        console.warn('Notification polling error:', err);
      }
    };

    pollAlerts();
    const timerId = setInterval(pollAlerts, 60000);
    return () => clearInterval(timerId);
  }, [currentUser]);

  // Toast Auto-Dismiss
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => setActiveToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  // 15-minute advance reminder check poller
  useEffect(() => {
    if (!currentUser) return;

    const checkUpcomingReminders = async () => {
      try {
        const remindersList = await api.getReminders();
        const todayStr = new Date().toISOString().split('T')[0];
        const now = Date.now();

        const notifiedList = JSON.parse(sessionStorage.getItem('notified_15min_reminders') || '[]');
        let updatedNotified = false;

        for (const r of remindersList) {
          if (r.is_read) continue;
          if (r.reminder_date !== todayStr) continue;

          // Parse reminder time
          let reminderTimeStr = r.reminder_time || '09:00:00';
          let reminderDateTime = null;

          // Handle typical formats like HH:MM:SS or HH:MM
          const timeParts = reminderTimeStr.split(':');
          if (timeParts.length >= 2) {
            const hours = parseInt(timeParts[0]);
            const minutes = parseInt(timeParts[1]);
            const seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;
            reminderDateTime = new Date();
            reminderDateTime.setHours(hours, minutes, seconds, 0);
          }

          if (!reminderDateTime) continue;

          const diffMins = (reminderDateTime.getTime() - now) / 60000;

          // If reminder is scheduled within the next 15 minutes (or currently due/overdue within 5 minutes)
          if (diffMins >= -5 && diffMins <= 15) {
            if (!notifiedList.includes(r.id)) {
              notifiedList.push(r.id);
              updatedNotified = true;

              const title = '🔔 Upcoming Follow-Up';
              const body = `Follow-up for ${r.leads ? r.leads.name : 'Lead'} is scheduled in ${Math.round(diffMins)} minutes (${r.reminder_time}).`;

              // Trigger standard browser notification
              if (Notification.permission === 'granted') {
                new Notification(title, { body });
              }

              // Trigger Capacitor notification if available
              if (window.Capacitor) {
                try {
                  showPushNotification(title, body, { reminderId: r.id });
                } catch (err) {
                  console.warn('Capacitor notification error:', err);
                }
              }

              // Display interactive bottom-right popup
              setActiveAlertReminder(r);
            }
          }
        }

        if (updatedNotified) {
          sessionStorage.setItem('notified_15min_reminders', JSON.stringify(notifiedList));
        }
      } catch (error) {
        console.error('Error checking upcoming reminders:', error);
      }
    };

    // Request Notification Permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    checkUpcomingReminders();
    const interval = setInterval(checkUpcomingReminders, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Mobile call logs synchronization poller (APK only)
  useEffect(() => {
    if (!currentUser) return;
    if (!window.Capacitor) return; // Android APK only

    const syncAndroidCallLogs = async () => {
      // Access callLog Cordova plugin if loaded
      const callLog = window.plugins && window.plugins.callLog;
      if (!callLog) return;

      const hasReadPermission = () => {
        return new Promise((resolve) => {
          callLog.hasReadPermission(resolve, () => resolve(false));
        });
      };

      const requestReadPermission = () => {
        return new Promise((resolve) => {
          callLog.requestReadPermission(() => resolve(true), () => resolve(false));
        });
      };

      const fetchCallLogs = (sinceMs) => {
        return new Promise((resolve) => {
          const filters = sinceMs ? [{ name: 'date', value: sinceMs, operator: '>=' }] : [];
          callLog.getCallLog(filters, resolve, () => resolve([]));
        });
      };

      try {
        let isGranted = await hasReadPermission();
        if (!isGranted) {
          isGranted = await requestReadPermission();
        }

        if (isGranted) {
          // Sync calls from last 24 hours
          const lastSyncTime = parseInt(localStorage.getItem('last_call_log_sync_time') || '0');
          const sinceMs = lastSyncTime || (Date.now() - 24 * 60 * 60 * 1000);
          
          const logs = await fetchCallLogs(sinceMs);
          if (logs && logs.length > 0) {
            // Map logs to match sync format
            // cordova-plugin-calllog fields: number, type (1: incoming, 2: outgoing, 3: missed), duration (secs), date (timestamp ms)
            const callTypeMap = { 1: 'Incoming', 2: 'Outgoing', 3: 'Missed' };
            const formatted = logs.map(l => ({
              id: `${l.type}_${l.number}_${l.date}`,
              number: l.number,
              type: callTypeMap[l.type] || 'Outgoing',
              duration: l.duration,
              timestamp: new Date(l.date).toISOString()
            }));

            const res = await api.syncMobileCalls(formatted);
            if (res.synced && res.synced.length > 0) {
              // Store sync time
              localStorage.setItem('last_call_log_sync_time', Date.now().toString());
              
              // Refresh details
              fetchCRMData();
              
              // Trigger a toast showing how many calls were synced
              setActiveToast({
                title: '📲 Mobile Calls Synced',
                body: `Successfully matched and synced ${res.synced.length} mobile call(s) with CRM leads.`
              });
            }
          }
        }
      } catch (err) {
        console.warn('Call Log Sync failed:', err);
      }
    };

    // Trigger sync immediately and check every 60 seconds
    syncAndroidCallLogs();
    const intervalId = setInterval(syncAndroidCallLogs, 60000);
    return () => clearInterval(intervalId);
  }, [currentUser]);

  const handlePopupCall = () => {
    if (activeAlertReminder && activeAlertReminder.leads) {
      setSelectedLeadForCall(activeAlertReminder.leads);
      setCallLogModalOpen(true);
    }
    setActiveAlertReminder(null);
  };

  const handlePopupWhatsApp = () => {
    if (activeAlertReminder && activeAlertReminder.leads) {
      const lead = activeAlertReminder.leads;
      const phone = lead.phone1 || '';
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const prefix = cleanPhone.length === 10 ? '91' : '';
      const message = `Hello ${lead.name || 'Client'},\n\nThis is a friendly reminder for our scheduled follow-up call at ${activeAlertReminder.reminder_time || ''}.\n\nRegards,\nIndiana Vrindavan Estates Team`;
      const url = `https://wa.me/${prefix}${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
    setActiveAlertReminder(null);
  };

  const handlePopupDismiss = () => {
    setActiveAlertReminder(null);
  };

  const fetchCRMData = async (user = currentUser) => {
    if (!user) return;
    setDataLoading(true);
    try {
      const promises = [
        api.getLeads({ limit: 20, page: 1 }),
        api.getReminderWidgets()
      ];
      if (user.role === 'admin') {
        promises.push(api.getEmployees());
      }

      const results = await Promise.all(promises);
      const leadsData = results[0];
      const widgets = results[1];
      const employeesData = user.role === 'admin' ? results[2] : null;

      setLeads(leadsData.leads || leadsData);
      setRemindersCount(widgets.today || 0);

      if (user.role === 'admin' && employeesData) {
        setEmployees(employeesData);
      }

      if (window.Capacitor) {
        try {
          const { scheduleAllFollowUps } = await import('./utils/localNotifications');
          await scheduleAllFollowUps(leadsData.leads || leadsData);
        } catch (e) {
          console.error('Failed to schedule notifications:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load CRM data:', err);
    } finally {
      setDataLoading(false);
      setLastUpdated(Date.now());
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
    setActiveTab('command-center');
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
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .slide-in-alert {
          animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {activeToast && (
        <div 
          className="slide-in-alert"
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 99999,
            background: 'rgba(26, 26, 26, 0.95)',
            border: '1px solid var(--primary)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
            padding: '16px',
            width: '320px',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            color: 'var(--text-main)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 700, fontSize: '13px' }}>
              <BellRing size={14} style={{ color: 'var(--primary)' }} />
              {activeToast.title}
            </span>
            <button 
              onClick={() => setActiveToast(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1
              }}
            >
              &times;
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.4, color: 'var(--text-main)' }}>
            {activeToast.body}
          </p>
          {activeToast.lead && (
            <button 
              className="btn btn-primary" 
              style={{ padding: '4px 8px', fontSize: '11px', alignSelf: 'flex-start', marginTop: '4px' }}
              onClick={() => {
                setSelectedLeadForEdit(activeToast.lead);
                setLeadModalOpen(true);
                setActiveToast(null);
              }}
            >
              Open Lead
            </button>
          )}
        </div>
      )}

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
            <img src="/favicon-192x192.png" alt="VE Logo" class="brand-logo-img" />
            <h1 class="brand-name">Vrindavan Estates</h1>
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
            class={`nav-tab ${activeTab === 'command-center' ? 'active' : ''}`}
            onClick={() => setActiveTab('command-center')}
          >
            <Compass size={15} style={{ color: 'var(--primary)' }} /> Daybook
          </div>
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
            class={`nav-tab ${activeTab === 'pipeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('pipeline')}
          >
            <Trello size={15} /> Pipeline
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
            class={`nav-tab ${activeTab === 'inventory-pipeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory-pipeline')}
          >
            <Trello size={15} /> Inventory Pipeline
          </div>
          <div 
            class={`nav-tab ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <Receipt size={15} /> Bookings
          </div>
          <div 
            class={`nav-tab ${activeTab === 'booking-pipeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('booking-pipeline')}
          >
            <Trello size={15} /> Booking Pipeline
          </div>
          <div 
            class={`nav-tab ${activeTab === 'collections' ? 'active' : ''}`}
            onClick={() => setActiveTab('collections')}
          >
            <BadgeCent size={15} /> Collections
          </div>
          <div 
            class={`nav-tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
            onClick={() => setActiveTab('whatsapp')}
          >
            <FaWhatsapp size={15} style={{ color: '#25D366' }} /> WhatsApp
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
              class={`nav-tab ${activeTab === 'duplicates' ? 'active' : ''}`}
              onClick={() => setActiveTab('duplicates')}
            >
              <Copy size={15} /> Merge Duplicates
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
        {dataLoading && activeTab !== 'dashboard' ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Refreshing database data...
          </div>
        ) : (
          <>
            {activeTab === 'command-center' && (
              <CommandCenter 
                leads={leads}
                employees={employees}
                currentUser={currentUser}
                onOpenLeadDrawer={handleOpenLeadDrawer}
                onRefreshData={fetchCRMData}
              />
            )}

            {activeTab === 'dashboard' && (
              <Dashboard 
                leads={leads} 
                employees={employees} 
                lastUpdated={lastUpdated}
                onSelectLead={handleSelectLeadFromDashboard} 
                onDrillDown={handleDrillDown}
                onOpenLeadDrawer={handleOpenLeadDrawer}
              />
            )}

            {activeTab === 'leads' && (
              <LeadTable 
                leads={leads} 
                employees={employees} 
                currentUser={currentUser}
                initialFilters={kpiFilters}
                onClearInitialFilters={() => setKpiFilters(null)}
                onOpenLeadDrawer={handleOpenLeadDrawer}
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

            {activeTab === 'pipeline' && (
              <LeadPipeline 
                currentUser={currentUser}
                onOpenLeadDrawer={handleOpenLeadDrawer}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectMaster currentUser={currentUser} />
            )}

            {activeTab === 'inventory' && (
              <InventoryMgmt currentUser={currentUser} />
            )}

            {activeTab === 'inventory-pipeline' && (
              <InventoryPipeline currentUser={currentUser} />
            )}

            {activeTab === 'bookings' && (
              <BookingsRegistry currentUser={currentUser} />
            )}

            {activeTab === 'booking-pipeline' && (
              <BookingPipeline currentUser={currentUser} />
            )}

            {activeTab === 'collections' && (
              <React.Suspense fallback={<div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading Collections...</div>}>
                <CollectionDashboard currentUser={currentUser} onOpenLeadDrawer={handleOpenLeadDrawer} />
              </React.Suspense>
            )}

            {activeTab === 'whatsapp' && (
              <WhatsAppCampaigns currentUser={currentUser} />
            )}

            {activeTab === 'reports' && (
              <React.Suspense fallback={<div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>Loading Reports...</div>}>
                <ReportsAnalytics currentUser={currentUser} onDrillDown={handleDrillDown} />
              </React.Suspense>
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

            {activeTab === 'duplicates' && currentUser.role === 'admin' && (
              <DuplicateManager employees={employees} />
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

        {/* Lead Detail Side Drawer */}
        <LeadDetailDrawer 
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          leadId={drawerLeadId}
          currentUser={currentUser}
          employees={employees}
          onRefreshData={fetchCRMData}
        />

        {/* Bottom-right Glassmorphic Follow-Up Popup Alert */}
        {activeAlertReminder && (
          <div 
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 1000,
              width: '350px',
              background: 'rgba(30, 41, 59, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.5)',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BellRing size={20} style={{ color: '#10B981' }} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#F8FAFC' }}>Upcoming Follow-Up</h4>
                <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '500' }}>Scheduled at {activeAlertReminder.reminder_time}</span>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: '#F1F5F9' }}>
                {activeAlertReminder.leads ? activeAlertReminder.leads.name : 'Unknown Lead'}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', wordBreak: 'break-word' }}>
                {activeAlertReminder.notes || activeAlertReminder.title}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handlePopupCall}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <PhoneCall size={14} /> Call
              </button>
              <button 
                onClick={handlePopupWhatsApp}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: '#25D366',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <FaWhatsapp size={15} /> WhatsApp
              </button>
              <button 
                onClick={handlePopupDismiss}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#E2E8F0',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}



      </div>
    </div>
  );
}
