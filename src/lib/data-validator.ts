import { Timestamp } from 'firebase/firestore';
import {
  getAllMeals,
  getSettings,
  getCacheMetadata,
  type Meal,
  type AppSettings,
  type CacheMetadata
} from './offline-storage';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

export interface ValidationError {
  type: 'critical' | 'error' | 'warning';
  field: string;
  message: string;
  item?: unknown;
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'performance' | 'data_quality' | 'compatibility';
  message: string;
  count?: number;
  suggestion?: string;
}

export interface ValidationStats {
  totalMeals: number;
  duplicateIds: number;
  invalidDates: number;
  emptyMealNames: number;
  orphanedMeals: number;
  dataIntegrityScore: number; // 0-100
}

export interface IntegrityCheckResult {
  passed: boolean;
  checksPerformed: number;
  checksPassed: number;
  issues: IntegrityIssue[];
  recommendations: string[];
}

export interface IntegrityIssue {
  severity: 'critical' | 'major' | 'minor';
  category: 'data_consistency' | 'data_quality' | 'performance';
  description: string;
  affectedItems: number;
  fixable: boolean;
}

export class DataValidator {

  /**
   * Validate all data in the system
   */
  static async validateAllData(): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      stats: {
        totalMeals: 0,
        duplicateIds: 0,
        invalidDates: 0,
        emptyMealNames: 0,
        orphanedMeals: 0,
        dataIntegrityScore: 100
      }
    };

    try {
      // Get all data
      const [meals, settings, metadata] = await Promise.all([
        getAllMeals(),
        getSettings(),
        getCacheMetadata('backup_status')
      ]);

      result.stats.totalMeals = meals.length;

      // Validate meals
      await this.validateMeals(meals, result);

      // Validate settings
      await this.validateSettings(settings, result);

      // Validate metadata consistency
      await this.validateMetadata(metadata, meals.length, result);

      // Calculate overall integrity score
      result.stats.dataIntegrityScore = this.calculateIntegrityScore(result);
      result.valid = result.errors.filter(e => e.type === 'critical').length === 0;

    } catch (error) {
      result.errors.push({
        type: 'critical',
        field: 'system',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      result.valid = false;
    }

    return result;
  }

  /**
   * Validate meals data
   */
  private static async validateMeals(meals: Meal[], result: ValidationResult): Promise<void> {
    const seenIds = new Set<string>();
    const seenMealNames = new Map<string, number>();

    for (let i = 0; i < meals.length; i++) {
      const meal = meals[i];

      // Check for required fields
      if (!meal.id) {
        result.errors.push({
          type: 'critical',
          field: `meals[${i}].id`,
          message: 'Meal missing required ID',
          item: meal,
          suggestion: 'Generate a unique ID for this meal'
        });
      } else if (seenIds.has(meal.id)) {
        result.errors.push({
          type: 'critical',
          field: `meals[${i}].id`,
          message: `Duplicate meal ID: ${meal.id}`,
          item: meal,
          suggestion: 'Generate a new unique ID'
        });
        result.stats.duplicateIds++;
      } else {
        seenIds.add(meal.id);
      }

      // Check meal name
      if (!meal.mealName || meal.mealName.trim() === '') {
        result.errors.push({
          type: 'error',
          field: `meals[${i}].mealName`,
          message: 'Meal has empty or missing name',
          item: meal,
          suggestion: 'Provide a descriptive meal name'
        });
        result.stats.emptyMealNames++;
      } else {
        // Track meal name frequency for duplicate detection
        const count = seenMealNames.get(meal.mealName) || 0;
        seenMealNames.set(meal.mealName, count + 1);

        // Check for very long meal names
        if (meal.mealName.length > 100) {
          result.warnings.push({
            type: 'data_quality',
            message: `Very long meal name (${meal.mealName.length} chars): "${meal.mealName.substring(0, 50)}..."`,
            suggestion: 'Consider shortening meal names for better usability'
          });
        }

        // Check for suspicious characters
        if (/[<>{}[\]\\]/.test(meal.mealName)) {
          result.warnings.push({
            type: 'data_quality',
            message: `Meal name contains unusual characters: "${meal.mealName}"`,
            suggestion: 'Consider removing special characters from meal names'
          });
        }
      }

      // Check date
      if (!meal.date) {
        result.errors.push({
          type: 'critical',
          field: `meals[${i}].date`,
          message: 'Meal missing required date',
          item: meal,
          suggestion: 'Provide a valid date for this meal'
        });
        result.stats.invalidDates++;
      } else if (meal.date instanceof Timestamp) {
        const dateMs = meal.date.toMillis();
        const now = Date.now();

        // Check for future dates
        if (dateMs > now + 24 * 60 * 60 * 1000) { // More than 1 day in future
          result.warnings.push({
            type: 'data_quality',
            message: `Meal date is in the future: ${new Date(dateMs).toLocaleDateString()}`,
            suggestion: 'Verify the date is correct'
          });
        }

        // Check for very old dates (before 1900)
        if (dateMs < new Date('1900-01-01').getTime()) {
          result.warnings.push({
            type: 'data_quality',
            message: `Meal date is very old: ${new Date(dateMs).toLocaleDateString()}`,
            suggestion: 'Verify the date is correct'
          });
        }
      } else {
        result.errors.push({
          type: 'error',
          field: `meals[${i}].date`,
          message: 'Invalid date format',
          item: meal,
          suggestion: 'Ensure date is a valid Timestamp object'
        });
        result.stats.invalidDates++;
      }

      // Check UID consistency
      if (meal.uid && typeof meal.uid !== 'string') {
        result.errors.push({
          type: 'error',
          field: `meals[${i}].uid`,
          message: 'Invalid UID format',
          item: meal,
          suggestion: 'UID should be a string'
        });
      }

      // Check boolean fields
      if (meal.pending !== undefined && typeof meal.pending !== 'boolean') {
        result.warnings.push({
          type: 'data_quality',
          message: `Non-boolean 'pending' value: ${meal.pending}`,
          suggestion: 'Convert to boolean value'
        });
      }

      if (meal.hidden !== undefined && typeof meal.hidden !== 'boolean') {
        result.warnings.push({
          type: 'data_quality',
          message: `Non-boolean 'hidden' value: ${meal.hidden}`,
          suggestion: 'Convert to boolean value'
        });
      }
    }

    // Check for excessive duplicates
    seenMealNames.forEach((count, mealName) => {
      if (count > 20) {
        result.warnings.push({
          type: 'data_quality',
          message: `Meal "${mealName}" appears ${count} times`,
          count,
          suggestion: 'Consider if this is expected or if entries should be consolidated'
        });
      }
    });

    // Performance warnings
    if (meals.length > 5000) {
      result.warnings.push({
        type: 'performance',
        message: `Large dataset detected: ${meals.length} meals`,
        suggestion: 'Consider archiving old data to improve performance'
      });
    }
  }

  /**
   * Validate settings data
   */
  private static async validateSettings(
    settings: AppSettings | null | undefined,
    result: ValidationResult
  ): Promise<void> {
    if (!settings) {
      result.warnings.push({
        type: 'data_quality',
        message: 'No settings found - using defaults',
        suggestion: 'Settings will be initialized with default values'
      });
      return;
    }

    // Check theme
    if (settings.theme && !['light', 'dark'].includes(settings.theme)) {
      result.warnings.push({
        type: 'data_quality',
        message: `Invalid theme value: ${settings.theme}`,
        suggestion: 'Theme should be "light" or "dark"'
      });
    }

    // Check backup frequency
    if (settings.backupFrequencyDays && (
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
  private static async validateMetadata(
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
  private static calculateIntegrityScore(result: ValidationResult): number {
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

  /**
   * Perform comprehensive integrity check
   */
  static async performIntegrityCheck(): Promise<IntegrityCheckResult> {
    const result: IntegrityCheckResult = {
      passed: true,
      checksPerformed: 0,
      checksPassed: 0,
      issues: [],
      recommendations: []
    };

    try {
      const checks = [
        () => this.checkDatabaseSchema(),
        () => this.checkDataConsistency(),
        () => this.checkPerformanceMetrics(),
        () => this.checkBackupStatus(),
        () => this.checkStorageQuota()
      ];

      for (const check of checks) {
        result.checksPerformed++;
        try {
          const checkResult = await check();
          if (checkResult.passed) {
            result.checksPassed++;
          } else {
            result.issues.push(...checkResult.issues);
          }
        } catch (error) {
          result.issues.push({
            severity: 'critical',
            category: 'data_consistency',
            description: `Integrity check failed: ${error}`,
            affectedItems: 0,
            fixable: false
          });
        }
      }

      result.passed = result.issues.filter(i => i.severity === 'critical').length === 0;

      // Generate recommendations
      if (result.issues.length > 0) {
        result.recommendations = this.generateRecommendations(result.issues);
      }

    } catch (error) {
      result.issues.push({
        severity: 'critical',
        category: 'data_consistency',
        description: `Integrity check system failure: ${error}`,
        affectedItems: 0,
        fixable: false
      });
      result.passed = false;
    }

    return result;
  }

  /**
   * Check database schema integrity
   */
  private static async checkDatabaseSchema(): Promise<{ passed: boolean; issues: IntegrityIssue[] }> {
    const issues: IntegrityIssue[] = [];

    try {
      // This would check if IndexedDB schema matches expectations
      // For now, just verify basic functionality
      await getAllMeals();
      await getSettings();
      return { passed: true, issues };
    } catch {
      issues.push({
        severity: 'critical',
        category: 'data_consistency',
        description: 'Database schema validation failed',
        affectedItems: 0,
        fixable: false
      });
      return { passed: false, issues };
    }
  }

  /**
   * Check data consistency
   */
  private static async checkDataConsistency(): Promise<{ passed: boolean; issues: IntegrityIssue[] }> {
    const issues: IntegrityIssue[] = [];

    const validation = await this.validateAllData();
    const criticalErrors = validation.errors.filter(e => e.type === 'critical').length;

    if (criticalErrors > 0) {
      issues.push({
        severity: 'critical',
        category: 'data_consistency',
        description: `${criticalErrors} critical data consistency errors found`,
        affectedItems: criticalErrors,
        fixable: true
      });
    }

    const dataQualityWarnings = validation.warnings.filter(w => w.type === 'data_quality').length;
    if (dataQualityWarnings > 10) {
      issues.push({
        severity: 'major',
        category: 'data_quality',
        description: `${dataQualityWarnings} data quality issues detected`,
        affectedItems: dataQualityWarnings,
        fixable: true
      });
    }

    return { passed: criticalErrors === 0, issues };
  }

  /**
   * Check performance metrics
   */
  private static async checkPerformanceMetrics(): Promise<{ passed: boolean; issues: IntegrityIssue[] }> {
    const issues: IntegrityIssue[] = [];

    try {
      const meals = await getAllMeals();

      // Check for performance issues
      if (meals.length > 10000) {
        issues.push({
          severity: 'major',
          category: 'performance',
          description: 'Large dataset may impact performance',
          affectedItems: meals.length,
          fixable: true
        });
      }

      // Check for storage efficiency
      const duplicateNames = new Map<string, number>();
      meals.forEach(meal => {
        const count = duplicateNames.get(meal.mealName) || 0;
        duplicateNames.set(meal.mealName, count + 1);
      });

      let duplicateCount = 0;
      duplicateNames.forEach(count => {
        if (count > 1) duplicateCount++;
      });
      if (duplicateCount > meals.length * 0.3) {
        issues.push({
          severity: 'minor',
          category: 'performance',
          description: 'High number of duplicate meal names detected',
          affectedItems: duplicateCount,
          fixable: true
        });
      }

    } catch {
      issues.push({
        severity: 'major',
        category: 'performance',
        description: 'Performance check failed',
        affectedItems: 0,
        fixable: false
      });
    }

    return { passed: issues.filter(i => i.severity === 'critical').length === 0, issues };
  }

  /**
   * Check backup status
   */
  private static async checkBackupStatus(): Promise<{ passed: boolean; issues: IntegrityIssue[] }> {
    const issues: IntegrityIssue[] = [];

    try {
      const metadata = await getCacheMetadata('backup_status');

      if (!metadata?.lastBackupTimestamp || metadata.lastBackupTimestamp === 0) {
        issues.push({
          severity: 'major',
          category: 'data_consistency',
          description: 'No backup found - data is not protected',
          affectedItems: 1,
          fixable: true
        });
      } else {
        const daysSinceBackup = (Date.now() - metadata.lastBackupTimestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceBackup > 30) {
          issues.push({
            severity: 'major',
            category: 'data_consistency',
            description: `Backup is ${Math.floor(daysSinceBackup)} days old`,
            affectedItems: 1,
            fixable: true
          });
        }
      }

    } catch {
      issues.push({
        severity: 'minor',
        category: 'data_consistency',
        description: 'Unable to check backup status',
        affectedItems: 0,
        fixable: false
      });
    }

    return { passed: issues.filter(i => i.severity === 'critical').length === 0, issues };
  }

  /**
   * Check storage quota
   */
  private static async checkStorageQuota(): Promise<{ passed: boolean; issues: IntegrityIssue[] }> {
    const issues: IntegrityIssue[] = [];

    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;

        if (quota > 0) {
          const usagePercent = (used / quota) * 100;

          if (usagePercent > 90) {
            issues.push({
              severity: 'critical',
              category: 'performance',
              description: `Storage quota nearly full: ${usagePercent.toFixed(1)}% used`,
              affectedItems: 1,
              fixable: true
            });
          } else if (usagePercent > 75) {
            issues.push({
              severity: 'major',
              category: 'performance',
              description: `High storage usage: ${usagePercent.toFixed(1)}% used`,
              affectedItems: 1,
              fixable: true
            });
          }
        }
      }
    } catch {
      // Storage estimate not available - not critical
    }

    return { passed: issues.filter(i => i.severity === 'critical').length === 0, issues };
  }

  /**
   * Generate recommendations based on issues
   */
  private static generateRecommendations(issues: IntegrityIssue[]): string[] {
    const recommendations: string[] = [];

    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const majorIssues = issues.filter(i => i.severity === 'major').length;

    if (criticalIssues > 0) {
      recommendations.push('🚨 Critical issues found - immediate action required');
      recommendations.push('• Export data as backup before making changes');
      recommendations.push('• Fix critical data consistency errors');
    }

    if (majorIssues > 0) {
      recommendations.push('⚠️ Major issues detected - action recommended');
    }

    const backupIssues = issues.filter(i => i.category === 'data_consistency' &&
      (i.description.includes('backup') || i.description.includes('Backup')));

    if (backupIssues.length > 0) {
      recommendations.push('• Create a new backup to protect your data');
    }

    const performanceIssues = issues.filter(i => i.category === 'performance');
    if (performanceIssues.length > 0) {
      recommendations.push('• Consider archiving old data to improve performance');
      recommendations.push('• Review and consolidate duplicate entries');
    }

    const dataQualityIssues = issues.filter(i => i.category === 'data_quality');
    if (dataQualityIssues.length > 0) {
      recommendations.push('• Clean up data quality issues for better reliability');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All checks passed - your data is in good condition');
    }

    return recommendations;
  }
}