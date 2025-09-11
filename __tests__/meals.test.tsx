import { render, screen, act } from '@testing-library/react';

document.createRange = () => ({
  setStart: () => {},
  setEnd: () => {},
  commonAncestorContainer: document.createElement('div')
} as any);

jest.mock('@/lib/firebaseClient', () => ({
  auth: {},
  db: {},
}));

jest.mock('@/lib/mealsStore', () => {
  const mockMeal = {
    id: '1',
    mealName: 'Pizza',
    date: {
      toDate: () => new Date('2024-01-02'),
      toMillis: () => new Date('2024-01-02').getTime(),
    },
    pending: false,
  };
  return {
    getAllMeals: jest.fn().mockResolvedValue([mockMeal]),
    saveMeal: jest.fn().mockResolvedValue(undefined),
    getPendingMeals: jest.fn().mockResolvedValue([]),
    markMealSynced: jest.fn().mockResolvedValue(undefined),
  };
});

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
    fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }),
    now: () => ({ toDate: () => new Date('2024-01-03'), toMillis: () => new Date('2024-01-03').getTime() })
  }
}));

const Meals = require('@/pages/meals').default;

test('renders meals list', async () => {
  await act(async () => {
    render(<Meals />);
  });
  const dateString = new Date('2024-01-02').toLocaleDateString();
  expect(screen.getByText('Meals')).toBeInTheDocument();
  expect(screen.getByText('Log Out')).toBeInTheDocument();
  expect(await screen.findByText(`${dateString} – Pizza`)).toBeInTheDocument();
});
