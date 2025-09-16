import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import {
  saveMeal,
  getAllMeals,
  type Meal,
} from "@/lib/offline-storage";
import {
  getPendingMeals,
  markMealSynced,
} from "@/lib/mealsStore";
import Navigation from "@/components/Navigation";
import { validateMeal } from "@/utils/validation";
import { checkFormSubmissionLimit } from "@/utils/rateLimit";

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

  useEffect(() => {
    syncPendingMeals();
    loadSuggestions();
  }, []);

  async function loadSuggestions() {
    const all = await getAllMeals();
    const names = Array.from(new Set(all.map(m => m.mealName)));
    setSuggestions(names);
  }

  async function syncPendingMeals() {
    const pending = await getPendingMeals();
    for (const m of pending) {
      try {
        const docRef = await addDoc(collection(db, "meals"), {
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

  function handleMealNameChange(value: string) {
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
  }

  function selectSuggestion(suggestion: string) {
    setMealName(suggestion);
    setShowSuggestions(false);
    setFilteredSuggestions([]);
  }

  async function addMeal() {
    // Clear previous errors and messages
    setErrors([]);
    setMessage(null);

    // Check rate limiting
    const rateLimitCheck = checkFormSubmissionLimit(auth.currentUser?.uid);
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
        uid: auth.currentUser?.uid,
        pending: true,
      };
      
      await saveMeal(newMeal);
      setMealName("");
      setDate(new Date().toISOString().substring(0, 10));
      setMessage("Meal saved successfully");
      setTimeout(() => setMessage(null), 3000);
      
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
    <main className="container">
      <Navigation currentPage="add" />
      <h1>Add Meal</h1>
      <p className="subtitle">Track what you're cooking today</p>
      <div className="form">
        <label>
          Meal Name
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
        <button onClick={addMeal}>Add Meal</button>
      </div>
      
      {errors.length > 0 && (
        <div className="form" style={{ marginTop: '0.5rem' }}>
          {errors.map((error, index) => (
            <p key={index} className="error-message">{error}</p>
          ))}
        </div>
      )}
      
      {message && <p className="success-message">{message}</p>}
      
      <div className="version-indicator">
        v0.2.3
      </div>
    </main>
  );
}

