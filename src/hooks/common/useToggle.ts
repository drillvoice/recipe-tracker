import { useState, useCallback } from 'react';

export interface UseToggleReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  set: (value: boolean) => void;
}

/**
 * Hook for managing boolean toggle state (modals, dropdowns, etc.)
 *
 * @param initialState - Initial toggle state (default: false)
 * @returns Object with toggle state and control functions
 *
 * @example
 * ```typescript
 * const { isOpen, open, close, toggle } = useToggle();
 *
 * return (
 *   <>
 *     <button onClick={toggle}>Toggle Modal</button>
 *     {isOpen && <Modal onClose={close}>Content</Modal>}
 *   </>
 * );
 * ```
 */
export function useToggle(initialState = false): UseToggleReturn {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const set = useCallback((value: boolean) => {
    setIsOpen(value);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
    set
  };
}