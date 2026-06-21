import { LocalNotifications } from '@capacitor/local-notifications';

export const scheduleFollowUpNotification = async (lead) => {
  if (!window.Capacitor) return;

  try {
    const hasPermission = await LocalNotifications.checkPermissions();
    if (hasPermission.display !== 'granted') {
      const request = await LocalNotifications.requestPermissions();
      if (request.display !== 'granted') {
        console.warn('Notifications permission denied');
        return;
      }
    }

    if (!lead.follow_up_date) return;

    // Schedule notification for follow up date at 9:00 AM local time
    const followUpDate = new Date(lead.follow_up_date + 'T09:00:00');
    
    // If the follow-up date has already passed, don't schedule it
    if (followUpDate.getTime() < Date.now()) {
      return; 
    }

    // Generate a unique 32-bit integer ID from lead UUID
    const numericId = Math.abs(
      lead.id.split('-').reduce((acc, part) => acc + parseInt(part, 16) || 0, 0)
    ) % 1000000;

    // Cancel existing notification for this lead to avoid duplicates
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: numericId }]
      });
    } catch (e) {
      // Ignored if it doesn't exist
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          title: '🔔 Follow-Up Reminder',
          body: `Contact ${lead.name} for ${lead.project || 'Vrindavan Estates'}\nPhone: ${lead.phone1}`,
          id: numericId,
          schedule: { at: followUpDate },
          sound: null,
          extra: { leadId: lead.id }
        }
      ]
    });
    console.log(`Successfully scheduled notification for lead ${lead.name} (${lead.id}) on ${followUpDate}`);
  } catch (error) {
    console.error('Failed to schedule local notification:', error);
  }
};

export const scheduleAllFollowUps = async (leads = []) => {
  if (!window.Capacitor || leads.length === 0) return;

  console.log(`Analyzing ${leads.length} leads for local reminders...`);
  // Get all active leads with follow-up date scheduled today or in future
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  
  const futureLeads = leads.filter(l => 
    l.follow_up_date && 
    l.follow_up_date >= todayStr && 
    l.booking_status !== 'Confirmed'
  );

  for (const lead of futureLeads) {
    await scheduleFollowUpNotification(lead);
  }
};

export const scheduleReminderNotification = async (reminder, leadName) => {
  if (!window.Capacitor) return;

  try {
    const hasPermission = await LocalNotifications.checkPermissions();
    if (hasPermission.display !== 'granted') {
      const request = await LocalNotifications.requestPermissions();
      if (request.display !== 'granted') {
        console.warn('Notifications permission denied');
        return;
      }
    }

    if (!reminder.reminder_date) return;

    // Parse reminder date and time (reminder_time is HH:MM or HH:MM AM/PM)
    const timeStr = reminder.reminder_time || '09:00';
    let [hours, minutes] = timeStr.split(':');
    let isPM = false;
    if (timeStr.toLowerCase().includes('pm')) {
      isPM = true;
    }
    hours = parseInt(hours);
    minutes = parseInt(minutes);
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    const reminderDateTime = new Date(`${reminder.reminder_date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    
    // Scheduled trigger is 15 minutes before follow-up
    const triggerTime = new Date(reminderDateTime.getTime() - 15 * 60 * 1000);

    // If trigger time has already passed, don't schedule
    if (triggerTime.getTime() < Date.now()) {
      return; 
    }

    // Generate numeric 32-bit ID
    const numericId = Math.abs(
      reminder.id.split('-').reduce((acc, part) => acc + parseInt(part, 16) || 0, 0)
    ) % 1000000;

    // Cancel existing
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: numericId }]
      });
    } catch (e) {}

    await LocalNotifications.schedule({
      notifications: [
        {
          title: '⏰ Upcoming Follow-Up Alert',
          body: `Follow-up with ${leadName || 'Customer'} is scheduled in 15 minutes at ${reminder.reminder_time}.`,
          id: numericId,
          schedule: { at: triggerTime },
          sound: null,
          extra: { leadId: reminder.lead_id }
        }
      ]
    });
    console.log(`Scheduled Capacitor alert for reminder ${reminder.id} at ${triggerTime}`);
  } catch (error) {
    console.error('Capacitor reminder notification schedule failed:', error);
  }
};

export const scheduleAllReminders = async (reminders = [], leads = []) => {
  if (!window.Capacitor || reminders.length === 0) return;

  const leadMap = {};
  leads.forEach(l => {
    leadMap[l.id] = l.name;
  });

  const nowStr = new Date().toISOString().split('T')[0];
  const upcomingReminders = reminders.filter(r => !r.is_read && r.reminder_date >= nowStr);

  console.log(`Scheduling ${upcomingReminders.length} upcoming Capacitor reminders...`);
  for (const rem of upcomingReminders) {
    const name = rem.leads?.name || leadMap[rem.lead_id] || 'Customer';
    await scheduleReminderNotification(rem, name);
  }
};
