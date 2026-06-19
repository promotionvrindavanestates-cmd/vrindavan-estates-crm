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
          title: '🕉️ Follow-Up Reminder',
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
