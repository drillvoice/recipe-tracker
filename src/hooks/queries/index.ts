import { QueryClient } from '@tanstack/react-query';

// Create a client with offline-first configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Retry with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for data freshness
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect to avoid excessive requests
      refetchOnReconnect: false,
      // Enable background refetching
      refetchOnMount: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
      // Retry with short delay
      retryDelay: 1000,
    },
  },
});

// Query keys for consistent cache management
export const queryKeys = {
  meals: ['meals'] as const,
  mealById: (id: string) => ['meals', id] as const,
  ideas: ['ideas'] as const,
  settings: ['settings'] as const,
  cacheMetadata: (key: string) => ['cache-metadata', key] as const,
  validation: ['validation'] as const,
  integrity: ['integrity'] as const,
} as const;

// Re-export React Query components and hooks
export { QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';