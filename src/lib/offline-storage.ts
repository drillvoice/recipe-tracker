import { openDB, type IDBPDatabase, type IDBPObjectStore, type DBSchema } from 'idb';
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
  updatedAtMs?: number;
  syncState?: 'pending' | 'synced' | 'error';
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
  entityType: 'meal';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload?: Partial<Meal>;
  targetUid?: string;
  timestamp: number;
  retryCount?: number;
  lastError?: string;
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
      'entityType': string;
      'entityId': string;
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
        syncStore.createIndex('entityType', 'entityType');
        syncStore.createIndex('entityId', 'entityId');
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

// Restore Firestore Timestamps that lost their prototype when structured-cloned into IndexedDB
export function normalizeMealDate(meal: Meal): Meal {
  if (meal.date && typeof meal.date.toMillis === 'function' && typeof meal.date.toDate === 'function') {
    return meal;
  }

  try {
    const dateObj = meal.date as unknown as { seconds?: number; nanoseconds?: number } | undefined;
    if (dateObj && typeof dateObj.seconds === 'number') {
      return { ...meal, date: new Timestamp(dateObj.seconds, dateObj.nanoseconds || 0) };
    }
  } catch {
    // If Timestamp constructor fails (like in tests), keep the original object
  }

  return meal;
}

export async function getAllMeals(): Promise<Meal[]> {
  const db = getDb();
  if (!db) return [];

  const meals = await (await db).getAll('meals');
  return meals.map(normalizeMealDate);
}

export async function getMealById(id: string): Promise<Meal | null> {
  const db = getDb();
  if (!db) return null;

  const meal = await (await db).get('meals', id);
  return meal ? normalizeMealDate(meal) : null;
}

function withLocalSyncMetadata(meal: Meal, existing?: Meal, preserveTimestamp = false): Meal {
  // Always stamp a fresh timestamp on local writes so the freshness comparison in
  // cloud-sync never loses a local edit to a stale cloud copy.  Pass
  // preserveTimestamp=true only when re-saving a meal whose timestamp must not
  // advance (e.g. initialPullAndMerge re-assigning UID without user edits).
  const updatedAtMs = preserveTimestamp
    ? (meal.updatedAtMs ?? existing?.updatedAtMs ?? Date.now())
    : Date.now();
  return {
    ...meal,
    updatedAtMs,
    pending: meal.pending ?? true,
    syncState: meal.syncState ?? 'pending'
  };
}

function withUpdatedSyncMetadata(meal: Meal, updates: Partial<Meal>): Meal {
  return {
    ...meal,
    ...updates,
    updatedAtMs: updates.updatedAtMs ?? Date.now(),
    pending: updates.pending ?? true,
    syncState: updates.syncState ?? 'pending'
  };
}

type SyncEnqueueItem = Omit<SyncItem, 'id' | 'timestamp' | 'retryCount' | 'lastError'>;
type SyncQueueStore = IDBPObjectStore<RecipeTrackerDB, ArrayLike<'meals' | 'sync_queue' | 'cache_meta'>, 'sync_queue', 'readwrite'>;

