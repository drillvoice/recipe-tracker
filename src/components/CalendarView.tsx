import { useState, useCallback, useEffect, useMemo } from "react";
import { Timestamp } from "firebase/firestore";
import ConfirmDialog from "@/components/ConfirmDialog";
import ActionButton from "@/components/ActionButton";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useMeals } from "@/hooks/useMeals";
import type { Meal } from "@/lib/offline-storage";

interface CalendarViewProps {
  refreshTrigger?: number;
}

interface DayCell {
  date: number;
  isCurrentMonth: boolean;
  hasData: boolean;
}

export default function CalendarView({ refreshTrigger }: CalendarViewProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMealName, setEditMealName] = useState("");
  const [editDate, setEditDate] = useState("");

  const { dialogProps, showDialog } = useConfirmDialog();
  const { meals, loadMeals, updateMealData, deleteMealData } = useMeals();

  // Refresh meals when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === null) {
      return;
    }
    loadMeals();
  }, [refreshTrigger, loadMeals]);

  // Group meals by date (YYYY-MM-DD format)
  const mealsByDate = useMemo(() => {
    const grouped: Record<string, Meal[]> = {};
    meals.forEach(meal => {
      const mealDate = meal.date.toDate();
      const dateKey = `${mealDate.getFullYear()}-${String(mealDate.getMonth() + 1).padStart(2, '0')}-${String(mealDate.getDate()).padStart(2, '0')}`;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });
    return grouped;
  }, [meals]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const days: DayCell[] = [];

    // Add previous month's trailing days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: prevMonthLastDay - i,
        isCurrentMonth: false,
        hasData: false
      });
    }

    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        date: day,
        isCurrentMonth: true,
        hasData: !!mealsByDate[dateKey]
      });
    }

    // Add next month's leading days to complete the grid
    const remainingCells = 42 - days.length; // 6 rows × 7 days
    for (let day = 1; day <= remainingCells; day++) {
      days.push({
        date: day,
        isCurrentMonth: false,
        hasData: false
      });
    }

    return days;
  }, [currentYear, currentMonth, mealsByDate]);

  // Get dishes for selected date
  const selectedDishes = useMemo(() => {
    if (!selectedDate) return [];
    return mealsByDate[selectedDate] || [];
  }, [selectedDate, mealsByDate]);

  // Count dishes for current month
  const dishCount = useMemo(() => {
    let count = 0;
    Object.keys(mealsByDate).forEach(dateKey => {
      const [year, month] = dateKey.split('-').map(Number);
      if (year === currentYear && month === currentMonth + 1) {
        count += mealsByDate[dateKey].length;
      }
    });
    return count;
  }, [mealsByDate, currentYear, currentMonth]);

  const handlePreviousMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
  }, [currentMonth, currentYear]);

  const handleNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
  }, [currentMonth, currentYear]);

  const handleDayClick = useCallback((day: DayCell) => {
    if (!day.isCurrentMonth || !day.hasData) return;

    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`;
    setSelectedDate(dateKey);
    setEditingId(null); // Cancel any ongoing edits
  }, [currentYear, currentMonth]);

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

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMealData(id);
      // If no more dishes for this date, clear selection
      const remainingDishes = selectedDishes.filter(d => d.id !== id);
      if (remainingDishes.length === 0) {
        setSelectedDate(null);
      }
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  }, [deleteMealData, selectedDishes]);

  const confirmDelete = useCallback((meal: Meal) => {
    showDialog(
      "Delete Dish",
      `Are you sure you want to delete "${meal.mealName}" from ${meal.date.toDate().toLocaleDateString()}?`,
      () => handleDelete(meal.id)
    );
  }, [handleDelete, showDialog]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getSelectedDateDisplay = () => {
    if (!selectedDate) return "";
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
    const monthName = monthNames[month - 1];
    return `${dayName}, ${monthName} ${day}`;
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button
          className="calendar-nav-button"
          onClick={handlePreviousMonth}
          aria-label="Previous month"
        >
          &lt;
        </button>
        <h2 className="calendar-title">
          {monthNames[currentMonth]} {currentYear}
        </h2>
        <button
          className="calendar-nav-button"
          onClick={handleNextMonth}
          aria-label="Next month"
        >
          &gt;
        </button>
      </div>

      <div className="calendar-grid">
        {dayNames.map(dayName => (
          <div key={dayName} className="calendar-day-name">
            {dayName}
          </div>
        ))}
        {calendarDays.map((day, index) => {
          const dateKey = day.isCurrentMonth
            ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`
            : '';
          const isSelected = dateKey === selectedDate;

          return (
            <button
              key={index}
              className={`calendar-day ${!day.isCurrentMonth ? 'calendar-day-other-month' : ''} ${day.hasData ? 'calendar-day-has-dish' : ''} ${isSelected ? 'calendar-day-selected' : ''}`}
              onClick={() => handleDayClick(day)}
              disabled={!day.isCurrentMonth || !day.hasData}
            >
              {day.date}
            </button>
          );
        })}
      </div>

      {selectedDate && selectedDishes.length > 0 && (
        <div className="calendar-selected-dishes">
          <div className="calendar-selected-date-header">
            {getSelectedDateDisplay()}
          </div>
          <div className="calendar-dishes-list">
            {selectedDishes.map(meal => {
              const isEditing = editingId === meal.id;
              return (
                <div key={meal.id} className="calendar-dish-row">
                  {isEditing ? (
                    <div className="calendar-dish-edit">
                      <input
                        type="text"
                        value={editMealName}
                        onChange={(e) => setEditMealName(e.target.value)}
                        className="edit-input"
                        placeholder="Dish name"
                      />
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="edit-input"
                      />
                      <div className="action-buttons">
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
                      </div>
                    </div>
                  ) : (
                    <div className="calendar-dish-view">
                      <span className="calendar-dish-name">{meal.mealName}</span>
                      <div className="action-buttons">
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
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="calendar-summary">
        You've cooked <span className="calendar-summary-count">{dishCount}</span> dish{dishCount === 1 ? '' : 'es'} this month!
      </div>

      <ConfirmDialog
        {...dialogProps}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
