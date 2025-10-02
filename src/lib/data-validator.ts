// Legacy data-validator.ts - Re-exports the new modular structure for backwards compatibility
export {
  DataValidator,
  ValidatorUtils,
  IntegrityChecker,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationStats,
  type IntegrityCheckResult,
  type IntegrityIssue
} from './validation';