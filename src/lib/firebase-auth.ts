import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";

import { auth } from "./firebase";

let currentUser: User | null = null;
let pendingAuthPromise: Promise<User> | null = null;

if (typeof window !== "undefined" && typeof auth.onAuthStateChanged === "function") {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  });
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export async function ensureAuthenticatedUser(): Promise<User> {
  if (currentUser) {
    return currentUser;
  }

  if (pendingAuthPromise) {
    return pendingAuthPromise;
  }

  pendingAuthPromise = new Promise<User>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        pendingAuthPromise = null;
        unsubscribe();
        resolve(user);
        return;
      }

      try {
        const result = await signInAnonymously(auth);
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

