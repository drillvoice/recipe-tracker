import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import Link from "next/link";

interface Meal {
  id: string;
  mealName: string;
  date: Timestamp;
}

export default function Meals() {
  const [mealName, setMealName] = useState("");
  const [date, setDate] = useState("");
  const [meals, setMeals] = useState<Meal[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, user => {
      if (!user) window.location.href = "/";
    });
    const q = query(collection(db, "meals"), orderBy("date", "desc"));
    const unsubMeals = onSnapshot(q, snap => {
      setMeals(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => {
      unsubAuth();
      unsubMeals();
    };
  }, []);

  async function addMeal() {
    await addDoc(collection(db, "meals"), {
      mealName,
      date: date ? Timestamp.fromDate(new Date(date)) : Timestamp.now(),
      uid: auth.currentUser?.uid
    });
    setMealName("");
  }

  return (
    <main>
      <h1>Meals</h1>
      <button onClick={() => signOut(auth)}>Log Out</button>
      <Link href="/history">History</Link>
      <div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input placeholder="Meal name" value={mealName} onChange={e => setMealName(e.target.value)} />
        <button onClick={addMeal}>Add Meal</button>
      </div>
      <ul>
        {meals.map(m => (
          <li key={m.id}>
            {m.date.toDate().toLocaleDateString()} – {m.mealName}
          </li>
        ))}
      </ul>
    </main>
  );
}
