import { useState, useCallback } from 'react';

interface UseAsyncOperationOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  initialData?: T;
}

export interface UseAsyncOperationReturn<T, Args extends any[]> {
  execute: (...args: Args) => Promise<T | void>;
  isLoading: boolean;
  error: Error | null;
  data: T | null;
  reset: () => void;
}

/**
 * Hook for managing async operations with loading and error states
 *
 * @param asyncFn - The async function to execute
 * @param options - Configuration options
 * @returns Object with execute function and operation state
 *
 * @example
 * ```typescript
 * const { execute, isLoading, error, data } = useAsyncOperation(
 *   async (id: string) => api.fetchUser(id),
 *   {
 *     onSuccess: (user) => console.log('User loaded:', user),
 *     onError: (error) => console.error('Failed to load user:', error)
 *   }
 * );
 *
 * const handleLoadUser = () => execute('user123');
 * ```
 */
export function useAsyncOperation<T, Args extends any[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
  options: UseAsyncOperationOptions<T> = {}
): UseAsyncOperationReturn<T, Args> {
  const { onSuccess, onError, initialData = null } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(initialData);

  const execute = useCallback(async (...args: Args): Promise<T | void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await asyncFn(...args);
      setData(result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [asyncFn, onSuccess, onError]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(initialData);
  }, [initialData]);

  return {
    execute,
    isLoading,
    error,
    data,
    reset
  };
}