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
  tags?: string[]; // Array of simple tag strings
}

// Tag interface for the tagging system
export interface Tag {
  id: string;
  name: string;
  color: string; // Hex color code
  createdAt: Date;
  usageCount: number; // Track how many meals use this tag
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
  legacyMigrationComplete?: boolean;
  migrationTimestamp?: number;
  migratedCount?: number;
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
  type: 'meal' | 'setting' | 'tag';
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
  tags: {
    key: string;
    value: Tag;
    indexes: {
      'name': string;
      'usageCount': number;
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
const DB_VERSION = 3;

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

      // Create tags object store for tagging system (v3+)
      if (!db.objectStoreNames.contains('tags')) {
        const tagsStore = db.createObjectStore('tags', { keyPath: 'id' });
        tagsStore.createIndex('name', 'name');
        tagsStore.createIndex('usageCount', 'usageCount');
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

  // Use transaction for atomic operation
  const tx = dbInstance.transaction(['meals', 'cache_meta'], 'readwrite');
  await tx.objectStore('meals').put(meal);

  // Update meal count in metadata atomically
  const mealCount = await tx.objectStore('meals').count();
  const metaStore = tx.objectStore('cache_meta');
  const existing = await metaStore.get('backup_status') || { key: 'backup_status' };
  await metaStore.put({ ...existing, mealCount });

  await tx.done;
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

  // Use index for efficient lookup instead of scanning all meals
  const tx = dbInstance.transaction('meals', 'readwrite');
  const store = tx.objectStore('meals');
  const index = store.index('mealName');

  // Get all meals with this name using the index
  const mealsToUpdate = await index.getAll(mealName);

  // Batch update all matching meals
  const updatePromises = mealsToUpdate.map(meal => {
    meal.hidden = hidden;
    return store.put(meal);
  });

  await Promise.all(updatePromises);
  await tx.done;
}

export async function updateMealTagsByName(mealName: string, tags: string[]): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;

  // Use index for efficient lookup instead of scanning all meals
  const tx = dbInstance.transaction('meals', 'readwrite');
  const store = tx.objectStore('meals');
  const index = store.index('mealName');

  // Get all meals with this name using the index
  const mealsToUpdate = await index.getAll(mealName);

  // Batch update all matching meals with new tags
  const updatePromises = mealsToUpdate.map(meal => {
    meal.tags = [...tags]; // Create a copy of the tags array
    return store.put(meal);
  });

  await Promise.all(updatePromises);
  await tx.done;
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

export async function getAllTagStrings(): Promise<string[]> {
  const db = getDb();
  if (!db) return [];

  const dbInstance = await db;
  const meals = await dbInstance.getAll('meals');

  const tagSet = new Set<string>();
  meals.forEach(meal => {
    if (meal.tags && Array.isArray(meal.tags)) {
      meal.tags.forEach(tag => {
        if (tag && typeof tag === 'string' && tag.trim()) {
          tagSet.add(tag.trim());
        }
      });
    }
  });

  return Array.from(tagSet).sort();
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

// === TAG OPERATIONS ===

export async function getAllTags(): Promise<Tag[]> {
  const db = getDb();
  if (!db) return [];

  const tags = await (await db).getAll('tags');

  // Convert Date objects that may have been serialized
  return tags.map(tag => ({
    ...tag,
    createdAt: tag.createdAt instanceof Date ? tag.createdAt : new Date(tag.createdAt)
  }));
}

export async function getTag(id: string): Promise<Tag | null> {
  const db = getDb();
  if (!db) return null;

  const tag = await (await db).get('tags', id);
  if (!tag) return null;

  return {
    ...tag,
    createdAt: tag.createdAt instanceof Date ? tag.createdAt : new Date(tag.createdAt)
  };
}

export async function saveTag(tag: Tag): Promise<void> {
  const db = getDb();
  if (!db) return;

  await (await db).put('tags', tag);
}

export async function updateTag(id: string, updates: Partial<Tag>): Promise<Tag | null> {
  const db = getDb();
  if (!db) return null;

  const dbInstance = await db;
  const tag = await dbInstance.get('tags', id);
  if (tag) {
    const updatedTag = { ...tag, ...updates };
    await dbInstance.put('tags', updatedTag);
    return updatedTag;
  }
  return null;
}

export async function deleteTag(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;

  // Use transaction to atomically delete tag and update meals
  const tx = dbInstance.transaction(['tags', 'meals'], 'readwrite');

  // Delete the tag
  await tx.objectStore('tags').delete(id);

  // Remove tag from all meals that reference it
  const mealsStore = tx.objectStore('meals');
  const meals = await mealsStore.getAll();

  for (const meal of meals) {
    if (meal.tags && meal.tags.includes(id)) {
      meal.tags = meal.tags.filter(tagId => tagId !== id);
      await mealsStore.put(meal);
    }
  }

  await tx.done;
}

export async function updateTagUsageCount(tagId: string, delta: number): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const tag = await dbInstance.get('tags', tagId);
  if (tag) {
    tag.usageCount = Math.max(0, tag.usageCount + delta);
    await dbInstance.put('tags', tag);
  }
}

export async function getTagsByName(name: string): Promise<Tag[]> {
  const db = getDb();
  if (!db) return [];

  const dbInstance = await db;
  const index = dbInstance.transaction('tags', 'readonly').objectStore('tags').index('name');
  const tags = await index.getAll(name);

  return tags.map(tag => ({
    ...tag,
    createdAt: tag.createdAt instanceof Date ? tag.createdAt : new Date(tag.createdAt)
  }));
}

export async function getMealsByTag(tagId: string): Promise<Meal[]> {
  const db = getDb();
  if (!db) return [];

  const meals = await getAllMeals();
  return meals.filter(meal => meal.tags && meal.tags.includes(tagId));
}

export async function addTagToMeal(mealId: string, tagId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const dbInstance = await db;
  const meal = await dbInstance.get('meals', mealId);

  if (!meal) return false;

  // Initialize tags array if it doesn't exist
  if (!meal.tags) {
    meal.tags = [];
  }

  // Add tag if not already present
  if (!meal.tags.includes(tagId)) {
    meal.tags.push(tagId);
    await dbInstance.put('meals', meal);
    await updateTagUsageCount(tagId, 1);
    return true;
  }

  return false;
}

export async function removeTagFromMeal(mealId: string, tagId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const dbInstance = await db;
  const meal = await dbInstance.get('meals', mealId);

  if (!meal || !meal.tags) return false;

  const tagIndex = meal.tags.indexOf(tagId);
  if (tagIndex > -1) {
    meal.tags.splice(tagIndex, 1);
    await dbInstance.put('meals', meal);
    await updateTagUsageCount(tagId, -1);
    return true;
  }

  return false;
}