import { render, screen, act } from '@testing-library/react';

// Polyfill for next/link usage in tests
(document as any).createRange = () => ({
  setStart: () => {},
  setEnd: () => {},
  commonAncestorContainer: document.createElement('div')
});

jest.mock('@/lib/mealsStore', () => ({
  getAllMeals: jest.fn(),
}));

import { getAllMeals } from '@/lib/mealsStore';

const Page = require('@/pages/ideas').default;

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
  expect(rows[0]).toHaveTextContent('2x');
  expect(rows[1]).toHaveTextContent('Pasta Carbonara');
  expect(rows[1]).toHaveTextContent('1x');
});

test('shows message when there are no meals', async () => {
  (getAllMeals as jest.Mock).mockResolvedValue([]);

  await act(async () => {
    render(<Page />);
  });

  expect(screen.getByText('No visible meals. Toggle \'Show Hidden\' to see hidden meals.')).toBeInTheDocument();
});

