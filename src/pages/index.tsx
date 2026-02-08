import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import Head from "next/head";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import {
  saveMeal,
  getAllMeals,
  getPendingMeals,
  markMealSynced,
  type Meal,
} from "@/lib/offline-storage";
import Navigation from "@/components/Navigation";
import HistoryAccordion from "@/components/HistoryAccordion";
import { validateMeal } from "@/utils/validation";

const CalendarView = lazy(() => import("@/components/CalendarView"));
import { checkFormSubmissionLimit } from "@/utils/rateLimit";
import { TaglineManager } from "@/lib/tagline-manager";
import { useFormState, useToggle, useAutocomplete, useMessages } from "@/hooks/common";

export default function Meals() {
  // Form state using useFormState hook
  const { values: formValues, updateValue: updateFormValue } = useFormState({
    mealName: "",
    date: new Date().toISOString().substring(0, 10)
  });

  // Message management using useMessages hook
  const { messages, addSuccess, addError, clearAllMessages } = useMessages({
    autoClose: true,
    autoCloseDelay: 3000
  });

  // Toggle states using useToggle hook
  const { isOpen: historyAccordionOpen, toggle: toggleHistoryAccordion, open: openHistoryAccordion } = useToggle(false);

  // Autocomplete for meal suggestions using useAutocomplete hook
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const {
    inputValue: mealName,
    suggestions: filteredSuggestions,
    showSuggestions,
    setInputValue: setMealName,
    selectSuggestion,
    closeSuggestions
  } = useAutocomplete(suggestions, { maxSuggestions: 5 });

  // Other component state
  const [currentTagline, setCurrentTagline] = useState<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const syncPendingMeals = useCallback(async () => {
    const database = db;
    if (!database) {
      return;
    }

    const pending = await getPendingMeals();
    for (const m of pending) {
      try {
        const docRef = await addDoc(collection(database, "meals"), {
          mealName: m.mealName,
          date: m.date,
          uid: m.uid,
        });
        await markMealSynced(m.id, docRef.id);
      } catch {
        // ignore offline errors
      }
    }
  }, []);

  // Initialize and manage tagline rotation
  useEffect(() => {
    // Set initial tagline
    setCurrentTagline(TaglineManager.getCurrentTagline());

    // Check for tagline updates every hour
    const checkTaglineInterval = setInterval(() => {
      const newTagline = TaglineManager.getCurrentTagline();
      if (newTagline !== currentTagline) {
        setCurrentTagline(newTagline);
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(checkTaglineInterval);
  }, [currentTagline]);

  const loadSuggestions = useCallback(async () => {
    const all = await getAllMeals();
    const names = Array.from(new Set(all.map(m => m.mealName)));
    setSuggestions(names);
  }, []);

  useEffect(() => {
    syncPendingMeals();
    loadSuggestions();
  }, [loadSuggestions, syncPendingMeals]);

  // handleMealNameChange and selectSuggestion are now handled by useAutocomplete hook

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
        date: Timestamp.fromDate(new Date(validation.data.date + 'T00:00:00')),
        uid: auth?.currentUser?.uid,
        pending: true,
      };

      await saveMeal(newMeal);

      // Reset form using the hook
      setMealName("");
      updateFormValue('date', new Date().toISOString().substring(0, 10));

      // Show success message using the hook
      addSuccess("Meal saved successfully");

      // Open history accordion to show visual confirmation
      openHistoryAccordion();

      // Trigger history refresh
      setRefreshTrigger(Date.now());

      // Update suggestions and close autocomplete
      setSuggestions(prev =>
        Array.from(new Set([...prev, validation.data.mealName]))
      );
      closeSuggestions();
      syncPendingMeals();
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
              placeholder="Enter meal name..."
              value={mealName}
              onChange={e => setMealName(e.target.value)}
              onFocus={() => {
                if (mealName.trim() && filteredSuggestions.length > 0) {
                  // openSuggestions is called automatically by useAutocomplete
                }
              }}
              onBlur={() => {
                // Delay hiding to allow clicks on suggestions
                setTimeout(() => closeSuggestions(), 150);
              }}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  if (showSuggestions && filteredSuggestions.length > 0) {
                    return;
                  }
                  event.preventDefault();
                  addMeal();
                }
              }}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {filteredSuggestions.slice(0, 5).map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    className="suggestion-item"
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
        <CalendarView refreshTrigger={refreshTrigger} />
      </Suspense>

      <HistoryAccordion
        isOpen={historyAccordionOpen}
        onToggle={toggleHistoryAccordion}
        refreshTrigger={refreshTrigger}
      />

      <div className="version-indicator">
        v0.8.2
      </div>
    </main>
    </>
  );
}

