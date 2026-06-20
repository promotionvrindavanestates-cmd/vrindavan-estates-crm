import { LocalNotifications } from '@capacitor/local-notifications';

// Synthesize a premium audio bell chime using Web Audio API (no external MP3 asset dependency)
export const playChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playNote = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    const now = ctx.currentTime;
    // Premium dual-tone chime (E5 -> A5)
    playNote(659.25, now, 0.4);       // E5
    playNote(880.00, now + 0.12, 0.6); // A5
  } catch (err) {
    console.warn('Audio chime failed to play:', err);
  }
};

// Requests permission for both browser notifications and Capacitor mobile notifications
export const requestNotificationPermission = async () => {
  try {
    // 1. Web browser permissions
    if ('Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        await Notification.requestPermission();
      }
    }

    // 2. Capacitor mobile app permissions
    if (window.Capacitor) {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    }
  } catch (e) {
    console.error('Failed to request notifications permission:', e);
  }
};

// Dispatches cross-platform push alerts
export const showPushNotification = async (title, body, extra = {}) => {
  // Always play auditory feedback
  playChime();

  try {
    if (window.Capacitor) {
      // Mobile wrapped Capacitor alert
      const numericId = Math.floor(Math.random() * 1000000);
      await LocalNotifications.schedule({
        notifications: [
          {
            title: title,
            body: body,
            id: numericId,
            schedule: { at: new Date(Date.now() + 100) }, // Trigger immediately
            sound: null,
            extra: extra
          }
        ]
      });
      console.log('Mobile local notification scheduled:', title);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      // Browser desktop alert
      new Notification(title, {
        body: body,
        icon: '/favicon.ico'
      });
      console.log('Web browser Notification dispatched:', title);
    }
  } catch (e) {
    console.error('Error dispatching push notification:', e);
  }
};
