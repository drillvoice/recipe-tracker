import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import {
  getAllMeals,
  saveMeal,
  getPendingMeals,
  markMealSynced,
  type Meal,
} from "@/lib/mealsStore";

function formatDate(d: Date) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function Meals() {
  const [mealName, setMealName] = useState("");
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getAllMeals().then(ms =>
      setMeals(ms.sort((a, b) => b.date.toMillis() - a.date.toMillis()))
    );
    const q = query(collection(db, "meals"), orderBy("date", "desc"));
    const unsubMeals = onSnapshot(
      q,
      async snap => {
        const serverMeals = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as any),
          pending: false,
        }));
        for (const m of serverMeals) await saveMeal(m);
        const pending = await getPendingMeals();
        setMeals(
          [...serverMeals, ...pending].sort(
            (a, b) => b.date.toMillis() - a.date.toMillis()
          )
        );
      },
      async err => {
        console.error("Meal subscription failed", err);
        const all = await getAllMeals();
        setMeals(all.sort((a, b) => b.date.toMillis() - a.date.toMillis()));
        setMessage("Unable to sync with server");
      }
    );
    syncPendingMeals();
    return () => {
      unsubMeals();
    };
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
    const all = await getAllMeals();
    setMeals(all.sort((a, b) => b.date.toMillis() - a.date.toMillis()));
  }

  async function addMeal() {
    let mealTimestamp = Timestamp.now();
    if (date) {
      const [day, month, year] = date.split("/").map(Number);
      const parsed = new Date(year, month - 1, day);
      if (!isNaN(parsed.getTime())) {
        mealTimestamp = Timestamp.fromDate(parsed);
      }
    }
    const newMeal: Meal = {
      id: Date.now().toString(),
      mealName,
      date: mealTimestamp,
      uid: auth.currentUser?.uid,
      pending: true,
    };
    await saveMeal(newMeal);
    setMeals(prev =>
      [newMeal, ...prev].sort(
        (a, b) => b.date.toMillis() - a.date.toMillis()
      )
    );
    setMealName("");
    setMessage("Meal saved locally");
    setTimeout(() => setMessage(null), 2000);
    syncPendingMeals();
  }

  return (
    <main>
      <h1>Meals</h1>
      <div>
        <input
          type="text"
          value={date}
          onChange={e => setDate(e.target.value)}
          placeholder="dd/mm/yyyy"
        />
        <input
          placeholder="Meal name"
          value={mealName}
          onChange={e => setMealName(e.target.value)}
        />
        <button onClick={addMeal}>Add Meal</button>
      </div>
      {message && <p>{message}</p>}
      <ul>
        {meals.map(m => (
          <li key={m.id}>{formatDate(m.date.toDate())} – {m.mealName}</li>
        ))}
      </ul>
    </main>
  );
}

