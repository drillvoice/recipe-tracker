import { render, screen } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({ auth: {} }));

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn()
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn() })
}));

const Home = require('@/pages/index').default;

test('renders login form', () => {
  render(<Home />);
  expect(screen.getByText('Recipe Tracker')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  expect(screen.getByText('Log In')).toBeInTheDocument();
  expect(screen.getByText('Sign Up')).toBeInTheDocument();
});
