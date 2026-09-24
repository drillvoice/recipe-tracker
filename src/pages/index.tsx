import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import Head from "next/head";
import { auth } from "@/lib/firebase";
import { Timestamp } from "firebase/firestore";
import type { Meal } from "@/lib/offline-storage";
import Navigation from "@/components/Navigation";
import HistoryAccordion from "@/components/HistoryAccordion";
import { validateMeal } from "@/utils/validation";
import { toLocalDateKey, fromLocalDateKey } from "@/utils/date";
import { useMeals } from "@/hooks/useMeals";

const CalendarView = lazy(() => import("@/components/CalendarView"));
import { checkFormSubmissionLimit } from "@/utils/rateLimit";
import { TaglineManager } from "@/lib/tagline-manager";
import { useFormState, useToggle, useAutocomplete, useMessages } from "@/hooks/common";

export default function Meals() {
  // Form state using useFormState hook
  const { values: formValues, updateValue: updateFormValue } = useFormState({
    mealName: "",
    date: toLocalDateKey()
  });

  // Message management using useMessages hook
  const { messages, addSuccess, addError, clearAllMessages } = useMessages({
    autoClose: true,
    autoCloseDelay: 3000
  });

  // Toggle states using useToggle hook
  const { isOpen: historyAccordionOpen, toggle: toggleHistoryAccordion, open: openHistoryAccordion } = useToggle(false);

  // Shared with CalendarView and HistoryAccordion, so the page reads
  // IndexedDB once and a new dish appears everywhere without reloading.
  const { meals, addMeal: saveNewMeal } = useMeals();

  // Unique dish names, most recently made first (meals are sorted newest first)
  const suggestions = useMemo(
    () => Array.from(new Set(meals.map(m => m.mealName))),
    [meals]
  );

  // Autocomplete for dish suggestions using useAutocomplete hook
  const {
    inputValue: mealName,
    suggestions: filteredSuggestions,
    showSuggestions,
    setInputValue: setMealName,
    selectSuggestion,
    closeSuggestions
  } = useAutocomplete(suggestions, { maxSuggestions: 5 });
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const [currentTagline, setCurrentTagline] = useState<string>("");

  // Initialize and manage tagline rotation
  useEffect(() => {
    setCurrentTagline(TaglineManager.getCurrentTagline());

    // Check for tagline updates every hour
    const checkTaglineInterval = setInterval(() => {
      setCurrentTagline(TaglineManager.getCurrentTagline());
    }, 60 * 60 * 1000);

    return () => clearInterval(checkTaglineInterval);
  }, []);

  async function addMeal() {
    // Clear previous messages
    clearAllMessages();

    // Check rate limiting
    const rateLimitCheck = checkFormSubmissionLimit(auth?.currentUser?.uid);
    if (!rateLimitCheck.allowed) {
      addError(`Too many submissions. Please wait ${rateLimitCheck.retryAfter} seconds before trying again.`);
      return;
    }

    // Validate input
    const validation = validateMeal({ mealName, date: formValues.date });
    if (!validation.success) {
      validation.errors.forEach(error => addError(error));
      return;
    }

    try {
      const newMeal: Meal = {
        id: Date.now().toString(),
        mealName: validation.data.mealName,
        date: Timestamp.fromDate(fromLocalDateKey(validation.data.date)),
        uid: auth?.currentUser?.uid,
        pending: true,
      };

      await saveNewMeal(newMeal);

      // Reset form using the hook
      setMealName("");
      setActiveSuggestion(-1);
      updateFormValue('date', toLocalDateKey());

      addSuccess("Dish saved");

      // Open history accordion to show visual confirmation
      openHistoryAccordion();
      closeSuggestions();
    } catch (error) {
      console.error('Error saving meal:', error);
      addError('Failed to save meal. Please try again.');
    }
  }

  return (
    <>
      <Head>
        <title>DishDiary - Add Dish</title>
      </Head>
      <main className="container">
        <Navigation currentPage="add" />
        <h1>DishDiary</h1>
        <p className="subtitle tagline-text">{currentTagline || "What's cooking, good looking?🍳"}</p>
      <div className="form">
        <label>
          Dish name
          <div className="autocomplete-container">
            <input
              placeholder="Enter dish name..."
              value={mealName}
              onChange={e => {
                setMealName(e.target.value);
                setActiveSuggestion(-1);
              }}
              onBlur={() => {
                // Delay hiding to allow clicks on suggestions
                setTimeout(() => closeSuggestions(), 150);
              }}
              onKeyDown={event => {
                const suggestionsOpen = showSuggestions && filteredSuggestions.length > 0;
                if (suggestionsOpen && event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveSuggestion(i => (i + 1) % filteredSuggestions.length);
                } else if (suggestionsOpen && event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveSuggestion(i => (i <= 0 ? filteredSuggestions.length : i) - 1);
                } else if (suggestionsOpen && event.key === "Escape") {
                  closeSuggestions();
                  setActiveSuggestion(-1);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  if (suggestionsOpen && activeSuggestion >= 0) {
                    // Pick the highlighted suggestion; a second Enter adds it
                    selectSuggestion(filteredSuggestions[activeSuggestion]);
                    setActiveSuggestion(-1);
                  } else {
                    addMeal();
                  }
                }
              }}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions && filteredSuggestions.length > 0}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={`suggestion-item${index === activeSuggestion ? " active" : ""}`}
                    onClick={() => selectSuggestion(suggestion)}
                    onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
        <label>
          Date
          <input
            type="date"
            value={formValues.date}
            onChange={e => updateFormValue('date', e.target.value)}
          />
        </label>
        <button onClick={addMeal}>Add Dish</button>
      </div>
      
      {/* Messages are now handled by useMessages hook */}
      {messages.length > 0 && (
        <div className="form" style={{ marginTop: '0.5rem' }}>
          {messages.map((message) => (
            <p key={message.id} className={`${message.type}-message`}>
              {message.text}
            </p>
          ))}
        </div>
      )}

      <Suspense fallback={<div className="form"><p>Loading calendar...</p></div>}>
        <CalendarView
          onDateSelect={date => updateFormValue('date', date)}
        />
      </Suspense>

      <HistoryAccordion
        isOpen={historyAccordionOpen}
        onToggle={toggleHistoryAccordion}
      />

      <div className="version-indicator">
        v0.9.3
      </div>
    </main>
    </>
  );
}
