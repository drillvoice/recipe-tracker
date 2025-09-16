import { useState, useCallback, useMemo } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Navigation from "@/components/Navigation";
import IdeasTableRow from "@/components/IdeasTableRow";
import { TagFilterBar } from "@/components/TagFilterBar";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useIdeas, type Idea } from "@/hooks/useIdeas";

export default function Ideas() {
  const [showHidden, setShowHidden] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const { dialogProps, showDialog } = useConfirmDialog();
  const { ideas, isLoading, error, toggleMealVisibility } = useIdeas();

  const confirmHide = useCallback((idea: Idea) => {
    showDialog(
      idea.hidden ? "Show Meal" : "Hide Meal",
      idea.hidden 
        ? `Show "${idea.mealName}" in ideas list?`
        : `Hide "${idea.mealName}" from ideas list?`,
      () => handleToggleHidden(idea.mealName, !idea.hidden)
    );
  }, [showDialog]);

  const handleToggleHidden = useCallback(async (mealName: string, hidden: boolean) => {
    try {
      await toggleMealVisibility(mealName, hidden);
    } catch (error) {
      console.error('Error toggling meal visibility:', error);
    }
  }, [toggleMealVisibility]);

  const visibleIdeas = useMemo(() => {
    let filtered = ideas.filter(idea => showHidden || !idea.hidden);

    // Filter by selected tags (OR logic - show ideas that have any of the selected tags)
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter(idea =>
        idea.tags.some(tagId => selectedTagIds.includes(tagId))
      );
    }

    return filtered;
  }, [ideas, showHidden, selectedTagIds]);

  const hiddenCount = useMemo(() =>
    ideas.filter(i => i.hidden).length,
    [ideas]
  );

  if (error) {
    return (
      <main className="container">
        <Navigation currentPage="ideas" />
        <h1>Ideas</h1>
        <p className="error-message">Error loading meals: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <Navigation currentPage="ideas" />
      <div className="page-header">
        <h1>Ideas</h1>
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
        <div className="ideas-filters space-y-4">
          <TagFilterBar
            selectedTagIds={selectedTagIds}
            onTagsChange={setSelectedTagIds}
          />

          <div className="ideas-filters-row">
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
              />
              <span className="filter-label">Show Hidden</span>
            </label>
          </div>
        </div>
      )}

      {isLoading ? (
        <p>Loading meals...</p>
      ) : visibleIdeas.length > 0 ? (
        <>
          <p className="subtitle">
            {visibleIdeas.length} unique meal{visibleIdeas.length === 1 ? "" : "s"}
            {showHidden && hiddenCount > 0 && (
              <span className="hidden-count"> ({hiddenCount} hidden)</span>
            )}
          </p>
          <table className="ideas-table">
            <thead>
              <tr>
                <th>Meal</th>
                <th>Last Made</th>
                <th>Count</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleIdeas.map(idea => (
                <IdeasTableRow
                  key={idea.mealName}
                  idea={idea}
                  onConfirmHide={confirmHide}
                  onTagsUpdated={() => {
                    // This will trigger a re-render to show updated tags
                    // The useIdeas hook will handle the data refresh
                  }}
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

