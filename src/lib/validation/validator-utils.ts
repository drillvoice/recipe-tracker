import { type Meal, type AppSettings, type CacheMetadata } from '../offline-storage';
import { type ValidationResult } from './types';

export class ValidatorUtils {
  /**
   * Validate individual meals
   */
  static async validateMeals(meals: Meal[], result: ValidationResult): Promise<void> {
    const mealIds = new Set<string>();
    const mealNames = new Map<string, number>();

    for (const meal of meals) {
      // Check for duplicate IDs
      if (mealIds.has(meal.id)) {
        result.stats.duplicateIds++;
        result.errors.push({
          type: 'error',
          field: 'id',
          message: `Duplicate meal ID found: ${meal.id}`,
          item: meal,
          suggestion: 'Remove duplicate entries or regenerate IDs'
        });
      } else {
        mealIds.add(meal.id);
      }

      // Validate meal name
      if (!meal.mealName || meal.mealName.trim() === '') {
        result.stats.emptyMealNames++;
        result.errors.push({
          type: 'error',
          field: 'mealName',
          message: 'Meal has empty or missing name',
          item: meal,
          suggestion: 'Add a descriptive name for this meal'
        });
      } else {
        // Track meal name frequency
        const trimmedName = meal.mealName.trim();
        mealNames.set(trimmedName, (mealNames.get(trimmedName) || 0) + 1);

        // Check for excessively long names
        if (trimmedName.length > 100) {
          result.warnings.push({
            type: 'data_quality',
            message: `Meal name is very long (${trimmedName.length} characters): "${trimmedName.substring(0, 50)}..."`,
            suggestion: 'Consider shortening meal names for better readability'
          });
        }

        // Check for suspicious patterns
        if (trimmedName.toLowerCase().includes('test') || trimmedName.toLowerCase().includes('debug')) {
          result.warnings.push({
            type: 'data_quality',
            message: `Meal name appears to be test data: "${trimmedName}"`,
            suggestion: 'Remove test entries from production data'
          });
        }
      }

      // Validate date
      if (!meal.date) {
        result.stats.invalidDates++;
        result.errors.push({
          type: 'error',
          field: 'date',
          message: 'Meal has missing date',
          item: meal,
          suggestion: 'Assign a valid date to this meal'
        });
      } else {
        try {
          const dateMs = meal.date.toMillis();
          const now = Date.now();
          const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
          const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);

          // Check for future dates (more than 1 day ahead)
          if (dateMs > now + (24 * 60 * 60 * 1000)) {
            result.warnings.push({
              type: 'data_quality',
              message: `Meal date is in the future: ${new Date(dateMs).toLocaleDateString()}`,
              suggestion: 'Verify meal dates are correct'
            });
          }

          // Check for very old dates (more than 10 years ago)
          if (dateMs < now - (10 * 365 * 24 * 60 * 60 * 1000)) {
            result.warnings.push({
              type: 'data_quality',
              message: `Meal date is very old: ${new Date(dateMs).toLocaleDateString()}`,
              suggestion: 'Verify meal dates are correct'
            });
          }

          // Check for dates beyond reasonable range
          if (dateMs < oneYearAgo - (5 * 365 * 24 * 60 * 60 * 1000) || dateMs > oneYearFromNow) {
            result.stats.invalidDates++;
            result.errors.push({
              type: 'warning',
              field: 'date',
              message: `Meal date is outside reasonable range: ${new Date(dateMs).toLocaleDateString()}`,
              item: meal,
              suggestion: 'Check if this date is correct'
            });
          }
        } catch (_error) {
          result.stats.invalidDates++;
          result.errors.push({
            type: 'error',
            field: 'date',
            message: 'Meal has invalid date format',
            item: meal,
            suggestion: 'Fix the date format for this meal'
          });
        }
      }

      // Validate UID format if present
      if (meal.uid && (typeof meal.uid !== 'string' || meal.uid.trim() === '')) {
        result.warnings.push({
          type: 'data_quality',
          message: 'Meal has invalid UID format',
          suggestion: 'UIDs should be non-empty strings'
        });
      }

      // Check for orphaned meals (meals without proper user association)
      if (!meal.uid && meal.pending !== false) {
        result.stats.orphanedMeals++;
        result.warnings.push({
          type: 'data_quality',
          message: 'Meal appears to be orphaned (no user ID and not explicitly local)',
          suggestion: 'Review meal ownership and sync status'
        });
      }

      // Validate tags if present
      if (meal.tags) {
        if (!Array.isArray(meal.tags)) {
          result.errors.push({
            type: 'error',
            field: 'tags',
            message: 'Meal tags should be an array',
            item: meal,
            suggestion: 'Fix tags format for this meal'
          });
        } else {
          // Check for duplicate tags
          const uniqueTags = new Set(meal.tags);
          if (uniqueTags.size !== meal.tags.length) {
            result.warnings.push({
              type: 'data_quality',
              message: `Meal has duplicate tags: "${meal.mealName}"`,
              suggestion: 'Remove duplicate tags'
            });
          }

          // Check for empty tags
          const emptyTags = meal.tags.filter(tag => !tag || tag.trim() === '');
          if (emptyTags.length > 0) {
            result.warnings.push({
              type: 'data_quality',
              message: `Meal has empty tags: "${meal.mealName}"`,
              suggestion: 'Remove empty tags'
            });
          }
        }
      }
    }

