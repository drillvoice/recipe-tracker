/**
 * @jest-environment jsdom
 */

import 'fake-indexeddb/auto';
import { Timestamp } from 'firebase/firestore';

// Polyfill structuredClone for testing environment
if (!global.structuredClone) {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

import {
  getAllMeals,
  saveMeal,
  updateMeal,
  deleteMeal,
  getCacheMetadata,
  updateCacheMetadata,
  getSettings,
  updateSettings,
  getBackupStatus,
  isBackupNeeded,
  type Meal,
  type AppSettings
} from '../src/lib/offline-storage';

// Mock Firebase Firestore Timestamp
class MockTimestamp {
  constructor(public seconds: number, public nanoseconds: number) {}

  static fromDate(date: Date) {
    return new MockTimestamp(
      Math.floor(date.getTime() / 1000),
      (date.getTime() % 1000) * 1000000
    );
  }

  toMillis() {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000);
  }

  toDate() {
    return new Date(this.toMillis());
  }

  isEqual(other: any) {
    return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }

  toJSON() {
    return {
      seconds: this.seconds,
      nanoseconds: this.nanoseconds,
      type: 'timestamp'
    };
  }

  valueOf() {
    return this.toMillis();
  }
}

// Mock the entire firebase/firestore module
jest.mock('firebase/firestore', () => ({
  Timestamp: MockTimestamp
}));

// Also create a local Timestamp for this test file
const TimestampClass = MockTimestamp;

describe('Enhanced Offline Storage', () => {
  beforeEach(async () => {
    // Clear IndexedDB before each test
    indexedDB = new (require('fake-indexeddb/lib/FDBFactory'))();
    // Reset the database promise to ensure clean state
    const { resetDbPromise } = await import('../src/lib/offline-storage');
    resetDbPromise();
  });

  describe('Meal Operations', () => {
    test('should save and retrieve meals', async () => {
      const testMeal: Meal = {
        id: 'test-1',
        mealName: 'Test Pasta',
        date: TimestampClass.fromDate(new Date('2024-03-15')) as any,
        uid: 'test-user',
        pending: false,
        hidden: false
      };

      await saveMeal(testMeal);
      const meals = await getAllMeals();

      expect(meals).toHaveLength(1);
      expect(meals[0].id).toBe('test-1');
      expect(meals[0].mealName).toBe('Test Pasta');
    });

    test('should update existing meals', async () => {
      const testMeal: Meal = {
        id: 'test-1',
        mealName: 'Original Name',
        date: TimestampClass.fromDate(new Date('2024-03-15')) as any,
        uid: 'test-user'
      };

      await saveMeal(testMeal);
      const updatedMeal = await updateMeal('test-1', { mealName: 'Updated Name' });

      expect(updatedMeal).toBeTruthy();
      expect(updatedMeal?.mealName).toBe('Updated Name');

      const meals = await getAllMeals();
      expect(meals[0].mealName).toBe('Updated Name');
    });

    test('should delete meals', async () => {
      const testMeal: Meal = {
        id: 'test-1',
        mealName: 'Test Pasta',
        date: TimestampClass.fromDate(new Date('2024-03-15')) as any,
        uid: 'test-user'
      };

      await saveMeal(testMeal);
      await deleteMeal('test-1');
      const meals = await getAllMeals();

      expect(meals).toHaveLength(0);
    });
  });

  describe('Cache Metadata', () => {
    test('should store and retrieve cache metadata', async () => {
      await updateCacheMetadata('test-key', {
        lastBackupTimestamp: Date.now(),
        mealCount: 5,
        version: '1.0.0'
      });

      const metadata = await getCacheMetadata('test-key');
      expect(metadata).toBeTruthy();
      expect(metadata?.mealCount).toBe(5);
      expect(metadata?.version).toBe('1.0.0');
    });

    test('should return null for non-existent metadata', async () => {
      const metadata = await getCacheMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('Settings', () => {
    test('should store and retrieve settings', async () => {
      const testSettings: Partial<AppSettings> = {
        theme: 'dark',
        autoBackupEnabled: false,
        backupFrequencyDays: 14
      };

      await updateSettings(testSettings);
      const settings = await getSettings();

      expect(settings.theme).toBe('dark');
      expect(settings.autoBackupEnabled).toBe(false);
      expect(settings.backupFrequencyDays).toBe(14);
    });

    test('should return default settings when none exist', async () => {
      const settings = await getSettings();

      expect(settings.id).toBe('app_preferences');
      expect(settings.theme).toBe('light');
      expect(settings.autoBackupEnabled).toBe(true);
      expect(settings.backupFrequencyDays).toBe(7);
    });
  });

  describe('Backup Status', () => {
    test('should determine when backup is needed', () => {
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);

      expect(isBackupNeeded(now, 7)).toBe(false);
      expect(isBackupNeeded(sevenDaysAgo, 7)).toBe(true);
      expect(isBackupNeeded(eightDaysAgo, 7)).toBe(true);
    });

    test('should get comprehensive backup status', async () => {
      // Add some test meals
      await saveMeal({
        id: 'test-1',
        mealName: 'Test Meal 1',
        date: TimestampClass.fromDate(new Date()) as any,
        uid: 'test-user'
      });

      await saveMeal({
        id: 'test-2',
        mealName: 'Test Meal 2',
        date: TimestampClass.fromDate(new Date()) as any,
        uid: 'test-user'
      });

      const status = await getBackupStatus();

      expect(status.mealCount).toBe(2);
      expect(status.needsBackup).toBe(true); // Should need backup since lastBackup is 0
      expect(status.daysSinceBackup).toBe(Infinity);
    });
  });

  describe('Data Integrity', () => {
    test('should handle invalid Timestamp objects', async () => {
      const testMeal: Meal = {
        id: 'test-1',
        mealName: 'Test Meal',
        date: { seconds: 1645804800, nanoseconds: 0 } as any, // Plain object instead of Timestamp
        uid: 'test-user'
      };

      await saveMeal(testMeal);
      const meals = await getAllMeals();

      expect(meals).toHaveLength(1);
      expect(meals[0].date).toBeInstanceOf(Object);
      // Should be converted to proper Timestamp in getAllMeals
    });

    test('should handle large datasets efficiently', async () => {
      const startTime = Date.now();

      // Create 100 test meals
      const promises = Array.from({ length: 100 }, (_, i) =>
        saveMeal({
          id: `test-${i}`,
          mealName: `Test Meal ${i}`,
          date: TimestampClass.fromDate(new Date(2024, 0, i + 1)) as any,
          uid: 'test-user'
        })
      );

      await Promise.all(promises);
      const meals = await getAllMeals();
      const endTime = Date.now();

      expect(meals).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});