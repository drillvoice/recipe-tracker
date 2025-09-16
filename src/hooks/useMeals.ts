import { useEffect, useState, useCallback } from 'react';
import { getAllMeals, updateMeal, deleteMeal, hideMealsByName, type Meal } from '@/lib/offline-storage';
import { migrateLegacyData, isMigrationNeeded } from '@/lib/database-migration';
import { Timestamp } from 'firebase/firestore';

export function useMeals() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadMeals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if migration is needed and run it
      if (await isMigrationNeeded()) {
        console.log('Running legacy data migration...');
        const migrationResult = await migrateLegacyData();
        if (!migrationResult.success) {
          console.error('Migration errors:', migrationResult.errors);
        } else {
          console.log(`Successfully migrated ${migrationResult.migratedCount} meals`);
        }
      }

      const all = await getAllMeals();
      all.sort((a, b) => b.date.toMillis() - a.date.toMillis());
      setMeals(all);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load meals'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateMealData = useCallback(async (id: string, updates: { mealName?: string; date?: Timestamp }) => {
    try {
      const updatedMeal = await updateMeal(id, updates);
      if (updatedMeal) {
        // Optimistically update local state instead of full reload
        setMeals(prevMeals => {
          const newMeals = prevMeals.map(meal =>
            meal.id === id ? updatedMeal : meal
          );
          // Re-sort after update
          newMeals.sort((a, b) => b.date.toMillis() - a.date.toMillis());
          return newMeals;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update meal'));
      throw err;
    }
  }, []);

  const deleteMealData = useCallback(async (id: string) => {
    try {
      await deleteMeal(id);
      // Optimistically update local state instead of full reload
      setMeals(prevMeals => prevMeals.filter(meal => meal.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete meal'));
      throw err;
    }
  }, []);

  const toggleMealVisibility = useCallback(async (mealName: string, hidden: boolean) => {
    try {
      await hideMealsByName(mealName, hidden);
      // Optimistically update local state instead of full reload
      setMeals(prevMeals =>
        prevMeals.map(meal =>
          meal.mealName === mealName ? { ...meal, hidden } : meal
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to toggle meal visibility'));
      throw err;
    }
  }, []);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  return {
    meals,
    isLoading,
    error,
    loadMeals,
    updateMealData,
    deleteMealData,
    toggleMealVisibility
  };
}