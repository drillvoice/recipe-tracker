// Types for import functionality
import { type Meal, type AppSettings, type CacheMetadata } from '../offline-storage';
import { type SerializableMeal, type BackupMetadata } from '../export-manager';
import { type TagManagementData } from '../tag-manager';

export type ConflictResolutionStrategy = 'skip' | 'overwrite' | 'merge' | 'ask';

export interface ImportOptions {
  conflictResolution: ConflictResolutionStrategy;
  validateChecksums?: boolean;
  createBackup?: boolean;
  dryRun?: boolean;
}

export type ConflictItem =
  | {
      type: 'meal';
      action: 'update';
      existing: Meal;
      incoming: SerializableMeal;
      fieldConflicts?: string[];
    }
  | {
      type: 'meal';
      action: 'create';
      incoming: SerializableMeal;
      fieldConflicts?: string[];
    };

export interface ImportResult {
  success: boolean;
  summary: {
    mealsProcessed: number;
    mealsImported: number;
    mealsSkipped: number;
    mealsUpdated: number;
    settingsImported: boolean;
    tagManagementImported: boolean;
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
  metadata?: BackupMetadata | Record<string, unknown>;
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

export type ImportFormat = 'backup' | 'json' | 'csv' | 'unknown';

export interface ParsedImportPayload {
  meals: SerializableMeal[];
  settings?: Partial<AppSettings>;
  cache_meta?: CacheMetadata | CacheMetadata[] | null;
  tagManagement?: TagManagementData;
}

export interface ParsedImportResult {
  success: boolean;
  format: ImportFormat;
  data: ParsedImportPayload;
  metadata?: BackupMetadata | Record<string, unknown>;
  errors: string[];
}

export type MealUpdateConflict = Extract<ConflictItem, { action: 'update' }>;