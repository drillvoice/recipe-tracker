import { render, screen, act, fireEvent } from '@testing-library/react';
import { saveMeal } from '@/lib/offline-storage';

Object.defineProperty(document, 'createRange', {
  value: () => ({
    setStart: () => undefined,
    setEnd: () => undefined,
    commonAncestorContainer: document.createElement('div')
  }) as unknown as Range
});

jest.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
}));

jest.mock('@/lib/offline-storage', () => ({
  saveMeal: jest.fn().mockResolvedValue(undefined),
  getAllMeals: jest.fn().mockResolvedValue([
    {
      id: '1',
      mealName: 'Burritos',
      date: {
        toDate: () => new Date('2024-01-01'),
        toMillis: () => new Date('2024-01-01').getTime(),
        seconds: Math.floor(new Date('2024-01-01').getTime() / 1000),
        nanoseconds: 0
      },
      tags: ['Dinner']
    }
  ]),
}));

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }),
    now: () => ({ toDate: () => new Date('2024-01-03'), toMillis: () => new Date('2024-01-03').getTime() })
  }
}));

const Page = require('@/pages/index').default;
const { __resetMealsStore } = require('@/hooks/useMeals');

beforeEach(() => {
  __resetMealsStore();
  (saveMeal as jest.Mock).mockClear();
});

test('renders add meal form', async () => {
  await act(async () => {
    render(<Page />);
  });
  expect(screen.getByRole('heading', { name: 'DishDiary' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Dish' })).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Enter dish name...')).toBeInTheDocument();
});

test('suggests previous dishes from the first keystroke', async () => {
  await act(async () => {
    render(<Page />);
  });
  const input = screen.getByPlaceholderText('Enter dish name...');
  await act(async () => {
    fireEvent.change(input, { target: { value: 'B' } });
  });
  expect(input).toHaveValue('B');
  expect(screen.getByRole('button', { name: 'Burritos' })).toBeInTheDocument();
});

test('Enter adds the dish even while suggestions are showing', async () => {
  await act(async () => {
    render(<Page />);
  });
  const input = screen.getByPlaceholderText('Enter dish name...');
  await act(async () => {
    fireEvent.change(input, { target: { value: 'Burr' } });
  });
  expect(screen.getByRole('button', { name: 'Burritos' })).toBeInTheDocument();

  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' });
  });

  expect(saveMeal).toHaveBeenCalledWith(expect.objectContaining({ mealName: 'Burr' }));
});

test('arrow keys pick a suggestion before Enter adds it', async () => {
  await act(async () => {
    render(<Page />);
  });
  const input = screen.getByPlaceholderText('Enter dish name...');
  await act(async () => {
    fireEvent.change(input, { target: { value: 'bur' } });
  });
  await act(async () => {
    fireEvent.keyDown(input, { key: 'ArrowDown' });
  });
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' });
  });
  expect(input).toHaveValue('Burritos');
  expect(saveMeal).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' });
  });
  expect(saveMeal).toHaveBeenCalledWith(expect.objectContaining({ mealName: 'Burritos' }));
});

test('defaults the date to today in local time, not UTC', async () => {
  await act(async () => {
    render(<Page />);
  });
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  expect(screen.getByDisplayValue(expected)).toBeInTheDocument();
});
