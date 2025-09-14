import { Timestamp } from 'firebase/firestore';
import {
  getAllMeals,
  saveMeal,
  updateSettings,
  updateCacheMetadata,
  type Meal,
  type AppSettings
} from './offline-storage';
import { ExportManager, type BackupData, type SerializableMeal } from './export-manager';

export type ConflictResolutionStrategy = 'skip' | 'overwrite' | 'merge' | 'ask';

export interface ImportOptions {
  conflictResolution: ConflictResolutionStrategy;
  validateChecksums?: boolean;
  createBackup?: boolean;
  dryRun?: boolean;
}

export interface ConflictItem {
  type: 'meal' | 'setting';
  action: 'update' | 'create';
  existing?: any;
  incoming: any;
  fieldConflicts?: string[];
}

export interface ImportResult {
  success: boolean;
  summary: {
    mealsProcessed: number;
    mealsImported: number;
    mealsSkipped: number;
    mealsUpdated: number;
    settingsImported: boolean;
    conflictsDetected: number;
    conflictsResolved: number;
  };
  conflicts: ConflictItem[];
  errors: string[];
  warnings: string[];
  backupCreated?: string;
}

export interface ImportPreview {
  valid: boolean;
  format: string;
  metadata?: any;
  summary: {
    totalMeals: number;
    newMeals: number;
    existingMeals: number;
    settingsIncluded: boolean;
    dateRange?: string;
  };
  conflicts: ConflictItem[];
  errors: string[];
  warnings: string[];
}

export class ImportManager {

