import React, { useState, useCallback } from 'react';
import ActionButton from '@/components/ActionButton';
import type { Idea } from '@/hooks/useIdeas';

interface TagManagementSectionProps {
  idea: Idea;
  tagStrings: string[];
  allExistingTags: string[];
  getTagColor: (tagName: string) => string;
  onTagsUpdated?: (mealName: string, tags: string[]) => void;
}

export const TagManagementSection = React.memo<TagManagementSectionProps>(({
  idea,
  tagStrings,
  allExistingTags,
  getTagColor,
  onTagsUpdated
}) => {
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [filteredTagSuggestions, setFilteredTagSuggestions] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const handleTagInputChange = useCallback((value: string) => {
    setNewTagInput(value);
    if (value.trim() === '') {
      setFilteredTagSuggestions([]);
      setShowTagSuggestions(false);
      return;
    }

    const filtered = allExistingTags.filter(tag =>
      tag.toLowerCase().includes(value.toLowerCase()) &&
      !tagStrings.includes(tag)
    );
    setFilteredTagSuggestions(filtered);
    setShowTagSuggestions(filtered.length > 0);
  }, [allExistingTags, tagStrings]);

  const handleAddTag = useCallback(() => {
    const trimmedTag = newTagInput.trim();
    if (trimmedTag && !tagStrings.includes(trimmedTag)) {
      const newTags = [...tagStrings, trimmedTag];
      onTagsUpdated?.(idea.mealName, newTags);
    }
    setNewTagInput('');
    setShowTagInput(false);
    setShowTagSuggestions(false);
  }, [newTagInput, tagStrings, idea.mealName, onTagsUpdated]);

  const handleCancelTag = useCallback(() => {
    setNewTagInput('');
    setShowTagInput(false);
    setShowTagSuggestions(false);
  }, []);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const newTags = tagStrings.filter(tag => tag !== tagToRemove);
    onTagsUpdated?.(idea.mealName, newTags);
  }, [tagStrings, idea.mealName, onTagsUpdated]);

  const selectSuggestion = useCallback((suggestion: string) => {
    setNewTagInput(suggestion);
    setShowTagSuggestions(false);
    // Auto-add the selected suggestion
    if (!tagStrings.includes(suggestion)) {
      const newTags = [...tagStrings, suggestion];
      onTagsUpdated?.(idea.mealName, newTags);
    }
    setNewTagInput('');
    setShowTagInput(false);
  }, [tagStrings, idea.mealName, onTagsUpdated]);

  return (
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
                      onClick={() => selectSuggestion(suggestion)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="tag-input-buttons">
              <ActionButton
                icon="✓"
                onClick={handleAddTag}
                title="Add tag"
                variant="success"
              />
              <ActionButton
                icon="✕"
                onClick={handleCancelTag}
                title="Cancel"
                variant="default"
              />
            </div>
          </div>
        )}

        {/* Existing tags list for this dish */}
        {tagStrings.length > 0 && (
          <div className="existing-tags-list">
            <div className="tags-label">Current tags:</div>
            <div className="tags-container">
              {tagStrings.map(tag => (
                <span
                  key={tag}
                  className="tag-chip-small"
                  style={{ backgroundColor: getTagColor(tag) }}
                >
                  {tag}
                  <button
                    type="button"
                    className="tag-remove-btn"
                    onClick={() => handleRemoveTag(tag)}
                    title={`Remove ${tag} tag`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

TagManagementSection.displayName = 'TagManagementSection';