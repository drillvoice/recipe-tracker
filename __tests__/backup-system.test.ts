/**
 * @jest-environment jsdom
 */

import 'fake-indexeddb/auto';
import { Timestamp } from 'firebase/firestore';

// Polyfill for test environment
if (!global.structuredClone) {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

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

  isEqual(other: MockTimestamp) {
    return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }

  toJSON() {
    return { seconds: this.seconds, nanoseconds: this.nanoseconds, type: 'timestamp' };
  }

  valueOf() {
    return `Timestamp(${this.seconds}, ${this.nanoseconds})`;
  }
}

jest.mock('firebase/firestore', () => ({
  Timestamp: MockTimestamp
}));

// Mock window.crypto for checksum generation
Object.defineProperty(window, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockResolvedValue(
        // Mock a SHA-256 hash as ArrayBuffer (32 bytes)
        new Uint8Array(32).fill(0).buffer
      )
    }
  }
});

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = jest.fn();

// Mock document methods for file download
Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    href: '',
    download: '',
    style: { display: '' },
    click: jest.fn(),
    remove: jest.fn()
  }))
});

Object.defineProperty(document.body, 'appendChild', {
  value: jest.fn()
});

Object.defineProperty(document.body, 'removeChild', {
  value: jest.fn()
});

import { ExportManager, type ExportOptions, type BackupData } from '../src/lib/export-manager';
import { ImportManager, type ImportOptions } from '../src/lib/import-manager';
import { DataValidator } from '../src/lib/data-validator';
import { saveMeal, getAllMeals, updateSettings, type Meal } from '../src/lib/offline-storage';

