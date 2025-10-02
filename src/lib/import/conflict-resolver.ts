import { Timestamp } from 'firebase/firestore';
import { type Meal, saveMeal } from '../offline-storage';
import { type SerializableMeal } from '../export-manager';
import { type ConflictResolutionStrategy, type MealUpdateConflict, type ConflictItem } from './types';

export class ConflictResolver {
  /**
   * Detect conflicts between existing and incoming meal data
   */
  static detectMealConflicts(existing: Meal, incoming: SerializableMeal): string[] {
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
  static async resolveMealConflict(
    conflict: MealUpdateConflict,
    strategy: ConflictResolutionStrategy
  ): Promise<'skip' | 'overwrite' | 'merge'> {
    switch (strategy) {
      case 'skip':
        return 'skip';
      case 'overwrite':
        return 'overwrite';
      case 'merge': {
        // For meals, merge means take newer timestamp
        const existingTime = conflict.existing.date.toMillis();
        const incomingTime =
          conflict.incoming.date.seconds * 1000 +
          conflict.incoming.date.nanoseconds / 1_000_000;
        return incomingTime > existingTime ? 'overwrite' : 'skip';
      }
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
  static async saveMealFromImport(mealData: SerializableMeal): Promise<void> {
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
  static async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as text'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}