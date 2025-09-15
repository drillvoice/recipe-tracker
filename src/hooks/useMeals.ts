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
      await updateMeal(id, updates);
      await loadMeals();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update meal'));
      throw err;
    }
  }, [loadMeals]);

  const deleteMealData = useCallback(async (id: string) => {
    try {
      await deleteMeal(id);
      await loadMeals();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete meal'));
      throw err;
    }
  }, [loadMeals]);

  const toggleMealVisibility = useCallback(async (mealName: string, hidden: boolean) => {
    try {
      await hideMealsByName(mealName, hidden);
      await loadMeals();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to toggle meal visibility'));
      throw err;
    }
  }, [loadMeals]);

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