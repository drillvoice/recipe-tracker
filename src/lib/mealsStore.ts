import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import { Timestamp } from 'firebase/firestore';

export interface Meal {
  id: string;
  mealName: string;
  date: Timestamp;
  uid?: string;
  pending?: boolean;
}

interface MealDB extends DBSchema {
  meals: {
    key: string;
    value: Meal;
  };
}

let dbPromise: Promise<IDBPDatabase<MealDB>> | null = null;

function getDb() {
  if (dbPromise) return dbPromise;
  if (typeof window === 'undefined' || !("indexedDB" in window)) {
    return null;
  }
  dbPromise = openDB<MealDB>('recipe-tracker', 1, {
    upgrade(db) {
      db.createObjectStore('meals', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

export async function getAllMeals(): Promise<Meal[]> {
  try {
    const db = getDb();
    if (!db) return [];
    const meals = await (await db).getAll('meals');
    // IndexedDB strips class prototypes, so Firestore Timestamps stored there
    // come back as plain objects without the `toDate`/`toMillis` helpers. Restore
    // them here so the rest of the app can safely use Timestamp methods.
    return meals.map(m => ({
      ...m,
      date:
        m.date instanceof Timestamp
          ? m.date
          : new Timestamp((m.date as any).seconds, (m.date as any).nanoseconds),
    }));
  } catch (error) {
    console.error('Error getting all meals from IndexedDB:', error);
    return [];
  }
}

export async function saveMeal(meal: Meal): Promise<boolean> {
  try {
    const db = getDb();
    if (!db) return false;
    await (await db).put('meals', meal);
    return true;
  } catch (error) {
    console.error('Error saving meal to IndexedDB:', error);
    return false;
  }
}

export async function getPendingMeals(): Promise<Meal[]> {
  try {
    const meals = await getAllMeals();
    return meals.filter(m => m.pending);
  } catch (error) {
    console.error('Error getting pending meals:', error);
    return [];
  }
}

export async function markMealSynced(localId: string, newId: string): Promise<boolean> {
  try {
    const db = getDb();
    if (!db) return false;
    const inst = await db;
    const meal = await inst.get('meals', localId);
    if (meal) {
      await inst.delete('meals', localId);
      meal.id = newId;
      meal.pending = false;
      await inst.put('meals', meal);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error marking meal as synced:', error);
    return false;
  }
}

// Additional helper function to clean up old synced meals if needed
export async function deleteMeal(mealId: string): Promise<boolean> {
  try {
    const db = getDb();
    if (!db) return false;
    await (await db).delete('meals', mealId);
    return true;
  } catch (error) {
    console.error('Error deleting meal:', error);
    return false;
  }
}

// Helper function to check if IndexedDB is available
export function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && "indexedDB" in window;
}