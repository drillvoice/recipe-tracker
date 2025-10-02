import { getAllMeals } from '../offline-storage';
import { ExportManager, type SerializableMeal } from '../export-manager';
import { ImportParser } from './parser';
import { ConflictResolver } from './conflict-resolver';
import { ImportExecutor } from './executor';

// Re-export types for backwards compatibility
export type {
  ConflictResolutionStrategy,
  ImportOptions,
  ConflictItem,
  ImportResult,
  ImportPreview,
  ImportFormat,
  ParsedImportPayload,
  ParsedImportResult,
  MealUpdateConflict
} from './types';

export { ImportParser } from './parser';
export { ConflictResolver } from './conflict-resolver';
export { ImportExecutor } from './executor';

export class ImportManager {
  /**
   * Preview import data before actual import
   */
  static async previewImport(fileContent: string): Promise<import('./types').ImportPreview> {
    const preview: import('./types').ImportPreview = {
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
      const parsed = await ImportParser.parseImportData(fileContent);
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
      const conflicts: import('./types').ConflictItem[] = [];

      for (const meal of meals) {
        const existing = existingMealMap.get(meal.id);

        if (existing) {
          existingCount++;

          // Check for conflicts
          const fieldConflicts = ConflictResolver.detectMealConflicts(existing, meal);
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
  static async importData(
    fileContent: string,
    options: import('./types').ImportOptions
  ): Promise<import('./types').ImportResult> {
    const result: import('./types').ImportResult = {
      success: false,
      summary: {
        mealsProcessed: 0,
        mealsImported: 0,
        mealsSkipped: 0,
        mealsUpdated: 0,
        settingsImported: false,
        tagManagementImported: false,
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
          includeSettings: true,
          includeMetadata: true
        });
        result.backupCreated = backupResult.filename;
      }

      // Parse import data
      const parsed = await ImportParser.parseImportData(fileContent);
      if (!parsed.success) {
        result.errors = parsed.errors;
        return result;
      }

      // Process meals
      const mealResults = await ImportExecutor.processMeals(parsed.data.meals, options);
      result.summary.mealsProcessed = mealResults.processed;
      result.summary.mealsImported = mealResults.imported;
      result.summary.mealsSkipped = mealResults.skipped;
      result.summary.mealsUpdated = mealResults.updated;
      result.conflicts = mealResults.conflicts;
      result.errors.push(...mealResults.errors);
      result.summary.conflictsDetected = mealResults.conflicts.length;
      result.summary.conflictsResolved = mealResults.conflicts.length;

      // Import settings if included
      if (parsed.data.settings) {
        result.summary.settingsImported = await ImportExecutor.importSettings(
          parsed.data.settings,
          options.dryRun || false
        );
      }

      // Import cache metadata if included
      if (parsed.data.cache_meta) {
        await ImportExecutor.importCacheMetadata(parsed.data.cache_meta, options.dryRun || false);
      }

      // Import tag management data if included
      if (parsed.data.tagManagement) {
        result.summary.tagManagementImported = await ImportExecutor.importTagManagement(
          parsed.data.tagManagement,
          options.dryRun || false
        );
      }

      result.success = result.errors.length === 0;

      // Add dry run warning
      if (options.dryRun) {
        result.warnings.push('Dry run completed. No data was actually imported.');
      }

      // Add summary warnings
      if (result.summary.mealsSkipped > 0) {
        result.warnings.push(`${result.summary.mealsSkipped} meals were skipped due to conflicts or duplicates.`);
      }

    } catch (error) {
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Validate import file before processing
   */
  static validateImportFile(file: File): { valid: boolean; errors: string[] } {
    return ConflictResolver.validateImportFile(file);
  }

  /**
   * Read file content as text
   */
  static async readFileContent(file: File): Promise<string> {
    return ConflictResolver.readFileContent(file);
  }
}