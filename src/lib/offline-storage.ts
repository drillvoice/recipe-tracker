import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import { Timestamp } from 'firebase/firestore';

// Keep existing Meal interface but enhance it
export interface Meal {
  id: string;
  mealName: string;
  date: Timestamp;
  uid?: string;
  pending?: boolean;
  hidden?: boolean;
}

// New interfaces for enhanced backup system
export interface CacheMetadata {
  key: string;
  lastBackupTimestamp?: number;
  lastSyncCheck?: number;
  mealCount?: number;
  version?: string;
  lastImportTimestamp?: number;
  lastImportSource?: string;
  lastImportFormat?: string;
}

export interface AppSettings {
  id: string;
  theme?: 'light' | 'dark';
  autoBackupEnabled?: boolean;
  backupFrequencyDays?: number;
  exportFormat?: 'json' | 'csv' | 'backup';
  lastExportTimestamp?: number;
}

export interface SyncItem {
  id: string;
  type: 'meal' | 'setting';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount?: number;
}

// Enhanced database schema
interface RecipeTrackerDB extends DBSchema {
  meals: {
    key: string;
    value: Meal;
    indexes: {
      'date': string;
      'mealName': string;
    };
  };
  cache_meta: {
    key: string;
    value: CacheMetadata;
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  sync_queue: {
    key: string;
    value: SyncItem;
    indexes: {
      'timestamp': number;
      'type': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<RecipeTrackerDB>> | null = null;

// Export function to reset database promise (for testing)
export function resetDbPromise(): void {
  if (dbPromise) {
    dbPromise.then(db => db.close()).catch(() => {});
  }
  dbPromise = null;
}

const DB_NAME = 'recipe-tracker-enhanced';
const DB_VERSION = 2;

function getDb(): Promise<IDBPDatabase<RecipeTrackerDB>> | null {
  if (dbPromise) return dbPromise;
  if (typeof window === 'undefined' || !("indexedDB" in window)) {
    return null;
  }

  dbPromise = openDB<RecipeTrackerDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);

      // Create meals object store (or migrate from old version)
      if (!db.objectStoreNames.contains('meals')) {
        const mealsStore = db.createObjectStore('meals', { keyPath: 'id' });
        mealsStore.createIndex('date', 'date');
        mealsStore.createIndex('mealName', 'mealName');
      }

      // Create new object stores for enhanced features
      if (!db.objectStoreNames.contains('cache_meta')) {
        db.createObjectStore('cache_meta', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('sync_queue')) {
        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        syncStore.createIndex('timestamp', 'timestamp');
        syncStore.createIndex('type', 'type');
      }

      // Initialize default metadata and settings on first creation
      if (oldVersion === 0) {
        try {
          // Set initial metadata
          const metaStore = transaction.objectStore('cache_meta');
          metaStore.put({
            key: 'backup_status',
            lastBackupTimestamp: 0,
            lastSyncCheck: Date.now(),
            mealCount: 0,
            version: '1.0.0'
          });

          // Set default settings
          const settingsStore = transaction.objectStore('settings');
          settingsStore.put({
            id: 'app_preferences',
            theme: 'light',
            autoBackupEnabled: true,
            backupFrequencyDays: 7,
            exportFormat: 'json'
          });
        } catch (error) {
          // Ignore errors during initialization - defaults will be handled in getter functions
          console.warn('Database initialization warning:', error);
        }
      }
    },
  });

  return dbPromise;
}

// === MEAL OPERATIONS (Enhanced) ===

export async function getAllMeals(): Promise<Meal[]> {
  const db = getDb();
  if (!db) return [];

  const meals = await (await db).getAll('meals');

  // Restore Firestore Timestamps that lost their prototype in IndexedDB
  return meals.map(m => {
    // If it's already a proper Timestamp-like object, use it as-is
    if (m.date && typeof m.date.toMillis === 'function' && typeof m.date.toDate === 'function') {
      return { ...m, date: m.date };
    }

    // Try to restore from serialized format
    try {
      if (m.date && typeof (m.date as any).seconds === 'number') {
        return { ...m, date: new Timestamp((m.date as any).seconds, (m.date as any).nanoseconds || 0) };
      }
    } catch (error) {
      // If Timestamp constructor fails (like in tests), keep the original object
      // Silently handle this case to avoid test noise
    }

    return { ...m, date: m.date };
  });
}

export async function saveMeal(meal: Meal): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  await dbInstance.put('meals', meal);

  // Update meal count in metadata
  await updateCacheMetadata('backup_status', {
    mealCount: await dbInstance.count('meals')
  });
}

