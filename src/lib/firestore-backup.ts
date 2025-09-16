import {
  doc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import {
  signInAnonymously,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { auth, db } from './firebase';
import { getAllMeals } from './offline-storage';
import { setLastBackupTimestamp } from './offline-storage';

export interface CloudBackupResult {
  success: boolean;
  mealsBackedUp: number;
  timestamp: number;
  errors: string[];
  userId?: string;
}

export interface CloudBackupStatus {
  isAuthenticated: boolean;
  userId?: string;
  lastCloudBackup: number;
  cloudMealCount: number;
  syncNeeded: boolean;
}

let currentUser: User | null = null;

// Initialize authentication listener
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  });
}

/**
 * Ensures user is authenticated (anonymously if needed)
 */
export async function ensureAuthentication(): Promise<User> {
  return new Promise((resolve, reject) => {
    // If already authenticated, return current user
    if (currentUser) {
      resolve(currentUser);
      return;
    }

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        unsubscribe();
        resolve(user);
      } else {
        // No user, sign in anonymously
        try {
          const result = await signInAnonymously(auth);
          currentUser = result.user;
          unsubscribe();
          resolve(result.user);
        } catch (error) {
          unsubscribe();
          reject(error);
        }
      }
    });
  });
}

/**
 * Backs up all local meals to Firestore
 */
export async function backupMealsToCloud(): Promise<CloudBackupResult> {
  const result: CloudBackupResult = {
    success: false,
    mealsBackedUp: 0,
    timestamp: Date.now(),
    errors: []
  };

  try {
    // Ensure user is authenticated
    const user = await ensureAuthentication();
    result.userId = user.uid;

    // Get all local meals
    const meals = await getAllMeals();
    if (meals.length === 0) {
      result.success = true;
      result.mealsBackedUp = 0;
      return result;
    }

    // Use batch writes for better performance (up to 500 operations per batch)
    const batchSize = 500;
    const results: Array<{ success: boolean; mealId: string; error?: string }> = [];

    for (let i = 0; i < meals.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchMeals = meals.slice(i, i + batchSize);

      try {
        // Add all meals in this batch
        batchMeals.forEach(meal => {
          const mealData = {
            id: meal.id,
            mealName: meal.mealName,
            date: meal.date, // Firestore Timestamp
            uid: user.uid,
            hidden: meal.hidden || false,
            tags: meal.tags || [], // Include tags array
            lastUpdated: serverTimestamp()
          };

          const mealDocRef = doc(db, 'users', user.uid, 'meals', meal.id);
          batch.set(mealDocRef, mealData, { merge: true });
        });

        // Commit the entire batch atomically
        await batch.commit();

        // Mark all meals in this batch as successful
        batchMeals.forEach(meal => {
          results.push({ success: true, mealId: meal.id });
        });

      } catch (error) {
        console.error(`Failed to backup batch starting at index ${i}:`, error);
        // Mark all meals in this batch as failed
        batchMeals.forEach(meal => {
          results.push({
            success: false,
            mealId: meal.id,
            error: error instanceof Error ? error.message : 'Batch write failed'
          });
        });
      }
    }

    // Count successes and collect errors
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    result.mealsBackedUp = successful.length;
    result.errors = failed.map(f => `Meal ${f.mealId}: ${f.error}`);
    result.success = failed.length === 0;

    // Update local backup timestamp if successful
    if (result.success) {
      await setLastBackupTimestamp(result.timestamp);

      // Also store backup metadata in Firestore
      const backupMetaRef = doc(db, 'users', user.uid, 'metadata', 'backup');
      await setDoc(backupMetaRef, {
        lastBackupTimestamp: result.timestamp,
        mealCount: result.mealsBackedUp,
        backupVersion: '1.0.0',
        lastUpdated: serverTimestamp()
      });
    }

    return result;

  } catch (error) {
    console.error('Cloud backup failed:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

/**
 * Gets the current cloud backup status
 */
export async function getCloudBackupStatus(): Promise<CloudBackupStatus> {
  const status: CloudBackupStatus = {
    isAuthenticated: false,
    lastCloudBackup: 0,
    cloudMealCount: 0,
    syncNeeded: true
  };

  try {
    // Check if user is authenticated
    if (!currentUser) {
      return status;
    }

    status.isAuthenticated = true;
    status.userId = currentUser.uid;

    // Get backup metadata from Firestore
    const backupMetaRef = doc(db, 'users', currentUser.uid, 'metadata', 'backup');
    const backupMetaDoc = await getDoc(backupMetaRef);

    if (backupMetaDoc.exists()) {
      const data = backupMetaDoc.data();
      status.lastCloudBackup = data.lastBackupTimestamp || 0;
      status.cloudMealCount = data.mealCount || 0;
    }

    // Get actual count of meals in Firestore
    const mealsCollectionRef = collection(db, 'users', currentUser.uid, 'meals');
    const snapshot = await getDocs(mealsCollectionRef);
    status.cloudMealCount = snapshot.size;

    // Check if local meals need syncing (use actual meal count from main database)
    const localMeals = await getAllMeals();
    status.syncNeeded = localMeals.length !== status.cloudMealCount;

    return status;

  } catch (error) {
    console.error('Failed to get cloud backup status:', error);
    return status;
  }
}

/**
 * Checks if a cloud backup is needed based on time and data changes
 */
export function isCloudBackupNeeded(lastBackupTimestamp: number, frequencyDays: number = 7): boolean {
  const now = Date.now();
  const daysSinceBackup = (now - lastBackupTimestamp) / (1000 * 60 * 60 * 24);
  return daysSinceBackup >= frequencyDays;
}

/**
 * Gets a summary of cloud backup health
 */
export async function getCloudBackupHealth(): Promise<{
  healthy: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const health = {
    healthy: true,
    issues: [] as string[],
    recommendations: [] as string[]
  };

  try {
    const status = await getCloudBackupStatus();

    if (!status.isAuthenticated) {
      health.healthy = false;
      health.issues.push('Not authenticated with cloud backup service');
      health.recommendations.push('Click "Backup Now" to authenticate and create your first backup');
      return health;
    }

    if (status.lastCloudBackup === 0) {
      health.healthy = false;
      health.issues.push('No cloud backup found');
      health.recommendations.push('Create your first cloud backup to protect your data');
    } else if (isCloudBackupNeeded(status.lastCloudBackup)) {
      health.healthy = false;
      health.issues.push('Cloud backup is outdated (older than 7 days)');
      health.recommendations.push('Run a backup to sync your latest changes');
    }

    if (status.syncNeeded) {
      health.issues.push('Local and cloud data may be out of sync');
      health.recommendations.push('Run a backup to ensure all data is synchronized');
    }

  } catch (error) {
    health.healthy = false;
    health.issues.push('Unable to check cloud backup status');
    health.recommendations.push('Check your internet connection and try again');
  }

  return health;
}