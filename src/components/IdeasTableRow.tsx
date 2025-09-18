import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '@/components/ActionButton';
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
  onTagsUpdated?: (mealName: string, tags: string[]) => void;
}

const IdeasTableRow = React.memo<IdeasTableRowProps>(({
  idea,
  onConfirmHide,
  onTagsUpdated
}) => {
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tagMetadata, setTagMetadata] = useState<TagManagementData['tags']>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

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

        return (
          <span
            key={tag}
            className="tag-chip-small"
            style={{
              backgroundColor,
              color: textColor
            }}
          >
            {tag}
          </span>
        );
      }),
    [tagStrings, getTagColor]
  );

  return (
    <>
      <tr key={idea.mealName} className={idea.hidden ? 'hidden-meal' : ''}>
        <td>{idea.mealName}</td>
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
                  <div className="section-header">
                    <span className="section-title">Tags</span>
                    <ActionButton
                      icon="🏷️"
                      onClick={() => setShowTagInput(!showTagInput)}
                      title="Add tag"
                      variant="default"
                    />
                  </div>

                  {showTagInput && (
                    <div className="inline-tag-input">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag();
                          } else if (e.key === 'Escape') {
                            handleCancelTag();
                          }
                        }}
                        placeholder="Enter tag name..."
                        className="form-input"
                        autoFocus
                      />
                      <button
                        onClick={handleAddTag}
                        disabled={!newTagInput.trim()}
                        className="primary-button"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelTag}
                        className="secondary-button"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="expanded-section">
                <div className="visibility-section">
                  <span className="section-title">Visibility</span>
                  <ActionButton
                    icon={idea.hidden ? "👁️" : "👁️‍🗨️"}
                    onClick={() => onConfirmHide(idea)}
                    title={idea.hidden ? "Show meal" : "Hide meal"}
                    variant="default"
                  />
                  <span className="visibility-status">
                    {idea.hidden ? "Hidden from list" : "Visible in list"}
                  </span>
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