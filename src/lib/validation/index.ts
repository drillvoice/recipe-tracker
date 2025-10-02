import {
  getAllMeals,
  getSettings,
  getCacheMetadata
} from '../offline-storage';

import { ValidatorUtils } from './validator-utils';
import { IntegrityChecker } from './integrity-checker';

// Re-export types for backwards compatibility
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationStats,
  IntegrityCheckResult,
  IntegrityIssue
} from './types';

export { ValidatorUtils } from './validator-utils';
export { IntegrityChecker } from './integrity-checker';

export class DataValidator {
  /**
   * Validate all data in the system
   */
  static async validateAllData(): Promise<import('./types').ValidationResult> {
    const result: import('./types').ValidationResult = {
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
      await ValidatorUtils.validateMeals(meals, result);

      // Validate settings
      await ValidatorUtils.validateSettings(settings, result);

      // Validate metadata
      await ValidatorUtils.validateMetadata(metadata, meals.length, result);

      // Calculate integrity score
      result.stats.dataIntegrityScore = ValidatorUtils.calculateIntegrityScore(result);

      // Determine overall validity
      result.valid = result.errors.filter(e => e.type === 'critical' || e.type === 'error').length === 0;

      // Add summary warnings
      if (result.stats.duplicateIds > 0) {
        result.warnings.push({
          type: 'data_quality',
          message: `Found ${result.stats.duplicateIds} duplicate meal IDs`,
          count: result.stats.duplicateIds,
          suggestion: 'Run data cleanup to resolve duplicates'
        });
      }

      if (result.stats.invalidDates > 0) {
        result.warnings.push({
          type: 'data_quality',
          message: `Found ${result.stats.invalidDates} invalid dates`,
          count: result.stats.invalidDates,
          suggestion: 'Review and fix invalid date entries'
        });
      }

      if (result.stats.orphanedMeals > 0) {
        result.warnings.push({
          type: 'data_quality',
          message: `Found ${result.stats.orphanedMeals} orphaned meals`,
          count: result.stats.orphanedMeals,
          suggestion: 'Review meal ownership and sync status'
        });
      }

    } catch (_error) {
      result.errors.push({
        type: 'critical',
        field: 'system',
        message: `Validation failed: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
        suggestion: 'Check system integrity and try again'
      });
      result.valid = false;
      result.stats.dataIntegrityScore = 0;
    }

    return result;
  }

  /**
   * Perform comprehensive integrity check
   */
  static async performIntegrityCheck(): Promise<import('./types').IntegrityCheckResult> {
    return IntegrityChecker.performIntegrityCheck();
  }

  /**
   * Quick health check for system status
   */
  static async quickHealthCheck(): Promise<{
    healthy: boolean;
    score: number;
    criticalIssues: number;
    lastChecked: number;
  }> {
    try {
      const validation = await this.validateAllData();
      const criticalIssues = validation.errors.filter(e => e.type === 'critical').length;

      return {
        healthy: validation.valid && criticalIssues === 0,
        score: validation.stats.dataIntegrityScore,
        criticalIssues,
        lastChecked: Date.now()
      };
    } catch (_error) {
      return {
        healthy: false,
        score: 0,
        criticalIssues: 1,
        lastChecked: Date.now()
      };
    }
  }

  /**
   * Get validation summary for display
   */
  static async getValidationSummary(): Promise<{
    totalItems: number;
    issuesFound: number;
    score: number;
    recommendations: string[];
  }> {
    const validation = await this.validateAllData();
    const recommendations: string[] = [];

    if (validation.stats.duplicateIds > 0) {
      recommendations.push('Remove duplicate entries');
    }

    if (validation.stats.invalidDates > 0) {
      recommendations.push('Fix invalid dates');
    }

    if (validation.stats.orphanedMeals > 0) {
      recommendations.push('Review orphaned meals');
    }

    if (validation.stats.dataIntegrityScore < 80) {
      recommendations.push('Run full integrity check');
    }

    return {
      totalItems: validation.stats.totalMeals,
      issuesFound: validation.errors.length + validation.warnings.length,
      score: validation.stats.dataIntegrityScore,
      recommendations
    };
  }
}