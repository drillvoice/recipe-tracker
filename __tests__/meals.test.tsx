import { render, screen } from '@testing-library/react';

document.createRange = () => ({
  setStart: () => {},
  setEnd: () => {},
  commonAncestorContainer: document.createElement('div')
} as any);

jest.mock('@/lib/firebase', () => ({
  auth: {},
  db: {}
}));

const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn((_auth, cb) => {
  cb({ uid: '1' });
  return jest.fn();
});
const mockOnSnapshot = jest.fn((_q, cb) => {
  cb({
    docs: [
      { id: '1', data: () => ({ mealName: 'Pizza', date: { toDate: () => new Date('2024-01-02') } }) }
    ]
  });
  return jest.fn();
});

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: mockOnAuthStateChanged,
  signOut: mockSignOut
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: mockOnSnapshot,
  Timestamp: {
    fromDate: (d: Date) => ({ toDate: () => d }),
    now: () => ({ toDate: () => new Date('2024-01-03') })
  }
}));

const Meals = require('@/pages/meals').default;

test('renders meals list', () => {
  render(<Meals />);
  const dateString = new Date('2024-01-02').toLocaleDateString();
  expect(screen.getByText('Meals')).toBeInTheDocument();
  expect(screen.getByText('Log Out')).toBeInTheDocument();
  expect(screen.getByText(`${dateString} – Pizza`)).toBeInTheDocument();
});
