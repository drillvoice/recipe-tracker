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

jest.mock('@/lib/mealsStore', () => ({
  saveMeal: jest.fn().mockResolvedValue(undefined),
  getPendingMeals: jest.fn().mockResolvedValue([]),
  markMealSynced: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  Timestamp: {
    fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }),
    now: () => ({ toDate: () => new Date('2024-01-03'), toMillis: () => new Date('2024-01-03').getTime() })
  }
}));

const Page = require('@/pages/index').default;

test('renders add meal form', async () => {
  await act(async () => {
    render(<Page />);
  });
  expect(screen.getByRole('heading', { name: 'Add Meal' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Meal' })).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Enter meal name...')).toBeInTheDocument();
});

