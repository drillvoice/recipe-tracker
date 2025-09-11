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
  const db = getDb();
  if (!db) return [];
  return (await db).getAll('meals');
}

export async function saveMeal(meal: Meal) {
  const db = getDb();
  if (!db) return;
  await (await db).put('meals', meal);
}

export async function getPendingMeals(): Promise<Meal[]> {
  const meals = await getAllMeals();
  return meals.filter(m => m.pending);
}

export async function markMealSynced(localId: string, newId: string) {
  const db = getDb();
  if (!db) return;
  const inst = await db;
  const meal = await inst.get('meals', localId);
  if (meal) {
    await inst.delete('meals', localId);
    meal.id = newId;
    meal.pending = false;
    await inst.put('meals', meal);
  }
}
