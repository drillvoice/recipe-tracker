import React, { useState, useEffect } from 'react';
import { getAllTagStrings } from '@/lib/offline-storage';

interface TagManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealName: string;
  currentTags: string[];
  onTagsUpdate: (tags: string[]) => void;
}

export function TagManagementModal({
  isOpen,
  onClose,
  mealName,
  currentTags,
  onTagsUpdate
}: TagManagementModalProps) {
  const [tags, setTags] = useState<string[]>([...currentTags]);
  const [newTag, setNewTag] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load all existing tags when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAllTags();
    }
  }, [isOpen]);

  async function loadAllTags() {
    try {
      const existingTags = await getAllTagStrings();
      setAllTags(existingTags);
    } catch (error) {
      console.error('Failed to load existing tags:', error);
    }
  }

  const handleTagInputChange = (value: string) => {
    setNewTag(value);
    if (value.trim() === '') {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Filter existing tags that match the input and aren't already added
    const filtered = allTags.filter(tag =>
      tag.toLowerCase().includes(value.toLowerCase()) &&
      !tags.includes(tag)
    );
    setFilteredSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setTags([...tags, suggestion]);
    setNewTag('');
    setShowSuggestions(false);
    setFilteredSuggestions([]);
  };

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setNewTag('');
      setShowSuggestions(false);
      setFilteredSuggestions([]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    onTagsUpdate(tags);
    onClose();
  };

  const handleCancel = () => {
    setTags([...currentTags]); // Reset to original tags
    setNewTag('');
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Manage Tags</h3>
          <p className="modal-subtitle">{mealName}</p>
        </div>

        <div className="modal-body">
          {/* Current tags */}
          {tags.length > 0 && (
            <div className="tags-section">
              <h4>Current Tags</h4>
              <div className="tags-list">
                {tags.map(tag => (
                  <span key={tag} className="tag-chip">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="tag-remove"
                      aria-label={`Remove ${tag} tag`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add new tag */}
          <div className="add-tag-section">
            <h4>Add New Tag</h4>
            <div className="add-tag-input">
              <div className="tag-autocomplete-container">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => handleTagInputChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => {
                    if (newTag.trim() && filteredSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding to allow clicks on suggestions
                    setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  placeholder="Enter tag name..."
                  className="tag-input"
                  autoFocus
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="tag-suggestions-dropdown">
                    {filteredSuggestions.slice(0, 5).map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        className="tag-suggestion-item"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent input blur
                          handleSuggestionClick(suggestion);
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                className="add-tag-btn"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={handleCancel} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save Changes
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 400px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          padding: 20px 20px 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .modal-subtitle {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .modal-body {
          padding: 20px;
          flex: 1;
          overflow-y: auto;
        }

        .tags-section {
          margin-bottom: 24px;
        }

        .tags-section h4,
        .add-tag-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f3f4f6;
          color: #374151;
          padding: 6px 8px 6px 12px;
          border-radius: 16px;
          font-size: 14px;
          border: 1px solid #d1d5db;
        }

        .tag-remove {
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 0;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          line-height: 1;
        }

        .tag-remove:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .add-tag-input {
          display: flex;
          gap: 8px;
        }

        .tag-autocomplete-container {
          position: relative;
          flex: 1;
        }

        .tag-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }

        .tag-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .tag-suggestions-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #d1d5db;
          border-top: none;
          border-radius: 0 0 6px 6px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-height: 150px;
          overflow-y: auto;
          z-index: 1001;
        }

        .tag-suggestion-item {
          width: 100%;
          padding: 8px 12px;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          color: #374151;
          font-size: 14px;
          transition: background-color 0.15s;
          display: block;
        }

        .tag-suggestion-item:hover {
          background: #f3f4f6;
        }

        .tag-suggestion-item:active {
          background: #e5e7eb;
        }

        .add-tag-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .add-tag-btn:disabled {
          background: #d1d5db;
          cursor: not-allowed;
        }

        .add-tag-btn:not(:disabled):hover {
          background: #2563eb;
        }

        .modal-footer {
          padding: 16px 20px 20px 20px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn-secondary {
          background: #f9fafb;
          color: #374151;
          border: 1px solid #d1d5db;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background: #f3f4f6;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        @media (max-width: 480px) {
          .modal-overlay {
            padding: 16px;
          }

          .modal-content {
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}