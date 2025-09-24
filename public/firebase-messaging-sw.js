// firebase-messaging-sw.js - Service worker for Firebase Cloud Messaging

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-messaging-compat.js');
importScripts('/api/firebase-config');

const firebaseConfig = self.firebaseConfig;
delete self.firebaseConfig;
let messaging = null;

try {
  if (!firebaseConfig) {
    throw new Error('Missing Firebase configuration in service worker');
  }

  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  console.log('[firebase-messaging-sw.js] Firebase initialized for background messaging');
} catch (error) {
  console.error('[firebase-messaging-sw.js] Failed to initialize Firebase Messaging:', error);
}

// Handle background messages
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification?.title || '🍽️ Dinner Time!';
    const notificationOptions = {
      body: payload.notification?.body || 'What did you eat for dinner today?',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'dinner-reminder',
      requireInteraction: true,
      data: {
        type: 'dinner-reminder',
        url: '/',
        ...payload.data
      },
      actions: [
        {
          action: 'add-meal',
          title: '📝 Add Meal'
        },
        {
          action: 'dismiss',
          title: '✕ Dismiss'
        }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  console.warn('[firebase-messaging-sw.js] Background messaging unavailable; onBackgroundMessage not registered');
}

// Handle notification clicks (for background notifications)
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');

  event.notification.close();

  if (event.action === 'add-meal') {
    // Open app to add meal
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  } else if (event.action === 'dismiss') {
    // Just close (already done above)
    console.log('[firebase-messaging-sw.js] Notification dismissed');
  } else {
    // Clicked notification body
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});