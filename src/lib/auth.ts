import {
  EmailAuthProvider,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

export async function linkAnonymousWithEmailPassword(email: string, password: string) {
  if (!auth.currentUser) throw new Error("No current user");
  const credential = EmailAuthProvider.credential(email, password);
  try {
    return await linkWithCredential(auth.currentUser, credential);
  } catch (err: any) {
    if (err.code === "auth/credential-already-in-use") {
      return await signInWithEmailAndPassword(auth, email, password);
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
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    return linkAnonymousWithEmailPassword(email, password);
  }
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  return signOut(auth);
}

export function sendReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export function sendVerification() {
  if (!auth.currentUser) throw new Error("No current user");
  return sendEmailVerification(auth.currentUser);
}

