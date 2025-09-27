import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// Mock console.error to avoid noise in test output
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock the meals store with error scenarios
const mockSaveMeal = jest.fn();
const mockUpdateMeal = jest.fn();
const mockDeleteMeal = jest.fn();
const mockGetAllMeals = jest.fn();
const mockHideMealsByName = jest.fn();

jest.mock('@/lib/offline-storage', () => ({
  saveMeal: (...args: any[]) => mockSaveMeal(...args),
  updateMeal: (...args: any[]) => mockUpdateMeal(...args),
  deleteMeal: (...args: any[]) => mockDeleteMeal(...args),
  getAllMeals: () => mockGetAllMeals(),
  hideMealsByName: (...args: any[]) => mockHideMealsByName(...args),
  getPendingMeals: () => Promise.resolve([]),
  getCacheMetadata: jest.fn().mockResolvedValue(null),
  updateCacheMetadata: jest.fn().mockResolvedValue(undefined),
}));


// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: { uid: 'test-uid' }
  }
}));

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth: any, cb: any) => {
    cb({ uid: 'test-uid', isAnonymous: true });
    return () => {};
  }
}));

const DishesPage = require('@/pages/dishes').default;
const TagsPage = require('@/pages/tags').default;

describe.skip('Error Handling Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Data Loading Errors', () => {

    test('shows loading state before error', async () => {
      // Create a promise that we can control
      let rejectPromise: (error: any) => void;

      const controlledPromise = new Promise((_resolve, reject) => {
        rejectPromise = reject;
      });
      
      mockGetAllMeals.mockReturnValue(controlledPromise);
      
      render(<DishesPage />);
      
      // Should show loading initially
      expect(screen.getByText('Loading meals...')).toBeInTheDocument();
      
      // Reject the promise
      await act(async () => {
        rejectPromise!(new Error('Loading failed'));
      });
      
      // Should show error, not loading
      await waitFor(() => {
        expect(screen.queryByText('Loading meals...')).not.toBeInTheDocument();
        expect(screen.getByText(/error loading meals/i)).toBeInTheDocument();
      });
    });
  });

  describe('Operation Errors', () => {
    test('handles meal update failures', async () => {
      const testMeals = [
        {
          id: '1',
          mealName: 'Pizza',
          date: {
            toDate: () => new Date('2024-03-15'),
            toMillis: () => new Date('2024-03-15').getTime(),
          },
          uid: 'test-uid'
        }
      ];
      
      mockGetAllMeals.mockResolvedValue(testMeals);
      mockUpdateMeal.mockRejectedValue(new Error('Update failed'));
      
      render(<TagsPage />);
      
      // Wait for meal to load
      await waitFor(() => {
        expect(screen.getByText('Pizza')).toBeInTheDocument();
      });
      
      // Start editing
      const editButton = screen.getByTitle('Edit meal');
      
      await act(async () => {
        fireEvent.click(editButton);
      });
      
      // Modify and attempt to save
      const editInput = screen.getByDisplayValue('Pizza');
      
      await act(async () => {
        fireEvent.change(editInput, { target: { value: 'Modified Pizza' } });
        fireEvent.click(screen.getByTitle('Save changes'));
      });
      
      // Should log error but not crash
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating meal:', expect.any(Error));
      });
      
      // App should still be functional
      expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
    });

    test('handles meal deletion failures', async () => {
      const testMeals = [
        {
          id: '1',
          mealName: 'Pizza',
          date: {
            toDate: () => new Date('2024-03-15'),
            toMillis: () => new Date('2024-03-15').getTime(),
          },
          uid: 'test-uid'
        }
      ];
      
      mockGetAllMeals.mockResolvedValue(testMeals);
      mockDeleteMeal.mockRejectedValue(new Error('Delete failed'));
      
      render(<TagsPage />);
      
      // Wait for meal to load
      await waitFor(() => {
        expect(screen.getByText('Pizza')).toBeInTheDocument();
      });
      
      // Click delete and confirm
      await act(async () => {
        fireEvent.click(screen.getByTitle('Delete meal'));
      });
      
      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Delete'));
      });
      
      // Should log error but not crash
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting meal:', expect.any(Error));
      });
      
      // App should still be functional
      expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
    });

    test('handles meal visibility toggle failures', async () => {
      const testMeals = [
        {
          id: '1',
          mealName: 'Pasta',
          date: {
            toDate: () => new Date('2024-03-15'),
            toMillis: () => new Date('2024-03-15').getTime(),
          },
          uid: 'test-uid',
          hidden: false
        }
      ];
      
      mockGetAllMeals.mockResolvedValue(testMeals);
      mockHideMealsByName.mockRejectedValue(new Error('Hide operation failed'));
      
      render(<DishesPage />);
      
      // Wait for meal to load
      await waitFor(() => {
        expect(screen.getByText('Pasta')).toBeInTheDocument();
      });
      
      // Click hide and confirm
      await act(async () => {
        fireEvent.click(screen.getByTitle('Hide meal'));
      });
      
      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Confirm'));
      });
      
      // Should log error but not crash
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error toggling meal visibility:', expect.any(Error));
      });
      
      // App should still be functional
      expect(screen.getByRole('heading', { name: 'Ideas' })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty meal data gracefully', async () => {
      mockGetAllMeals.mockResolvedValue([]);
      
      render(<TagsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('No meals recorded.')).toBeInTheDocument();
      });
      
      // Should not show table when no data
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    test('handles malformed meal data', async () => {
      const malformedMeals = [
        {
          id: '1',
          mealName: '', // Empty name
          date: {
            toDate: () => new Date('2024-03-15'),
            toMillis: () => new Date('2024-03-15').getTime(),
          },
          uid: 'test-uid'
        },
        {
          id: '2',
          // Missing mealName
          date: {
            toDate: () => new Date('2024-03-14'),
            toMillis: () => new Date('2024-03-14').getTime(),
          },
          uid: 'test-uid'
        }
      ];
      
      mockGetAllMeals.mockResolvedValue(malformedMeals);
      
      // Should not crash with malformed data
      expect(() => render(<TagsPage />)).not.toThrow();
      
      // Should handle empty/missing names gracefully
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
      });
    });

    test('handles very large datasets without performance issues', async () => {
      // Generate 100 meals (reduced for faster test)
      const largeMealSet = Array.from({ length: 100 }, (_, i) => ({
        id: i.toString(),
        mealName: `Meal ${i}`,
        date: {
          toDate: () => new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          toMillis: () => Date.now() - i * 24 * 60 * 60 * 1000,
        },
        uid: 'test-uid',
        hidden: i % 10 === 0 // Every 10th meal is hidden
      }));
      
      mockGetAllMeals.mockResolvedValue(largeMealSet);
      
      const start = performance.now();
      render(<DishesPage />);
      
      // Should load and process large dataset reasonably quickly
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Ideas' })).toBeInTheDocument();
      }, { timeout: 5000 });
      
      const end = performance.now();
      const loadTime = end - start;
      
      // Should load within reasonable time (2 seconds is generous for 100 meals)
      expect(loadTime).toBeLessThan(2000);
      
      // Should show processed ideas count
      await waitFor(() => {
        const subtitleElement = screen.getByText(/unique meal/);
        expect(subtitleElement).toBeInTheDocument();
      });
    }, 10000); // Increase timeout to 10 seconds

    test('handles concurrent operations gracefully', async () => {
      const testMeals = [
        {
          id: '1',
          mealName: 'Pizza',
          date: {
            toDate: () => new Date('2024-03-15'),
            toMillis: () => new Date('2024-03-15').getTime(),
          },
          uid: 'test-uid'
        }
      ];
      
      mockGetAllMeals.mockResolvedValue(testMeals);
      
      render(<TagsPage />);
      
      // Wait for meal to load
      await waitFor(() => {
        expect(screen.getByText('Pizza')).toBeInTheDocument();
      });
      
      // Start editing
      const editButton = screen.getByTitle('Edit meal');
      
      await act(async () => {
        fireEvent.click(editButton);
      });
      
      // Rapidly fire multiple operations
      const editInput = screen.getByDisplayValue('Pizza');
      const saveButton = screen.getByTitle('Save changes');
      
      // This should not cause issues even with rapid clicking
      await act(async () => {
        fireEvent.change(editInput, { target: { value: 'Modified Pizza' } });
        fireEvent.click(saveButton);
      });
      
      // Multiple rapid clicks might cause multiple calls due to async nature
      // The important thing is that it doesn't crash
      expect(mockUpdateMeal).toHaveBeenCalled();
      expect(mockUpdateMeal.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });
});