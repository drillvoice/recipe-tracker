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

test('signInEmail links when anonymous', async () => {
  await signInEmail('a@b.com', 'pw');
  expect(linkWithCredential).toHaveBeenCalled();
});

test('signInEmail falls back to sign-in when link returns email-already-in-use', async () => {
  (linkWithCredential as jest.Mock).mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
  await signInEmail('a@b.com', 'pw');
  expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'a@b.com', 'pw');
});

test('signOutUser calls signOut', async () => {
  await signOutUser();
  expect(signOut).toHaveBeenCalled();
});

test('sendReset calls reset', async () => {
  await sendReset('a@b.com');
  expect(sendPasswordResetEmail).toHaveBeenCalled();
});
