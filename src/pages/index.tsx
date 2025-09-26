import { useEffect, useState, useCallback } from "react";
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
import { checkFormSubmissionLimit } from "@/utils/rateLimit";
import { TaglineManager } from "@/lib/tagline-manager";
import NotificationManager from "@/lib/notification-manager";

export default function Meals() {
  const [mealName, setMealName] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().substring(0, 10)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [historyAccordionOpen, setHistoryAccordionOpen] = useState(false);
  const [currentTagline, setCurrentTagline] = useState<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    syncPendingMeals();
    loadSuggestions();
    initializeNotifications();
  }, []);

  // Initialize notification system
  async function initializeNotifications() {
    try {
      await NotificationManager.initialize();
      console.log('Notification system initialized');
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

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

  async function syncPendingMeals() {
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
  }

  const handleMealNameChange = useCallback((value: string) => {
    setMealName(value);
    if (value.trim() === "") {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = suggestions.filter(suggestion =>
      suggestion.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredSuggestions(filtered);
    setShowSuggestions(filtered.length > 0 && value !== "");
  }, [suggestions]);

  const selectSuggestion = useCallback((suggestion: string) => {
    setMealName(suggestion);
    setShowSuggestions(false);
    setFilteredSuggestions([]);
  }, []);

  async function addMeal() {
    // Clear previous errors and messages
    setErrors([]);
    setMessage(null);

    // Check rate limiting
    const rateLimitCheck = checkFormSubmissionLimit(auth?.currentUser?.uid);
    if (!rateLimitCheck.allowed) {
      setErrors([`Too many submissions. Please wait ${rateLimitCheck.retryAfter} seconds before trying again.`]);
      return;
    }

    // Validate input
    const validation = validateMeal({ mealName, date });
    if (!validation.success) {
      setErrors(validation.errors);
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
      setMealName("");
      setDate(new Date().toISOString().substring(0, 10));
      setMessage("Meal saved successfully");
      setTimeout(() => setMessage(null), 3000);

      // Open history accordion to show visual confirmation
      setHistoryAccordionOpen(true);

      // Trigger history refresh
      setRefreshTrigger(Date.now());

      setSuggestions(prev =>
        Array.from(new Set([...prev, validation.data.mealName]))
      );
      setShowSuggestions(false);
      setFilteredSuggestions([]);
      syncPendingMeals();
    } catch (error) {
      console.error('Error saving meal:', error);
      setErrors(['Failed to save meal. Please try again.']);
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
              onChange={e => handleMealNameChange(e.target.value)}
              onFocus={() => {
                if (mealName.trim() && filteredSuggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                // Delay hiding to allow clicks on suggestions
                setTimeout(() => setShowSuggestions(false), 150);
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
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </label>
        <button onClick={addMeal}>Add Dish</button>
      </div>
      
      {errors.length > 0 && (
        <div className="form" style={{ marginTop: '0.5rem' }}>
          {errors.map((error, index) => (
            <p key={index} className="error-message">{error}</p>
          ))}
        </div>
      )}
      
      {message && <p className="success-message">{message}</p>}

      <HistoryAccordion
        isOpen={historyAccordionOpen}
        onToggle={() => setHistoryAccordionOpen(!historyAccordionOpen)}
        refreshTrigger={refreshTrigger}
      />

      <div className="version-indicator">
        v0.4.1
      </div>
    </main>
    </>
  );
}

