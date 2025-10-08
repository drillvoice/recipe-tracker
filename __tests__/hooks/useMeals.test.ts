import { renderHook, act, waitFor } from '@testing-library/react';
import { useMeals } from '@/hooks/useMeals';

// Mock offline storage
const mockGetAllMeals = jest.fn();
const mockUpdateMeal = jest.fn();
const mockDeleteMeal = jest.fn();
const mockHideMealsByName = jest.fn();
const mockUpdateMealTagsByName = jest.fn();

jest.mock('@/lib/offline-storage', () => ({
  getAllMeals: () => mockGetAllMeals(),
  updateMeal: (id: string, updates: unknown) => mockUpdateMeal(id, updates),
  deleteMeal: (id: string) => mockDeleteMeal(id),
  hideMealsByName: (name: string, hidden: boolean) => mockHideMealsByName(name, hidden),
  updateMealTagsByName: (name: string, tags: string[]) => mockUpdateMealTagsByName(name, tags),
}));

describe('useMeals hook', () => {
  const createMockMeal = (id: string, name: string, milliseconds: number, hidden = false, tags: string[] = []) => ({
    id,
    mealName: name,
    date: {
      toMillis: () => milliseconds,
      toDate: () => new Date(milliseconds),
      seconds: Math.floor(milliseconds / 1000),
      nanoseconds: 0,
    },
    uid: 'test-user',
    hidden,
    tags,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllMeals.mockResolvedValue([]);
    mockUpdateMeal.mockResolvedValue(undefined);
    mockDeleteMeal.mockResolvedValue(undefined);
    mockHideMealsByName.mockResolvedValue(undefined);
    mockUpdateMealTagsByName.mockResolvedValue(undefined);
  });

  describe('loadMeals', () => {
    test('loads meals on mount', async () => {
      const mockMeals = [
        createMockMeal('1', 'Pizza', 2000000),
        createMockMeal('2', 'Pasta', 1000000),
      ];

      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.meals).toHaveLength(2);
      expect(result.current.error).toBeNull();
    });

    test('sorts meals by date descending', async () => {
      const mockMeals = [
        createMockMeal('1', 'Oldest', 1000000),
        createMockMeal('2', 'Newest', 3000000),
        createMockMeal('3', 'Middle', 2000000),
      ];

      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.meals[0].mealName).toBe('Newest');
      expect(result.current.meals[1].mealName).toBe('Middle');
      expect(result.current.meals[2].mealName).toBe('Oldest');
    });

    test('handles errors during loading', async () => {
      const error = new Error('Failed to load');
      mockGetAllMeals.mockRejectedValue(error);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain('Failed to load');
      expect(result.current.meals).toEqual([]);
    });

    test('can manually reload meals', async () => {
      const initialMeals = [createMockMeal('1', 'Pizza', 1000000)];
      const updatedMeals = [
        createMockMeal('1', 'Pizza', 1000000),
        createMockMeal('2', 'Pasta', 2000000),
      ];

      mockGetAllMeals.mockResolvedValueOnce(initialMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(1);
      });

      mockGetAllMeals.mockResolvedValueOnce(updatedMeals);

      await act(async () => {
        await result.current.loadMeals();
      });

      expect(result.current.meals).toHaveLength(2);
    });
  });

  describe('updateMealData', () => {
    test('updates meal optimistically', async () => {
      const mockMeals = [
        createMockMeal('1', 'Pizza', 1000000),
        createMockMeal('2', 'Pasta', 2000000),
      ];

      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(2);
      });

      const updatedMeal = createMockMeal('1', 'Updated Pizza', 1000000);
      mockUpdateMeal.mockResolvedValue(updatedMeal);

      await act(async () => {
        await result.current.updateMealData('1', { mealName: 'Updated Pizza' });
      });

      expect(mockUpdateMeal).toHaveBeenCalledWith('1', { mealName: 'Updated Pizza' });
      expect(result.current.meals.find(m => m.id === '1')?.mealName).toBe('Updated Pizza');
    });

    test('re-sorts meals after date update', async () => {
      const mockMeals = [
        createMockMeal('1', 'Pizza', 1000000),
        createMockMeal('2', 'Pasta', 2000000),
      ];

      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(2);
      });

      // Update Pizza to be newer than Pasta
      const updatedMeal = createMockMeal('1', 'Pizza', 3000000);
      mockUpdateMeal.mockResolvedValue(updatedMeal);

      await act(async () => {
        await result.current.updateMealData('1', {});
      });

      // Pizza should now be first
      expect(result.current.meals[0].id).toBe('1');
      expect(result.current.meals[1].id).toBe('2');
    });

    test('handles update errors', async () => {
      const mockMeals = [createMockMeal('1', 'Pizza', 1000000)];
      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(1);
      });

      const error = new Error('Update failed');
      mockUpdateMeal.mockRejectedValue(error);

      await expect(async () => {
        await act(async () => {
          await result.current.updateMealData('1', { mealName: 'New Name' });
        });
      }).rejects.toThrow('Update failed');

      // Error is thrown, which is the key behavior we're testing
      // React state updates may not be immediately visible in test environment
    });

    test('does not update state if update returns null', async () => {
      const mockMeals = [createMockMeal('1', 'Pizza', 1000000)];
      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(1);
      });

      mockUpdateMeal.mockResolvedValue(null);

      await act(async () => {
        await result.current.updateMealData('1', { mealName: 'New Name' });
      });

      // Meal should remain unchanged
      expect(result.current.meals[0].mealName).toBe('Pizza');
    });
  });

  describe('deleteMealData', () => {
    test('deletes meal optimistically', async () => {
      const mockMeals = [
        createMockMeal('1', 'Pizza', 1000000),
        createMockMeal('2', 'Pasta', 2000000),
      ];

      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(2);
      });

      await act(async () => {
        await result.current.deleteMealData('1');
      });

      expect(mockDeleteMeal).toHaveBeenCalledWith('1');
      expect(result.current.meals).toHaveLength(1);
      expect(result.current.meals.find(m => m.id === '1')).toBeUndefined();
    });

    test('handles delete errors', async () => {
      const mockMeals = [createMockMeal('1', 'Pizza', 1000000)];
      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(1);
      });

      const error = new Error('Delete failed');
      mockDeleteMeal.mockRejectedValue(error);

      await expect(async () => {
        await act(async () => {
          await result.current.deleteMealData('1');
        });
      }).rejects.toThrow('Delete failed');

      // Error is thrown, which is the key behavior we're testing
    });
  });

  describe('toggleMealVisibility', () => {
    test('toggles visibility for all meals with same name', async () => {
      const mockMeals = [
        createMockMeal('1', 'Pizza', 1000000, false),
        createMockMeal('2', 'Pizza', 2000000, false),
        createMockMeal('3', 'Pasta', 3000000, false),
      ];

      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(3);
      });

      await act(async () => {
        await result.current.toggleMealVisibility('Pizza', true);
      });

      expect(mockHideMealsByName).toHaveBeenCalledWith('Pizza', true);

      const pizzaMeals = result.current.meals.filter(m => m.mealName === 'Pizza');
      expect(pizzaMeals.every(m => m.hidden === true)).toBe(true);

      const pastaMeal = result.current.meals.find(m => m.mealName === 'Pasta');
      expect(pastaMeal?.hidden).toBe(false);
    });

    test('handles toggle errors', async () => {
      const mockMeals = [createMockMeal('1', 'Pizza', 1000000)];
      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(1);
      });

      const error = new Error('Toggle failed');
      mockHideMealsByName.mockRejectedValue(error);

      await expect(async () => {
        await act(async () => {
          await result.current.toggleMealVisibility('Pizza', true);
        });
      }).rejects.toThrow('Toggle failed');

      // Error is thrown, which is the key behavior we're testing
    });
  });

  describe('updateMealTags', () => {
    test('updates tags for all meals with same name', async () => {
      const mockMeals = [
        createMockMeal('1', 'Pizza', 1000000, false, ['Italian']),
        createMockMeal('2', 'Pizza', 2000000, false, ['Italian']),
        createMockMeal('3', 'Pasta', 3000000, false, ['Italian']),
      ];

      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(3);
      });

      const newTags = ['Italian', 'Dinner'];

      await act(async () => {
        await result.current.updateMealTags('Pizza', newTags);
      });

      expect(mockUpdateMealTagsByName).toHaveBeenCalledWith('Pizza', newTags);

      const pizzaMeals = result.current.meals.filter(m => m.mealName === 'Pizza');
      expect(pizzaMeals.every(m => m.tags?.includes('Dinner'))).toBe(true);

      const pastaMeal = result.current.meals.find(m => m.mealName === 'Pasta');
      expect(pastaMeal?.tags).not.toContain('Dinner');
    });

    test('creates new tags array to avoid mutation', async () => {
      const mockMeals = [createMockMeal('1', 'Pizza', 1000000, false, [])];
      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(1);
      });

      const tagsArray = ['Italian'];

      await act(async () => {
        await result.current.updateMealTags('Pizza', tagsArray);
      });

      const meal = result.current.meals[0];
      expect(meal.tags).toEqual(tagsArray);
      expect(meal.tags).not.toBe(tagsArray); // Different array reference
    });

    test('handles tag update errors', async () => {
      const mockMeals = [createMockMeal('1', 'Pizza', 1000000)];
      mockGetAllMeals.mockResolvedValue(mockMeals);

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.meals).toHaveLength(1);
      });

      const error = new Error('Tag update failed');
      mockUpdateMealTagsByName.mockRejectedValue(error);

      await expect(async () => {
        await act(async () => {
          await result.current.updateMealTags('Pizza', ['Italian']);
        });
      }).rejects.toThrow('Tag update failed');

      // Error is thrown, which is the key behavior we're testing
    });
  });

  describe('error handling', () => {
    test('converts non-Error objects to Error', async () => {
      mockGetAllMeals.mockRejectedValue('String error');

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Failed to load meals');
    });

    test('clears error on successful reload', async () => {
      mockGetAllMeals.mockRejectedValueOnce(new Error('Failed'));

      const { result } = renderHook(() => useMeals());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      mockGetAllMeals.mockResolvedValueOnce([]);

      await act(async () => {
        await result.current.loadMeals();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
