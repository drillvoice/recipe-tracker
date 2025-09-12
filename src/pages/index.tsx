import { useEffect, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import {
  saveMeal,
  getPendingMeals,
  getAllMeals,
  markMealSynced,
  type Meal,
} from "@/lib/mealsStore";

export default function Meals() {
  const [mealName, setMealName] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().substring(0, 10)
  );
  const [message, setMessage] = useState<string | null>(null);
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
    const newMeal: Meal = {
      id: Date.now().toString(),
      mealName,
      date: date ? Timestamp.fromDate(new Date(date)) : Timestamp.now(),
      uid: auth.currentUser?.uid,
      pending: true,
    };
    await saveMeal(newMeal);
    setMealName("");
    setDate(new Date().toISOString().substring(0, 10));
    setMessage("Meal saved locally");
    setTimeout(() => setMessage(null), 2000);
    setSuggestions(prev =>
      Array.from(new Set([...prev, mealName]))
    );
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    syncPendingMeals();
  }

  return (
    <main className="container">
      <nav className="top-nav">
        <Link href="/" className="nav-item active">
          + Add
        </Link>
        <Link href="/history" className="nav-item">
          History
        </Link>
        <Link href="/ideas" className="nav-item">
          Ideas
        </Link>
        <Link href="/account" className="nav-item">
          Account
        </Link>
      </nav>
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
      {message && <p className="message">{message}</p>}
      
      <div className="version-indicator">
        v0.0.2
      </div>
    </main>
  );
}

