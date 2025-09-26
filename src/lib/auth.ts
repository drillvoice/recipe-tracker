import {
  EmailAuthProvider,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from "firebase/auth";
import { auth } from "./firebase";

function requireAuth(): Auth {
  if (!auth) {
    throw new Error("Firebase auth is not configured.");
  }
  return auth;
}

export async function linkAnonymousWithEmailPassword(email: string, password: string) {
  const firebaseAuth = requireAuth();
  if (!firebaseAuth.currentUser) throw new Error("No current user");
  const credential = EmailAuthProvider.credential(email, password);
  try {
    return await linkWithCredential(firebaseAuth.currentUser, credential);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "auth/credential-already-in-use") {
      return await signInWithEmailAndPassword(firebaseAuth, email, password);
    }
    throw err;
  }
}

export async function signUpEmail(email: string, password: string) {
  const cred = await linkAnonymousWithEmailPassword(email, password);
  if (cred.user.email && !cred.user.emailVerified) {
    await sendEmailVerification(cred.user);
  }
  return cred;
}

export async function signInEmail(email: string, password: string) {
  const firebaseAuth = requireAuth();
  if (firebaseAuth.currentUser && firebaseAuth.currentUser.isAnonymous) {
    return linkAnonymousWithEmailPassword(email, password);
  }
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

export function signOutUser() {
  return signOut(requireAuth());
}

export function sendReset(email: string) {
  return sendPasswordResetEmail(requireAuth(), email);
}

export function sendVerification() {
  const firebaseAuth = requireAuth();
  if (!firebaseAuth.currentUser) throw new Error("No current user");
  return sendEmailVerification(firebaseAuth.currentUser);
}

