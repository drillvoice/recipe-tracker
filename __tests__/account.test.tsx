import { render, screen, fireEvent, act } from '@testing-library/react';
import Account from '@/pages/account';

const mockUser = { email: null as string | null, emailVerified: false, isAnonymous: true };

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth: any, cb: any) => {
    cb(mockUser);
    return () => {};
  }
}));

const signInEmail = jest.fn();
const signUpEmail = jest.fn();
const signOutUser = jest.fn();
const sendReset = jest.fn();
const sendVerification = jest.fn();

jest.mock('@/lib/auth', () => ({
  signInEmail: (...args: any[]) => signInEmail(...args),
  signUpEmail: (...args: any[]) => signUpEmail(...args),
  signOutUser: () => signOutUser(),
  sendReset: (e: string) => sendReset(e),
  sendVerification: () => sendVerification(),
}));

jest.mock('@/lib/firebase', () => ({ auth: {} }));

test('allows sign in and sign up', async () => {
  // Mock anonymous user for this test
  mockUser.email = null;
  mockUser.isAnonymous = true;
  mockUser.emailVerified = false;
  
  render(<Account />);
  fireEvent.change(screen.getByPlaceholderText('Enter your email...'), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByPlaceholderText('Enter your password...'), { target: { value: 'pw' } });
  await act(async () => {
    fireEvent.click(screen.getAllByText('Sign In')[1]);
  });
  expect(signInEmail).toHaveBeenCalled();
  fireEvent.click(screen.getByText('Sign Up'));
  await act(async () => {
    fireEvent.click(screen.getAllByText('Sign Up')[1]);
  });
  expect(signUpEmail).toHaveBeenCalled();
});

test('allows forgot password', async () => {
  // Mock anonymous user for this test
  mockUser.email = null;
  mockUser.isAnonymous = true;
  mockUser.emailVerified = false;
  
  render(<Account />);
  fireEvent.change(screen.getByPlaceholderText('Enter your email...'), { target: { value: 'a@b.com' } });
  await act(async () => {
    fireEvent.click(screen.getByText('Forgot Password?'));
  });
  expect(sendReset).toHaveBeenCalled();
});

test('verify and sign out', async () => {
  // Mock signed-in unverified user for this test
  mockUser.email = 'a@b.com';
  mockUser.isAnonymous = false;
  mockUser.emailVerified = false;
  
  render(<Account />);
  
  // Wait for component to load user state
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  await act(async () => {
    fireEvent.click(screen.getByText('Send Verification Email'));
    fireEvent.click(screen.getByText('Sign Out'));
  });
  expect(sendVerification).toHaveBeenCalled();
  expect(signOutUser).toHaveBeenCalled();
});