  /**
   * Preview import data before actual import
   */
  static async previewImport(fileContent: string): Promise<ImportPreview> {
    const preview: ImportPreview = {
      valid: false,
      format: 'unknown',
      summary: {
        totalMeals: 0,
        newMeals: 0,
        existingMeals: 0,
        settingsIncluded: false
      },
      conflicts: [],
      errors: [],
      warnings: []
    };

    try {
      // Detect and parse format
      const parsed = await this.parseImportData(fileContent);
      if (!parsed.success) {
        preview.errors = parsed.errors;
        return preview;
      }

      preview.format = parsed.format;
      preview.metadata = parsed.metadata;
      preview.valid = true;

      // Get existing data for comparison
      const existingMeals = await getAllMeals();
      const existingMealMap = new Map(existingMeals.map(m => [m.id, m]));

      // Analyze meals
      const meals = parsed.data.meals || [];
      preview.summary.totalMeals = meals.length;

      let newCount = 0;
      let existingCount = 0;
      const conflicts: ConflictItem[] = [];

      for (const meal of meals) {
        const existing = existingMealMap.get(meal.id);

        if (existing) {
          existingCount++;

          // Check for conflicts
          const fieldConflicts = this.detectMealConflicts(existing, meal);
          if (fieldConflicts.length > 0) {
            conflicts.push({
              type: 'meal',
              action: 'update',
              existing,
              incoming: meal,
              fieldConflicts
            });
          }
        } else {
          newCount++;
        }
      }

      preview.summary.newMeals = newCount;
      preview.summary.existingMeals = existingCount;
      preview.summary.settingsIncluded = !!parsed.data.settings;
      preview.conflicts = conflicts;

      // Calculate date range
      if (meals.length > 0) {
        const dates = meals.map((m: SerializableMeal) => new Date(m.date.seconds * 1000));
        const minDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
        preview.summary.dateRange = `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;
      }

      // Add warnings
      if (conflicts.length > 0) {
        preview.warnings.push(`${conflicts.length} conflicts detected. Review before importing.`);
      }

      if (parsed.data.meals && parsed.data.meals.length > 1000) {
        preview.warnings.push('Large dataset detected. Import may take longer than usual.');
      }

    } catch (error) {
      preview.errors.push(`Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return preview;
  }

  /**
   * Import data with conflict resolution
   */
  static async importData(fileContent: string, options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      summary: {
        mealsProcessed: 0,
        mealsImported: 0,
        mealsSkipped: 0,
        mealsUpdated: 0,
        settingsImported: false,
        conflictsDetected: 0,
        conflictsResolved: 0
      },
      conflicts: [],
      errors: [],
      warnings: []
    };

    try {
      // Create backup if requested
      if (options.createBackup) {
        const backupResult = await ExportManager.exportData({
          format: 'backup',
          includeMeals: true,
          includeSettings: true,
          includeMetadata: true
        });

        if (backupResult.success) {
          result.backupCreated = backupResult.filename;
        } else {
          result.warnings.push('Failed to create pre-import backup');
        }
      }

      // Parse import data
      const parsed = await this.parseImportData(fileContent);
      if (!parsed.success) {
        result.errors = parsed.errors;
        return result;
      }

      // Validate checksum if available and requested
      if (options.validateChecksums && parsed.metadata?.checksum) {
        const calculatedChecksum = await ExportManager['generateChecksum'](fileContent);
        if (calculatedChecksum !== parsed.metadata.checksum) {
          result.errors.push('Checksum validation failed. File may be corrupted.');
          return result;
        }
      }

      // Process meals
      if (parsed.data.meals && parsed.data.meals.length > 0) {
        const mealResult = await this.processMeals(parsed.data.meals, options);
        result.summary.mealsProcessed = mealResult.processed;
        result.summary.mealsImported = mealResult.imported;
        result.summary.mealsSkipped = mealResult.skipped;
        result.summary.mealsUpdated = mealResult.updated;
        result.conflicts.push(...mealResult.conflicts);
        result.errors.push(...mealResult.errors);
      }

      // Process settings
      if (parsed.data.settings && !options.dryRun) {
        try {
          await updateSettings(parsed.data.settings);
          result.summary.settingsImported = true;
        } catch (error) {
          result.errors.push(`Failed to import settings: ${error}`);
        }
      }

      // Update metadata
      if (parsed.metadata && !options.dryRun) {
        await updateCacheMetadata('import_status', {
          lastImportTimestamp: Date.now(),
          lastImportSource: parsed.metadata.source || 'unknown',
          lastImportFormat: parsed.metadata.format || 'unknown'
        });
      }

      result.summary.conflictsDetected = result.conflicts.length;
      result.summary.conflictsResolved = result.conflicts.filter(c => c.action).length;

      result.success = result.errors.length === 0;

      if (options.dryRun) {
        result.warnings.push('Dry run completed. No data was actually imported.');
      }

    } catch (error) {
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Parse import data and detect format
   */
  private static async parseImportData(content: string): Promise<{
    success: boolean;
    format: string;
    data: any;
    metadata?: any;
    errors: string[];
  }> {
    const result = {
      success: false,
      format: 'unknown',
      data: {} as any,
      metadata: undefined,
      errors: [] as string[]
    };

    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(content);

      // Detect format based on structure
      if (this.isBackupFormat(parsed)) {
        result.format = 'backup';
        result.data = {
          meals: parsed.meals || [],
          settings: parsed.settings,
          cache_meta: parsed.cache_meta
        };
        result.metadata = parsed.metadata;
      } else if (this.isJSONExportFormat(parsed)) {
        result.format = 'json';
        result.data = {
          meals: parsed.meals || [],
          settings: parsed.settings
        };
        result.metadata = parsed.metadata;
      } else {
        result.errors.push('Unrecognized JSON format');
        return result;
      }

      // Validate and convert meals
      if (result.data.meals) {
        result.data.meals = result.data.meals.map((meal: any) => this.validateAndConvertMeal(meal));
      }

      result.success = true;

    } catch (jsonError) {
      // Try parsing as CSV
      try {
        const csvData = this.parseCSV(content);
        result.format = 'csv';
        result.data = { meals: csvData };
        result.success = true;
      } catch (csvError) {
        result.errors.push('Failed to parse as JSON or CSV');
        result.errors.push(`JSON error: ${jsonError}`);
        result.errors.push(`CSV error: ${csvError}`);
      }
    }

    return result;
  }

  /**
   * Check if data is backup format
   */
  private static isBackupFormat(data: any): boolean {
    return data &&
           data.metadata &&
           data.metadata.format === 'backup' &&
           Array.isArray(data.meals);
  }

  /**
   * Check if data is JSON export format
   */
  private static isJSONExportFormat(data: any): boolean {
    return data &&
           data.metadata &&
           data.metadata.format === 'json' &&
           Array.isArray(data.meals);
  }

  /**
   * Parse CSV content into meals
   */
  private static parseCSV(content: string): SerializableMeal[] {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header and one data row');
    }

    const meals: SerializableMeal[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (doesn't handle quotes with commas inside)
      const fields = line.split(',').map(field => field.replace(/^"|"$/g, ''));

      if (fields.length < 2) {
        throw new Error(`Invalid CSV row ${i}: insufficient fields`);
      }

      const [dateStr, mealName, hidden, pending, uid] = fields;

      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date in row ${i}: ${dateStr}`);
        }

        meals.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          mealName: mealName.trim(),
          date: {
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: (date.getTime() % 1000) * 1000000
          },
          uid: uid || undefined,
          pending: pending === 'Yes',
          hidden: hidden === 'Yes'
        });
      } catch (error) {
        throw new Error(`Error parsing CSV row ${i}: ${error}`);
      }
    }

    return meals;
  }

  /**
   * Validate and convert meal data
   */
  private static validateAndConvertMeal(mealData: any): SerializableMeal {
    if (!mealData.id || typeof mealData.id !== 'string') {
      throw new Error('Meal missing required ID field');
    }

    if (!mealData.mealName || typeof mealData.mealName !== 'string') {
      throw new Error('Meal missing required mealName field');
    }

    if (!mealData.date) {
      throw new Error('Meal missing required date field');
    }

    // Convert date to consistent format
    let dateObj;
    if (mealData.date.seconds !== undefined) {
      // Already in Firestore Timestamp format
      dateObj = {
        seconds: mealData.date.seconds,
        nanoseconds: mealData.date.nanoseconds || 0
      };
    } else if (typeof mealData.date === 'string') {
      // ISO string format
      const date = new Date(mealData.date);
      dateObj = {
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: (date.getTime() % 1000) * 1000000
      };
    } else {
      throw new Error('Invalid date format in meal data');
    }

    return {
      id: mealData.id,
      mealName: mealData.mealName.trim(),
      date: dateObj,
      uid: mealData.uid,
      pending: !!mealData.pending,
      hidden: !!mealData.hidden
    };
  }

  /**
   * Process meals with conflict resolution
   */
  private static async processMeals(meals: SerializableMeal[], options: ImportOptions): Promise<{
    processed: number;
    imported: number;
    skipped: number;
    updated: number;
    conflicts: ConflictItem[];
    errors: string[];
  }> {
    const result = {
      processed: 0,
      imported: 0,
      skipped: 0,
      updated: 0,
      conflicts: [] as ConflictItem[],
      errors: [] as string[]
    };

    const existingMeals = await getAllMeals();
    const existingMealMap = new Map(existingMeals.map(m => [m.id, m]));

    for (const incomingMeal of meals) {
      result.processed++;

      try {
        const existing = existingMealMap.get(incomingMeal.id);

        if (existing) {
          // Handle existing meal
          const conflicts = this.detectMealConflicts(existing, incomingMeal);

          if (conflicts.length > 0) {
            const conflict: ConflictItem = {
              type: 'meal',
              action: 'update',
              existing,
              incoming: incomingMeal,
              fieldConflicts: conflicts
            };
            result.conflicts.push(conflict);

            const action = await this.resolveMealConflict(conflict, options.conflictResolution);

            if (action === 'skip') {
              result.skipped++;
            } else if (action === 'overwrite' && !options.dryRun) {
              await this.saveMealFromImport(incomingMeal);
              result.updated++;
            }
          } else {
            // No conflicts, but item exists - might be identical
            result.skipped++;
          }
        } else {
          // New meal
          if (!options.dryRun) {
            await this.saveMealFromImport(incomingMeal);
          }
          result.imported++;
        }
      } catch (error) {
        result.errors.push(`Failed to process meal ${incomingMeal.id}: ${error}`);
      }
    }

    return result;
  }

  /**
   * Detect conflicts between existing and incoming meal
   */
  private static detectMealConflicts(existing: Meal, incoming: SerializableMeal): string[] {
    const conflicts: string[] = [];

    if (existing.mealName !== incoming.mealName) {
      conflicts.push('mealName');
    }

    if (existing.date.seconds !== incoming.date.seconds) {
      conflicts.push('date');
    }

    if (existing.hidden !== incoming.hidden) {
      conflicts.push('hidden');
    }

    if (existing.pending !== incoming.pending) {
      conflicts.push('pending');
    }

    return conflicts;
  }

  /**
   * Resolve meal conflict based on strategy
   */
  private static async resolveMealConflict(
    conflict: ConflictItem,
    strategy: ConflictResolutionStrategy
  ): Promise<'skip' | 'overwrite' | 'merge'> {
    switch (strategy) {
      case 'skip':
        return 'skip';
      case 'overwrite':
        return 'overwrite';
      case 'merge':
        // For meals, merge means take newer timestamp
        const existingTime = conflict.existing.date.toMillis();
        const incomingTime = conflict.incoming.date.seconds * 1000;
        return incomingTime > existingTime ? 'overwrite' : 'skip';
      case 'ask':
        // In a real implementation, this would prompt the user
        // For now, default to skip
        return 'skip';
      default:
        return 'skip';
    }
  }

  /**
   * Save meal from import data
   */
  private static async saveMealFromImport(mealData: SerializableMeal): Promise<void> {
    const meal: Meal = {
      id: mealData.id,
      mealName: mealData.mealName,
      date: new Timestamp(mealData.date.seconds, mealData.date.nanoseconds),
      uid: mealData.uid,
      pending: mealData.pending,
      hidden: mealData.hidden
    };

    await saveMeal(meal);
  }

  /**
   * Validate import file before processing
   */
  static validateImportFile(file: File): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      errors.push('File size exceeds 10MB limit');
    }

    // Check file type
    const allowedTypes = [
      'application/json',
      'text/json',
      'text/csv',
      'application/csv',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.backup')) {
      errors.push('Unsupported file type. Please use JSON, CSV, or .backup files.');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Read file content as text
   */
  static readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };

      reader.onerror = () => {
        reject(new Error('File reading failed'));
      };

      reader.readAsText(file);
    });
  }
}