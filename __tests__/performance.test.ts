import { measurePerformance } from '@/utils/performance';
import { Timestamp } from 'firebase/firestore';
import type { Meal } from '@/lib/offline-storage';
import type { Idea } from '@/hooks/useIdeas';

// Mock data generators
const generateMockMeal = (id: number, mealName?: string): Meal => ({
  id: id.toString(),
  mealName: mealName || `Meal ${id}`,
  date: Timestamp.fromDate(new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)),
  uid: 'test-uid',
  hidden: Math.random() > 0.8, // 20% chance of being hidden
  tags: mealName ? mealName.split(' ').slice(0, 2) : ['Meal'],
});

const generateMockMeals = (count: number): Meal[] => {
  const meals: Meal[] = [];
  const mealNames = ['Pizza', 'Pasta', 'Salad', 'Burger', 'Soup', 'Rice', 'Chicken', 'Fish'];
  
  for (let i = 0; i < count; i++) {
    const mealName = mealNames[i % mealNames.length];
    meals.push(generateMockMeal(i, `${mealName} ${Math.floor(i / mealNames.length) + 1}`));
  }
  
  return meals;
};

// Ideas processing function (extracted from useIdeas hook)
const processIdeas = (meals: Meal[]): Idea[] => {
  const map = new Map<string, Idea>();
  
  for (const meal of meals) {
    const existing = map.get(meal.mealName);
    if (existing) {
      existing.count += 1;
      if (meal.date.toMillis() > existing.lastMade.toMillis()) {
        existing.lastMade = meal.date;
      }
      if (meal.hidden) {
        existing.hidden = true;
      }
    } else {
      map.set(meal.mealName, {
        mealName: meal.mealName,
        lastMade: meal.date,
        count: 1,
        hidden: meal.hidden || false,
        tags: [], // Empty tags array for performance test
      });
    }
  }
  
  const arr = Array.from(map.values());
  arr.sort(
    (a, b) =>
      b.lastMade.toMillis() - a.lastMade.toMillis() ||
      a.mealName.localeCompare(b.mealName)
  );
  return arr;
};

describe('Performance Tests', () => {
  // Test data processing performance with different dataset sizes
  const testCases = [10, 100, 500, 1000];

  testCases.forEach(mealCount => {
    test(`Ideas processing performance with ${mealCount} meals`, () => {
      const meals = generateMockMeals(mealCount);
      
      const result = measurePerformance(
        `Process ${mealCount} meals into ideas`,
        () => processIdeas(meals),
        5 // Run 5 times for average
      );
      
      expect(result.averageTime).toBeDefined();
      expect(result.averageTime!).toBeLessThan(100); // Should process in under 100ms
      
      // Log results for analysis
      console.log(`${mealCount} meals -> ${result.averageTime?.toFixed(2)}ms average`);
    });
  });

  test('Meal sorting performance', () => {
    const meals = generateMockMeals(1000);
    
    const result = measurePerformance(
      'Sort 1000 meals by date',
      () => {
        const sorted = [...meals];
        sorted.sort((a, b) => b.date.toMillis() - a.date.toMillis());
        return sorted;
      },
      10
    );
    
    expect(result.averageTime).toBeDefined();
    expect(result.averageTime!).toBeLessThan(50); // Sorting should be fast
    
    console.log(`Meal sorting: ${result.averageTime?.toFixed(2)}ms average`);
  });

  test('Ideas filtering performance', () => {
    const meals = generateMockMeals(500);
    const ideas = processIdeas(meals);
    
    const result = measurePerformance(
      'Filter ideas (show/hide)',
      () => {
        const visible = ideas.filter(idea => !idea.hidden);
        const hidden = ideas.filter(idea => idea.hidden);
        return { visible, hidden };
      },
      20
    );
    
    expect(result.averageTime).toBeDefined();
    expect(result.averageTime!).toBeLessThan(10); // Filtering should be very fast
    
    console.log(`Ideas filtering: ${result.averageTime?.toFixed(2)}ms average`);
  });

  test('Memory usage - large dataset processing', () => {
    const performanceWithMemory = performance as Performance & {
      memory?: { usedJSHeapSize: number };
    };
    const initialMemory = performanceWithMemory.memory?.usedJSHeapSize || 0;
    
    // Process a large dataset
    const meals = generateMockMeals(5000);
    const ideas = processIdeas(meals);
    
    const finalMemory = performanceWithMemory.memory?.usedJSHeapSize || 0;
    const memoryIncrease = finalMemory - initialMemory;
    
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.length).toBeLessThanOrEqual(meals.length);
    
    // Log memory usage if available
    if (initialMemory > 0) {
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    }
  });

  test('Component render performance simulation', () => {
    const meals = generateMockMeals(200);
    
    // Simulate multiple re-renders like React would do
    const result = measurePerformance(
      'Simulate component re-renders',
      () => {
        // Simulate the work done on each render
        const sortedMeals = [...meals].sort((a, b) => b.date.toMillis() - a.date.toMillis());
        const ideas = processIdeas(sortedMeals);
        const visibleIdeas = ideas.filter(idea => !idea.hidden);
        
        return {
          mealsCount: sortedMeals.length,
          ideasCount: ideas.length,
          visibleCount: visibleIdeas.length
        };
      },
      10
    );
    
    expect(result.averageTime).toBeDefined();
    expect(result.averageTime!).toBeLessThan(200); // Should handle re-renders efficiently
    
    console.log(`Component render simulation: ${result.averageTime?.toFixed(2)}ms average`);
  });
});