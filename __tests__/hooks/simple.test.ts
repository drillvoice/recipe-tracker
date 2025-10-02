import { renderHook, act } from '@testing-library/react';
import { useLoading, useToggle } from '@/hooks/common';

describe('Simple Hook Tests', () => {
  describe('useLoading', () => {
    it('should manage loading state', () => {
      const { result } = renderHook(() => useLoading());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.startLoading();
      });
      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.stopLoading();
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('useToggle', () => {
    it('should toggle state', () => {
      const { result } = renderHook(() => useToggle());

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.close();
      });
      expect(result.current.isOpen).toBe(false);
    });
  });
});