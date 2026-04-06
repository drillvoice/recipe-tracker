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
  expect(rows[0]).toHaveTextContent('Chicken Stir Fry');
  expect(rows[1]).toHaveTextContent('Pasta Carbonara');

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

  expect(getDishOrder()).toEqual([
    'Chicken Stir Fry',
    'Apple Curry',
    'Beef Tacos',
  ]);

  fireEvent.click(screen.getByRole('button', { name: /filter/i }));

  fireEvent.change(screen.getByLabelText('Sort dishes'), {
    target: { value: 'oldest' },
  });

  expect(getDishOrder()).toEqual([
    'Beef Tacos',
    'Apple Curry',
    'Chicken Stir Fry',
  ]);

  fireEvent.change(screen.getByLabelText('Sort dishes'), {
    target: { value: 'alphabetical' },
  });

  expect(getDishOrder()).toEqual([
    'Apple Curry',
    'Beef Tacos',
    'Chicken Stir Fry',
  ]);
});

test('shows message when there are no meals', async () => {
  (getAllMeals as jest.Mock).mockResolvedValue([]);

  await act(async () => {
    render(<Page />);
  });

  expect(screen.getByText('No visible meals. Toggle \'Show Hidden\' to see hidden meals.')).toBeInTheDocument();
});
