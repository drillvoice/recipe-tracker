import { signInEmail, signUpEmail, signOutUser, sendReset } from '@/lib/auth';
import {
  linkWithCredential,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn(() => 'cred') },
  linkWithCredential: jest.fn(() => Promise.resolve({ user: { email: 'e', emailVerified: false } })),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { email: 'e', emailVerified: true } })),
  sendEmailVerification: jest.fn(() => Promise.resolve()),
  sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/firebase', () => ({ auth: { currentUser: { isAnonymous: true } } }));

test('signUpEmail links anonymous and sends verification', async () => {
  await signUpEmail('a@b.com', 'pw');
  expect(linkWithCredential).toHaveBeenCalled();
  expect(sendEmailVerification).toHaveBeenCalled();
});

test('signInEmail signs in directly without linking the anonymous user', async () => {
  (linkWithCredential as jest.Mock).mockClear();
  await signInEmail('a@b.com', 'pw');
  expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'a@b.com', 'pw');
  // Linking would silently create a new account for a mistyped email.
  expect(linkWithCredential).not.toHaveBeenCalled();
});

test('signOutUser calls signOut', async () => {
  await signOutUser();
  expect(signOut).toHaveBeenCalled();
});

test('sendReset calls reset', async () => {
  await sendReset('a@b.com');
  expect(sendPasswordResetEmail).toHaveBeenCalled();
});
