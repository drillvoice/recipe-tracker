import { useState, useCallback, useMemo } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Navigation from "@/components/Navigation";
import IdeasTableRow from "@/components/IdeasTableRow";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useIdeas, type Idea } from "@/hooks/useIdeas";

export default function Ideas() {
  const [showHidden, setShowHidden] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { dialogProps, showDialog } = useConfirmDialog();
  const { ideas, isLoading, error, toggleMealVisibility, updateMealTags } = useIdeas();

  const confirmHide = useCallback((idea: Idea) => {
    showDialog(
      idea.hidden ? "Show Meal" : "Hide Meal",
      idea.hidden
        ? `Show "${idea.mealName}" in ideas list?`
        : `Hide "${idea.mealName}" from ideas list?`,
      () => handleToggleHidden(idea.mealName, !idea.hidden)
    );
  }, [showDialog]);

  const directToggleHidden = useCallback(async (idea: Idea) => {
    await handleToggleHidden(idea.mealName, !idea.hidden);
  }, []);

  const handleToggleHidden = useCallback(async (mealName: string, hidden: boolean) => {
    try {
      await toggleMealVisibility(mealName, hidden);
    } catch (error) {
      console.error('Error toggling meal visibility:', error);
    }
  }, [toggleMealVisibility]);

  const visibleIdeas = useMemo(() =>
    ideas.filter(idea => showHidden || !idea.hidden),
    [ideas, showHidden]
  );

  const hiddenCount = useMemo(() =>
    ideas.filter(i => i.hidden).length,
    [ideas]
  );

  if (error) {
    return (
      <main className="container">
        <Navigation currentPage="dishes" />
        <h1>Dishes</h1>
        <p className="error-message">Error loading meals: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <Navigation currentPage="dishes" />
      <div className="page-header">
        <h1>Dishes</h1>
        {ideas.length > 0 && (
          <button 
            className="filter-button"
            onClick={() => setShowFilters(!showFilters)}
            title="Filter options"
          >
            🔍
          </button>
        )}
      </div>
      
      {showFilters && ideas.length > 0 && (
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

      {isLoading ? (
        <p>Loading meals...</p>
      ) : visibleIdeas.length > 0 ? (
        <>
          <p className="subtitle">
            {visibleIdeas.length} unique dish{visibleIdeas.length === 1 ? "" : "es"}
            {showHidden && hiddenCount > 0 && (
              <span className="hidden-count"> ({hiddenCount} hidden)</span>
            )}
          </p>
          <table className="ideas-table">
            <thead>
              <tr>
                <th>Dish</th>
                <th>Last Made</th>
                <th>Tags</th>
                <th>Info</th>
              </tr>
            </thead>
            <tbody>
              {visibleIdeas.map(idea => (
                <IdeasTableRow
                  key={idea.mealName}
                  idea={idea}
                  onConfirmHide={confirmHide}
                  onDirectHide={directToggleHidden}
                  onTagsUpdated={updateMealTags}
                />
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>{showHidden ? "No meals recorded." : "No visible meals. Toggle 'Show Hidden' to see hidden meals."}</p>
      )}

      <ConfirmDialog
        {...dialogProps}
        confirmText="Confirm"
      />
    </main>
  );
}