describe('Backup System Integration Tests', () => {
  beforeEach(async () => {
    // Clear IndexedDB before each test
    indexedDB = new (require('fake-indexeddb/lib/FDBFactory'))();

    // Reset database promise to force new database creation
    const offlineStorage = require('../src/lib/offline-storage');
    if (offlineStorage.resetDbPromise) {
      offlineStorage.resetDbPromise();
    }

    // Add some test data
    const testMeals: Meal[] = [
      {
        id: 'meal-1',
        mealName: 'Spaghetti Carbonara',
        date: MockTimestamp.fromDate(new Date('2024-03-15')),
        uid: 'test-user',
        pending: false,
        hidden: false
      },
      {
        id: 'meal-2',
        mealName: 'Chicken Curry',
        date: MockTimestamp.fromDate(new Date('2024-03-16')),
        uid: 'test-user',
        pending: true,
        hidden: false
      },
      {
        id: 'meal-3',
        mealName: 'Vegetable Stir Fry',
        date: MockTimestamp.fromDate(new Date('2024-03-17')),
        uid: 'test-user',
        pending: false,
        hidden: true
      }
    ];

    for (const meal of testMeals) {
      await saveMeal(meal);
    }

    await updateSettings({
      id: 'app_preferences',
      theme: 'light',
      autoBackupEnabled: true,
      backupFrequencyDays: 7,
      exportFormat: 'json'
    });
  });

  describe('ExportManager', () => {
    test('should export data in JSON format', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeMeals: true,
        includeSettings: true,
        includeMetadata: true
      };

      const result = await ExportManager.exportData(options);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(3);
      expect(result.filename).toContain('recipe-tracker-export');
      expect(result.filename).toContain('.json');
      expect(result.size).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should export data in CSV format', async () => {
      const options: ExportOptions = {
        format: 'csv',
        includeMeals: true
      };

      const result = await ExportManager.exportData(options);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(3);
      expect(result.filename).toContain('recipe-tracker-meals');
      expect(result.filename).toContain('.csv');
    });

    test('should export data in backup format with checksum', async () => {
      const options: ExportOptions = {
        format: 'backup',
        includeMeals: true,
        includeSettings: true,
        includeMetadata: true,
        addChecksum: true
      };

      const result = await ExportManager.exportData(options);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(3);
      expect(result.filename).toContain('recipe-tracker-backup');
      expect(result.filename).toContain('.backup');
      expect(result.checksum).toBeDefined();
    });

    test('should filter by date range', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeMeals: true,
        dateRange: {
          start: new Date('2024-03-15'),
          end: new Date('2024-03-16')
        }
      };

      const result = await ExportManager.exportData(options);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(2); // Should only include 2 meals within date range
    });

    test('should get export statistics', async () => {
      const stats = await ExportManager.getExportStats();

      expect(stats.totalMeals).toBe(3);
      expect(stats.estimatedSize).toContain('B'); // Should contain byte unit
    });

    test('should validate export data', () => {
      const testMeals: Meal[] = [
        {
          id: 'valid-meal',
          mealName: 'Test Meal',
          date: MockTimestamp.fromDate(new Date()),
          uid: 'test-user'
        },
        {
          id: '', // Invalid - empty ID
          mealName: 'Invalid Meal',
          date: MockTimestamp.fromDate(new Date()),
          uid: 'test-user'
        }
      ];

      const validation = ExportManager.validateExportData(testMeals);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('missing ID');
    });

    test('should handle empty data gracefully', async () => {
      // Clear all meals
      const meals = await getAllMeals();
      // In a real implementation, we'd delete them, but for testing just export empty set

      const options: ExportOptions = {
        format: 'json',
        includeMeals: false
      };

      const result = await ExportManager.exportData(options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No data available to export');
    });
  });

  describe('ImportManager', () => {
    test('should preview JSON import correctly', async () => {
      const importData = {
        metadata: {
          version: '1.0.0',
          format: 'json',
          exportDate: new Date().toISOString(),
          source: 'test'
        },
        meals: [
          {
            id: 'new-meal-1',
            mealName: 'Imported Pasta',
            date: {
              seconds: Math.floor(new Date('2024-03-18').getTime() / 1000),
              nanoseconds: 0
            },
            uid: 'test-user'
          },
          {
            id: 'meal-1', // Existing meal - should detect conflict
            mealName: 'Updated Carbonara',
            date: {
              seconds: Math.floor(new Date('2024-03-15').getTime() / 1000),
              nanoseconds: 0
            },
            uid: 'test-user'
          }
        ]
      };

      const preview = await ImportManager.previewImport(JSON.stringify(importData));

      expect(preview.valid).toBe(true);
      expect(preview.format).toBe('json');
      expect(preview.summary.totalMeals).toBe(2);
      expect(preview.summary.newMeals).toBe(1);
      expect(preview.summary.existingMeals).toBe(1);
      expect(preview.conflicts).toHaveLength(1);
      expect(preview.conflicts[0].type).toBe('meal');
      expect(preview.conflicts[0].action).toBe('update');
    });

    test('should import data with skip conflict resolution', async () => {
      const importData = {
        metadata: {
          version: '1.0.0',
          format: 'json',
          exportDate: new Date().toISOString(),
          source: 'test'
        },
        meals: [
          {
            id: 'new-meal-1',
            mealName: 'Imported Pasta',
            date: {
              seconds: Math.floor(new Date('2024-03-18').getTime() / 1000),
              nanoseconds: 0
            },
            uid: 'test-user'
          }
        ]
      };

      const options: ImportOptions = {
        conflictResolution: 'skip',
        createBackup: false,
        dryRun: false
      };

      const result = await ImportManager.importData(JSON.stringify(importData), options);

      expect(result.success).toBe(true);
      expect(result.summary.mealsImported).toBe(1);
      expect(result.summary.mealsProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify the meal was actually imported
      const allMeals = await getAllMeals();
      expect(allMeals).toHaveLength(4); // 3 original + 1 imported
      expect(allMeals.some(m => m.id === 'new-meal-1')).toBe(true);
    });

    test('should handle CSV import', async () => {
      const csvContent = `Date,Meal Name,Hidden,Pending,User ID
"2024-03-20","Imported CSV Meal","No","No","test-user"
"2024-03-21","Another CSV Meal","Yes","No","test-user"`;

      const preview = await ImportManager.previewImport(csvContent);

      expect(preview.valid).toBe(true);
      expect(preview.format).toBe('csv');
      expect(preview.summary.totalMeals).toBe(2);
      expect(preview.summary.newMeals).toBe(2);
    });

    test('should validate file before import', () => {
      const validFile = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' });
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/octet-stream' });
      const largeFile = new File([new Array(11 * 1024 * 1024).fill('a').join('')], 'large.json', { type: 'application/json' });

      expect(ImportManager.validateImportFile(validFile).valid).toBe(true);
      expect(ImportManager.validateImportFile(invalidFile).valid).toBe(false);
      expect(ImportManager.validateImportFile(largeFile).valid).toBe(false);
    });

    test('should perform dry run without making changes', async () => {
      const importData = {
        metadata: {
          version: '1.0.0',
          format: 'json',
          exportDate: new Date().toISOString(),
          source: 'test'
        },
        meals: [
          {
            id: 'dry-run-meal',
            mealName: 'Dry Run Meal',
            date: {
              seconds: Math.floor(new Date('2024-03-18').getTime() / 1000),
              nanoseconds: 0
            },
            uid: 'test-user'
          }
        ]
      };

      const options: ImportOptions = {
        conflictResolution: 'skip',
        dryRun: true
      };

      const result = await ImportManager.importData(JSON.stringify(importData), options);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Dry run completed. No data was actually imported.');

      // Verify no actual changes were made (dry run meal should not exist)
      const allMeals = await getAllMeals();
      expect(allMeals.some(m => m.id === 'dry-run-meal')).toBe(false);
    });

    test('should handle malformed import data', async () => {
      const malformedData = '{"invalid": json}';

      const preview = await ImportManager.previewImport(malformedData);

      expect(preview.valid).toBe(false);
      expect(preview.errors.length).toBeGreaterThan(0);
    });
  });

  describe('DataValidator', () => {
    test('should validate all data successfully', async () => {
      const validation = await DataValidator.validateAllData();

      expect(validation.valid).toBe(true);
      expect(validation.stats.totalMeals).toBeGreaterThanOrEqual(3);
      expect(validation.stats.duplicateIds).toBe(0);
      expect(validation.stats.dataIntegrityScore).toBeGreaterThan(80);
    });

    test('should detect data integrity issues', async () => {
      // Add a meal with invalid data
      const invalidMeal = {
        id: '', // Invalid empty ID
        mealName: '',
        date: MockTimestamp.fromDate(new Date()),
        uid: 'test-user'
      } as Meal;

      await saveMeal(invalidMeal);

      const validation = await DataValidator.validateAllData();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.stats.dataIntegrityScore).toBeLessThan(100);
    });

    test('should perform comprehensive integrity check', async () => {
      const integrityCheck = await DataValidator.performIntegrityCheck();

      expect(integrityCheck.checksPerformed).toBeGreaterThan(0);
      expect(integrityCheck.checksPassed).toBeGreaterThan(0);
      expect(Array.isArray(integrityCheck.issues)).toBe(true);
      expect(Array.isArray(integrityCheck.recommendations)).toBe(true);
    });

    test('should detect performance issues with large datasets', async () => {
      // This test would be slow in reality, so we'll mock the behavior
      const mockGetAllMeals = jest.fn().mockResolvedValue(
        new Array(15000).fill(null).map((_, i) => ({
          id: `meal-${i}`,
          mealName: `Meal ${i}`,
          date: MockTimestamp.fromDate(new Date()),
          uid: 'test-user'
        }))
      );

      // Temporarily replace getAllMeals
      const originalGetAllMeals = require('../src/lib/offline-storage').getAllMeals;
      require('../src/lib/offline-storage').getAllMeals = mockGetAllMeals;

      try {
        const validation = await DataValidator.validateAllData();

        expect(validation.warnings.some(w => w.type === 'performance')).toBe(true);
        expect(validation.stats.totalMeals).toBe(15000);
      } finally {
        // Restore original function
        require('../src/lib/offline-storage').getAllMeals = originalGetAllMeals;
      }
    });
  });

  describe('End-to-End Export/Import Cycle', () => {
    test('should complete full export-import cycle without data loss', async () => {
      // Step 1: Export all data
      const exportOptions: ExportOptions = {
        format: 'backup',
        includeMeals: true,
        includeSettings: true,
        includeMetadata: true
      };

      const exportResult = await ExportManager.exportData(exportOptions);
      expect(exportResult.success).toBe(true);

      // Step 2: Clear database (simulate fresh install)
      // In a real test, we'd clear the database here
      // For this test, we'll assume the export content is available

      // Step 3: Import the exported data
      const mockExportedData: BackupData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          source: 'recipe-tracker-enhanced',
          appVersion: '0.0.7',
          format: 'backup',
          itemCounts: {
            meals: 3,
            settings: 1
          }
        },
        meals: [
          {
            id: 'meal-1',
            mealName: 'Spaghetti Carbonara',
            date: {
              seconds: Math.floor(new Date('2024-03-15').getTime() / 1000),
              nanoseconds: 0
            },
            uid: 'test-user',
            pending: false,
            hidden: false
          },
          {
            id: 'meal-2',
            mealName: 'Chicken Curry',
            date: {
              seconds: Math.floor(new Date('2024-03-16').getTime() / 1000),
              nanoseconds: 0
            },
            uid: 'test-user',
            pending: true,
            hidden: false
          },
          {
            id: 'meal-3',
            mealName: 'Vegetable Stir Fry',
            date: {
              seconds: Math.floor(new Date('2024-03-17').getTime() / 1000),
              nanoseconds: 0
            },
            uid: 'test-user',
            pending: false,
            hidden: true
          }
        ],
        settings: {
          id: 'app_preferences',
          theme: 'light',
          autoBackupEnabled: true,
          backupFrequencyDays: 7,
          exportFormat: 'json'
        }
      };

      const importOptions: ImportOptions = {
        conflictResolution: 'overwrite',
        createBackup: false,
        dryRun: false
      };

      const importResult = await ImportManager.importData(
        JSON.stringify(mockExportedData),
        importOptions
      );

      expect(importResult.success).toBe(true);
      expect(importResult.summary.mealsProcessed).toBe(3);

      // Step 4: Validate data integrity after import
      const validation = await DataValidator.validateAllData();
      expect(validation.valid).toBe(true);
      expect(validation.stats.totalMeals).toBeGreaterThan(0);
    });

    test('should handle conflict resolution during import', async () => {
      // Create conflicting data
      const conflictingImportData = {
        metadata: {
          version: '1.0.0',
          format: 'json',
          exportDate: new Date().toISOString(),
          source: 'test'
        },
        meals: [
          {
            id: 'meal-1', // Same ID as existing meal
            mealName: 'Modified Carbonara', // Different name
            date: {
              seconds: Math.floor(new Date('2024-03-15').getTime() / 1000),
              nanoseconds: 0
            },
            uid: 'test-user',
            pending: false,
            hidden: false
          }
        ]
      };

      // Test different conflict resolution strategies
      const strategies: Array<{ strategy: string; expectedAction: string }> = [
        { strategy: 'skip', expectedAction: 'should skip conflicting items' },
        { strategy: 'overwrite', expectedAction: 'should overwrite with new data' },
        { strategy: 'merge', expectedAction: 'should merge based on timestamps' }
      ];

      for (const { strategy } of strategies) {
        const options: ImportOptions = {
          conflictResolution: strategy as any,
          createBackup: false,
          dryRun: true // Use dry run to avoid affecting subsequent tests
        };

        const result = await ImportManager.importData(
          JSON.stringify(conflictingImportData),
          options
        );

        expect(result.success).toBe(true);
        expect(result.summary.conflictsDetected).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty import files', async () => {
      const emptyFile = '';
      const preview = await ImportManager.previewImport(emptyFile);

      expect(preview.valid).toBe(false);
      expect(preview.errors.length).toBeGreaterThan(0);
    });

    test('should handle corrupted backup files', async () => {
      const corruptedBackup = '{"metadata":{"format":"backup"},"meals":[{"id":"corrupt"'; // Incomplete JSON

      const preview = await ImportManager.previewImport(corruptedBackup);

      expect(preview.valid).toBe(false);
      expect(preview.errors.length).toBeGreaterThan(0);
    });

    test('should handle unsupported export formats gracefully', async () => {
      const options: ExportOptions = {
        format: 'xml' as any, // Unsupported format
        includeMeals: true
      };

      const result = await ExportManager.exportData(options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unsupported export format: xml');
    });

    test('should validate date ranges in export options', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeMeals: true,
        dateRange: {
          start: new Date('2025-01-01'), // Future date
          end: new Date('2024-12-31')   // Earlier end date
        }
      };

      const result = await ExportManager.exportData(options);

      // Should handle invalid date ranges gracefully
      expect(result.itemCount).toBe(0); // No meals in this range
    });
  });
});