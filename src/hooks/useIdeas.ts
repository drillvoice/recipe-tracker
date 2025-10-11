import { useMemo } from 'react';
import { useMeals } from './useMeals';
import type { Meal } from '@/lib/offline-storage';

export interface Idea {
  mealName: string;
  lastMade: Meal["date"];
  count: number;
  hidden: boolean;
  tags: string[]; // Array of simple tag strings
}

export function useIdeas() {
  const { meals, isLoading, error, toggleMealVisibility, updateMealTags, renameDishAllInstances, deleteAllInstancesOfDish } = useMeals();

  const ideas = useMemo(() => {
    const map = new Map<string, Idea>();

    for (const meal of meals) {
      const existing = map.get(meal.mealName);
      if (existing) {
        existing.count += 1;
        if (meal.date.toMillis() > existing.lastMade.toMillis()) {
          existing.lastMade = meal.date;
        }
        // If any meal with this name is hidden, mark the idea as hidden
        if (meal.hidden) {
          existing.hidden = true;
        }
        // Merge tags from this meal (avoid duplicates)
        if (meal.tags) {
          for (const tag of meal.tags) {
            if (!existing.tags.includes(tag)) {
              existing.tags.push(tag);
            }
          }
        }
      } else {
        map.set(meal.mealName, {
          mealName: meal.mealName,
          lastMade: meal.date,
          count: 1,
          hidden: meal.hidden || false,
          tags: meal.tags ? [...meal.tags] : [], // Copy tags array
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
  }, [meals]);

  return {
    ideas,
    isLoading,
    error,
    toggleMealVisibility,
    updateMealTags,
    renameDishAllInstances,
    deleteAllInstancesOfDish
  };
}