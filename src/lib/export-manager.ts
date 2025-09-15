import { Timestamp } from 'firebase/firestore';
import { getAllMeals, getSettings, getCacheMetadata, type Meal, type AppSettings } from './offline-storage';

export type ExportFormat = 'json' | 'csv' | 'backup';

export interface ExportOptions {
  format: ExportFormat;
  includeMeals?: boolean;
  includeSettings?: boolean;
  includeMetadata?: boolean;
  compress?: boolean;
  addChecksum?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ExportResult {
  success: boolean;
  filename: string;
  size: number;
  checksum?: string;
  itemCount: number;
  errors: string[];
}

export interface BackupMetadata {
  version: string;
  exportDate: string;
  source: string;
  appVersion: string;
  format: string;
  checksum?: string;
  itemCounts: {
    meals: number;
    settings: number;
  };
}

export interface BackupData {
  metadata: BackupMetadata;
  meals: SerializableMeal[];
  settings?: AppSettings;
  cache_meta?: any[];
}

export interface SerializableMeal {
  id: string;
  mealName: string;
  date: {
    seconds: number;
    nanoseconds: number;
  };
  uid?: string;
  pending?: boolean;
  hidden?: boolean;
}

export class ExportManager {
  private static readonly VERSION = '1.0.0';
  private static readonly SOURCE = 'recipe-tracker-enhanced';

