import { useState, useEffect } from 'react';
import NotificationManager, { type NotificationSettings as Settings, type NotificationStatus } from '@/lib/notification-manager';
import type { MessageState } from './types';

interface NotificationSettingsProps {
  onMessage: (message: MessageState | null) => void;
}

export default function NotificationSettings({ onMessage }: NotificationSettingsProps) {
  const [notificationSettings, setNotificationSettings] = useState<Settings | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadNotificationData();
  }, []);

  const loadNotificationData = async () => {
    try {
      const settings = NotificationManager.getSettings();
      const status = await NotificationManager.getStatus();
      setNotificationSettings(settings);
      setNotificationStatus(status);
    } catch (error) {
      console.error('Failed to load notification data:', error);
    }
  };

  const formatTimeAsReadable = (timeString: string): string => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const handleToggleReminders = async () => {
    if (!notificationSettings) return;

    setUpdating(true);
    try {
      const newEnabled = !notificationSettings.enabled;

      if (newEnabled) {
        // Request permission first
        const permission = await NotificationManager.requestPermission();
        if (permission !== 'granted') {
          onMessage({
            type: 'error',
            text: 'Notification permission is required to enable reminders. Please allow notifications in your browser settings.'
          });
          setUpdating(false);
          return;
        }

        // Show test notification
        await NotificationManager.showTestNotification();
      }

      // Update settings
      const newSettings = { ...notificationSettings, enabled: newEnabled };
      NotificationManager.saveSettings(newSettings);
      setNotificationSettings(newSettings);

      if (newEnabled && notificationStatus?.permission === 'granted') {
        await NotificationManager.scheduleNextReminder();
        onMessage({
          type: 'success',
          text: `Dinner reminders ${newEnabled ? 'enabled' : 'disabled'}. ${newEnabled ? 'You should see a test notification and the next reminder will be scheduled.' : ''}`
        });
      } else {
        onMessage({
          type: 'success',
          text: `Dinner reminders ${newEnabled ? 'enabled' : 'disabled'}.`
        });
      }

      // Reload status to get updated info
      await loadNotificationData();
    } catch (error) {
      console.error('Failed to toggle reminders:', error);
      onMessage({
        type: 'error',
        text: `Failed to ${notificationSettings.enabled ? 'disable' : 'enable'} reminders: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleTimeChange = async (time: string) => {
    if (!notificationSettings) return;

    setUpdating(true);
    try {
      const newSettings = { ...notificationSettings, reminderTime: time };
      NotificationManager.saveSettings(newSettings);
      setNotificationSettings(newSettings);

      if (newSettings.enabled && notificationStatus?.permission === 'granted') {
        await NotificationManager.scheduleNextReminder();
        onMessage({
          type: 'success',
          text: `Reminder time updated to ${formatTimeAsReadable(time)}. Next reminder scheduled accordingly.`
        });
      }
    } catch (error) {
      console.error('Failed to update reminder time:', error);
      onMessage({
        type: 'error',
        text: `Failed to update reminder time: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      const success = await NotificationManager.showTestNotification();
      if (success) {
        onMessage({
          type: 'success',
          text: 'Test notification sent! Check for the notification on your device.'
        });
      } else {
        onMessage({
          type: 'error',
          text: 'Failed to send test notification. Please check your notification permissions.'
        });
      }
    } catch (error) {
      onMessage({
        type: 'error',
        text: `Test notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  if (!notificationSettings || !notificationStatus) {
    return <div>Loading notification settings...</div>;
  }

  return (
    <div className="notification-section">
      <div className="status-header">
        <h2>🔔 Dinner Reminders</h2>
        <div className="status-indicator">
          <div className={`status-dot ${
            notificationSettings.enabled && notificationStatus.permission === 'granted'
              ? 'active'
              : 'warning'
          }`} />
          <span className={`status-text ${
            notificationSettings.enabled && notificationStatus.permission === 'granted'
              ? 'active'
              : 'warning'
          }`}>
            {notificationSettings.enabled && notificationStatus.permission === 'granted'
              ? 'Active'
              : notificationSettings.enabled
                ? 'Permission Needed'
                : 'Disabled'
            }
          </span>
        </div>
      </div>

      <div className="notification-controls">
        <div className="control-group">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={notificationSettings.enabled}
              onChange={handleToggleReminders}
              disabled={updating}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">
              {notificationSettings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {notificationSettings.enabled && (
          <div className="control-group">
            <label htmlFor="reminder-time">Reminder Time:</label>
            <input
              id="reminder-time"
              type="time"
              value={notificationSettings.reminderTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              disabled={updating}
              className="time-input"
            />
            <span className="time-display">
              ({formatTimeAsReadable(notificationSettings.reminderTime)})
            </span>
          </div>
        )}

        <div className="control-group">
          <button
            onClick={handleTestNotification}
            className="test-button secondary"
            disabled={updating || notificationStatus.permission !== 'granted'}
          >
            Send Test Notification
          </button>
        </div>
      </div>

      <div className="notification-info">
        <p className="info-text">
          💡 <strong>Tip:</strong> Notifications help you remember to log your daily meals.
          They work even when the app is closed!
        </p>

        {notificationStatus.permission !== 'granted' && (
          <p className="warning-text">
            ⚠️ Notification permission is required for reminders to work.
            Enable notifications in your browser settings.
          </p>
        )}
      </div>
    </div>
  );
}