import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllMeals, type Meal } from "@/lib/mealsStore";

export default function History() {
  const [meals, setMeals] = useState<Meal[]>([]);

  useEffect(() => {
    async function load() {
      const all = await getAllMeals();
      all.sort((a, b) => b.date.toMillis() - a.date.toMillis());
      setMeals(all);
    }
    load();
  }, []);

  return (
    <main className="container">
      <nav className="top-nav">
        <Link href="/" className="nav-item">
          + Add
        </Link>
        <Link href="/history" className="nav-item active">
          History
        </Link>
        <Link href="/ideas" className="nav-item">
          Ideas
        </Link>
        <Link href="/account" className="nav-item">
          Account
        </Link>
      </nav>
      <h1>History</h1>
      {meals.length > 0 ? (
        <>
          <p className="subtitle">
            {meals.length} meal{meals.length === 1 ? "" : "s"} tracked
          </p>
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Meal</th>
              </tr>
            </thead>
            <tbody>
              {meals.map(meal => (
                <tr key={meal.id}>
                  <td>
                    {meal
                      .date.toDate()
                      .toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                  </td>
                  <td>{meal.mealName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>No meals recorded.</p>
      )}
    </main>
  );
}
