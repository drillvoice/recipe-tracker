import { render, screen, act, fireEvent, within } from '@testing-library/react';

// Polyfill for next/link usage in tests
Object.defineProperty(document, 'createRange', {
  value: () => ({
    setStart: () => undefined,
    setEnd: () => undefined,
    commonAncestorContainer: document.createElement('div')
  }) as unknown as Range
});

jest.mock('@/lib/offline-storage', () => ({
  getAllMeals: jest.fn(),
}));

import { getAllMeals } from '@/lib/offline-storage';

const Page = require('@/pages/dishes').default;
const { __resetMealsStore } = require('@/hooks/useMeals');

beforeEach(() => {
  __resetMealsStore();
});

test('renders unique meals with counts', async () => {
  (getAllMeals as jest.Mock).mockResolvedValue([
    {
      id: '1',
      mealName: 'Chicken Stir Fry',
      date: {
        toDate: () => new Date('2024-03-15'),
        toMillis: () => new Date('2024-03-15').getTime(),
      },
    },
    {
      id: '2',
      mealName: 'Pasta Carbonara',
      date: {
        toDate: () => new Date('2024-03-14'),
        toMillis: () => new Date('2024-03-14').getTime(),
      },
    },
    {
      id: '3',
      mealName: 'Chicken Stir Fry',
      date: {
        toDate: () => new Date('2024-03-13'),
        toMillis: () => new Date('2024-03-13').getTime(),
      },
    },
  ]);

  await act(async () => {
    render(<Page />);
  });

  const rows = screen.getAllByRole('row').slice(1); // skip header
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('Pasta Carbonara');
  expect(rows[1]).toHaveTextContent('Chicken Stir Fry');

  // Check that info buttons are present instead of count columns
  expect(screen.getAllByTitle('Show details')).toHaveLength(2);
});

test('supports sorting dishes by oldest first and alphabetically', async () => {
  (getAllMeals as jest.Mock).mockResolvedValue([
    {
      id: '1',
      mealName: 'Chicken Stir Fry',
      date: {
        toDate: () => new Date('2024-03-15'),
        toMillis: () => new Date('2024-03-15').getTime(),
      },
    },
    {
      id: '2',
      mealName: 'Beef Tacos',
      date: {
        toDate: () => new Date('2024-03-13'),
        toMillis: () => new Date('2024-03-13').getTime(),
      },
    },
    {
      id: '3',
      mealName: 'Apple Curry',
      date: {
        toDate: () => new Date('2024-03-14'),
        toMillis: () => new Date('2024-03-14').getTime(),
      },
    },
  ]);

  await act(async () => {
    render(<Page />);
  });

  const getDishOrder = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

  // Default is oldest-first
  expect(getDishOrder()).toEqual([
    'Beef Tacos',
    'Apple Curry',
    'Chicken Stir Fry',
  ]);

  fireEvent.change(screen.getByLabelText('Sort:'), {
    target: { value: 'newest' },
  });

  expect(getDishOrder()).toEqual([
    'Chicken Stir Fry',
    'Apple Curry',
    'Beef Tacos',
  ]);

  fireEvent.change(screen.getByLabelText('Sort:'), {
    target: { value: 'alphabetical' },
  });

  expect(getDishOrder()).toEqual([
    'Apple Curry',
    'Beef Tacos',
    'Chicken Stir Fry',
  ]);
});

test('shows times made and sorts by it', async () => {
  const meal = (id: string, mealName: string, day: string) => ({
    id,
    mealName,
    date: {
      toDate: () => new Date(day),
      toMillis: () => new Date(day).getTime(),
    },
  });
  (getAllMeals as jest.Mock).mockResolvedValue([
    meal('1', 'Tacos', '2024-03-10'),
    meal('2', 'Tacos', '2024-03-12'),
    meal('3', 'Curry', '2024-03-11'),
    meal('4', 'Pasta', '2024-03-01'),
    meal('5', 'Pasta', '2024-03-05'),
    meal('6', 'Pasta', '2024-03-09'),
  ]);

  await act(async () => {
    render(<Page />);
  });

  const getRows = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => {
        const cells = within(row).getAllByRole('cell');
        return [cells[0]?.textContent, cells[2]?.textContent];
      });

  fireEvent.change(screen.getByLabelText('Sort:'), {
    target: { value: 'mostMade' },
  });
  expect(getRows()).toEqual([
    ['Pasta', '3'],
    ['Tacos', '2'],
    ['Curry', '1'],
  ]);

  fireEvent.change(screen.getByLabelText('Sort:'), {
    target: { value: 'leastMade' },
  });
  expect(getRows()).toEqual([
    ['Curry', '1'],
    ['Tacos', '2'],
    ['Pasta', '3'],
  ]);
});

test('shows message when there are no meals', async () => {
  (getAllMeals as jest.Mock).mockResolvedValue([]);

  await act(async () => {
    render(<Page />);
  });

  expect(screen.getByText('No dishes recorded yet. Add your first dish from the home page.')).toBeInTheDocument();
});

test('explains when filters hide every dish and can clear them', async () => {
  (getAllMeals as jest.Mock).mockResolvedValue([
    {
      id: '1',
      mealName: 'Chicken Stir Fry',
      date: {
        toDate: () => new Date(),
        toMillis: () => Date.now(),
      },
    },
  ]);

  await act(async () => {
    render(<Page />);
  });

  fireEvent.click(screen.getByTitle('Filter options'));
  // Made today, so a "7+ days ago" filter excludes it
  fireEvent.click(screen.getByRole('button', { name: '7' }));

  expect(screen.getByText('No dishes match your filters.')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByText('Chicken Stir Fry')).toBeInTheDocument();
});
