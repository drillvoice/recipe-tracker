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

export default function Meals() {
  const [mealName, setMealName] = useState("");
  // Set default date to today's date in YYYY-MM-DD format
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
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
    if (!mealName.trim()) {
      setMessage("Please enter a meal name");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const newMeal: Meal = {
      id: Date.now().toString(),
      mealName: mealName.trim(),
      date: date ? Timestamp.fromDate(new Date(date)) : Timestamp.now(),
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
    setMessage("Meal saved! 🍽️");
    setTimeout(() => setMessage(null), 3000);
    syncPendingMeals();
  }

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  return (
    <main style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '2rem 1rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <header style={{
        textAlign: 'center',
        marginBottom: '3rem'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          color: '#2d3748',
          margin: '0 0 0.5rem 0'
        }}>
          🍽️ Recipe Tracker
        </h1>
        <p style={{
          color: '#718096',
          fontSize: '1.1rem',
          margin: 0
        }}>
          Keep track of what you cooked
        </p>
      </header>

      <div style={{
        backgroundColor: '#f7fafc',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: '#2d3748',
          marginBottom: '1.5rem',
          marginTop: 0
        }}>
          Add New Meal
        </h2>
        
        <div style={{
          display: 'grid',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#4a5568',
              marginBottom: '0.5rem'
            }}>
              Date
            </label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              tabIndex={1}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = '#4299e1'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
          
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#4a5568',
              marginBottom: '0.5rem'
            }}>
              What did you cook?
            </label>
            <input
              placeholder="e.g., Spaghetti Carbonara, Chicken Stir Fry..."
              value={mealName}
              onChange={e => setMealName(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addMeal()}
              tabIndex={2}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = '#4299e1'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
        </div>
        
        <button 
          onClick={addMeal} 
          tabIndex={3}
          style={{
            width: '100%',
            padding: '0.875rem 1.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            color: 'white',
            backgroundColor: '#4299e1',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'background-color 0.2s, transform 0.1s',
            outline: 'none'
          }}
          onMouseEnter={e => {
            e.target.style.backgroundColor = '#3182ce';
            e.target.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.target.style.backgroundColor = '#4299e1';
            e.target.style.transform = 'translateY(0)';
          }}
          onMouseDown={e => e.target.style.transform = 'translateY(0)'}
          onMouseUp={e => e.target.style.transform = 'translateY(-1px)'}
        >
          Add Meal
        </button>
      </div>

      {message && (
        <div style={{
          padding: '1rem',
          marginBottom: '2rem',
          backgroundColor: message.includes('Unable') || message.includes('Please') ? '#fed7d7' : '#c6f6d5',
          color: message.includes('Unable') || message.includes('Please') ? '#c53030' : '#2f855a',
          borderRadius: '8px',
          border: `1px solid ${message.includes('Unable') || message.includes('Please') ? '#feb2b2' : '#9ae6b4'}`,
          fontSize: '0.9rem',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}

      <div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#2d3748',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📚 Your Meals
          {meals.length > 0 && (
            <span style={{
              fontSize: '0.8rem',
              fontWeight: '400',
              color: '#718096',
              backgroundColor: '#edf2f7',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px'
            }}>
              {meals.length}
            </span>
          )}
        </h2>
        
        {meals.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: '#718096',
            backgroundColor: '#f7fafc',
            borderRadius: '12px',
            border: '2px dashed #e2e8f0'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
            <p style={{ fontSize: '1.1rem', margin: 0 }}>
              No meals recorded yet.<br />
              Add your first meal above!
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '0.5rem'
          }}>
            {meals.map((m, index) => (
              <div key={m.id} style={{
                padding: '1rem 1.25rem',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'transform 0.1s, box-shadow 0.1s',
                cursor: 'default'
              }}
              onMouseEnter={e => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }}
              >
                <div>
                  <div style={{
                    fontWeight: '600',
                    color: '#2d3748',
                    fontSize: '1rem',
                    marginBottom: '0.25rem'
                  }}>
                    {m.mealName}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#718096'
                  }}>
                    {formatDate(m.date)}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {m.pending && (
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#d69e2e',
                      backgroundColor: '#faf089',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px',
                      fontWeight: '500'
                    }}>
                      Syncing...
                    </span>
                  )}
                  <span style={{ fontSize: '1.5rem' }}>
                    {index === 0 ? '🌟' : '🍽️'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}