import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSettings,
  updateSettings,
  getCacheMetadata,
  updateCacheMetadata,
  type AppSettings,
  type CacheMetadata,
} from '@/lib/offline-storage';
import { DataValidator } from '@/lib/data-validator';
import { ImportManager, type ImportOptions, type ImportResult } from '@/lib/import-manager';
import { ExportManager, type ExportOptions, type ExportResult } from '@/lib/export-manager';
import { queryKeys } from './index';

// Settings mutations
export function useSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<AppSettings>) => {
      await updateSettings(settings);
      return settings;
    },
    onSuccess: (updatedSettings) => {
      // Update settings cache
      queryClient.setQueryData(queryKeys.settings, (oldSettings: AppSettings | undefined) => ({
        ...oldSettings,
        ...updatedSettings,
      }));
    },
    onError: (error) => {
      console.error('Failed to update settings:', error);
    },
  });
}

// Cache metadata mutations
export function useCacheMetadataMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, metadata }: { key: string; metadata: Partial<CacheMetadata> }) => {
      await updateCacheMetadata(key, metadata);
      return { key, metadata };
    },
    onSuccess: ({ key, metadata }) => {
      // Update cache metadata
      queryClient.setQueryData(queryKeys.cacheMetadata(key), (oldMetadata: CacheMetadata | undefined) => ({
        ...oldMetadata,
        ...metadata,
      }));
    },
    onError: (error) => {
      console.error('Failed to update cache metadata:', error);
    },
  });
}

// Data validation mutations
export function useDataValidationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: DataValidator.validateAllData,
    onSuccess: (validationResult) => {
      // Cache validation results
      queryClient.setQueryData(queryKeys.validation, validationResult);
    },
    onError: (error) => {
      console.error('Data validation failed:', error);
    },
  });
}

// Integrity check mutations
export function useIntegrityCheckMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: DataValidator.performIntegrityCheck,
    onSuccess: (integrityResult) => {
      // Cache integrity results
      queryClient.setQueryData(queryKeys.integrity, integrityResult);
    },
    onError: (error) => {
      console.error('Integrity check failed:', error);
    },
  });
}

// Data import mutations
export function useDataImportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileContent, options }: { fileContent: string; options: ImportOptions }): Promise<ImportResult> => {
      return ImportManager.importData(fileContent, options);
    },
    onSuccess: (importResult) => {
      if (importResult.success) {
        // Invalidate all data queries to refresh after import
        queryClient.invalidateQueries({ queryKey: queryKeys.meals });
        queryClient.invalidateQueries({ queryKey: queryKeys.ideas });
        queryClient.invalidateQueries({ queryKey: queryKeys.settings });
        queryClient.invalidateQueries({ queryKey: queryKeys.validation });
      }
    },
    onError: (error) => {
      console.error('Data import failed:', error);
    },
  });
}

// Data export mutations
export function useDataExportMutation() {
  return useMutation({
    mutationFn: async (options: ExportOptions): Promise<ExportResult> => {
      return ExportManager.exportData(options);
    },
    onError: (error) => {
      console.error('Data export failed:', error);
    },
  });
}

// Backup operations
export function useBackupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: { format: 'backup'; includeSettings?: boolean; includeMetadata?: boolean }) => {
      return ExportManager.exportData(options);
    },
    onSuccess: (backupResult) => {
      if (backupResult.success) {
        // Update backup metadata
        const now = Date.now();
        queryClient.setQueryData(queryKeys.cacheMetadata('backup_status'), (oldMetadata: CacheMetadata | undefined) => ({
          ...oldMetadata,
          key: 'backup_status',
          lastBackupTimestamp: now,
          lastSyncCheck: now,
        }));
      }
    },
    onError: (error) => {
      console.error('Backup failed:', error);
    },
  });
}

// Batch operations for performance
export function useBatchOperationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (operations: Array<() => Promise<unknown>>) => {
      const results = await Promise.allSettled(operations.map(op => op()));
      return results;
    },
    onSuccess: () => {
      // Invalidate all queries after batch operations
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error('Batch operations failed:', error);
    },
  });
}