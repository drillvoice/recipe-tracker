import { useEffect, useId, useMemo, useState } from 'react';
import type { ChangeEvent, FC, FormEvent } from 'react';

interface TagActionsModalProps {
  mealName: string;
  tag: string;
  tags: string[];
  onClose: () => void;
  onTagsUpdated: (mealName: string, tags: string[]) => void;
}

const TagActionsModal: FC<TagActionsModalProps> = ({
  mealName,
  tag,
  tags,
  onClose,
  onTagsUpdated
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [renameValue, setRenameValue] = useState(tag);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renameInputId = useId();

  useEffect(() => {
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setRenameValue(tag);
    setError(null);
  }, [tag]);

  const trimmedRename = useMemo(() => renameValue.trim(), [renameValue]);

  const hasDuplicateName = useMemo(
    () =>
      tags.some(existingTag =>
        existingTag.toLowerCase() === trimmedRename.toLowerCase() &&
        existingTag.toLowerCase() !== tag.toLowerCase()
      ),
    [tags, trimmedRename, tag]
  );

  const handleClose = () => {
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setRenameValue(tag);
    setError(null);
    onClose();
  };

  const handleRenameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRenameValue(event.target.value);
    if (error) {
      setError(null);
    }
  };

  const handleRenameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (trimmedRename === '') {
      setError('Tag name cannot be empty.');
      return;
    }

    if (hasDuplicateName) {
      setError('This dish already uses that tag name.');
      return;
    }

    if (trimmedRename === tag) {
      setIsEditing(false);
      setRenameValue(tag);
      return;
    }

    const updatedTags = tags.map(existingTag =>
      existingTag === tag ? trimmedRename : existingTag
    );

    onTagsUpdated(mealName, updatedTags);
    handleClose();
  };

  const handleStartRename = () => {
    setIsEditing(true);
    setShowDeleteConfirm(false);
    setError(null);
  };

  const handleCancelRename = () => {
    setIsEditing(false);
    setRenameValue(tag);
    setError(null);
  };

  const handleStartDelete = () => {
    setShowDeleteConfirm(true);
    setIsEditing(false);
    setError(null);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setError(null);
  };

  const handleConfirmDelete = () => {
    const updatedTags = tags.filter(existingTag => existingTag !== tag);
    onTagsUpdated(mealName, updatedTags);
    handleClose();
  };

  const isSaveDisabled =
    trimmedRename === '' || trimmedRename === tag || hasDuplicateName;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content tag-actions-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${renameInputId}-title`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={`${renameInputId}-title`}>Tag Options</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body tag-actions-body">
          <div className="tag-actions-summary">
            <span className="tag-actions-label">Dish</span>
            <span className="tag-actions-value">{mealName}</span>
          </div>

          <div className="tag-actions-summary">
            <span className="tag-actions-label">Tag</span>
            <span className="tag-actions-value tag-actions-chip">{tag}</span>
          </div>

          {!isEditing && !showDeleteConfirm && (
            <div className="tag-actions-options">
              <button
                type="button"
                className="secondary-button"
                onClick={handleStartRename}
              >
                Edit
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={handleStartDelete}
              >
                Delete
              </button>
            </div>
          )}

          {isEditing && (
            <form className="tag-rename-form" onSubmit={handleRenameSubmit}>
              <label htmlFor={renameInputId} className="tag-actions-label">
                Rename tag
              </label>
              <input
                id={renameInputId}
                type="text"
                value={renameValue}
                onChange={handleRenameChange}
                className="form-input-compact"
                placeholder="Enter new tag name"
                autoFocus
              />
              {error && <p className="tag-action-error">{error}</p>}
              {!error && hasDuplicateName && (
                <p className="tag-action-error">This dish already uses that tag name.</p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCancelRename}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSaveDisabled}
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {showDeleteConfirm && (
            <div className="tag-delete-confirm">
              <p>
                Remove "{tag}" from "{mealName}"?
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCancelDelete}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={handleConfirmDelete}
                >
                  Remove Tag
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagActionsModal;
