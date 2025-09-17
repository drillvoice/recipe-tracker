import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { TagManager, type TagInfo, type TagCategory, type TagColor, TAG_COLORS } from "@/lib/tag-manager";

interface TagDetailsModalProps {
  tag: TagInfo;
  categories: TagCategory[];
  onClose: () => void;
  onUpdated: () => void;
}

export default function TagDetailsModal({ tag, categories, onClose, onUpdated }: TagDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(tag.name);
  const [selectedCategory, setSelectedCategory] = useState(tag.category || '');
  const [selectedCustomColor, setSelectedCustomColor] = useState<TagColor | ''>(tag.customColor || '');
  const [isLoading, setIsLoading] = useState(false);
  const { dialogProps, showDialog } = useConfirmDialog();

  const effectiveColor = selectedCustomColor ||
    (selectedCategory ? categories.find(c => c.id === selectedCategory)?.color : undefined) ||
    'gray';

  const handleSave = async () => {
    if (editName.trim() === '') return;

    setIsLoading(true);
    try {
      // Rename tag if name changed
      if (editName.trim() !== tag.name) {
        await TagManager.renameTag(tag.name, editName.trim());
      }

      // Update category and color
      await TagManager.updateTag(editName.trim(), {
        category: selectedCategory || undefined,
        customColor: selectedCustomColor || undefined
      });

      onUpdated();
    } catch (error) {
      console.error('Error updating tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    showDialog(
      'Delete Tag',
      `Are you sure you want to delete "${tag.name}"? This will remove it from all ${tag.count} dish${tag.count === 1 ? '' : 'es'}.`,
      async () => {
        setIsLoading(true);
        try {
          await TagManager.deleteTag(tag.name);
          onUpdated();
        } catch (error) {
          console.error('Error deleting tag:', error);
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditName(tag.name);
    setSelectedCategory(tag.category || '');
    setSelectedCustomColor(tag.customColor || '');
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content tag-management-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>
              {isEditing ? 'Edit Tag' : 'Tag Details'}
            </h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          <div className="modal-body">
            <div className="tag-preview">
              <div
                className="tag-preview-chip"
                style={{
                  backgroundColor: TAG_COLORS[effectiveColor],
                  color: effectiveColor === 'yellow' || effectiveColor === 'beige' ? '#374151' : '#1f2937'
                }}
              >
                {editName.trim() || tag.name}
              </div>
              <div className="tag-stats">
                <span>{tag.count} dish{tag.count === 1 ? '' : 'es'}</span>
                {tag.lastUsed && (
                  <span className="tag-last-used">
                    Last used: {new Date(tag.lastUsed).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="tag-edit-form">
                <div className="form-group">
                  <label>Tag Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter tag name..."
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="form-select"
                  >
                    <option value="">No category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Custom Color</label>
                  <div className="color-picker">
                    <button
                      type="button"
                      className={`color-option ${selectedCustomColor === '' ? 'selected' : ''}`}
                      onClick={() => setSelectedCustomColor('')}
                      title="Use category color"
                    >
                      Default
                    </button>
                    {Object.entries(TAG_COLORS).map(([colorKey, colorValue]) => (
                      <button
                        key={colorKey}
                        type="button"
                        className={`color-option ${selectedCustomColor === colorKey ? 'selected' : ''}`}
                        style={{ backgroundColor: colorValue }}
                        onClick={() => setSelectedCustomColor(colorKey as TagColor)}
                        title={colorKey}
                      />
                    ))}
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleSave}
                    disabled={isLoading || editName.trim() === ''}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="tag-info">
                <div className="tag-detail-row">
                  <span className="label">Category:</span>
                  <span className="value">
                    {tag.category
                      ? categories.find(c => c.id === tag.category)?.name || tag.category
                      : 'None'
                    }
                  </span>
                </div>

                {tag.customColor && (
                  <div className="tag-detail-row">
                    <span className="label">Custom Color:</span>
                    <span className="value">
                      <span
                        className="color-sample"
                        style={{ backgroundColor: TAG_COLORS[tag.customColor] }}
                      />
                      {tag.customColor}
                    </span>
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="danger-button"
                    onClick={handleDelete}
                    disabled={isLoading}
                  >
                    Delete Tag
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setIsEditing(true)}
                    disabled={isLoading}
                  >
                    Edit Tag
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        {...dialogProps}
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}