import { render, screen, fireEvent, act } from '@testing-library/react';
import Account from '@/pages/account';

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth: any, cb: any) => {
    cb({ email: 'a@b.com', emailVerified: false });
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

test('reset, verify and sign out', async () => {
  render(<Account />);
  await act(async () => {
    fireEvent.click(screen.getByText('Reset Password'));
    fireEvent.click(screen.getByText('Send Verification Email'));
    fireEvent.click(screen.getByText('Sign Out'));
  });
  expect(sendReset).toHaveBeenCalled();
  expect(sendVerification).toHaveBeenCalled();
  expect(signOutUser).toHaveBeenCalled();
});
