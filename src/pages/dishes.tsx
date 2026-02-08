import { useState, useCallback, useMemo } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Navigation from "@/components/Navigation";
import IdeasTableRow from "@/components/IdeasTableRow";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useIdeas, type Idea } from "@/hooks/useIdeas";

type DateFilterOption = "any" | "7days" | "14days" | "21days" | "28days";
type TagFilterMode = "OR" | "AND";

export default function Ideas() {
  const [showHidden, setShowHidden] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("any");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [tagFilterMode, setTagFilterMode] = useState<TagFilterMode>("OR");
  const { dialogProps, showDialog } = useConfirmDialog();
  const { ideas, isLoading, error, toggleMealVisibility, updateMealTags, renameDishAllInstances, deleteAllInstancesOfDish } = useIdeas();

  const handleToggleHidden = useCallback(async (mealName: string, hidden: boolean) => {
    try {
      await toggleMealVisibility(mealName, hidden);
    } catch (error) {
      console.error('Error toggling meal visibility:', error);
    }
  }, [toggleMealVisibility]);

  const confirmHide = useCallback((idea: Idea) => {
    if (idea.hidden) {
      // Show directly without confirmation
      handleToggleHidden(idea.mealName, false);
    } else {
      // Show confirmation when hiding
      showDialog(
        "Hide Dish",
        `Hide "${idea.mealName}" from dishes list?`,
        () => handleToggleHidden(idea.mealName, true)
      );
    }
  }, [showDialog, handleToggleHidden]);

  // Extract all unique tags from all ideas
  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    ideas.forEach(idea => {
      idea.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [ideas]);

  // Toggle tag selection
  const toggleTagSelection = useCallback((tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  }, []);

  // Clear all tag filters
  const clearTagFilters = useCallback(() => {
    setSelectedTags(new Set());
  }, []);

  // Filter ideas based on date, tags, and hidden status
  const visibleIdeas = useMemo(() => {
    let filtered = ideas;

    // Filter by hidden status
    if (!showHidden) {
      filtered = filtered.filter(idea => !idea.hidden);
    }

    // Filter by date
    if (dateFilter !== "any") {
      const now = Date.now();
      const daysMap: Record<Exclude<DateFilterOption, "any">, number> = {
        "7days": 7,
        "14days": 14,
        "21days": 21,
        "28days": 28,
      };
      const days = daysMap[dateFilter];
      const cutoffTime = now - (days * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(idea => {
        const lastMadeTime = idea.lastMade.toMillis();
        return lastMadeTime < cutoffTime;
      });
    }

    // Filter by tags with AND/OR logic
    if (selectedTags.size > 0) {
      if (tagFilterMode === "OR") {
        // OR logic - show dishes with ANY selected tag
        filtered = filtered.filter(idea =>
          idea.tags?.some(tag => selectedTags.has(tag))
        );
      } else {
        // AND logic - show dishes with ALL selected tags
        filtered = filtered.filter(idea =>
          Array.from(selectedTags).every(selectedTag => idea.tags?.includes(selectedTag))
        );
      }
    }

    return filtered;
  }, [ideas, showHidden, dateFilter, selectedTags, tagFilterMode]);

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
        <button
          className="filter-button"
          onClick={() => setShowFilters(!showFilters)}
          title="Filter options"
        >
          🔍 Filter
        </button>
      </div>

      {showFilters && (
        <div className="ideas-filters">
          <h3 className="filter-section-title">Filters</h3>

          {/* Date Filter */}
          <div className="filter-section">
            <label className="filter-label">
              Last made {dateFilter !== "any" ? `${dateFilter.replace("days", "")}+ days ago` : "...days ago"}
            </label>
            <div className="date-filter-chips">
              <button
                className={`date-filter-chip ${dateFilter === "7days" ? 'selected' : ''}`}
                onClick={() => setDateFilter(dateFilter === "7days" ? "any" : "7days")}
              >
                7
              </button>
              <button
                className={`date-filter-chip ${dateFilter === "14days" ? 'selected' : ''}`}
                onClick={() => setDateFilter(dateFilter === "14days" ? "any" : "14days")}
              >
                14
              </button>
              <button
                className={`date-filter-chip ${dateFilter === "21days" ? 'selected' : ''}`}
                onClick={() => setDateFilter(dateFilter === "21days" ? "any" : "21days")}
              >
                21
              </button>
              <button
                className={`date-filter-chip ${dateFilter === "28days" ? 'selected' : ''}`}
                onClick={() => setDateFilter(dateFilter === "28days" ? "any" : "28days")}
              >
                28
              </button>
            </div>
          </div>

          {/* Clear Date Filter */}
          {dateFilter !== "any" && (
            <div className="filter-section" style={{ marginTop: '-0.75rem', marginBottom: '0.5rem' }}>
              <button
                className="clear-tags-button"
                onClick={() => setDateFilter("any")}
                title="Clear date filter"
              >
                Clear date filter
              </button>
            </div>
          )}

          {/* Tag Filter */}
          {allUniqueTags.length > 0 && (
            <div className="filter-section">
              <div className="filter-label-row">
                <label className="filter-label">Tags</label>
                {selectedTags.size > 0 && (
                  <button
                    className="clear-tags-button"
                    onClick={clearTagFilters}
                    title="Clear tag filters"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="tag-filter-chips">
                {allUniqueTags.map(tag => (
                  <button
                    key={tag}
                    className={`tag-filter-chip ${selectedTags.has(tag) ? 'selected' : ''}`}
                    onClick={() => toggleTagSelection(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {selectedTags.size > 1 && (
                <div className="tag-logic-toggle">
                  <label className="filter-label" style={{ marginBottom: '0.5rem' }}>Match:</label>
                  <div className="tag-logic-buttons">
                    <button
                      className={`tag-logic-button ${tagFilterMode === "OR" ? 'selected' : ''}`}
                      onClick={() => setTagFilterMode("OR")}
                      title="Show dishes with ANY selected tag"
                    >
                      Any tag (OR)
                    </button>
                    <button
                      className={`tag-logic-button ${tagFilterMode === "AND" ? 'selected' : ''}`}
                      onClick={() => setTagFilterMode("AND")}
                      title="Show dishes with ALL selected tags"
                    >
                      All tags (AND)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show Hidden Toggle */}
          {hiddenCount > 0 && (
            <div className="filter-section">
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
        </div>
      )}

      {isLoading ? (
        <p>Loading meals...</p>
      ) : visibleIdeas.length > 0 ? (
        <>
          <p className="subtitle">
            {dateFilter !== "any" || selectedTags.size > 0 || !showHidden ? (
              <>
                {visibleIdeas.length} of {ideas.length} dish{ideas.length === 1 ? "" : "es"}
                {showHidden && hiddenCount > 0 && (
                  <span className="hidden-count"> ({hiddenCount} hidden)</span>
                )}
              </>
            ) : (
              <>
                {visibleIdeas.length} unique dish{visibleIdeas.length === 1 ? "" : "es"}
                {showHidden && hiddenCount > 0 && (
                  <span className="hidden-count"> ({hiddenCount} hidden)</span>
                )}
              </>
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
                  onTagsUpdated={updateMealTags}
                  onRenameDish={renameDishAllInstances}
                  onDeleteAllInstances={deleteAllInstancesOfDish}
                  allExistingTags={allUniqueTags}
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

