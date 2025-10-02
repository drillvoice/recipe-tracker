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