import { type SerializableMeal, type BackupMetadata } from '../export-manager';
import { type AppSettings, type CacheMetadata } from '../offline-storage';
import { type TagManagementData } from '../tag-manager';
import { type ParsedImportResult } from './types';

export class ImportParser {
  /**
   * Parse import data from various formats
   */
  static async parseImportData(content: string): Promise<ParsedImportResult> {
    const result: ParsedImportResult = {
      success: false,
      format: 'unknown',
      data: { meals: [] },
      errors: []
    };

    try {
      // Try parsing as JSON first
      const parsed: unknown = JSON.parse(content);

      // Detect format based on structure
      if (this.isBackupFormat(parsed)) {
        const meals = this.normalizeMealArray(parsed.meals);
        result.format = 'backup';
        result.data = {
          meals,
          settings: (parsed.settings as Partial<AppSettings> | undefined) ?? undefined,
          cache_meta: (parsed.cache_meta as CacheMetadata | CacheMetadata[] | null | undefined) ?? null,
          tagManagement: (parsed.tagManagement as TagManagementData | undefined) ?? undefined
        };
        result.metadata = parsed.metadata as BackupMetadata | Record<string, unknown> | undefined;
      } else if (this.isJSONExportFormat(parsed)) {
        const meals = this.normalizeMealArray(parsed.meals);
        result.format = 'json';
        result.data = {
          meals,
          settings: (parsed.settings as Partial<AppSettings> | undefined) ?? undefined,
          tagManagement: (parsed.tagManagement as TagManagementData | undefined) ?? undefined
        };
        result.metadata = parsed.metadata as BackupMetadata | Record<string, unknown> | undefined;
      } else {
        result.errors.push('Unrecognized JSON format');
        return result;
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
  private static isBackupFormat(data: unknown): data is {
    metadata: { format: string; key?: string };
    meals?: unknown[];
    settings?: Partial<AppSettings>;
    cache_meta?: CacheMetadata | CacheMetadata[] | null;
    tagManagement?: TagManagementData;
  } {
    if (!data || typeof data !== 'object') {
      return false;
    }
    const candidate = data as Record<string, unknown>;
    const metadata = candidate.metadata as Record<string, unknown> | undefined;
    return (
      Array.isArray(candidate.meals) &&
      typeof metadata?.format === 'string' &&
      metadata.format === 'backup'
    );
  }

  /**
   * Check if data is JSON export format
   */
  private static isJSONExportFormat(data: unknown): data is {
    metadata: { format?: string; key?: string };
    meals?: unknown[];
    settings?: Partial<AppSettings>;
    tagManagement?: TagManagementData;
  } {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const candidate = data as Record<string, unknown>;
    const metadata = candidate.metadata as Record<string, unknown> | undefined;
    if (!Array.isArray(candidate.meals) || !metadata) {
      return false;
    }

    if (metadata.format === 'json') {
      return true;
    }

    if (metadata.key === 'backup_status' || metadata.format === undefined) {
      return true;
    }

    return false;
  }

  private static normalizeMealArray(meals: unknown): SerializableMeal[] {
    if (!Array.isArray(meals)) {
      return [];
    }
    return meals.map(meal => this.validateAndConvertMeal(meal));
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
  private static validateAndConvertMeal(mealData: unknown): SerializableMeal {
    if (!mealData || typeof mealData !== 'object') {
      throw new Error('Invalid meal data structure');
    }

    const candidate = mealData as Record<string, unknown>;

    const id = candidate.id;
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error('Meal missing required ID field');
    }

    const mealName = candidate.mealName;
    if (typeof mealName !== 'string' || mealName.trim() === '') {
      throw new Error('Meal missing required mealName field');
    }

    const dateValue = candidate.date;
    if (!dateValue) {
      throw new Error('Meal missing required date field');
    }

    // Convert date to consistent format
    let dateObj: SerializableMeal['date'];
    if (
      typeof dateValue === 'object' &&
      dateValue !== null &&
      'seconds' in dateValue
    ) {
      const seconds = Number((dateValue as { seconds: number }).seconds);
      const nanoseconds = Number((dateValue as { nanoseconds?: number }).nanoseconds ?? 0);
      if (Number.isNaN(seconds)) {
        throw new Error('Invalid seconds value in meal date');
      }
      dateObj = {
        seconds,
        nanoseconds
      };
    } else if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid date string in meal data');
      }
      dateObj = {
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: (date.getTime() % 1000) * 1000000
      };
    } else {
      throw new Error('Invalid date format in meal data');
    }

    const uid = typeof candidate.uid === 'string' ? candidate.uid : undefined;
    const pending = typeof candidate.pending === 'boolean' ? candidate.pending : Boolean(candidate.pending);
    const hidden = typeof candidate.hidden === 'boolean' ? candidate.hidden : Boolean(candidate.hidden);

    return {
      id: id.trim(),
      mealName: mealName.trim(),
      date: dateObj,
      uid,
      pending,
      hidden
    };
  }
}