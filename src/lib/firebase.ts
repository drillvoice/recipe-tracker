import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import {
  getFirestore,
  enableIndexedDbPersistence,
  type Firestore,
} from "firebase/firestore";
import {
  getMessaging,
  getToken,
  isSupported,
  type Messaging,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

export const db: Firestore = getFirestore(app);

// Initialize Firebase Cloud Messaging
let messaging: Messaging | null = null;

if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn("IndexedDB persistence failed", err);
  });

  // Initialize messaging only in browser environment
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
      console.log("Firebase Cloud Messaging supported and initialized");
    } else {
      console.log("Firebase Cloud Messaging not supported in this browser");
    }
  }).catch((err) => {
    console.warn("Failed to check FCM support:", err);
  });
}

export { messaging };

// FCM utility functions
export async function getFCMToken(): Promise<string | null> {
  if (!messaging) {
    console.log("FCM not available");
    return null;
  }

  try {
    // You'll need to add your VAPID key from Firebase Console
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("VAPID key not configured for FCM");
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    console.log("FCM token retrieved:", token ? "✓" : "✗");
    return token;
  } catch (error) {
    console.error("Failed to get FCM token:", error);
    return null;
  }
}

export function isFCMSupported(): boolean {
  return messaging !== null;
}

