import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useMealsQuery } from './useMealsQuery';
import { queryKeys } from './index';
import type { Idea } from '@/hooks/useIdeas';

// Enhanced useIdeas hook with React Query
export function useIdeasQuery() {
  // Depend on meals data for ideas computation
  const { meals, isLoading: mealsLoading, error: mealsError } = useMealsQuery();

  // Query for ideas derived from meals
  const {
    data: ideas = [],
    isLoading: ideasLoading,
    error: ideasError,
  } = useQuery({
    queryKey: queryKeys.ideas,
    queryFn: async (): Promise<Idea[]> => {
      // Group meals by name and calculate statistics
      const mealGroups = new Map<string, {
        mealName: string;
        count: number;
        lastMade: Date;
        hidden: boolean;
        tags: string[];
      }>();

      for (const meal of meals) {
        const existing = mealGroups.get(meal.mealName);
        const mealDate = meal.date.toDate();

        if (existing) {
          existing.count++;
          if (mealDate > existing.lastMade) {
            existing.lastMade = mealDate;
          }
          // Merge tags from all instances
          if (meal.tags) {
            const tagSet = new Set([...existing.tags, ...meal.tags]);
            existing.tags = Array.from(tagSet);
          }
          // If any instance is hidden, mark the idea as hidden
          if (meal.hidden) {
            existing.hidden = true;
          }
        } else {
          mealGroups.set(meal.mealName, {
            mealName: meal.mealName,
            count: 1,
            lastMade: mealDate,
            hidden: meal.hidden || false,
            tags: meal.tags ? [...meal.tags] : [],
          });
        }
      }

      // Convert to ideas array with Firestore Timestamp
      const ideasArray: Idea[] = Array.from(mealGroups.values()).map(group => ({
        mealName: group.mealName,
        count: group.count,
        lastMade: new Timestamp(
          Math.floor(group.lastMade.getTime() / 1000),
          (group.lastMade.getTime() % 1000) * 1000000
        ),
        hidden: group.hidden,
        tags: group.tags,
      }));

      // Sort by last made date (newest first)
      return ideasArray.sort((a, b) => b.lastMade.toMillis() - a.lastMade.toMillis());
    },
    enabled: !mealsLoading, // Run when meals are loaded (empty is valid)
    staleTime: 1 * 60 * 1000, // 1 minute for derived data
  });

  // Computed values — memoized to avoid recalculation on every render
  const visibleIdeas = useMemo(() => ideas.filter(idea => !idea.hidden), [ideas]);
  const hiddenIdeas = useMemo(() => ideas.filter(idea => idea.hidden), [ideas]);
  const totalIdeas = ideas.length;
  const hiddenCount = hiddenIdeas.length;

  // Get unique tags from all ideas
  const allTags = useMemo(() => {
    const tagSet = new Set(ideas.flatMap(idea => idea.tags || []));
    return Array.from(tagSet).sort();
  }, [ideas]);

  return {
    // Data
    ideas,
    visibleIdeas,
    hiddenIdeas,
    allTags,

    // Statistics
    totalIdeas,
    hiddenCount,
    visibleCount: visibleIdeas.length,

    // Loading states
    isLoading: mealsLoading || ideasLoading,

    // Errors
    error: mealsError || ideasError,

    // Helper functions
    getIdeaByName: (mealName: string) => ideas.find(idea => idea.mealName === mealName),
    getIdeasWithTag: (tag: string) => ideas.filter(idea => idea.tags?.includes(tag)),
    getRecentIdeas: (days: number = 30) => {
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      return ideas.filter(idea => idea.lastMade.toMillis() > cutoff);
    },
  };
}