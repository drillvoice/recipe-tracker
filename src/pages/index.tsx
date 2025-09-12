import { useEffect, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebaseClient";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import {
  saveMeal,
  getPendingMeals,
  markMealSynced,
  type Meal,
} from "@/lib/mealsStore";

export default function Meals() {
  const [mealName, setMealName] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().substring(0, 10)
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    syncPendingMeals();
  }, []);

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
    syncPendingMeals();
  }

  return (
    <main className="container">
      <nav className="top-nav">
        <Link href="/" className="nav-item active">
          Add
        </Link>
        <Link href="/history" className="nav-item">
          History
        </Link>
        <Link href="/ideas" className="nav-item">
          Ideas
        </Link>
      </nav>
      <h1>Add Meal</h1>
      <p className="subtitle">Track what you're cooking today</p>
      <div className="form">
        <label>
          Meal Name
          <input
            placeholder="Enter meal name..."
            value={mealName}
            onChange={e => setMealName(e.target.value)}
          />
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
    </main>
  );
}

