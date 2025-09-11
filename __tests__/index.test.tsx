import { render, screen } from '@testing-library/react';

document.createRange = () => ({
  setStart: () => {},
  setEnd: () => {},
  commonAncestorContainer: document.createElement('div')
} as any);

jest.mock('@/lib/firebaseClient', () => ({
  auth: {},
  db: {}
}));

const mockOnSnapshot = jest.fn((_q, cb) => {
  cb({
    docs: [
      { id: '1', data: () => ({ mealName: 'Pizza', date: { toDate: () => new Date('2024-01-02') } }) }
    ]
  });
  return jest.fn();
});

jest.mock('firebase/auth', () => ({
  signInAnonymously: jest.fn()
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

const Index = require('@/pages/index').default;

test('renders meals list', () => {
  render(<Index />);
  const dateString = new Date('2024-01-02').toLocaleDateString();
  expect(screen.getByRole('heading', { name: 'Add Meal' })).toBeInTheDocument();
  expect(screen.getByText(`${dateString} – Pizza`)).toBeInTheDocument();
});
