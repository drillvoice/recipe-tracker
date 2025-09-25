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

const requiredEnvVars = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

const missingEnvVars = requiredEnvVars.filter(
  (key) => !process.env[key],
);

export const isFirebaseConfigured = missingEnvVars.length === 0;

const firebaseConfig = isFirebaseConfigured
  ? {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? undefined,
    }
  : null;

const app: FirebaseApp | null = firebaseConfig
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;

export async function ensureAuthPersistence(): Promise<void> {
  if (!auth || typeof window === "undefined") {
    return;
  }

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn("Failed to set Firebase auth persistence:", error);
  }
}

export const db: Firestore | null = app ? getFirestore(app) : null;

// Initialize Firebase Cloud Messaging
let messaging: Messaging | null = null;

if (app && typeof window !== "undefined") {
  enableIndexedDbPersistence(db!).catch((err) => {
    console.warn("IndexedDB persistence failed", err);
  });

  // Initialize messaging only in browser environment
  isSupported()
    .then((supported) => {
      if (supported && app) {
        messaging = getMessaging(app);
        console.log("Firebase Cloud Messaging supported and initialized");
      } else {
        console.log("Firebase Cloud Messaging not supported in this browser");
      }
    })
    .catch((err) => {
      console.warn("Failed to check FCM support:", err);
    });
} else if (!isFirebaseConfigured) {
  console.warn(
    "Firebase environment variables are not fully configured. Skipping Firebase initialization.",
    `Missing: ${missingEnvVars.join(", ")}`,
  );
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

