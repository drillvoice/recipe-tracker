/**
 * PWA utility functions for service worker registration and install prompts
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  canInstall: boolean;
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('Service worker registered successfully:', registration);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New service worker available');
            // Trigger update notification
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Unregister service worker (for development/testing)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      return await registration.unregister();
    }
    return false;
  } catch (error) {
    console.error('Service worker unregistration failed:', error);
    return false;
  }
}

/**
 * Check PWA install state
 */
export function getPWAInstallState(): PWAInstallState {
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );

  const isInstalled = isStandalone;

  return {
    isInstallable: false, // Will be updated by install prompt events
    isInstalled,
    isStandalone,
    canInstall: !isInstalled
  };
}

/**
 * Show install prompt
 */
export function showInstallPrompt(deferredPrompt: BeforeInstallPromptEvent | null): Promise<boolean> {
  return new Promise((resolve) => {
    if (!deferredPrompt) {
      console.log('No install prompt available');
      resolve(false);
      return;
    }

    deferredPrompt.prompt();

    deferredPrompt.userChoice.then((choiceResult) => {
      console.log('Install prompt result:', choiceResult.outcome);
      resolve(choiceResult.outcome === 'accepted');
    });
  });
}

/**
 * Check if device supports PWA installation
 */
export function isPWASupported(): boolean {
  return typeof window !== 'undefined' && (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get PWA capabilities
 */
export function getPWACapabilities() {
  if (typeof window === 'undefined') {
    return {
      serviceWorker: false,
      pushNotifications: false,
      backgroundSync: false,
      fileSystemAccess: false,
      webShare: false,
      notification: false
    };
  }

  return {
    serviceWorker: 'serviceWorker' in navigator,
    pushNotifications: 'PushManager' in window,
    backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
    fileSystemAccess: 'showOpenFilePicker' in window,
    webShare: 'share' in navigator,
    notification: 'Notification' in window
  };
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
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
 * Show notification
 */
export function showNotification(title: string, options?: NotificationOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('Notification' in window)) {
      reject(new Error('Notifications not supported'));
      return;
    }

    if (Notification.permission !== 'granted') {
      reject(new Error('Notification permission not granted'));
      return;
    }

    const notification = new Notification(title, {
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-96x96.svg',
      ...options
    });

    notification.addEventListener('click', () => {
      window.focus();
      notification.close();
      resolve();
    });

    notification.addEventListener('error', (error) => {
      reject(error);
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
      resolve();
    }, 5000);
  });
}