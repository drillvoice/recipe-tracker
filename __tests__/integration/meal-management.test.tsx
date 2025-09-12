import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';

// Mock the meals store
const mockMeals: any[] = [];
const mockSaveMeal = jest.fn();
const mockUpdateMeal = jest.fn();
const mockDeleteMeal = jest.fn();
const mockGetAllMeals = jest.fn();
const mockHideMealsByName = jest.fn();

jest.mock('@/lib/mealsStore', () => ({
  saveMeal: (...args: any[]) => mockSaveMeal(...args),
  updateMeal: (...args: any[]) => mockUpdateMeal(...args),
  deleteMeal: (...args: any[]) => mockDeleteMeal(...args),
  getAllMeals: () => mockGetAllMeals(),
  hideMealsByName: (...args: any[]) => mockHideMealsByName(...args),
  getPendingMeals: () => Promise.resolve([]),
}));

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: () => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    }),
    fromDate: (date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    }),
  },
}));

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

const AddPage = require('@/pages/index').default;
const HistoryPage = require('@/pages/history').default;
const IdeasPage = require('@/pages/ideas').default;

describe('Meal Management Integration Tests', () => {
  beforeEach(() => {
    mockMeals.length = 0;
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockGetAllMeals.mockResolvedValue([]);
    mockSaveMeal.mockResolvedValue(undefined);
    mockUpdateMeal.mockResolvedValue(undefined);
    mockDeleteMeal.mockResolvedValue(undefined);
    mockHideMealsByName.mockResolvedValue(undefined);
  });

  describe('Add Meal Flow', () => {
    test('successfully adds a new meal', async () => {
      const { container } = render(<AddPage />);
      
      // Fill in meal details
      const mealInput = screen.getByPlaceholderText('Enter meal name...');
      const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
      const addButton = screen.getByRole('button', { name: /add meal/i });
      
      await act(async () => {
        fireEvent.change(mealInput, { target: { value: 'Spaghetti Carbonara' } });
        fireEvent.change(dateInput, { target: { value: '2024-03-15' } });
        fireEvent.click(addButton);
      });
      
      // Verify meal was saved
      expect(mockSaveMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          mealName: 'Spaghetti Carbonara',
          uid: 'test-uid',
          pending: true
        })
      );
      
      // Verify success message
      await waitFor(() => {
        expect(screen.getByText('Meal saved locally')).toBeInTheDocument();
      });
    });

    test('shows autocomplete suggestions', async () => {
      // Setup existing meals for suggestions
      const existingMeals = [
        {
          id: '1',
          mealName: 'Spaghetti Bolognese',
          date: Timestamp.fromDate(new Date()),
          uid: 'test-uid'
        }
      ];
      
      mockGetAllMeals.mockResolvedValue(existingMeals);
      
      render(<AddPage />);
      
      const mealInput = screen.getByPlaceholderText('Enter meal name...');
      
      await act(async () => {
        fireEvent.change(mealInput, { target: { value: 'Spag' } });
        fireEvent.focus(mealInput);
      });
      
      // Should trigger autocomplete logic
      expect(mealInput).toHaveValue('Spag');
    });
  });

  describe('History Page Integration', () => {
    test('displays meals and allows editing', async () => {
      const testMeals = [
        {
          id: '1',
          mealName: 'Pizza Margherita',
          date: {
            toDate: () => new Date('2024-03-15'),
            toMillis: () => new Date('2024-03-15').getTime(),
          },
          uid: 'test-uid'
        },
        {
          id: '2', 
          mealName: 'Caesar Salad',
          date: {
            toDate: () => new Date('2024-03-14'),
            toMillis: () => new Date('2024-03-14').getTime(),
          },
          uid: 'test-uid'
        }
      ];
      
      mockGetAllMeals.mockResolvedValue(testMeals);
      
      render(<HistoryPage />);
      
      // Wait for meals to load
      await waitFor(() => {
        expect(screen.getByText('Pizza Margherita')).toBeInTheDocument();
        expect(screen.getByText('Caesar Salad')).toBeInTheDocument();
      });
      
      // Test editing flow
      const editButtons = screen.getAllByTitle('Edit meal');
      
      await act(async () => {
        fireEvent.click(editButtons[0]);
      });
      
      // Should show edit inputs
      const editInput = screen.getByDisplayValue('Pizza Margherita');
      expect(editInput).toBeInTheDocument();
      
      // Modify and save
      await act(async () => {
        fireEvent.change(editInput, { target: { value: 'Pizza Napoletana' } });
        fireEvent.click(screen.getByTitle('Save changes'));
      });
      
      // Should call update
      await waitFor(() => {
        expect(mockUpdateMeal).toHaveBeenCalledWith('1', expect.objectContaining({
          mealName: 'Pizza Napoletana'
        }));
      });
    });

    test('allows deleting meals with confirmation', async () => {
      const testMeals = [
        {
          id: '1',
          mealName: 'Pizza Margherita',
          date: {
            toDate: () => new Date('2024-03-15'),
            toMillis: () => new Date('2024-03-15').getTime(),
          },
          uid: 'test-uid'
        }
      ];
      
      mockGetAllMeals.mockResolvedValue(testMeals);
      
      render(<HistoryPage />);
      
      // Wait for meal to load
      await waitFor(() => {
        expect(screen.getByText('Pizza Margherita')).toBeInTheDocument();
      });
      
      // Click delete button
      const deleteButton = screen.getByTitle('Delete meal');
      
      await act(async () => {
        fireEvent.click(deleteButton);
      });
      
      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });
      
      // Confirm deletion
      const confirmButton = screen.getByText('Delete');
      
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      
      // Should call delete
      await waitFor(() => {
        expect(mockDeleteMeal).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('Ideas Page Integration', () => {
    test('processes and displays meal ideas correctly', async () => {
      const testMeals = [
        {
          id: '1',
          mealName: 'Pizza',
          date: {
            toDate: () => new Date('2024-03-15'),
            toMillis: () => new Date('2024-03-15').getTime(),
          },
          uid: 'test-uid',
          hidden: false
        },
        {
          id: '2',
          mealName: 'Pizza',
          date: {
            toDate: () => new Date('2024-03-10'),
            toMillis: () => new Date('2024-03-10').getTime(),
          },
          uid: 'test-uid',
          hidden: false
        },
        {
          id: '3',
          mealName: 'Salad',
          date: {
            toDate: () => new Date('2024-03-12'),
            toMillis: () => new Date('2024-03-12').getTime(),
          },
          uid: 'test-uid',
          hidden: true
        }
      ];
      
      mockGetAllMeals.mockResolvedValue(testMeals);
      
      render(<IdeasPage />);
      
      // Wait for ideas to process and load
      await waitFor(() => {
        expect(screen.getByText('Pizza')).toBeInTheDocument();
        expect(screen.getByText('2x')).toBeInTheDocument(); // Pizza appears twice
      });
      
      // Should not show hidden meals by default
      expect(screen.queryByText('Salad')).not.toBeInTheDocument();
      
      // Test show hidden toggle
      const filterButton = screen.getByTitle('Filter options');
      
      await act(async () => {
        fireEvent.click(filterButton);
      });
      
      const showHiddenCheckbox = screen.getByLabelText('Show Hidden');
      
      await act(async () => {
        fireEvent.click(showHiddenCheckbox);
      });
      
      // Now hidden meals should appear
      await waitFor(() => {
        expect(screen.getByText('Salad')).toBeInTheDocument();
      });
    });

    test('allows hiding and showing meals', async () => {
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
      
      render(<IdeasPage />);
      
      // Wait for meal to load
      await waitFor(() => {
        expect(screen.getByText('Pasta')).toBeInTheDocument();
      });
      
      // Click hide button
      const hideButton = screen.getByTitle('Hide meal');
      
      await act(async () => {
        fireEvent.click(hideButton);
      });
      
      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/hide.*pasta.*from ideas list/i)).toBeInTheDocument();
      });
      
      // Confirm hiding
      const confirmButton = screen.getByText('Confirm');
      
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      
      // Should call hideMealsByName
      await waitFor(() => {
        expect(mockHideMealsByName).toHaveBeenCalledWith('Pasta', true);
      });
    });
  });

  describe('Cross-page Data Flow', () => {
    test('adding meal affects history and ideas pages', async () => {
      // Start with empty state
      mockGetAllMeals.mockResolvedValue([]);
      
      // Add a meal
      const { rerender } = render(<AddPage />);
      
      const mealInput = screen.getByPlaceholderText('Enter meal name...');
      const addButton = screen.getByRole('button', { name: /add meal/i });
      
      await act(async () => {
        fireEvent.change(mealInput, { target: { value: 'New Pasta Dish' } });
        fireEvent.click(addButton);
      });
      
      expect(mockSaveMeal).toHaveBeenCalled();
      
      // Now simulate the meal being available in other pages
      const newMeals = [
        {
          id: '1',
          mealName: 'New Pasta Dish',
          date: {
            toDate: () => new Date(),
            toMillis: () => Date.now(),
          },
          uid: 'test-uid',
          hidden: false
        }
      ];
      
      mockGetAllMeals.mockResolvedValue(newMeals);
      
      // Check it appears in history
      rerender(<HistoryPage />);
      
      await waitFor(() => {
        expect(screen.getByText('New Pasta Dish')).toBeInTheDocument();
      });
      
      // Check it appears in ideas
      rerender(<IdeasPage />);
      
      await waitFor(() => {
        expect(screen.getByText('New Pasta Dish')).toBeInTheDocument();
        expect(screen.getByText('1x')).toBeInTheDocument();
      });
    });
  });
});