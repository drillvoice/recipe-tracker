import { useState, useCallback, useMemo } from 'react';

interface UseAutocompleteOptions {
  maxSuggestions?: number;
  filterFn?: (option: string, input: string) => boolean;
  caseSensitive?: boolean;
}

export interface UseAutocompleteReturn {
  inputValue: string;
  suggestions: string[];
  showSuggestions: boolean;
  setInputValue: (value: string) => void;
  selectSuggestion: (suggestion: string) => void;
  clearSuggestions: () => void;
  openSuggestions: () => void;
  closeSuggestions: () => void;
}

/**
 * Default filter function using substring matching
 */
const defaultFilterFn = (option: string, input: string, caseSensitive = false): boolean => {
  const optionText = caseSensitive ? option : option.toLowerCase();
  const inputText = caseSensitive ? input : input.toLowerCase();
  return optionText.includes(inputText);
};

/**
 * Hook for managing autocomplete/suggestion functionality
 *
 * @param allOptions - Array of all available options
 * @param options - Configuration options
 * @returns Object with autocomplete state and control functions
 *
 * @example
 * ```typescript
 * const {
 *   inputValue,
 *   suggestions,
 *   showSuggestions,
 *   setInputValue,
 *   selectSuggestion
 * } = useAutocomplete(['apple', 'banana', 'cherry'], { maxSuggestions: 5 });
 *
 * return (
 *   <div>
 *     <input
 *       value={inputValue}
 *       onChange={(e) => setInputValue(e.target.value)}
 *     />
 *     {showSuggestions && (
 *       <div>
 *         {suggestions.map(suggestion => (
 *           <button key={suggestion} onClick={() => selectSuggestion(suggestion)}>
 *             {suggestion}
 *           </button>
 *         ))}
 *       </div>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useAutocomplete(
  allOptions: string[],
  options: UseAutocompleteOptions = {}
): UseAutocompleteReturn {
  const {
    maxSuggestions = 5,
    filterFn = defaultFilterFn,
    caseSensitive = false
  } = options;

  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter and limit suggestions based on input value
  const suggestions = useMemo(() => {
    if (!inputValue.trim()) {
      return [];
    }

    const filtered = allOptions.filter(option =>
      filterFn(option, inputValue, caseSensitive)
    );

    return filtered.slice(0, maxSuggestions);
  }, [allOptions, inputValue, filterFn, maxSuggestions, caseSensitive]);

  const handleSetInputValue = useCallback((value: string) => {
    setInputValue(value);
    setShowSuggestions(value.trim() !== '' && suggestions.length > 0);
  }, [suggestions.length]);

  const selectSuggestion = useCallback((suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
  }, []);

  const clearSuggestions = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  const openSuggestions = useCallback(() => {
    if (inputValue.trim() && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [inputValue, suggestions.length]);

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  // Update suggestions visibility when suggestions change
  const filteredSuggestions = useMemo(() => {
    const shouldShow = inputValue.trim() !== '' && suggestions.length > 0;
    if (!shouldShow && showSuggestions) {
      setShowSuggestions(false);
    }
    return suggestions;
  }, [suggestions, inputValue, showSuggestions]);

  return {
    inputValue,
    suggestions: filteredSuggestions,
    showSuggestions,
    setInputValue: handleSetInputValue,
    selectSuggestion,
    clearSuggestions,
    openSuggestions,
    closeSuggestions
  };
}