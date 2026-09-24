import { useState, useCallback, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import ConfirmDialog from "@/components/ConfirmDialog";
import HistoryTableRow from "@/components/HistoryTableRow";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useMeals } from "@/hooks/useMeals";
import type { Meal } from "@/lib/offline-storage";
import { toLocalDateKey, fromLocalDateKey } from "@/utils/date";

interface HistoryAccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  refreshTrigger?: number; // Optional prop to trigger refresh
}

export default function HistoryAccordion({ isOpen, onToggle, refreshTrigger }: HistoryAccordionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMealName, setEditMealName] = useState("");
  const [editDate, setEditDate] = useState("");
  const { dialogProps, showDialog } = useConfirmDialog();
  const { meals, isLoading, error, loadMeals, updateMealData, deleteMealData } = useMeals();

  // Refresh meals when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === null) {
      return;
    }

    loadMeals();
  }, [refreshTrigger, loadMeals]);

  const startEdit = useCallback((meal: Meal) => {
    setEditingId(meal.id);
    setEditMealName(meal.mealName);
    setEditDate(toLocalDateKey(meal.date.toDate()));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditMealName("");
    setEditDate("");
  }, []);

  const saveEdit = useCallback(async () => {
    const trimmedName = editMealName.trim();
    // Ignore saves that would blank the name or clear the date
    if (!editingId || !trimmedName || !editDate) return;

    try {
      await updateMealData(editingId, {
        mealName: trimmedName,
        date: Timestamp.fromDate(fromLocalDateKey(editDate))
      });
      cancelEdit();
    } catch (error) {
      console.error('Error updating dish:', error);
    }
  }, [editingId, editMealName, editDate, updateMealData, cancelEdit]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMealData(id);
    } catch (error) {
      console.error('Error deleting dish:', error);
    }
  }, [deleteMealData]);

  const confirmDelete = useCallback((meal: Meal) => {
    showDialog(
      "Delete Dish",
      `Are you sure you want to delete "${meal.mealName}" from ${meal.date.toDate().toLocaleDateString()}?`,
      () => handleDelete(meal.id)
    );
  }, [handleDelete, showDialog]);

  const handleEditMealNameChange = useCallback((value: string) => {
    setEditMealName(value);
  }, []);

  const handleEditDateChange = useCallback((value: string) => {
    setEditDate(value);
  }, []);

  if (error) {
    return (
      <div className="history-accordion">
        <button className="history-accordion-header" onClick={onToggle}>
          <span>History</span>
          <span className="accordion-icon">{isOpen ? "▼" : "▶"}</span>
        </button>
        {isOpen && (
          <div className="history-accordion-content">
            <p className="error-message">Error loading dishes: {error.message}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="history-accordion">
      <button className="history-accordion-header" onClick={onToggle}>
        <span>History ({meals.length} dish{meals.length === 1 ? "" : "es"})</span>
        <span className="accordion-icon">{isOpen ? "▼" : "▶"}</span>
      </button>

      {isOpen && (
        <div className="history-accordion-content">
          {isLoading ? (
            <p>Loading dishes...</p>
          ) : meals.length > 0 ? (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Dish</th>
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
          ) : (
            <p>No dishes recorded.</p>
          )}
        </div>
      )}

      <ConfirmDialog
        {...dialogProps}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}