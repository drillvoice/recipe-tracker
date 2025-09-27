import { openDB } from 'idb';
import { Timestamp } from 'firebase/firestore';
import type { Meal } from './offline-storage';

const OLD_DB_NAME = 'recipe-tracker';
const NEW_DB_NAME = 'recipe-tracker-enhanced';

export interface MigrationResult {
  success: boolean;
  migratedMealCount: number;
  errors: string[];
  skippedCount: number;
}

export interface MigrationStatus {
  needed: boolean;
  oldDbExists: boolean;
  newDbExists: boolean;
  oldMealCount: number;
  newMealCount: number;
}

/**
 * Check if migration from old database is needed
 */
export async function checkMigrationStatus(): Promise<MigrationStatus> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return {
      needed: false,
      oldDbExists: false,
      newDbExists: false,
      oldMealCount: 0,
      newMealCount: 0
    };
  }

  try {
    // Check if old database exists
    const oldDbExists = await databaseExists(OLD_DB_NAME);
    const newDbExists = await databaseExists(NEW_DB_NAME);

    let oldMealCount = 0;
    let newMealCount = 0;

    if (oldDbExists) {
      oldMealCount = await getOldDatabaseMealCount();
    }

    if (newDbExists) {
      newMealCount = await getNewDatabaseMealCount();
    }

    // Migration is needed if old DB exists and new DB either doesn't exist or has fewer meals
    const needed = oldDbExists && (!newDbExists || newMealCount < oldMealCount);

    return {
      needed,
      oldDbExists,
      newDbExists,
      oldMealCount,
      newMealCount
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return {
      needed: false,
      oldDbExists: false,
      newDbExists: false,
      oldMealCount: 0,
      newMealCount: 0
    };
  }
}

/**
 * Migrate data from old recipe-tracker database to new enhanced schema
 */
export async function migrateFromOldDatabase(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedMealCount: 0,
    errors: [],
    skippedCount: 0
  };

  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    result.errors.push('IndexedDB not available');
    return result;
  }

  try {
    // First, check if migration is actually needed
    const status = await checkMigrationStatus();
    if (!status.needed) {
      result.success = true;
      result.errors.push('Migration not needed - old database not found or already migrated');
      return result;
    }

    console.log('Starting migration from old database...');

    // Open old database to read data
    const oldDb = await openDB(OLD_DB_NAME, 1);
    const oldMeals = await oldDb.getAll('meals');

    console.log(`Found ${oldMeals.length} meals in old database`);

    if (oldMeals.length === 0) {
      result.success = true;
      result.errors.push('No meals found in old database');
      return result;
    }

    // Import the new offline-storage module to get the enhanced database
    const { saveMeal } = await import('./offline-storage');

    // Migrate each meal
    for (const oldMeal of oldMeals) {
      try {
        // Validate and transform old meal data
        const migratedMeal: Meal = {
          id: oldMeal.id,
          mealName: oldMeal.mealName,
          date: oldMeal.date instanceof Timestamp
            ? oldMeal.date
            : new Timestamp((oldMeal.date as { seconds?: number; nanoseconds?: number }).seconds || 0, (oldMeal.date as { seconds?: number; nanoseconds?: number }).nanoseconds || 0),
          uid: oldMeal.uid,
          pending: oldMeal.pending || false,
          hidden: oldMeal.hidden || false
        };

        // Validate required fields
        if (!migratedMeal.id || !migratedMeal.mealName) {
          result.skippedCount++;
          result.errors.push(`Skipped invalid meal: ${JSON.stringify(oldMeal)}`);
          continue;
        }

        // Save to new database
        await saveMeal(migratedMeal);
        result.migratedMealCount++;

      } catch (error) {
        result.skippedCount++;
        result.errors.push(`Failed to migrate meal ${oldMeal.id}: ${error}`);
      }
    }

    // Close old database
    oldDb.close();

    result.success = result.migratedMealCount > 0 || oldMeals.length === 0;
    console.log(`Migration completed: ${result.migratedMealCount} meals migrated, ${result.skippedCount} skipped`);

    // Optionally, you could delete the old database after successful migration
    // await deleteOldDatabase();

  } catch (error) {
    console.error('Migration failed:', error);
    result.errors.push(`Migration failed: ${error}`);
  }

  return result;
}

/**
 * Delete the old database after successful migration
 */
export async function deleteOldDatabase(): Promise<boolean> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return false;
  }

  try {
    const deleteRequest = indexedDB.deleteDatabase(OLD_DB_NAME);

    return new Promise((resolve, reject) => {
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onsuccess = () => resolve(true);
      deleteRequest.onblocked = () => {
        console.warn('Database deletion blocked - close other tabs');
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Error deleting old database:', error);
    return false;
  }
}

// === HELPER FUNCTIONS ===

/**
 * Check if a database exists
 */
async function databaseExists(dbName: string): Promise<boolean> {
  try {
    const db = await openDB(dbName, 1);
    db.close();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get meal count from old database
 */
async function getOldDatabaseMealCount(): Promise<number> {
  try {
    const db = await openDB(OLD_DB_NAME, 1);
    const count = await db.count('meals');
    db.close();
    return count;
  } catch (error) {
    console.error('Error counting meals in old database:', error);
    return 0;
  }
}

/**
 * Get meal count from new database
 */
async function getNewDatabaseMealCount(): Promise<number> {
  try {
    const db = await openDB(NEW_DB_NAME, 2);
    const count = await db.count('meals');
    db.close();
    return count;
  } catch (error) {
    console.error('Error counting meals in new database:', error);
    return 0;
  }
}

/**
 * Backup old database data to a downloadable file before migration
 */
export async function backupOldDatabase(): Promise<string | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null;
  }

  try {
    const db = await openDB(OLD_DB_NAME, 1);
    const meals = await db.getAll('meals');
    db.close();

    const backup = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      source: 'recipe-tracker-migration',
      meals: meals.map(meal => ({
        ...meal,
        // Convert Timestamp to serializable format
        date: meal.date instanceof Timestamp
          ? { seconds: meal.date.seconds, nanoseconds: meal.date.nanoseconds }
          : meal.date
      }))
    };

    const backupJson = JSON.stringify(backup, null, 2);
    const filename = `recipe-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;

    // Create downloadable blob
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    return filename;

  } catch (error) {
    console.error('Error backing up old database:', error);
    return null;
  }
}

/**
 * Auto-migration that runs on app startup
 */
export async function autoMigrate(): Promise<void> {
  try {
    const status = await checkMigrationStatus();

    if (status.needed) {
      console.log('Auto-migration needed - starting migration...');
      const result = await migrateFromOldDatabase();

      if (result.success) {
        console.log(`Auto-migration completed successfully: ${result.migratedMealCount} meals migrated`);
      } else {
        console.error('Auto-migration failed:', result.errors);
      }
    }
  } catch (error) {
    console.error('Auto-migration error:', error);
  }
}