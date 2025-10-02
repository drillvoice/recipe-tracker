import { useState, useCallback } from 'react';

type ValidationResult<T> = {
  isValid: boolean;
  errors: Partial<Record<keyof T, string>>;
};

export interface UseFormStateReturn<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  isValid: boolean;
  updateValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (newValues: T) => void;
  resetForm: () => void;
  validateForm: () => boolean;
  setErrors: (errors: Partial<Record<keyof T, string>>) => void;
  clearErrors: () => void;
}

/**
 * Hook for managing form state with validation
 *
 * @param initialValues - Initial form values
 * @param validator - Optional validation function
 * @returns Object with form state and control functions
 *
 * @example
 * ```typescript
 * const { values, errors, updateValue, validateForm, resetForm } = useFormState(
 *   { name: '', email: '' },
 *   (values) => ({
 *     isValid: !!values.name && !!values.email,
 *     errors: {
 *       name: !values.name ? 'Name is required' : undefined,
 *       email: !values.email ? 'Email is required' : undefined,
 *     }
 *   })
 * );
 * ```
 */
export function useFormState<T extends Record<string, unknown>>(
  initialValues: T,
  validator?: (values: T) => ValidationResult<T>
): UseFormStateReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const updateValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));

    // Clear error for this field when value changes
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const validateForm = useCallback((): boolean => {
    if (!validator) return true;

    const result = validator(values);
    setErrors(result.errors);
    return result.isValid;
  }, [values, validator]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const isValid = validator ? validator(values).isValid : true;

  return {
    values,
    errors,
    isValid,
    updateValue,
    setValues,
    resetForm,
    validateForm,
    setErrors,
    clearErrors
  };
}