import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllMeals, hideMealsByName, type Meal } from "@/lib/mealsStore";
import ActionButton from "@/components/ActionButton";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Idea {
  mealName: string;
  lastMade: Meal["date"];
  count: number;
  hidden: boolean;
}

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  useEffect(() => {
    loadIdeas();
  }, []);

  async function loadIdeas() {
    const all = await getAllMeals();
    const map = new Map<string, Idea>();
    
    for (const meal of all) {
      const existing = map.get(meal.mealName);
      if (existing) {
        existing.count += 1;
        if (meal.date.toMillis() > existing.lastMade.toMillis()) {
          existing.lastMade = meal.date;
        }
        // If any meal with this name is hidden, mark the idea as hidden
        if (meal.hidden) {
          existing.hidden = true;
        }
      } else {
        map.set(meal.mealName, {
          mealName: meal.mealName,
          lastMade: meal.date,
          count: 1,
          hidden: meal.hidden || false,
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

  function confirmHide(idea: Idea) {
    setConfirmDialog({
      isOpen: true,
      title: idea.hidden ? "Show Meal" : "Hide Meal",
      message: idea.hidden 
        ? `Show "${idea.mealName}" in ideas list?`
        : `Hide "${idea.mealName}" from ideas list?`,
      onConfirm: () => handleToggleHidden(idea.mealName, !idea.hidden)
    });
  }

  async function handleToggleHidden(mealName: string, hidden: boolean) {
    try {
      await hideMealsByName(mealName, hidden);
      await loadIdeas();
      setConfirmDialog({ ...confirmDialog, isOpen: false });
    } catch (error) {
      console.error('Error toggling meal visibility:', error);
    }
  }

  const visibleIdeas = ideas.filter(idea => showHidden || !idea.hidden);

  return (
    <main className="container">
      <nav className="top-nav">
        <Link href="/" className="nav-item">
          + Add
        </Link>
        <Link href="/history" className="nav-item">
          History
        </Link>
        <Link href="/ideas" className="nav-item active">
          Ideas
        </Link>
        <Link href="/account" className="nav-item">
          Account
        </Link>
      </nav>
      <h1>Ideas</h1>
      
      {ideas.length > 0 && (
        <div className="ideas-filters">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            <span className="filter-label">Show Hidden</span>
          </label>
        </div>
      )}

      {visibleIdeas.length > 0 ? (
        <>
          <p className="subtitle">
            {visibleIdeas.length} unique meal{visibleIdeas.length === 1 ? "" : "s"}
            {showHidden && ideas.some(i => i.hidden) && (
              <span className="hidden-count"> ({ideas.filter(i => i.hidden).length} hidden)</span>
            )}
          </p>
          <table className="ideas-table">
            <thead>
              <tr>
                <th>Meal</th>
                <th>Last Made</th>
                <th>Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleIdeas.map(idea => (
                <tr key={idea.mealName} className={idea.hidden ? 'hidden-meal' : ''}>
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
                  <td>
                    <div className="action-buttons">
                      <ActionButton
                        icon={idea.hidden ? "👁️" : "⭕"}
                        onClick={() => confirmHide(idea)}
                        title={idea.hidden ? "Show meal" : "Hide meal"}
                        variant={idea.hidden ? "default" : "danger"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>{showHidden ? "No meals recorded." : "No visible meals. Toggle 'Show Hidden' to see hidden meals."}</p>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        confirmText="Confirm"
      />
    </main>
  );
}

