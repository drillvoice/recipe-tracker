import { Timestamp } from 'firebase/firestore';

// Mock IndexedDB via idb
jest.mock('idb', () => ({
  openDB: jest.fn(() =>
    Promise.resolve({
      getAll: jest.fn().mockResolvedValue([
        {
          id: '1',
          mealName: 'Salad',
          date: { seconds: 1, nanoseconds: 2 },
          tags: ['fresh', 'light'],
        },
      ]),
    })
  ),
}));

describe('offline-storage meals', () => {
  beforeAll(() => {
    (global as any).window = (global as any).window || {};
    (global as any).window.indexedDB = {};
  });

  test('getAllMeals converts plain date objects to Firestore Timestamps', async () => {
    const { getAllMeals } = await import('@/lib/offline-storage');
    const meals = await getAllMeals();
    expect(meals).toHaveLength(1);
    const mealDate = meals[0].date;
    expect(mealDate).toBeInstanceOf(Timestamp);
    // Ensure restored object exposes Timestamp helpers
    expect(typeof mealDate.toDate).toBe('function');
    expect(typeof mealDate.toMillis).toBe('function');
    expect(meals[0].tags).toEqual(['fresh', 'light']);
  });
});
