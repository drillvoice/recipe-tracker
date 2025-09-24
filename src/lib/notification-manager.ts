// notification-manager.ts - Push notification management for dinner reminders

import { getFCMToken, isFCMSupported } from './firebase';

export interface NotificationSettings {
  enabled: boolean;
  reminderTime: string; // HH:MM format (e.g., "20:00")
  lastScheduled?: string; // ISO date string
}

export interface NotificationStatus {
  permission: NotificationPermission;
  supported: boolean;
  fcmSupported: boolean;
  fcmToken?: string;
}

class NotificationManager {
  private static readonly STORAGE_KEY = 'notification-settings';
  private static readonly SCHEDULER_KEY = 'notification-scheduler';
  private static readonly DEFAULT_SETTINGS: NotificationSettings = {
    enabled: true,
    reminderTime: '20:00', // 8pm default
  };

  private static schedulerTimeout: NodeJS.Timeout | null = null;

  /**
   * Check if notifications are supported in this browser
   */
  static isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Get current notification permission status
   */
  static async getStatus(): Promise<NotificationStatus> {
    const supported = this.isSupported();
    const permission = supported ? Notification.permission : 'denied';
    const fcmSupported = isFCMSupported();

    let fcmToken: string | undefined;
    if (fcmSupported && permission === 'granted') {
      fcmToken = (await getFCMToken()) || undefined;
    }

    return {
      permission,
      supported,
      fcmSupported,
      fcmToken,
    };
  }

  /**
   * Request notification permission from user
   */
  static async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    // If already granted or denied, return current state
    if (Notification.permission !== 'default') {
      return Notification.permission;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Get user's notification settings from localStorage
   */
  static getSettings(): NotificationSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...this.DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
    return this.DEFAULT_SETTINGS;
  }

  /**
   * Save notification settings to localStorage
   */
  static saveSettings(settings: NotificationSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
      console.log('Notification settings saved:', settings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }

  /**
   * Show a test notification to verify functionality
   */
  static async showTestNotification(): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Recipe Tracker', {
        body: 'Test notification - your dinner reminders are working!',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: 'test-notification',
        data: {
          type: 'test',
          url: '/',
        },
        actions: [
          {
            action: 'dismiss',
            title: 'Dismiss',
          },
        ],
      } as any);
      return true;
    } catch (error) {
      console.error('Error showing test notification:', error);
      return false;
    }
  }

  /**
   * Calculate next notification time based on current time and settings
   */
  static getNextNotificationTime(settings: NotificationSettings): Date {
    const now = new Date();
    const [hours, minutes] = settings.reminderTime.split(':').map(Number);

    const nextNotification = new Date();
    nextNotification.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (nextNotification <= now) {
      nextNotification.setDate(nextNotification.getDate() + 1);
    }

    return nextNotification;
  }

  /**
   * Schedule the next dinner reminder notification
   */
  static async scheduleNextReminder(): Promise<boolean> {
    const settings = this.getSettings();

    // Clear any existing scheduler
    this.clearScheduler();

    if (!settings.enabled || Notification.permission !== 'granted') {
      console.log('Notifications disabled or permission not granted');
      return false;
    }

    try {
      const nextTime = this.getNextNotificationTime(settings);
      const delay = nextTime.getTime() - Date.now();

      console.log(`Next dinner reminder scheduled for: ${nextTime.toLocaleString()} (in ${Math.round(delay / 1000 / 60)} minutes)`);

      // Save scheduler info for persistence across sessions
      localStorage.setItem(this.SCHEDULER_KEY, JSON.stringify({
        nextTime: nextTime.toISOString(),
        settings: settings
      }));

      // Use setTimeout for client-side scheduling
      this.schedulerTimeout = setTimeout(async () => {
        await this.showDinnerReminder();
        // Schedule the next one (24 hours later)
        await this.scheduleNextReminder();
      }, delay);

      // Update last scheduled time
      settings.lastScheduled = nextTime.toISOString();
      this.saveSettings(settings);

      return true;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return false;
    }
  }

  /**
   * Clear the current scheduler
   */
  static clearScheduler(): void {
    if (this.schedulerTimeout) {
      clearTimeout(this.schedulerTimeout);
      this.schedulerTimeout = null;
    }
    localStorage.removeItem(this.SCHEDULER_KEY);
  }

  /**
   * Restore scheduler from localStorage (for session persistence)
   */
  static restoreScheduler(): void {
    try {
      const stored = localStorage.getItem(this.SCHEDULER_KEY);
      if (!stored) return;

      const { nextTime, settings } = JSON.parse(stored);
      const scheduledTime = new Date(nextTime);
      const now = new Date();

      // If the scheduled time has passed, show the notification immediately
      // and schedule the next one
      if (scheduledTime <= now) {
        console.log('Missed notification time, showing now and rescheduling');
        this.showDinnerReminder();
        this.scheduleNextReminder();
        return;
      }

      // If the scheduled time is still in the future, restore the timer
      const delay = scheduledTime.getTime() - now.getTime();
      console.log(`Restoring scheduler for ${scheduledTime.toLocaleString()}`);

      this.schedulerTimeout = setTimeout(async () => {
        await this.showDinnerReminder();
        await this.scheduleNextReminder();
      }, delay);

    } catch (error) {
      console.error('Error restoring scheduler:', error);
      // If restoration fails, just schedule a new one
      this.scheduleNextReminder();
    }
  }

  /**
   * Show the dinner reminder notification with action buttons
   */
  static async showDinnerReminder(): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('🍽️ Dinner Time!', {
        body: 'What did you eat for dinner today?',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: 'dinner-reminder',
        requireInteraction: true, // Keep notification visible until user interacts
        data: {
          type: 'dinner-reminder',
          url: '/',
          timestamp: Date.now(),
        },
        actions: [
          {
            action: 'add-meal',
            title: '📝 Add Meal',
          },
          {
            action: 'dismiss',
            title: '✕ Dismiss',
          },
        ],
      } as any);

      console.log('Dinner reminder notification shown');
      return true;
    } catch (error) {
      console.error('Error showing dinner reminder:', error);
      return false;
    }
  }

  /**
   * Initialize notification system on app startup
   */
  static async initialize(): Promise<void> {
    if (!this.isSupported()) {
      console.log('Notifications not supported in this browser');
      return;
    }

    const settings = this.getSettings();

    // Auto-request permission on first load if not set
    if (Notification.permission === 'default' && settings.enabled) {
      console.log('Requesting notification permission...');
      await this.requestPermission();
    }

    // Schedule reminder if permissions are granted and enabled
    if (Notification.permission === 'granted' && settings.enabled) {
      // Try to restore existing scheduler first
      this.restoreScheduler();

      // If no scheduler was restored, create a new one
      if (!this.schedulerTimeout) {
        await this.scheduleNextReminder();
      }
    } else {
      console.log('Notifications not enabled or permission not granted');
    }
  }
}

export default NotificationManager;