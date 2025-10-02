import { getAllMeals, updateSettings, updateCacheMetadata } from '../offline-storage';
import { TagManager } from '../tag-manager';
import { type SerializableMeal } from '../export-manager';
import { type ImportOptions, type ConflictItem, type MealUpdateConflict } from './types';
import { ConflictResolver } from './conflict-resolver';

export class ImportExecutor {
  /**
   * Process meals with conflict resolution
   */
  static async processMeals(meals: SerializableMeal[], options: ImportOptions): Promise<{
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
          const conflicts = ConflictResolver.detectMealConflicts(existing, incomingMeal);

          if (conflicts.length > 0) {
            const conflict: MealUpdateConflict = {
              type: 'meal',
              action: 'update',
              existing,
              incoming: incomingMeal,
              fieldConflicts: conflicts
            };
            result.conflicts.push(conflict);

            const action = await ConflictResolver.resolveMealConflict(conflict, options.conflictResolution);

            if (action === 'skip') {
              result.skipped++;
            } else if (action === 'overwrite' && !options.dryRun) {
              await ConflictResolver.saveMealFromImport(incomingMeal);
              result.updated++;
            }
          } else {
            // No conflicts, but item exists - might be identical
            result.skipped++;
          }
        } else {
          // New meal
          if (!options.dryRun) {
            await ConflictResolver.saveMealFromImport(incomingMeal);
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
   * Import settings if included in import data
   */
  static async importSettings(settings: Record<string, unknown> | undefined, dryRun: boolean): Promise<boolean> {
    if (!settings || typeof settings !== 'object') {
      return false;
    }

    try {
      if (!dryRun) {
        await updateSettings(settings);
      }
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  /**
   * Import cache metadata if included in import data
   */
  static async importCacheMetadata(
    cacheMetadata: unknown,
    dryRun: boolean
  ): Promise<boolean> {
    if (!cacheMetadata) {
      return false;
    }

    try {
      if (!dryRun) {
        if (Array.isArray(cacheMetadata)) {
          // Handle array of cache metadata
          for (const meta of cacheMetadata) {
            if (meta && typeof meta === 'object' && 'key' in meta && typeof meta.key === 'string') {
              await updateCacheMetadata(meta.key, meta as Record<string, unknown>);
            }
          }
        } else if (typeof cacheMetadata === 'object' && 'key' in cacheMetadata && typeof cacheMetadata.key === 'string') {
          // Handle single cache metadata object
          await updateCacheMetadata(cacheMetadata.key, cacheMetadata as Record<string, unknown>);
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to import cache metadata:', error);
      return false;
    }
  }

  /**
   * Import tag management data if included in import data
   */
  static async importTagManagement(
    tagManagement: unknown,
    dryRun: boolean
  ): Promise<boolean> {
    if (!tagManagement || typeof tagManagement !== 'object') {
      return false;
    }

    try {
      if (!dryRun) {
        TagManager.saveTagManagementData(tagManagement as import('../tag-manager').TagManagementData);
      }
      return true;
    } catch (error) {
      console.error('Failed to import tag management data:', error);
      return false;
    }
  }
}