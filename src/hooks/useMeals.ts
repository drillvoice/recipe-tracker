import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { getAllMeals, saveMeal, updateMeal, deleteMeal, hideMealsByName, updateMealTagsByName, updateMealNameByName, deleteMealsByName, type Meal } from '@/lib/offline-storage';
import { MEALS_CHANGED_EVENT } from '@/lib/meal-events';
import { Timestamp } from 'firebase/firestore';

// Every useMeals() consumer (calendar, history, suggestions, dishes page)
// shares this one in-memory store, so an edit made in one component shows up
// in all of them, IndexedDB is read once per page rather than once per
// component, and revisiting a page renders cached data immediately.
interface MealsState {
  meals: Meal[];
  isLoading: boolean;
  error: Error | null;
}

const INITIAL_STATE: MealsState = { meals: [], isLoading: true, error: null };

let state: MealsState = INITIAL_STATE;
let hasLoaded = false;
let inFlightLoad: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(updater: (prev: MealsState) => MealsState): void {
  state = updater(state);
  listeners.forEach(listener => listener());
}

function sortByDateDesc(meals: Meal[]): Meal[] {
  return meals.sort((a, b) => b.date.toMillis() - a.date.toMillis());
}

function toError(err: unknown, fallback: string): Error {
  return err instanceof Error ? err : new Error(fallback);
}

function loadSharedMeals(): Promise<void> {
  if (inFlightLoad) return inFlightLoad;

  // Only show a loading state before the first load; later reloads refresh
  // in the background so lists don't flash "Loading..." after every edit.
  if (!hasLoaded) {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
  }

  inFlightLoad = (async () => {
    try {
      const all = sortByDateDesc(await getAllMeals());
      hasLoaded = true;
      setState(() => ({ meals: all, isLoading: false, error: null }));
    } catch (err) {
      setState(prev => ({ ...prev, isLoading: false, error: toError(err, 'Failed to load meals') }));
    } finally {
      inFlightLoad = null;
    }
  })();

  return inFlightLoad;
}

function handleExternalChange(): void {
  void loadSharedMeals();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener(MEALS_CHANGED_EVENT, handleExternalChange);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener(MEALS_CHANGED_EVENT, handleExternalChange);
    }
  };
}

function getSnapshot(): MealsState {
  return state;
}

function getServerSnapshot(): MealsState {
  return INITIAL_STATE;
}

/** Reset the shared store (tests only). */
export function __resetMealsStore(): void {
  state = INITIAL_STATE;
  hasLoaded = false;
  inFlightLoad = null;
}

export function useMeals() {
  const { meals, isLoading, error } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const loadMeals = useCallback(() => loadSharedMeals(), []);

  const runMutation = useCallback(async (operation: () => Promise<void>, fallbackMessage: string) => {
    try {
      await operation();
    } catch (err) {
      setState(prev => ({ ...prev, error: toError(err, fallbackMessage) }));
      throw err;
    }
  }, []);

  const addMeal = useCallback((meal: Meal) => runMutation(async () => {
    await saveMeal(meal);
    setState(prev => ({
      ...prev,
      meals: sortByDateDesc([meal, ...prev.meals.filter(existing => existing.id !== meal.id)])
    }));
  }, 'Failed to save meal'), [runMutation]);

  const updateMealData = useCallback((id: string, updates: { mealName?: string; date?: Timestamp }) => runMutation(async () => {
    const updatedMeal = await updateMeal(id, updates);
    if (updatedMeal) {
      setState(prev => ({
        ...prev,
        meals: sortByDateDesc(prev.meals.map(meal => meal.id === id ? updatedMeal : meal))
      }));
    }
  }, 'Failed to update meal'), [runMutation]);

  const deleteMealData = useCallback((id: string) => runMutation(async () => {
    await deleteMeal(id);
    setState(prev => ({ ...prev, meals: prev.meals.filter(meal => meal.id !== id) }));
  }, 'Failed to delete meal'), [runMutation]);

  const toggleMealVisibility = useCallback((mealName: string, hidden: boolean) => runMutation(async () => {
    await hideMealsByName(mealName, hidden);
    setState(prev => ({
      ...prev,
      meals: prev.meals.map(meal => meal.mealName === mealName ? { ...meal, hidden } : meal)
    }));
  }, 'Failed to toggle meal visibility'), [runMutation]);

  const updateMealTags = useCallback((mealName: string, tags: string[]) => runMutation(async () => {
    await updateMealTagsByName(mealName, tags);
    setState(prev => ({
      ...prev,
      meals: prev.meals.map(meal => meal.mealName === mealName ? { ...meal, tags: [...tags] } : meal)
    }));
  }, 'Failed to update meal tags'), [runMutation]);

  const renameDishAllInstances = useCallback((oldName: string, newName: string) => runMutation(async () => {
    await updateMealNameByName(oldName, newName);
    setState(prev => ({
      ...prev,
      meals: prev.meals.map(meal => meal.mealName === oldName ? { ...meal, mealName: newName } : meal)
    }));
  }, 'Failed to rename dish'), [runMutation]);

  const deleteAllInstancesOfDish = useCallback((mealName: string) => runMutation(async () => {
    await deleteMealsByName(mealName);
    setState(prev => ({ ...prev, meals: prev.meals.filter(meal => meal.mealName !== mealName) }));
  }, 'Failed to delete dish'), [runMutation]);

  // Revalidate on mount; concurrent mounts share one IndexedDB read.
  useEffect(() => {
    void loadSharedMeals();
  }, []);

  return {
    meals,
    isLoading,
    error,
    loadMeals,
    addMeal,
    updateMealData,
    deleteMealData,
    toggleMealVisibility,
    updateMealTags,
    renameDishAllInstances,
    deleteAllInstancesOfDish
  };
}
