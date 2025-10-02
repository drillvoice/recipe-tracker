// Legacy import-manager.ts - Re-exports the new modular structure for backwards compatibility
export {
  ImportManager,
  ImportParser,
  ConflictResolver,
  ImportExecutor,
  type ConflictResolutionStrategy,
  type ImportOptions,
  type ConflictItem,
  type ImportResult,
  type ImportPreview,
  type ImportFormat,
  type ParsedImportPayload,
  type ParsedImportResult,
  type MealUpdateConflict
} from './import';