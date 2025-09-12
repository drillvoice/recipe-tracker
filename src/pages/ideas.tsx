import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllMeals, type Meal } from "@/lib/mealsStore";

interface Idea {
  mealName: string;
  lastMade: Meal["date"];
  count: number;
}

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);

  useEffect(() => {
    async function load() {
      const all = await getAllMeals();
      const map = new Map<string, Idea>();
      for (const meal of all) {
        const existing = map.get(meal.mealName);
        if (existing) {
          existing.count += 1;
          if (meal.date.toMillis() > existing.lastMade.toMillis()) {
            existing.lastMade = meal.date;
          }
        } else {
          map.set(meal.mealName, {
            mealName: meal.mealName,
            lastMade: meal.date,
            count: 1,
          });
        }
      }
      const arr = Array.from(map.values());
      arr.sort(
        (a, b) =>
          b.lastMade.toMillis() - a.lastMade.toMillis() ||
          a.mealName.localeCompare(b.mealName)
      );
      setIdeas(arr);
    }
    load();
  }, []);

  return (
    <main className="container">
      <nav className="top-nav">
        <Link href="/" className="nav-item">
          Add
        </Link>
        <Link href="/history" className="nav-item">
          History
        </Link>
        <Link href="/ideas" className="nav-item active">
          Ideas
        </Link>
      </nav>
      <h1>Ideas</h1>
      {ideas.length > 0 ? (
        <>
          <p className="subtitle">
            {ideas.length} unique meal{ideas.length === 1 ? "" : "s"}
          </p>
          <table className="ideas-table">
            <thead>
              <tr>
                <th>Meal</th>
                <th>Last Made</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {ideas.map(idea => (
                <tr key={idea.mealName}>
                  <td>{idea.mealName}</td>
                  <td>
                    {idea.lastMade
                      .toDate()
                      .toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                  </td>
                  <td>
                    <span className="count-badge">{idea.count}x</span>
                  </td>
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

