import Link from "next/link";

interface Meal {
  id: number;
  mealName: string;
  date: Date;
}

export default function History() {
  const meals: Meal[] = [
    { id: 1, mealName: "Spaghetti", date: new Date() },
    { id: 2, mealName: "Tacos", date: new Date() }
  ];

  return (
    <main>
      <h1>Meal History</h1>
      <Link href="/meals">Add Meal</Link>
      <ul>
        {meals.map(m => (
          <li key={m.id}>
            {m.date.toLocaleDateString()} – {m.mealName}
          </li>
        ))}
      </ul>
    </main>
  );
}

