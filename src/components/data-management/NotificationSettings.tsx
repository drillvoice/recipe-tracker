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

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!notificationSettings) return;

    setUpdating(true);
    try {
      if (enabled) {
        const permission = await NotificationManager.requestPermission();
        if (permission !== 'granted') {
          onMessage({
            type: 'error',
            text: 'Notification permission is required to enable dinner reminders. Please check your browser settings.'
          });
          setUpdating(false);
          return;
        }
      }

      const newSettings = { ...notificationSettings, enabled };
      NotificationManager.saveSettings(newSettings);
      setNotificationSettings(newSettings);

      if (enabled) {
        await NotificationManager.scheduleNextReminder();
        onMessage({
          type: 'success',
          text: `Dinner reminders enabled! You'll receive a notification daily at ${newSettings.reminderTime} (${formatTimeAsReadable(newSettings.reminderTime)}).`
        });
      } else {
        await NotificationManager.clearScheduler();
        onMessage({
          type: 'info',
          text: 'Dinner reminders disabled. You can re-enable them anytime.'
        });
      }

      await loadNotificationData();
    } catch (error) {
      onMessage({
        type: 'error',
        text: `Failed to ${enabled ? 'enable' : 'disable'} reminders: ${error instanceof Error ? error.message : 'Unknown error'}`
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

      await loadNotificationData();
    } catch (error) {
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
          text: 'Test notification sent! Check your notifications.'
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

  const handleScheduledTestNotification = async () => {
    try {
      const success = await NotificationManager.scheduleTestNotification();
      if (success) {
        onMessage({
          type: 'success',
          text: '🕐 Test notification scheduled for 15 minutes from now! The server will send it automatically.'
        });
      } else {
        onMessage({
          type: 'error',
          text: 'Failed to schedule test notification. Please check your authentication and permissions.'
        });
      }
    } catch (error) {
      onMessage({
        type: 'error',
        text: `Failed to schedule test notification: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const handleClearTestNotification = async () => {
    try {
      await NotificationManager.clearTestNotification();
      onMessage({
        type: 'success',
        text: 'Test notification cleared.'
      });
    } catch (error) {
      onMessage({
        type: 'error',
        text: `Failed to clear test notification: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  if (!notificationSettings || !notificationStatus) {
    return <div className="loading">Loading notification settings...</div>;
  }

  const statusVariant =
    notificationSettings.enabled && notificationStatus.permission === 'granted' && notificationStatus.supported
      ? 'active'
      : 'warning';

  const statusText = !notificationStatus.supported
    ? 'Not Supported'
    : notificationStatus.permission === 'denied'
    ? 'Permission Denied'
    : notificationSettings.enabled && notificationStatus.permission === 'granted'
    ? 'Active'
    : 'Disabled';

  return (
    <>
      <div className="status-header">
        <h2>🔔 Dinner Reminders</h2>
        <div className="status-indicator">
          <div className={`status-dot ${statusVariant}`} />
          <span className={`status-text ${statusVariant}`}>{statusText}</span>
        </div>
      </div>

      <div className="notification-controls">
        <div className="notification-info">
          <p className="notification-description">
            Get reminded to log your dinner each day. Never forget to track your meals!
          </p>

          <div className="notification-stats">
            <div className="notification-stat">
              <span>🔔</span>
              <span>Browser Support: <strong>{notificationStatus.supported ? 'Yes' : 'No'}</strong></span>
            </div>
            <div className="notification-stat">
              <span>✅</span>
              <span>Permission: <strong>{notificationStatus.permission}</strong></span>
            </div>
            {notificationSettings.enabled && (
              <div className="notification-stat">
                <span>⏰</span>
                <span>
                  Daily at: <strong>{formatTimeAsReadable(notificationSettings.reminderTime)}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="notification-controls-grid">
          <div className="notification-setting">
            <label className="notification-toggle">
              <input
                type="checkbox"
                checked={notificationSettings.enabled}
                onChange={(event) => handleNotificationToggle(event.target.checked)}
                disabled={!notificationStatus.supported || updating}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">Enable daily dinner reminders</span>
            </label>
          </div>

          {notificationSettings.enabled && notificationStatus.permission === 'granted' && (
            <div className="notification-setting">
              <label htmlFor="reminder-time" className="time-label">
                Reminder Time:
              </label>
              <div className="time-input-group">
                <input
                  id="reminder-time"
                  type="time"
                  value={notificationSettings.reminderTime}
                  onChange={(event) => handleTimeChange(event.target.value)}
                  min="18:00"
                  max="22:00"
                  className="time-input"
                  disabled={updating}
                />
                <span className="time-note">Between 6 PM - 10 PM</span>
              </div>
            </div>
          )}

          <div className="notification-actions">
            <button
              onClick={handleTestNotification}
              className="test-notification-button"
              disabled={!notificationStatus.supported || notificationStatus.permission !== 'granted' || updating}
            >
              🧪 Test Notification
            </button>
            <button
              onClick={handleScheduledTestNotification}
              className="test-notification-button scheduled-test"
              disabled={!notificationStatus.supported || notificationStatus.permission !== 'granted' || updating}
            >
              🕐 Test Server Notification (15min)
            </button>
            <button
              onClick={handleClearTestNotification}
              className="test-notification-button clear-test"
              disabled={!notificationStatus.supported || updating}
            >
              ❌ Clear Test
            </button>
          </div>
        </div>

        {!notificationStatus.supported && (
          <div className="notification-warning">
            <p>
              ⚠️ Push notifications are not supported in this browser. Try Chrome, Firefox, or Edge for the best experience.
            </p>
          </div>
        )}

        {notificationStatus.supported && notificationStatus.permission === 'denied' && (
          <div className="notification-warning">
            <p>
              ⚠️ Notification permission was denied. To enable reminders, please allow notifications in your browser settings and refresh the page.
            </p>
          </div>
        )}
      </div>
    </>
  );
}