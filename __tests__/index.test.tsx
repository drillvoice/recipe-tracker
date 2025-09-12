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

const mockOnSnapshot = jest.fn((_q, cb) => {
  cb({
    docs: [
      { id: '1', data: () => ({ mealName: 'Pizza', date: { toDate: () => new Date('2024-01-02') } }) }
    ]
  });
  return jest.fn();
});

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

const Page = require('@/pages/index').default;

test('renders meals list', async () => {
  await act(async () => {
    render(<Page />);
  });
  const formatDate = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };
  const dateString = formatDate(new Date('2024-01-02'));
  expect(screen.getByText('Meals')).toBeInTheDocument();
  expect(await screen.findByText(`${dateString} – Pizza`)).toBeInTheDocument();
});

