import React, { useState } from 'react';
import ActionButton from '@/components/ActionButton';
import { TagManagementSection } from './TagManagementSection';
import type { Idea } from '@/hooks/useIdeas';

interface ExpandableRowContentProps {
  idea: Idea;
  tagStrings: string[];
  allExistingTags: string[];
  getTagColor: (tagName: string) => string;
  onConfirmHide: (idea: Idea) => void;
  onDirectHide?: (idea: Idea) => void;
  onTagsUpdated?: (mealName: string, tags: string[]) => void;
  onRenameDish?: (oldName: string, newName: string) => Promise<void>;
  onDeleteAllInstances?: (mealName: string) => Promise<void>;
}

export const ExpandableRowContent = React.memo<ExpandableRowContentProps>(({
  idea,
  tagStrings,
  allExistingTags,
  getTagColor,
  onConfirmHide,
  onDirectHide,
  onTagsUpdated,
  onRenameDish,
  onDeleteAllInstances
}) => {
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(idea.mealName);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleHideClick = () => {
    if (onDirectHide) {
      onDirectHide(idea);
    } else {
      setShowHideConfirm(true);
    }
  };

  const handleConfirmHide = () => {
    onConfirmHide(idea);
    setShowHideConfirm(false);
  };

  const handleCancelHide = () => {
    setShowHideConfirm(false);
  };

  const handleSaveNameEdit = async () => {
    if (!onRenameDish) return;

    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === idea.mealName) {
      setIsEditingName(false);
      setEditedName(idea.mealName);
      return;
    }

    try {
      setIsRenaming(true);
      await onRenameDish(idea.mealName, trimmedName);
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to rename dish:', error);
      setEditedName(idea.mealName);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleCancelNameEdit = () => {
    setIsEditingName(false);
    setEditedName(idea.mealName);
  };

  const handleDeleteAll = async () => {
    if (!onDeleteAllInstances) return;

    try {
      setIsDeleting(true);
      await onDeleteAllInstances(idea.mealName);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete all instances:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <tr className="expanded-row">
      <td colSpan={4}>
        <div className="expanded-content">
          <div className="expanded-section">
            <div className="dish-stats">
              <span className="count-info">Made {idea.count} time{idea.count === 1 ? '' : 's'}</span>
            </div>
          </div>

          {/* Edit Meal Name Section */}
          {onRenameDish && (
            <div className="expanded-section edit-name-section">
              {!isEditingName ? (
                <ActionButton
                  icon="✏️"
                  onClick={() => setIsEditingName(true)}
                  title="Edit dish name"
                  variant="default"
                />
              ) : (
                <div className="edit-name-form">
                  <label className="edit-name-label">Edit Meal Name:</label>
                  <input
                    type="text"
                    className="edit-name-input"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Enter dish name"
                    autoFocus
                  />
                  <div className="edit-name-buttons">
                    <button
                      className="btn-save-name"
                      onClick={handleSaveNameEdit}
                      disabled={isRenaming}
                    >
                      {isRenaming ? 'Saving...' : '✓ Save'}
                    </button>
                    <button
                      className="btn-cancel-name"
                      onClick={handleCancelNameEdit}
                      disabled={isRenaming}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <TagManagementSection
            idea={idea}
            tagStrings={tagStrings}
            allExistingTags={allExistingTags}
            getTagColor={getTagColor}
            onTagsUpdated={onTagsUpdated}
          />

          {/* Delete All Instances Section */}
          {onDeleteAllInstances && (
            <div className="expanded-section delete-all-section">
              {!showDeleteConfirm ? (
                <ActionButton
                  icon="🗑️"
                  onClick={() => setShowDeleteConfirm(true)}
                  title={`Delete all ${idea.count} instance${idea.count === 1 ? '' : 's'} of "${idea.mealName}"`}
                  variant="danger"
                />
              ) : (
                <div className="confirm-delete-all">
                  <span>Delete all {idea.count} instance{idea.count === 1 ? '' : 's'} of "{idea.mealName}"?</span>
                  <div className="confirm-buttons">
                    <ActionButton
                      icon="✓"
                      onClick={handleDeleteAll}
                      title="Yes, delete all"
                      variant="danger"
                      disabled={isDeleting}
                    />
                    <ActionButton
                      icon="✕"
                      onClick={() => setShowDeleteConfirm(false)}
                      title="Cancel"
                      variant="default"
                      disabled={isDeleting}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="expanded-section">
            <div className="dish-visibility-section">
              {!showHideConfirm ? (
                <ActionButton
                  icon="👁️‍🗨️"
                  onClick={handleHideClick}
                  title={`Hide "${idea.mealName}" from suggestions`}
                  variant="danger"
                />
              ) : (
                <div className="confirm-hide">
                  <span>Hide "{idea.mealName}"?</span>
                  <div className="confirm-buttons">
                    <ActionButton
                      icon="✓"
                      onClick={handleConfirmHide}
                      title="Yes, hide it"
                      variant="danger"
                    />
                    <ActionButton
                      icon="✕"
                      onClick={handleCancelHide}
                      title="Cancel"
                      variant="default"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
});

ExpandableRowContent.displayName = 'ExpandableRowContent';