  /**
   * Export data in the specified format
   */
  static async exportData(options: ExportOptions): Promise<ExportResult> {
    const result: ExportResult = {
      success: false,
      filename: '',
      size: 0,
      itemCount: 0,
      errors: []
    };

    try {
      // Gather data based on options
      const data = await this.gatherExportData(options);

      if (data.meals.length === 0 && (!options.includeSettings || !data.settings)) {
        result.errors.push('No data available to export');
        return result;
      }

      // Generate export content based on format
      let content: string;
      let filename: string;

      switch (options.format) {
        case 'json':
          { const jsonResult = this.generateJSONExport(data, options);
          content = jsonResult.content;
          filename = jsonResult.filename; }
          break;
        case 'csv':
          { const csvResult = this.generateCSVExport(data, options);
          content = csvResult.content;
          filename = csvResult.filename; }
          break;
        case 'backup':
          { const backupResult = this.generateBackupExport(data, options);
          content = backupResult.content;
          filename = backupResult.filename; }
          break;
        default:
          result.errors.push(`Unsupported export format: ${options.format}`);
          return result;
      }

      // Add checksum if requested
      if (options.addChecksum && options.format === 'backup') {
        const checksum = await this.generateChecksum(content);
        result.checksum = checksum;

        // Update the content with checksum in metadata
        const parsedContent = JSON.parse(content);
        parsedContent.metadata.checksum = checksum;
        content = JSON.stringify(parsedContent, null, 0);
      }

      // Trigger download
      result.filename = await this.downloadFile(content, filename);
      result.size = new Blob([content]).size;
      result.itemCount = data.meals.length;
      result.success = true;

    } catch (error) {
      result.errors.push(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Gather data for export based on options
   */
  private static async gatherExportData(options: ExportOptions): Promise<{
    meals: SerializableMeal[];
    settings?: AppSettings;
    metadata?: any;
  }> {
    const data: { meals: SerializableMeal[]; settings?: AppSettings; metadata?: any } = {
      meals: []
    };

    // Get meals if requested
    if (options.includeMeals !== false) {
      let meals = await getAllMeals();

      // Apply date range filter if specified
      if (options.dateRange) {
        const startTime = options.dateRange.start.getTime();
        const endTime = options.dateRange.end.getTime();

        meals = meals.filter(meal => {
          const mealTime = meal.date.toMillis();
          return mealTime >= startTime && mealTime <= endTime;
        });
      }

      // Convert to serializable format
      data.meals = meals.map(meal => ({
        id: meal.id,
        mealName: meal.mealName,
        date: {
          seconds: meal.date.seconds,
          nanoseconds: meal.date.nanoseconds
        },
        uid: meal.uid,
        pending: meal.pending,
        hidden: meal.hidden
      }));
    }

    // Get settings if requested
    if (options.includeSettings) {
      data.settings = await getSettings();
    }

    // Get metadata if requested
    if (options.includeMetadata) {
      data.metadata = await getCacheMetadata('backup_status');
    }

    return data;
  }

  /**
   * Generate JSON export
   */
  private static generateJSONExport(data: any, options: ExportOptions): { content: string; filename: string } {
    const exportData = {
      metadata: {
        version: this.VERSION,
        exportDate: new Date().toISOString(),
        source: this.SOURCE,
        format: 'json',
        itemCounts: {
          meals: data.meals.length,
          settings: data.settings ? 1 : 0
        }
      },
      ...data
    };

    const content = JSON.stringify(exportData, null, 2);
    const filename = `recipe-tracker-export-${this.getDateString()}.json`;

    return { content, filename };
  }

  /**
   * Generate CSV export (meals only)
   */
  private static generateCSVExport(data: any, options: ExportOptions): { content: string; filename: string } {
    if (data.meals.length === 0) {
      return { content: '', filename: '' };
    }

    // CSV Headers
    const headers = ['Date', 'Meal Name', 'Hidden', 'Pending', 'User ID'];
    const rows = [headers.join(',')];

    // Convert meals to CSV rows
    data.meals.forEach((meal: SerializableMeal) => {
      const date = new Date(meal.date.seconds * 1000).toLocaleDateString();
      const row = [
        `"${date}"`,
        `"${meal.mealName.replace(/"/g, '""')}"`, // Escape quotes
        meal.hidden ? 'Yes' : 'No',
        meal.pending ? 'Yes' : 'No',
        `"${meal.uid || ''}"`
      ];
      rows.push(row.join(','));
    });

    const content = rows.join('\n');
    const filename = `recipe-tracker-meals-${this.getDateString()}.csv`;

    return { content, filename };
  }

  /**
   * Generate backup export with compression and checksum
   */
  private static generateBackupExport(data: any, options: ExportOptions): { content: string; filename: string } {
    const backupData: BackupData = {
      metadata: {
        version: this.VERSION,
        exportDate: new Date().toISOString(),
        source: this.SOURCE,
        appVersion: '0.2.0', // TODO: Get from package.json
        format: 'backup',
        itemCounts: {
          meals: data.meals.length,
          settings: data.settings ? 1 : 0
        }
      },
      meals: data.meals
    };

    if (data.settings) {
      backupData.settings = data.settings;
    }

    if (data.metadata) {
      backupData.cache_meta = [data.metadata];
    }

    const content = JSON.stringify(backupData, null, 0); // Compact JSON for backup
    const filename = `recipe-tracker-backup-${this.getDateString()}.backup`;

    return { content, filename };
  }

  /**
   * Generate checksum for content validation
   */
  private static async generateChecksum(content: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (error) {
        // Fall back to simple checksum if crypto.subtle fails
      }
    }

    // Fallback simple checksum for environments without crypto.subtle or in tests
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Download file to user's device
   */
  private static async downloadFile(content: string, filename: string): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('File download only available in browser environment');
    }

    try {
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      setTimeout(() => URL.revokeObjectURL(url), 100);

      return filename;
    } catch (error) {
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get formatted date string for filenames
   */
  private static getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Validate export data before processing
   */
  static validateExportData(meals: Meal[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    meals.forEach((meal, index) => {
      if (!meal.id) {
        errors.push(`Meal at index ${index} missing ID`);
      }
      if (!meal.mealName || meal.mealName.trim() === '') {
        errors.push(`Meal at index ${index} missing or empty meal name`);
      }
      if (!meal.date) {
        errors.push(`Meal at index ${index} missing date`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get export statistics for UI display
   */
  static async getExportStats(options?: { dateRange?: { start: Date; end: Date } }): Promise<{
    totalMeals: number;
    dateRange?: string;
    estimatedSize: string;
  }> {
    let meals = await getAllMeals();

    if (options?.dateRange) {
      const startTime = options.dateRange.start.getTime();
      const endTime = options.dateRange.end.getTime();

      meals = meals.filter(meal => {
        const mealTime = meal.date.toMillis();
        return mealTime >= startTime && mealTime <= endTime;
      });
    }

    // Estimate size based on average meal data
    const avgMealSize = 150; // Approximate bytes per meal in JSON
    const estimatedBytes = meals.length * avgMealSize;
    const estimatedSize = this.formatBytes(estimatedBytes);

    return {
      totalMeals: meals.length,
      dateRange: options?.dateRange
        ? `${options.dateRange.start.toLocaleDateString()} - ${options.dateRange.end.toLocaleDateString()}`
        : undefined,
      estimatedSize
    };
  }

  /**
   * Format bytes to human readable string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}