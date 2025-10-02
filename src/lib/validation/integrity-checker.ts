import { getAllMeals, getSettings, getCacheMetadata } from '../offline-storage';
import { type IntegrityCheckResult, type IntegrityIssue } from './types';

export class IntegrityChecker {
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
    }

    return result;
  }

  /**
   * Check database schema integrity
   */
  private static async checkDatabaseSchema(): Promise<{ passed: boolean; issues: IntegrityIssue[] }> {
    const issues: IntegrityIssue[] = [];

    try {
      // Try to access core functions to verify schema
      await getAllMeals();
      await getSettings();
      await getCacheMetadata('backup_status');

      return { passed: true, issues: [] };
    } catch (error) {
      issues.push({
        severity: 'critical',
        category: 'data_consistency',
        description: 'Database schema verification failed',
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

    try {
      const meals = await getAllMeals();
      const mealIds = new Set();
      let duplicates = 0;

      for (const meal of meals) {
        if (mealIds.has(meal.id)) {
          duplicates++;
        } else {
          mealIds.add(meal.id);
        }
      }

      if (duplicates > 0) {
        issues.push({
          severity: 'major',
          category: 'data_consistency',
          description: `Found ${duplicates} duplicate meal IDs`,
          affectedItems: duplicates,
          fixable: true
        });
      }

      return { passed: duplicates === 0, issues };
    } catch (error) {
      issues.push({
        severity: 'critical',
        category: 'data_consistency',
        description: 'Data consistency check failed',
        affectedItems: 0,
        fixable: false
      });
      return { passed: false, issues };
    }
  }

  /**
   * Check performance metrics
   */
  private static async checkPerformanceMetrics(): Promise<{ passed: boolean; issues: IntegrityIssue[] }> {
    const issues: IntegrityIssue[] = [];

    try {
      const meals = await getAllMeals();

      if (meals.length > 5000) {
        issues.push({
          severity: 'minor',
          category: 'performance',
          description: `Large dataset detected: ${meals.length} meals`,
          affectedItems: meals.length,
          fixable: false
        });
      }

      return { passed: meals.length <= 5000, issues };
    } catch (error) {
      issues.push({
        severity: 'major',
        category: 'performance',
        description: 'Performance metrics check failed',
        affectedItems: 0,
        fixable: false
      });
      return { passed: false, issues };
    }
  }

  /**
   * Check backup status
   */
  private static async checkBackupStatus(): Promise<{ passed: boolean; issues: IntegrityIssue[] }> {
    const issues: IntegrityIssue[] = [];

    try {
      const metadata = await getCacheMetadata('backup_status');

      if (!metadata || !metadata.lastBackupTimestamp) {
        issues.push({
          severity: 'minor',
          category: 'data_quality',
          description: 'No recent backup found',
          affectedItems: 0,
          fixable: true
        });
      } else {
        const daysSinceBackup = (Date.now() - metadata.lastBackupTimestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceBackup > 30) {
          issues.push({
            severity: 'minor',
            category: 'data_quality',
            description: `Last backup was ${Math.floor(daysSinceBackup)} days ago`,
            affectedItems: 0,
            fixable: true
          });
        }
      }

      return { passed: issues.length === 0, issues };
    } catch (error) {
      issues.push({
        severity: 'major',
        category: 'data_quality',
        description: 'Backup status check failed',
        affectedItems: 0,
        fixable: false
      });
      return { passed: false, issues };
    }
  }

  /**
   * Check storage quota
   */
  private static async checkStorageQuota(): Promise<{ passed: boolean; issues: IntegrityIssue[] }> {
    const issues: IntegrityIssue[] = [];

    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage) {
          const usagePercent = (estimate.usage / estimate.quota) * 100;

          if (usagePercent > 80) {
            issues.push({
              severity: 'major',
              category: 'performance',
              description: `Storage usage is ${usagePercent.toFixed(1)}% of quota`,
              affectedItems: 0,
              fixable: true
            });
          } else if (usagePercent > 60) {
            issues.push({
              severity: 'minor',
              category: 'performance',
              description: `Storage usage is ${usagePercent.toFixed(1)}% of quota`,
              affectedItems: 0,
              fixable: true
            });
          }
        }
      }

      return { passed: issues.length === 0, issues };
    } catch (error) {
      // Storage API not available, this is not critical
      return { passed: true, issues: [] };
    }
  }

  /**
   * Generate recommendations based on issues
   */
  private static generateRecommendations(issues: IntegrityIssue[]): string[] {
    const recommendations: string[] = [];

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const majorIssues = issues.filter(i => i.severity === 'major');
    const minorIssues = issues.filter(i => i.severity === 'minor');

    if (criticalIssues.length > 0) {
      recommendations.push('❗ Critical issues detected - immediate action required');
      recommendations.push('Consider exporting data as backup before making changes');
    }

    if (majorIssues.length > 0) {
      recommendations.push('⚠️ Major issues found - recommend resolving soon');
    }

    if (minorIssues.length > 0) {
      recommendations.push('ℹ️ Minor issues detected - consider addressing when convenient');
    }

    // Specific recommendations
    const duplicateIssues = issues.filter(i => i.description.includes('duplicate'));
    if (duplicateIssues.length > 0) {
      recommendations.push('Run data cleanup to remove duplicate entries');
    }

    const backupIssues = issues.filter(i => i.description.includes('backup'));
    if (backupIssues.length > 0) {
      recommendations.push('Create a backup to protect your data');
    }

    const storageIssues = issues.filter(i => i.description.includes('Storage usage'));
    if (storageIssues.length > 0) {
      recommendations.push('Consider archiving old data or cleaning up duplicates');
    }

    return recommendations;
  }
}