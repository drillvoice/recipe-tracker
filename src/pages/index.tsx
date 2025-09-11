import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
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

export default function Meals() {
  const [mealName, setMealName] = useState("");
  const [date, setDate] = useState("");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Monitor authentication state
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) {
        console.log("User ready:", currentUser.uid);
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    // Only set up Firestore listeners after auth is ready
    if (!authReady || !user) return;

    let unsubMeals: (() => void) | undefined;

    const setupFirestore = async () => {
      try {
        // Load local meals first
        const localMeals = await getAllMeals();
        setMeals(localMeals.sort((a, b) => b.date.toMillis() - a.date.toMillis()));

        // Set up Firestore listener
        const q = query(collection(db, "meals"), orderBy("date", "desc"));
        unsubMeals = onSnapshot(
          q,
          async (snap) => {
            const serverMeals = snap.docs.map(d => ({
              id: d.id,
              ...(d.data() as any),
              pending: false,
            }));
            
            // Save server meals to local store
            for (const m of serverMeals) {
              await saveMeal(m);
            }
            
            const pending = await getPendingMeals();
            setMeals(
              [...serverMeals, ...pending].sort(
                (a, b) => b.date.toMillis() - a.date.toMillis()
              )
            );
            setMessage("Synced with server");
            setTimeout(() => setMessage(null), 2000);
          },
          async (err) => {
            console.error("Meal subscription failed", err);
            const all = await getAllMeals();
            setMeals(all.sort((a, b) => b.date.toMillis() - a.date.toMillis()));
            setMessage("Unable to sync with server - working offline");
          }
        );

        // Sync any pending meals
        await syncPendingMeals();
      } catch (error) {
        console.error("Error setting up Firestore:", error);
        setMessage("Error connecting to database");
      }
    };

    setupFirestore();

    return () => {
      if (unsubMeals) unsubMeals();
    };
  }, [authReady, user]);

  async function syncPendingMeals() {
    if (!user) return;
    
    const pending = await getPendingMeals();
    for (const m of pending) {
      try {
        const docRef = await addDoc(collection(db, "meals"), {
          mealName: m.mealName,
          date: m.date,
          uid: m.uid,
        });
        await markMealSynced(m.id, docRef.id);
        console.log("Synced meal:", m.mealName);
      } catch (error) {
        console.error("Failed to sync meal:", error);
        // Keep as pending for retry later
      }
    }
    
    const all = await getAllMeals();
    setMeals(all.sort((a, b) => b.date.toMillis() - a.date.toMillis()));
  }

  async function addMeal() {
    if (!mealName.trim()) {
      setMessage("Please enter a meal name");
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    const newMeal: Meal = {
      id: Date.now().toString(),
      mealName: mealName.trim(),
      date: date ? Timestamp.fromDate(new Date(date)) : Timestamp.now(),
      uid: user?.uid,
      pending: true,
    };

    try {
      await saveMeal(newMeal);
      setMeals(prev =>
        [newMeal, ...prev].sort(
          (a, b) => b.date.toMillis() - a.date.toMillis()
        )
      );
      setMealName("");
      setDate("");
      setMessage("Meal saved locally");
      setTimeout(() => setMessage(null), 2000);
      
      // Try to sync immediately
      if (user) {
        syncPendingMeals();
      }
    } catch (error) {
      console.error("Failed to save meal:", error);
      setMessage("Failed to save meal");
      setTimeout(() => setMessage(null), 2000);
    }
  }

  if (!authReady) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Authentication required. Please refresh the page.</div>;
  }

  return (
    <main style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Meals</h1>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            style={{ marginRight: '10px', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            placeholder="Meal name"
            value={mealName}
            onChange={e => setMealName(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && addMeal()}
            style={{ padding: '8px', width: '200px', marginRight: '10px' }}
          />
          <button onClick={addMeal} style={{ padding: '8px 16px' }}>
            Add Meal
          </button>
        </div>
      </div>
      
      {message && (
        <p style={{ 
          padding: '10px', 
          backgroundColor: '#f0f8ff', 
          border: '1px solid #ddd',
          borderRadius: '4px'
        }}>
          {message}
        </p>
      )}
      
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {meals.map(m => (
          <li key={m.id} style={{ 
            padding: '10px', 
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>
              {m.date.toDate().toLocaleDateString()} – {m.mealName}
            </span>
            {m.pending && (
              <span style={{ 
                fontSize: '12px', 
                color: '#666',
                fontStyle: 'italic' 
              }}>
                Syncing...
              </span>
            )}
          </li>
        ))}
      </ul>
      
      {meals.length === 0 && (
        <p style={{ textAlign: 'center', color: '#666', marginTop: '40px' }}>
          No meals recorded yet. Add your first meal above!
        </p>
      )}
    </main>
  );
}