    // Check for excessive duplicates
    mealNames.forEach((count, name) => {
      if (count > 50) {
        result.warnings.push({
          type: 'data_quality',
          message: `Meal name "${name}" appears ${count} times`,
          count,
          suggestion: 'Consider if this is intentional or if there are data quality issues'
        });
      }
    });

    // Performance warnings
    if (meals.length > 1000) {
      result.warnings.push({
        type: 'performance',
        message: `Large dataset: ${meals.length} meals`,
        count: meals.length,
        suggestion: 'Consider archiving old data for better performance'
      });
    }
  }

  /**
   * Validate app settings
   */
  static async validateSettings(settings: AppSettings | null, result: ValidationResult): Promise<void> {
    if (!settings) {
      result.warnings.push({
        type: 'data_quality',
        message: 'No app settings found',
        suggestion: 'Settings will be initialized with defaults'
      });
      return;
    }

    // Check theme setting
    if (settings.theme && !['light', 'dark'].includes(settings.theme)) {
      result.warnings.push({
        type: 'data_quality',
        message: `Invalid theme setting: ${settings.theme}`,
        suggestion: 'Theme should be "light" or "dark"'
      });
    }

    // Check backup frequency
    if (settings.backupFrequencyDays !== undefined && (
      typeof settings.backupFrequencyDays !== 'number' ||
      settings.backupFrequencyDays < 1 ||
      settings.backupFrequencyDays > 365
    )) {
      result.warnings.push({
        type: 'data_quality',
        message: `Invalid backup frequency: ${settings.backupFrequencyDays} days`,
        suggestion: 'Backup frequency should be between 1 and 365 days'
      });
    }

    // Check export format
    if (settings.exportFormat && !['json', 'csv', 'backup'].includes(settings.exportFormat)) {
      result.warnings.push({
        type: 'data_quality',
        message: `Invalid export format: ${settings.exportFormat}`,
        suggestion: 'Export format should be "json", "csv", or "backup"'
      });
    }
  }

  /**
   * Validate metadata consistency
   */
  static async validateMetadata(
    metadata: CacheMetadata | null,
    actualMealCount: number,
    result: ValidationResult
  ): Promise<void> {
    if (!metadata) {
      result.warnings.push({
        type: 'data_quality',
        message: 'No backup metadata found',
        suggestion: 'Metadata will be initialized on next backup'
      });
      return;
    }

    // Check meal count consistency
    if (metadata.mealCount !== undefined && metadata.mealCount !== actualMealCount) {
      result.warnings.push({
        type: 'data_quality',
        message: `Meal count mismatch: metadata shows ${metadata.mealCount}, actual count is ${actualMealCount}`,
        suggestion: 'Metadata will be updated on next backup'
      });
    }

    // Check timestamps
    if (metadata.lastBackupTimestamp && metadata.lastBackupTimestamp > Date.now()) {
      result.warnings.push({
        type: 'data_quality',
        message: 'Last backup timestamp is in the future',
        suggestion: 'Check system clock settings'
      });
    }
  }

  /**
   * Calculate overall data integrity score
   */
  static calculateIntegrityScore(result: ValidationResult): number {
    let score = 100;

    // Deduct points for errors
    result.errors.forEach(error => {
      switch (error.type) {
        case 'critical':
          score -= 20;
          break;
        case 'error':
          score -= 10;
          break;
        case 'warning':
          score -= 5;
          break;
      }
    });

    // Deduct points for warnings
    result.warnings.forEach(warning => {
      switch (warning.type) {
        case 'data_quality':
          score -= 3;
          break;
        case 'performance':
          score -= 1;
          break;
        case 'compatibility':
          score -= 2;
          break;
      }
    });

    return Math.max(0, Math.min(100, score));
  }
}