import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Timestamp } from 'firebase/firestore';
import {
  getAllMeals,
  saveMeal,
  updateMeal,
  deleteMeal,
  hideMealsByName,
  updateMealTagsByName,
  type Meal,
} from '@/lib/offline-storage';
import { queryKeys } from './index';

// Enhanced useMeals hook with React Query
export function useMealsQuery() {
  const queryClient = useQueryClient();

  // Query for all meals
  const {
    data: meals = [],
    isLoading,
    error,
    refetch: loadMeals,
  } = useQuery({
    queryKey: queryKeys.meals,
    queryFn: async () => {
      const allMeals = await getAllMeals();
      // Sort by date descending
      return allMeals.sort((a, b) => b.date.toMillis() - a.date.toMillis());
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for meal data
  });

  // Mutation for saving a new meal
  const saveMealMutation = useMutation({
    mutationFn: async (meal: Meal) => {
      await saveMeal(meal);
      return meal;
    },
    onSuccess: (newMeal) => {
      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.meals, (oldMeals: Meal[] | undefined) => {
        if (!oldMeals) return [newMeal];
        const updated = [newMeal, ...oldMeals];
        return updated.sort((a, b) => b.date.toMillis() - a.date.toMillis());
      });

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.meals });
      queryClient.invalidateQueries({ queryKey: queryKeys.ideas });
    },
    onError: (error) => {
      console.error('Failed to save meal:', error);
    },
  });

  // Mutation for updating a meal
  const updateMealMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { mealName?: string; date?: Timestamp } }) => {
      const updatedMeal = await updateMeal(id, updates);
      return { id, updatedMeal };
    },
    onSuccess: ({ id, updatedMeal }) => {
      if (updatedMeal) {
        // Optimistically update the cache
        queryClient.setQueryData(queryKeys.meals, (oldMeals: Meal[] | undefined) => {
          if (!oldMeals) return [];
          const updated = oldMeals.map(meal => meal.id === id ? updatedMeal : meal);
          return updated.sort((a, b) => b.date.toMillis() - a.date.toMillis());
        });
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.ideas });
    },
    onError: (error) => {
      console.error('Failed to update meal:', error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: queryKeys.meals });
    },
  });

  // Mutation for deleting a meal
  const deleteMealMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteMeal(id);
      return id;
    },
    onSuccess: (deletedId) => {
      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.meals, (oldMeals: Meal[] | undefined) => {
        if (!oldMeals) return [];
        return oldMeals.filter(meal => meal.id !== deletedId);
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.ideas });
    },
    onError: (error) => {
      console.error('Failed to delete meal:', error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: queryKeys.meals });
    },
  });

  // Mutation for hiding/showing meals by name
  const toggleMealVisibilityMutation = useMutation({
    mutationFn: async ({ mealName, hidden }: { mealName: string; hidden: boolean }) => {
      await hideMealsByName(mealName, hidden);
      return { mealName, hidden };
    },
    onSuccess: ({ mealName, hidden }) => {
      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.meals, (oldMeals: Meal[] | undefined) => {
        if (!oldMeals) return [];
        return oldMeals.map(meal =>
          meal.mealName === mealName ? { ...meal, hidden } : meal
        );
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.ideas });
    },
    onError: (error) => {
      console.error('Failed to toggle meal visibility:', error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: queryKeys.meals });
    },
  });

  // Mutation for updating meal tags
  const updateMealTagsMutation = useMutation({
    mutationFn: async ({ mealName, tags }: { mealName: string; tags: string[] }) => {
      await updateMealTagsByName(mealName, tags);
      return { mealName, tags };
    },
    onSuccess: ({ mealName, tags }) => {
      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.meals, (oldMeals: Meal[] | undefined) => {
        if (!oldMeals) return [];
        return oldMeals.map(meal =>
          meal.mealName === mealName ? { ...meal, tags: [...tags] } : meal
        );
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.ideas });
    },
    onError: (error) => {
      console.error('Failed to update meal tags:', error);
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: queryKeys.meals });
    },
  });

  return {
    // Data
    meals,
    isLoading,
    error,

    // Actions
    loadMeals,
    saveMeal: saveMealMutation.mutate,
    updateMealData: updateMealMutation.mutate,
    deleteMealData: deleteMealMutation.mutate,
    toggleMealVisibility: toggleMealVisibilityMutation.mutate,
    updateMealTags: updateMealTagsMutation.mutate,

    // Mutation states
    isSaving: saveMealMutation.isPending,
    isUpdating: updateMealMutation.isPending,
    isDeleting: deleteMealMutation.isPending,
    isTogglingVisibility: toggleMealVisibilityMutation.isPending,
    isUpdatingTags: updateMealTagsMutation.isPending,

    // Mutation results
    saveError: saveMealMutation.error,
    updateError: updateMealMutation.error,
    deleteError: deleteMealMutation.error,
    visibilityError: toggleMealVisibilityMutation.error,
    tagsError: updateMealTagsMutation.error,
  };
}