import { useState } from "react";
import { Timestamp } from "firebase/firestore";
import ActionButton from "@/components/ActionButton";
import ConfirmDialog from "@/components/ConfirmDialog";
import Navigation from "@/components/Navigation";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useMeals } from "@/hooks/useMeals";
import type { Meal } from "@/lib/mealsStore";

export default function History() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMealName, setEditMealName] = useState("");
  const [editDate, setEditDate] = useState("");
  const { dialogProps, showDialog } = useConfirmDialog();
  const { meals, isLoading, error, updateMealData, deleteMealData } = useMeals();

  function startEdit(meal: Meal) {
    setEditingId(meal.id);
    setEditMealName(meal.mealName);
    setEditDate(meal.date.toDate().toISOString().substring(0, 10));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditMealName("");
    setEditDate("");
  }

  async function saveEdit() {
    if (!editingId) return;
    
    try {
      await updateMealData(editingId, {
        mealName: editMealName,
        date: Timestamp.fromDate(new Date(editDate + 'T00:00:00'))
      });
      cancelEdit();
    } catch (error) {
      console.error('Error updating meal:', error);
    }
  }

  function confirmDelete(meal: Meal) {
    showDialog(
      "Delete Meal",
      `Are you sure you want to delete "${meal.mealName}" from ${meal.date.toDate().toLocaleDateString()}?`,
      () => handleDelete(meal.id)
    );
  }

  async function handleDelete(id: string) {
    try {
      await deleteMealData(id);
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  }

  if (error) {
    return (
      <main className="container">
        <Navigation currentPage="history" />
        <h1>History</h1>
        <p className="error-message">Error loading meals: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <Navigation currentPage="history" />
      <h1>History</h1>
      {isLoading ? (
        <p>Loading meals...</p>
      ) : meals.length > 0 ? (
        <>
          <p className="subtitle">
            {meals.length} meal{meals.length === 1 ? "" : "s"} tracked
          </p>
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Meal</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {meals.map(meal => (
                <tr key={meal.id}>
                  <td>
                    {editingId === meal.id ? (
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      meal.date.toDate().toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    )}
                  </td>
                  <td>
                    {editingId === meal.id ? (
                      <input
                        type="text"
                        value={editMealName}
                        onChange={(e) => setEditMealName(e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      meal.mealName
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      {editingId === meal.id ? (
                        <>
                          <ActionButton
                            icon="✓"
                            onClick={saveEdit}
                            title="Save changes"
                            variant="success"
                          />
                          <ActionButton
                            icon="✕"
                            onClick={cancelEdit}
                            title="Cancel editing"
                          />
                        </>
                      ) : (
                        <>
                          <ActionButton
                            icon="✏️"
                            onClick={() => startEdit(meal)}
                            title="Edit meal"
                          />
                          <ActionButton
                            icon="🗑️"
                            onClick={() => confirmDelete(meal)}
                            title="Delete meal"
                            variant="danger"
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>No meals recorded.</p>
      )}

      <ConfirmDialog
        {...dialogProps}
        confirmText="Delete"
        variant="danger"
      />
    </main>
  );
}
