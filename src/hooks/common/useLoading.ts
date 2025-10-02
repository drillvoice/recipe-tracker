import { useState, useCallback } from 'react';

export interface UseLoadingReturn {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  withLoading: <T>(asyncFn: () => Promise<T>) => Promise<T>;
}

/**
 * Hook for managing loading state with consistent patterns
 *
 * @param initialState - Initial loading state (default: false)
 * @returns Object with loading state and control functions
 *
 * @example
 * ```typescript
 * const { isLoading, startLoading, stopLoading, withLoading } = useLoading();
 *
 * // Manual control
 * const handleSubmit = async () => {
 *   startLoading();
 *   try {
 *     await api.submit(data);
 *   } finally {
 *     stopLoading();
 *   }
 * };
 *
 * // Automatic control
 * const handleSubmit = () => withLoading(() => api.submit(data));
 * ```
 */
export function useLoading(initialState = false): UseLoadingReturn {
  const [isLoading, setIsLoading] = useState(initialState);

  const startLoading = useCallback(() => {
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  const withLoading = useCallback(async <T>(asyncFn: () => Promise<T>): Promise<T> => {
    startLoading();
    try {
      const result = await asyncFn();
      return result;
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  return {
    isLoading,
    startLoading,
    stopLoading,
    withLoading
  };
}