// Merge a new operation into any queued operation for the same meal so the
// queue holds at most one item per entity.  Uses the entityId index rather
// than scanning the whole queue.
async function putMergedSyncItem(store: SyncQueueStore, item: SyncEnqueueItem): Promise<void> {
  const queuedForEntity = await store.index('entityId').getAll(item.entityId);
  const existing = queuedForEntity.find(queued => queued.entityType === 'meal');

  const mergedOperation: SyncItem['operation'] =
    item.operation === 'delete'
      ? 'delete'
      : existing?.operation === 'create'
        ? 'create'
        : item.operation;

  const syncItem: SyncItem = {
    id: existing?.id ?? `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    entityType: 'meal',
    entityId: item.entityId,
    operation: mergedOperation,
    payload: item.operation === 'delete' ? undefined : item.payload,
    targetUid: item.targetUid ?? existing?.targetUid,
    timestamp: Date.now(),
    retryCount: 0,
    lastError: undefined
  };

  await store.put(syncItem);
}

async function enqueueMealSync(
  dbInstance: IDBPDatabase<RecipeTrackerDB>,
  item: SyncEnqueueItem
): Promise<void> {
  const tx = dbInstance.transaction('sync_queue', 'readwrite');
  await putMergedSyncItem(tx.store as SyncQueueStore, item);
  await tx.done;
}

// Apply a mutation to every instance of a dish and queue the matching sync
// operations in a single atomic transaction.
async function updateMealsByName(
  mealName: string,
  mutate: (meal: Meal) => void,
  options: { skipSyncQueue?: boolean }
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const tx = dbInstance.transaction(['meals', 'sync_queue'], 'readwrite');
  const store = tx.objectStore('meals');
  const queueStore = tx.objectStore('sync_queue') as SyncQueueStore;

  const mealsToUpdate = await store.index('mealName').getAll(mealName);
  const now = Date.now();

  for (const meal of mealsToUpdate) {
    mutate(meal);
    meal.updatedAtMs = now;
    meal.pending = true;
    meal.syncState = 'pending';
    await store.put(meal);

    if (!options.skipSyncQueue) {
      await putMergedSyncItem(queueStore, {
        entityType: 'meal',
        entityId: meal.id,
        operation: 'update',
        payload: meal,
        targetUid: meal.uid
      });
    }
  }

  await tx.done;
}

export async function saveMeal(
  meal: Meal,
  options: { skipSyncQueue?: boolean; preserveTimestamp?: boolean } = {}
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const existingMeal = await dbInstance.get('meals', meal.id);
  const mealToSave = withLocalSyncMetadata(meal, existingMeal ?? undefined, options.preserveTimestamp);

  await dbInstance.put('meals', mealToSave);

  if (!options.skipSyncQueue) {
    await enqueueMealSync(dbInstance, {
      entityType: 'meal',
      entityId: mealToSave.id,
      operation: existingMeal ? 'update' : 'create',
      payload: mealToSave,
      targetUid: mealToSave.uid
    });
  }

  await updateCacheMetadata('backup_status', {
    mealCount: await dbInstance.count('meals')
  });
}

export async function updateMeal(
  id: string,
  updates: Partial<Meal>,
  options: { skipSyncQueue?: boolean } = {}
): Promise<Meal | null> {
  const db = getDb();
  if (!db) return null;

  const dbInstance = await db;
  const meal = await dbInstance.get('meals', id);
  if (meal) {
    const updatedMeal = withUpdatedSyncMetadata(meal, updates);
    await dbInstance.put('meals', updatedMeal);
    if (!options.skipSyncQueue) {
      await enqueueMealSync(dbInstance, {
        entityType: 'meal',
        entityId: updatedMeal.id,
        operation: 'update',
        payload: updatedMeal,
        targetUid: updatedMeal.uid
      });
    }
    return updatedMeal;
  }
  return null;
}

export async function deleteMeal(
  id: string,
  options: { skipSyncQueue?: boolean } = {}
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const existingMeal = await dbInstance.get('meals', id);
  if (!options.skipSyncQueue && existingMeal) {
    await enqueueMealSync(dbInstance, {
      entityType: 'meal',
      entityId: id,
      operation: 'delete',
      targetUid: existingMeal.uid
    });
  }
  await dbInstance.delete('meals', id);

  // Update meal count in metadata
  await updateCacheMetadata('backup_status', {
    mealCount: await dbInstance.count('meals')
  });
}

export async function hideMealsByName(
  mealName: string,
  hidden: boolean,
  options: { skipSyncQueue?: boolean } = {}
): Promise<void> {
  await updateMealsByName(mealName, meal => { meal.hidden = hidden; }, options);
}

export async function updateMealTagsByName(
  mealName: string,
  tags: string[],
  options: { skipSyncQueue?: boolean } = {}
): Promise<void> {
  await updateMealsByName(mealName, meal => { meal.tags = [...tags]; }, options);
}

export async function updateMealNameByName(
  oldName: string,
  newName: string,
  options: { skipSyncQueue?: boolean } = {}
): Promise<void> {
  await updateMealsByName(oldName, meal => { meal.mealName = newName; }, options);
}

export async function deleteMealsByName(
  mealName: string,
  options: { skipSyncQueue?: boolean } = {}
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;

  // Delete the meals, queue their sync deletes and update the meal count in
  // one atomic transaction so a failed commit leaves no orphaned queue items.
  const tx = dbInstance.transaction(['meals', 'sync_queue', 'cache_meta'], 'readwrite');
  const store = tx.objectStore('meals');
  const queueStore = tx.objectStore('sync_queue') as SyncQueueStore;

  const mealsToDelete = await store.index('mealName').getAll(mealName);

  for (const meal of mealsToDelete) {
    await store.delete(meal.id);
    if (!options.skipSyncQueue) {
      await putMergedSyncItem(queueStore, {
        entityType: 'meal',
        entityId: meal.id,
        operation: 'delete',
        targetUid: meal.uid
      });
    }
  }

  const mealCount = await store.count();
  const metaStore = tx.objectStore('cache_meta');
  const existing = await metaStore.get('backup_status') || { key: 'backup_status' };
  await metaStore.put({ ...existing, mealCount });

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
  const tagSet = new Set<string>();

  // Use cursor to iterate without loading all meal objects into memory
  const tx = dbInstance.transaction('meals', 'readonly');
  let cursor = await tx.objectStore('meals').openCursor();

  while (cursor) {
    const meal = cursor.value;
    if (meal.tags && Array.isArray(meal.tags)) {
      for (const tag of meal.tags) {
        if (tag && typeof tag === 'string' && tag.trim()) {
          tagSet.add(tag.trim());
        }
      }
    }
    cursor = await cursor.continue();
  }

  await tx.done;
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

export async function addToSyncQueue(item: Omit<SyncItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
  const db = getDb();
  if (!db) return;

  const syncItem: SyncItem = {
    ...item,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
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

export async function getSyncQueueCount(): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  return (await db).count('sync_queue');
}

// Mark a pushed queue item as done.  The queue entry is only removed, and the
// meal only marked synced, if neither changed while the push was in flight;
// otherwise the newer local edit stays queued for the next flush.
export async function completeSyncItem(item: SyncItem): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const tx = dbInstance.transaction(['sync_queue', 'meals'], 'readwrite');
  const queueStore = tx.objectStore('sync_queue');
  const mealsStore = tx.objectStore('meals');

  const queued = await queueStore.get(item.id);
  if (queued && queued.timestamp === item.timestamp) {
    await queueStore.delete(item.id);
  }

  if (item.operation !== 'delete') {
    const meal = await mealsStore.get(item.entityId);
    if (meal && meal.updatedAtMs === item.payload?.updatedAtMs) {
      await mealsStore.put({ ...meal, syncState: 'synced', pending: false });
    }
  }

  await tx.done;
}

export async function updateSyncItem(id: string, updates: Partial<SyncItem>): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const existing = await dbInstance.get('sync_queue', id);
  if (!existing) return;

  await dbInstance.put('sync_queue', {
    ...existing,
    ...updates,
    timestamp: updates.timestamp ?? existing.timestamp
  });
}

export async function assignSyncQueueTargetUid(uid: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const items = await dbInstance.getAll('sync_queue');
  await Promise.all(
    items.map(item => dbInstance.put('sync_queue', { ...item, targetUid: uid }))
  );
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

export async function markMealSyncState(
  mealId: string,
  syncState: Meal['syncState'],
  pending: boolean
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const meal = await dbInstance.get('meals', mealId);
  if (!meal) return;

  await dbInstance.put('meals', {
    ...meal,
    syncState,
    pending
  });
}

export async function upsertMealFromCloud(meal: Meal): Promise<void> {
  const db = getDb();
  if (!db) return;

  const dbInstance = await db;
  const normalizedMeal: Meal = {
    ...meal,
    pending: false,
    syncState: 'synced'
  };

  await dbInstance.put('meals', normalizedMeal);
  await updateCacheMetadata('backup_status', {
    mealCount: await dbInstance.count('meals')
  });
}

export async function deleteMealFromCloud(mealId: string): Promise<void> {
  await deleteMeal(mealId, { skipSyncQueue: true });
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

  // Remove tag from matching meals using cursor (avoids loading all meals into memory)
  const mealsStore = tx.objectStore('meals');
  let cursor = await mealsStore.openCursor();

  while (cursor) {
    const meal = cursor.value;
    if (meal.tags && meal.tags.includes(id)) {
      meal.tags = meal.tags.filter(tagId => tagId !== id);
      await cursor.update(meal);
    }
    cursor = await cursor.continue();
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

  const dbInstance = await db;
  const results: Meal[] = [];

  // Use cursor to only collect matching meals without loading all into memory
  const tx = dbInstance.transaction('meals', 'readonly');
  let cursor = await tx.objectStore('meals').openCursor();

  while (cursor) {
    const meal = cursor.value;
    if (meal.tags && meal.tags.includes(tagId)) {
      results.push(normalizeMealDate(meal));
    }
    cursor = await cursor.continue();
  }

  await tx.done;
  return results;
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
