// Common reusable hooks for consistent patterns across the application

// High Priority Hooks
export { useLoading } from './useLoading';
export { useToggle } from './useToggle';
export { useFormState } from './useFormState';
export { useAsyncOperation } from './useAsyncOperation';

// Medium Priority Hooks
export { useAutocomplete } from './useAutocomplete';
export { useMessages, type Message, type MessageType } from './useMessages';
export { useEditMode } from './useEditMode';

// Type exports for convenience
export type { UseLoadingReturn } from './useLoading';
export type { UseToggleReturn } from './useToggle';
export type { UseFormStateReturn } from './useFormState';
export type { UseAsyncOperationReturn } from './useAsyncOperation';
export type { UseAutocompleteReturn } from './useAutocomplete';
export type { UseMessagesReturn } from './useMessages';
export type { UseEditModeReturn } from './useEditMode';