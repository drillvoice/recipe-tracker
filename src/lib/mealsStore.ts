import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import { Timestamp } from 'firebase/firestore';

export interface Meal {
  id: string;
  mealName: string;
  date: Timestamp;
  uid?: string;
  pending?: boolean;
  hidden?: boolean;
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

export async function updateMeal(id: string, updates: Partial<Meal>) {
  const db = getDb();
  if (!db) return null;
  const inst = await db;
  const meal = await inst.get('meals', id);
  if (meal) {
    const updatedMeal = { ...meal, ...updates };
    await inst.put('meals', updatedMeal);
    return updatedMeal;
  }
  return null;
}

export async function deleteMeal(id: string) {
  const db = getDb();
  if (!db) return;
  const inst = await db;
  await inst.delete('meals', id);
}

export async function hideMealsByName(mealName: string, hidden: boolean) {
  const db = getDb();
  if (!db) return;
  const inst = await db;
  const meals = await inst.getAll('meals');
  
  for (const meal of meals) {
    if (meal.mealName === mealName) {
      meal.hidden = hidden;
      await inst.put('meals', meal);
    }
  }
}
