import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";

import { auth, isFirebaseConfigured } from "./firebase";

let currentUser: User | null = null;
let pendingAuthPromise: Promise<User> | null = null;

if (typeof window !== "undefined" && auth && typeof auth.onAuthStateChanged === "function") {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  });
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export async function ensureAuthenticatedUser(): Promise<User> {
  const firebaseAuth = auth;
  if (!firebaseAuth || !isFirebaseConfigured) {
    throw new Error("Firebase authentication is not configured.");
  }

  if (currentUser) {
    return currentUser;
  }

  if (pendingAuthPromise) {
    return pendingAuthPromise;
  }

  pendingAuthPromise = new Promise<User>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        currentUser = user;
        pendingAuthPromise = null;
        unsubscribe();
        resolve(user);
        return;
      }

      try {
        const result = await signInAnonymously(firebaseAuth);
        currentUser = result.user;
        pendingAuthPromise = null;
        unsubscribe();
        resolve(result.user);
      } catch (error) {
        pendingAuthPromise = null;
        unsubscribe();
        reject(error);
      }
    });
  });

  return pendingAuthPromise;
}

