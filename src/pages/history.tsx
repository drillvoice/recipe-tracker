import { useState, useCallback } from "react";
import { Timestamp } from "firebase/firestore";
import ConfirmDialog from "@/components/ConfirmDialog";
import Navigation from "@/components/Navigation";
import HistoryTableRow from "@/components/HistoryTableRow";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useMeals } from "@/hooks/useMeals";
import type { Meal } from "@/lib/mealsStore";

export default function History() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMealName, setEditMealName] = useState("");
  const [editDate, setEditDate] = useState("");
  const { dialogProps, showDialog } = useConfirmDialog();
  const { meals, isLoading, error, updateMealData, deleteMealData } = useMeals();

  const startEdit = useCallback((meal: Meal) => {
    setEditingId(meal.id);
    setEditMealName(meal.mealName);
    setEditDate(meal.date.toDate().toISOString().substring(0, 10));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditMealName("");
    setEditDate("");
  }, []);

  const saveEdit = useCallback(async () => {
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
  }, [editingId, editMealName, editDate, updateMealData, cancelEdit]);

  const confirmDelete = useCallback((meal: Meal) => {
    showDialog(
      "Delete Meal",
      `Are you sure you want to delete "${meal.mealName}" from ${meal.date.toDate().toLocaleDateString()}?`,
      () => handleDelete(meal.id)
    );
  }, [showDialog]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMealData(id);
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  }, [deleteMealData]);

  const handleEditMealNameChange = useCallback((value: string) => {
    setEditMealName(value);
  }, []);

  const handleEditDateChange = useCallback((value: string) => {
    setEditDate(value);
  }, []);

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
                <HistoryTableRow
                  key={meal.id}
                  meal={meal}
                  editingId={editingId}
                  editMealName={editMealName}
                  editDate={editDate}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onConfirmDelete={confirmDelete}
                  onEditMealNameChange={handleEditMealNameChange}
                  onEditDateChange={handleEditDateChange}
                />
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