export async function updateMeal(id: string, updates: Partial<Meal>): Promise<Meal | null> {
  const db = getDb();
  if (!db) return null;

  const dbInstance = await db;
  const meal = await dbInstance.get('meals', id);
  if (meal) {
    const updatedMeal = { ...meal, ...updates };
    await dbInstance.put('meals', updatedMeal);
    return updatedMeal;
  }
  return null;
}

export async function deleteMeal(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  await dbInstance.delete('meals', id);

  // Update meal count in metadata
  await updateCacheMetadata('backup_status', {
    mealCount: await dbInstance.count('meals')
  });
}

export async function hideMealsByName(mealName: string, hidden: boolean): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const meals = await dbInstance.getAll('meals');

  for (const meal of meals) {
    if (meal.mealName === mealName) {
      meal.hidden = hidden;
      await dbInstance.put('meals', meal);
    }
  }
}

// === METADATA OPERATIONS ===

export async function getCacheMetadata(key: string): Promise<CacheMetadata | null> {
  const db = getDb();
  if (!db) return null;

  const result = await (await db).get('cache_meta', key);
  return result || null;
}

export async function updateCacheMetadata(key: string, updates: Partial<CacheMetadata>): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const existing = await dbInstance.get('cache_meta', key) || { key };

  await dbInstance.put('cache_meta', { ...existing, ...updates });
}

export async function getLastBackupTimestamp(): Promise<number> {
  const metadata = await getCacheMetadata('backup_status');
  return metadata?.lastBackupTimestamp || 0;
}

export async function setLastBackupTimestamp(timestamp: number): Promise<void> {
  await updateCacheMetadata('backup_status', {
    lastBackupTimestamp: timestamp,
    lastSyncCheck: Date.now()
  });
}

export async function getMealCount(): Promise<number> {
  const metadata = await getCacheMetadata('backup_status');
  return metadata?.mealCount || 0;
}

// === SETTINGS OPERATIONS ===

export async function getSettings(): Promise<AppSettings> {
  const db = getDb();
  if (!db) {
    // Return defaults if IndexedDB unavailable
    return {
      id: 'app_preferences',
      theme: 'light',
      autoBackupEnabled: true,
      backupFrequencyDays: 7,
      exportFormat: 'json'
    };
  }

  const settings = await (await db).get('settings', 'app_preferences');
  return settings || {
    id: 'app_preferences',
    theme: 'light',
    autoBackupEnabled: true,
    backupFrequencyDays: 7,
    exportFormat: 'json'
  };
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const existing = await dbInstance.get('settings', 'app_preferences') || { id: 'app_preferences' };

  await dbInstance.put('settings', { ...existing, ...updates });
}

// === SYNC QUEUE OPERATIONS ===

export async function addToSyncQueue(item: Omit<SyncItem, 'id' | 'timestamp'>): Promise<void> {
  const db = getDb();
  if (!db) return;

  const syncItem: SyncItem = {
    ...item,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    retryCount: 0
  };

  await (await db).put('sync_queue', syncItem);
}

export async function getSyncQueue(): Promise<SyncItem[]> {
  const db = getDb();
  if (!db) return [];

  const items = await (await db).getAll('sync_queue');
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  await (await db).delete('sync_queue', id);
}

export async function clearSyncQueue(): Promise<void> {
  const db = getDb();
  if (!db) return;

  await (await db).clear('sync_queue');
}

// === BACKUP UTILITIES ===

export function isBackupNeeded(lastBackupTimestamp: number, frequencyDays: number = 7): boolean {
  const now = Date.now();
  const daysSinceBackup = (now - lastBackupTimestamp) / (1000 * 60 * 60 * 24);
  return daysSinceBackup >= frequencyDays;
}

export async function getBackupStatus(): Promise<{
  lastBackup: number;
  mealCount: number;
  needsBackup: boolean;
  daysSinceBackup: number;
}> {
  const [metadata, settings] = await Promise.all([
    getCacheMetadata('backup_status'),
    getSettings()
  ]);

  const lastBackup = metadata?.lastBackupTimestamp || 0;
  const mealCount = metadata?.mealCount || 0;
  const daysSinceBackup = lastBackup > 0 ? (Date.now() - lastBackup) / (1000 * 60 * 60 * 24) : Infinity;
  const needsBackup = isBackupNeeded(lastBackup, settings.backupFrequencyDays);

  return {
    lastBackup,
    mealCount,
    needsBackup,
    daysSinceBackup
  };
}

// === LEGACY COMPATIBILITY ===

// These functions maintain compatibility with existing code
export async function getPendingMeals(): Promise<Meal[]> {
  const meals = await getAllMeals();
  return meals.filter(m => m.pending);
}

export async function markMealSynced(localId: string, newId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const meal = await dbInstance.get('meals', localId);
  if (meal) {
    await dbInstance.delete('meals', localId);
    meal.id = newId;
    meal.pending = false;
    await dbInstance.put('meals', meal);
  }
}