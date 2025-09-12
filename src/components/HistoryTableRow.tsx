import React from 'react';
import ActionButton from '@/components/ActionButton';
import type { Meal } from '@/lib/mealsStore';

interface HistoryTableRowProps {
  meal: Meal;
  editingId: string | null;
  editMealName: string;
  editDate: string;
  onStartEdit: (meal: Meal) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onConfirmDelete: (meal: Meal) => void;
  onEditMealNameChange: (value: string) => void;
  onEditDateChange: (value: string) => void;
}

const HistoryTableRow = React.memo<HistoryTableRowProps>(({
  meal,
  editingId,
  editMealName,
  editDate,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onConfirmDelete,
  onEditMealNameChange,
  onEditDateChange
}) => {
  const isEditing = editingId === meal.id;

  return (
    <tr key={meal.id}>
      <td>
        {isEditing ? (
          <input
            type="date"
            value={editDate}
            onChange={(e) => onEditDateChange(e.target.value)}
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
        {isEditing ? (
          <input
            type="text"
            value={editMealName}
            onChange={(e) => onEditMealNameChange(e.target.value)}
            className="edit-input"
          />
        ) : (
          meal.mealName
        )}
      </td>
      <td>
        <div className="action-buttons">
          {isEditing ? (
            <>
              <ActionButton
                icon="✓"
                onClick={onSaveEdit}
                title="Save changes"
                variant="success"
              />
              <ActionButton
                icon="✕"
                onClick={onCancelEdit}
                title="Cancel editing"
              />
            </>
          ) : (
            <>
              <ActionButton
                icon="✏️"
                onClick={() => onStartEdit(meal)}
                title="Edit meal"
              />
              <ActionButton
                icon="🗑️"
                onClick={() => onConfirmDelete(meal)}
                title="Delete meal"
                variant="danger"
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
});

HistoryTableRow.displayName = 'HistoryTableRow';

export default HistoryTableRow;