import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllMeals, updateMeal, deleteMeal, type Meal } from "@/lib/mealsStore";
import { Timestamp } from "firebase/firestore";
import ActionButton from "@/components/ActionButton";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function History() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMealName, setEditMealName] = useState("");
  const [editDate, setEditDate] = useState("");
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
    loadMeals();
  }, []);

  async function loadMeals() {
    const all = await getAllMeals();
    all.sort((a, b) => b.date.toMillis() - a.date.toMillis());
    setMeals(all);
  }

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
      await updateMeal(editingId, {
        mealName: editMealName,
        date: Timestamp.fromDate(new Date(editDate + 'T00:00:00'))
      });
      await loadMeals();
      cancelEdit();
    } catch (error) {
      console.error('Error updating meal:', error);
    }
  }

  function confirmDelete(meal: Meal) {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Meal",
      message: `Are you sure you want to delete "${meal.mealName}" from ${meal.date.toDate().toLocaleDateString()}?`,
      onConfirm: () => handleDelete(meal.id)
    });
  }

  async function handleDelete(id: string) {
    try {
      await deleteMeal(id);
      await loadMeals();
      setConfirmDialog({ ...confirmDialog, isOpen: false });
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  }

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
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        confirmText="Delete"
        variant="danger"
      />
    </main>
  );
}
