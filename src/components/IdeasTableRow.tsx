import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ActionButton from '@/components/ActionButton';
import TagActionsModal from '@/components/TagActionsModal';
import {
  TagManager,
  TAG_COLORS,
  TAG_MANAGEMENT_UPDATED_EVENT,
  type TagCategory,
  type TagManagementData
} from '@/lib/tag-manager';
import type { Idea } from '@/hooks/useIdeas';

interface IdeasTableRowProps {
  idea: Idea;
  onConfirmHide: (idea: Idea) => void;
  onDirectHide?: (idea: Idea) => void;
  onTagsUpdated?: (mealName: string, tags: string[]) => void;
  allIdeas?: Idea[]; // For extracting all existing tags for autocomplete
}

const IdeasTableRow = React.memo<IdeasTableRowProps>(({
  idea,
  onConfirmHide,
  onDirectHide,
  onTagsUpdated,
  allIdeas = []
}) => {
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tagMetadata, setTagMetadata] = useState<TagManagementData['tags']>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const [filteredTagSuggestions, setFilteredTagSuggestions] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearLongPress();
    };
  }, [clearLongPress]);

  const handleTagModalClose = useCallback(() => {
    clearLongPress();
    setIsTagModalOpen(false);
    setSelectedTag(null);
  }, [clearLongPress]);

  const handleTagUpdate = useCallback((mealName: string, updatedTags: string[]) => {
    onTagsUpdated?.(mealName, updatedTags);
    handleTagModalClose();
  }, [handleTagModalClose, onTagsUpdated]);

  const openTagModal = useCallback((tag: string) => {
    if (!onTagsUpdated) {
      return;
    }

    setSelectedTag(tag);
    setIsTagModalOpen(true);
  }, [onTagsUpdated]);

  const startLongPress = useCallback((tag: string) => {
    if (!onTagsUpdated) {
      return;
    }

    clearLongPress();
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTimeoutRef.current = null;
      openTagModal(tag);
    }, 500);
  }, [clearLongPress, onTagsUpdated, openTagModal]);

  const handlePointerDown = useCallback((tag: string) => (event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) {
      return;
    }

    startLongPress(tag);
  }, [startLongPress]);

  const handlePointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handlePointerLeave = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleContextMenu = useCallback((tag: string) => (event: React.MouseEvent<HTMLSpanElement>) => {
    if (!onTagsUpdated) {
      return;
    }

    event.preventDefault();
    clearLongPress();
    openTagModal(tag);
  }, [clearLongPress, onTagsUpdated, openTagModal]);

  const handleKeyDown = useCallback((tag: string) => (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (!onTagsUpdated) {
      return;
    }

    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'Space' ||
      event.key === 'Spacebar' ||
      event.key === 'ContextMenu' ||
      (event.key === 'F10' && event.shiftKey)
    ) {
      event.preventDefault();
      openTagModal(tag);
    }
  }, [onTagsUpdated, openTagModal]);

  // Load categories and tag metadata once and refresh when tag settings change
  useEffect(() => {
    const loadTagManagementData = () => {
      const data = TagManager.getTagManagementData();
      setCategories(data.categories);
      setTagMetadata(data.tags);
    };

    loadTagManagementData();

    if (typeof window === 'undefined') {
      return;
    }

    const handleTagManagementUpdate = () => {
      loadTagManagementData();
    };

    window.addEventListener(
      TAG_MANAGEMENT_UPDATED_EVENT,
      handleTagManagementUpdate
    );

    return () => {
      window.removeEventListener(
        TAG_MANAGEMENT_UPDATED_EVENT,
        handleTagManagementUpdate
      );
    };
  }, []);

  const getTagColor = useCallback(
    (tagName: string): string => {
      const metadata = tagMetadata[tagName];

      const customColor = metadata?.customColor;
      if (customColor && TAG_COLORS[customColor]) {
        return TAG_COLORS[customColor];
      }

      const categoryId = metadata?.category;
      if (categoryId) {
        const category = categories.find(c => c.id === categoryId);
        if (category) {
          return TAG_COLORS[category.color];
        }
      }

      return TAG_COLORS.gray;
    },
    [categories, tagMetadata]
  );

  // Use the tags from the idea data
  const tagStrings = useMemo(() => idea.tags ?? [], [idea.tags]);

  // Extract all unique tags from all ideas for autocomplete suggestions
  const allExistingTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const ideaItem of allIdeas) {
      if (ideaItem.tags) {
        for (const tag of ideaItem.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [allIdeas]);

  // Handle tag input changes with autocomplete filtering
  const handleTagInputChange = useCallback((value: string) => {
    setNewTagInput(value);

    if (value.trim() === "") {
      setFilteredTagSuggestions([]);
      setShowTagSuggestions(false);
      return;
    }

    // Filter tags using substring matching (case-insensitive)
    const filtered = allExistingTags.filter(tag =>
      tag.toLowerCase().includes(value.toLowerCase()) &&
      !tagStrings.includes(tag) // Don't suggest tags already applied to this dish
    );

    setFilteredTagSuggestions(filtered);
    setShowTagSuggestions(filtered.length > 0);
  }, [allExistingTags, tagStrings]);

  // Select a suggestion from the autocomplete dropdown
  const selectTagSuggestion = useCallback((suggestion: string) => {
    setNewTagInput(suggestion);
    setShowTagSuggestions(false);
    setFilteredTagSuggestions([]);
  }, []);

  const handleAddTag = useCallback(() => {
    const trimmedTag = newTagInput.trim();
    if (trimmedTag && !tagStrings.includes(trimmedTag)) {
      const updatedTags = [...tagStrings, trimmedTag];
      onTagsUpdated?.(idea.mealName, updatedTags);
    }
    setNewTagInput('');
    setShowTagInput(false);
  }, [newTagInput, tagStrings, idea.mealName, onTagsUpdated]);

  const handleCancelTag = useCallback(() => {
    setNewTagInput('');
    setShowTagInput(false);
    setShowTagSuggestions(false);
    setFilteredTagSuggestions([]);
  }, []);

  const handleHideClick = useCallback(() => {
    if (idea.hidden) {
      // If already hidden, show directly without confirmation
      onConfirmHide(idea);
    } else {
      // If visible, show confirmation
      setShowHideConfirm(true);
    }
  }, [idea, onConfirmHide]);

  const handleConfirmHide = useCallback(() => {
    // Use direct hide to bypass additional confirmation
    if (onDirectHide) {
      onDirectHide(idea);
    } else {
      onConfirmHide(idea);
    }
    setShowHideConfirm(false);
  }, [idea, onConfirmHide, onDirectHide]);

  const handleCancelHide = useCallback(() => {
    setShowHideConfirm(false);
  }, []);
  const renderedTagChips = useMemo(
    () =>
      tagStrings.map(tag => {
        const backgroundColor = getTagColor(tag);
        const textColor =
          backgroundColor === TAG_COLORS.yellow ||
          backgroundColor === TAG_COLORS.beige
            ? '#374151'
            : '#1f2937';
        const interactive = Boolean(onTagsUpdated);

        return (
          <span
            key={tag}
            className={`tag-chip-small${interactive ? ' interactive-tag-chip' : ''}`}
            style={{
              backgroundColor,
              color: textColor
            }}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `Show options for tag ${tag}` : undefined}
            aria-haspopup={interactive ? 'dialog' : undefined}
            title={interactive ? 'Press and hold, right-click, or use the keyboard for tag actions' : undefined}
            onPointerDown={interactive ? handlePointerDown(tag) : undefined}
            onPointerUp={interactive ? handlePointerUp : undefined}
            onPointerLeave={interactive ? handlePointerLeave : undefined}
            onPointerCancel={interactive ? handlePointerUp : undefined}
            onContextMenu={interactive ? handleContextMenu(tag) : undefined}
            onKeyDown={interactive ? handleKeyDown(tag) : undefined}
          >
            {tag}
          </span>
        );
      }),
    [
      getTagColor,
      handleContextMenu,
      handleKeyDown,
      handlePointerDown,
      handlePointerLeave,
      handlePointerUp,
      onTagsUpdated,
      tagStrings
    ]
  );

  return (
    <>
      {isTagModalOpen && selectedTag && onTagsUpdated && (
        <TagActionsModal
          mealName={idea.mealName}
          tag={selectedTag}
          tags={tagStrings}
          onClose={handleTagModalClose}
          onTagsUpdated={handleTagUpdate}
        />
      )}

      <tr key={idea.mealName} className={idea.hidden ? 'hidden-meal' : ''}>
        <td
          className="dish-name-cell"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {idea.mealName}
        </td>
        <td>
          {idea.lastMade
            .toDate()
            .toLocaleDateString('en-GB', {
              day: "numeric",
              month: "numeric",
            })}
        </td>
        <td className="tags-cell">
          <div className="tags-container">
            {renderedTagChips}
            {tagStrings.length === 0 && (
              <span className="no-tags">—</span>
            )}
          </div>
        </td>
        <td>
          <ActionButton
            icon="ℹ️"
            onClick={() => setIsExpanded(!isExpanded)}
            title="Show details"
            variant="default"
          />
        </td>
      </tr>

      {isExpanded && (
        <tr className="expanded-row">
          <td colSpan={4}>
            <div className="expanded-content">
              <div className="expanded-section">
                <div className="dish-stats">
                  <span className="count-info">Made {idea.count} time{idea.count === 1 ? '' : 's'}</span>
                </div>
              </div>

              <div className="expanded-section">
                <div className="tag-management-section">
                  {!showTagInput ? (
                    <button
                      onClick={() => setShowTagInput(true)}
                      className="add-tag-button"
                    >
                      + Add Tag
                    </button>
                  ) : (
                    <div className="inline-tag-input">
                      <div className="tag-autocomplete-container">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => handleTagInputChange(e.target.value)}
                          onFocus={() => {
                            if (newTagInput.trim() && filteredTagSuggestions.length > 0) {
                              setShowTagSuggestions(true);
                            }
                          }}
                          onBlur={() => {
                            // Delay hiding to allow clicks on suggestions
                            setTimeout(() => setShowTagSuggestions(false), 150);
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            } else if (e.key === 'Escape') {
                              handleCancelTag();
                            }
                          }}
                          placeholder="Enter tag name..."
                          className="tag-input-field"
                          autoFocus
                        />
                        {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                          <div className="tag-suggestions-dropdown">
                            {filteredTagSuggestions.slice(0, 5).map(suggestion => (
                              <button
                                key={suggestion}
                                type="button"
                                className="tag-suggestion-item"
                                onClick={() => selectTagSuggestion(suggestion)}
                                onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleAddTag}
                        disabled={!newTagInput.trim()}
                        className="tag-save-btn"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelTag}
                        className="tag-cancel-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="expanded-section">
                <div className="visibility-section">
                  {!showHideConfirm ? (
                    <button
                      onClick={handleHideClick}
                      className={idea.hidden ? "show-button" : "hide-button"}
                    >
                      {idea.hidden ? "Show" : "Hide"}
                    </button>
                  ) : (
                    <div className="hide-confirmation">
                      <span className="hide-confirm-text">Hide "{idea.mealName}"?</span>
                      <button
                        onClick={handleConfirmHide}
                        className="confirm-hide-btn"
                      >
                        Yes, Hide
                      </button>
                      <button
                        onClick={handleCancelHide}
                        className="cancel-hide-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

IdeasTableRow.displayName = 'IdeasTableRow';

export default IdeasTableRow;