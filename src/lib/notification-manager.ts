// notification-manager.ts - Push notification management for dinner reminders

import { getFCMToken, isFCMSupported, db, isFirebaseConfigured } from './firebase';
import { ensureAuthenticatedUser } from './firebase-auth';
import {
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  deleteField,
} from 'firebase/firestore';

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
      } as NotificationOptions);
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
    if (!settings.enabled || Notification.permission !== 'granted') {
      console.log('Notifications disabled or permission not granted');
      return false;
    }

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const nextTime = this.getNextNotificationTime(settings);
      console.log(`Next dinner reminder scheduled for: ${nextTime.toLocaleString()} (${timezone})`);

      const persisted = await this.persistRemoteSchedule({
        nextTime,
        settings,
        timezone,
      });

      if (persisted) {
        localStorage.setItem(this.SCHEDULER_KEY, JSON.stringify({
          nextTime: nextTime.toISOString(),
          reminderTime: settings.reminderTime,
          timezone,
        }));

        settings.lastScheduled = nextTime.toISOString();
        this.saveSettings(settings);
      } else {
        console.warn('Remote reminder schedule could not be persisted.');
      }

      return persisted;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return false;
    }
  }

  /**
   * Clear the current scheduler
   */
  static async clearScheduler(): Promise<void> {
    localStorage.removeItem(this.SCHEDULER_KEY);

    try {
      if (!isFirebaseConfigured) {
        console.warn('Skipping remote reminder persistence because Firebase is not configured.');
        return;
      }

      const user = await ensureAuthenticatedUser();
      const database = db;
      if (!database || !isFirebaseConfigured) {
        console.warn('Skipping remote reminder persistence because Firebase is not configured.');
        return;
      }

      const reminderRef = doc(database, 'users', user.uid, 'notificationSubscriptions', 'dinner');
      const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

      await setDoc(
        reminderRef,
        {
          active: false,
          updatedAt: serverTimestamp(),
          lastKnownPermission: permission,
          nextNotificationAt: deleteField(),
          disabledAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error clearing remote reminder subscription:', error);
    }
  }

  /**
   * Restore scheduler from localStorage (for session persistence)
   */
  static async restoreScheduler(settings: NotificationSettings): Promise<boolean> {
    try {
      const stored = localStorage.getItem(this.SCHEDULER_KEY);
      if (!stored) {
        return false;
      }

      const { nextTime, reminderTime, timezone } = JSON.parse(stored) as {
        nextTime?: string;
        reminderTime?: string;
        timezone?: string;
      };

      if (!nextTime || !reminderTime || !timezone) {
        return false;
      }

      if (reminderTime !== settings.reminderTime) {
        return false;
      }

      const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      if (timezone !== currentTimezone) {
        return false;
      }

      const scheduledTime = new Date(nextTime);
      if (Number.isNaN(scheduledTime.getTime()) || scheduledTime <= new Date()) {
        return false;
      }

      const token = await getFCMToken();
      if (!token) {
        return false;
      }

      const persisted = await this.persistRemoteSchedule({
        nextTime: scheduledTime,
        settings,
        timezone,
        token,
      });

      return persisted;
    } catch (error) {
      console.error('Error restoring scheduler:', error);
      return false;
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
      } as NotificationOptions);

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
      const restored = await this.restoreScheduler(settings);
      if (!restored) {
        await this.scheduleNextReminder();
      }
    } else {
      console.log('Notifications not enabled or permission not granted');
    }
  }

  private static async persistRemoteSchedule({
    nextTime,
    settings,
    timezone,
    token,
  }: {
    nextTime: Date;
    settings: NotificationSettings;
    timezone: string;
    token?: string | null;
  }): Promise<boolean> {
    try {
      if (!isFirebaseConfigured) {
        console.warn('Skipping remote reminder persistence because Firebase is not configured.');
        return false;
      }

      const ensuredToken = token ?? (await getFCMToken());
      if (!ensuredToken) {
        console.warn('Unable to persist reminder subscription without FCM token');
        return false;
      }

      const user = await ensureAuthenticatedUser();
      const database = db;
      if (!database || !isFirebaseConfigured) {
        console.warn('Skipping remote reminder persistence because Firebase is not configured.');
        return false;
      }

      const reminderRef = doc(database, 'users', user.uid, 'notificationSubscriptions', 'dinner');
      const [hours, minutes] = settings.reminderTime.split(':').map(Number);
      const platform = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
      const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

      await setDoc(
        reminderRef,
        {
          active: true,
          reminderTime: settings.reminderTime,
          reminderHour: Number.isFinite(hours) ? hours : null,
          reminderMinute: Number.isFinite(minutes) ? minutes : null,
          timezone,
          token: ensuredToken,
          nextNotificationAt: Timestamp.fromDate(nextTime),
          lastKnownPermission: permission,
          updatedAt: serverTimestamp(),
          platform,
        },
        { merge: true }
      );
      return true;
    } catch (error) {
      console.error('Error persisting remote reminder schedule:', error);
      return false;
    }
  }

  /**
   * Test function: Schedule a notification for 15 minutes from now
   * This is a temporary debugging tool to test the subscription feature
   */
  static async scheduleTestNotification(): Promise<boolean> {
    try {
      if (!isFirebaseConfigured) {
        console.warn('Skipping test reminder persistence because Firebase is not configured.');
        return false;
      }

      console.log('🔄 Starting test notification scheduling...');

      console.log('🔐 Checking authentication...');
      const user = await ensureAuthenticatedUser();
      console.log('✅ User authenticated:', user.uid);

      console.log('🔔 Getting FCM token...');
      const ensuredToken = await getFCMToken();
      console.log('✅ FCM token obtained:', ensuredToken ? 'Yes' : 'No');

      if (!ensuredToken) {
        console.error('❌ No FCM token available for test notification');
        return false;
      }

      // Calculate 15 minutes from now
      const now = new Date();
      const testTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      console.log('💾 Writing to Firestore...');
      const database = db;
      if (!database || !isFirebaseConfigured) {
        console.warn('Skipping test reminder persistence because Firebase is not configured.');
        return false;
      }

      const reminderRef = doc(database, 'users', user.uid, 'notificationSubscriptions', 'test-dinner');
      const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      const platform = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';

      const docData = {
        active: true,
        reminderTime: `${testTime.getHours().toString().padStart(2, '0')}:${testTime.getMinutes().toString().padStart(2, '0')}`,
        reminderHour: testTime.getHours(),
        reminderMinute: testTime.getMinutes(),
        timezone,
        token: ensuredToken,
        nextNotificationAt: Timestamp.fromDate(testTime),
        lastKnownPermission: permission,
        updatedAt: serverTimestamp(),
        platform,
        isTest: true, // Mark as test notification
      };

      console.log('📄 Document data:', docData);
      await setDoc(reminderRef, docData, { merge: true });
      console.log('✅ Successfully wrote to Firestore');

      console.log(`🎯 Test notification scheduled for ${testTime.toLocaleString()} (15 minutes from now)`);
      return true;
    } catch (error) {
      console.error('Error scheduling test notification:', error);
      return false;
    }
  }

  /**
   * Clear test notification subscription
   */
  static async clearTestNotification(): Promise<void> {
    try {
      if (!isFirebaseConfigured) {
        console.warn('Skipping reminder disable because Firebase is not configured.');
        return;
      }

      const user = await ensureAuthenticatedUser();
      const database = db;
      if (!database || !isFirebaseConfigured) {
        console.warn('Skipping reminder disable because Firebase is not configured.');
        return;
      }

      const reminderRef = doc(database, 'users', user.uid, 'notificationSubscriptions', 'test-dinner');

      await setDoc(
        reminderRef,
        {
          active: false,
          updatedAt: serverTimestamp(),
          nextNotificationAt: deleteField(),
          disabledAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log('Test notification cleared');
    } catch (error) {
      console.error('Error clearing test notification:', error);
    }
  }
}

export default NotificationManager;