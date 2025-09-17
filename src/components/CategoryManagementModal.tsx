import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { TagManager, type TagCategory, type TagColor, TAG_COLORS } from "@/lib/tag-manager";

interface CategoryManagementModalProps {
  categories: TagCategory[];
  onClose: () => void;
  onUpdated: () => void;
}

export default function CategoryManagementModal({ categories, onClose, onUpdated }: CategoryManagementModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState<TagColor>('mint');
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState<TagColor>('mint');
  const [isLoading, setIsLoading] = useState(false);
  const { dialogProps, showDialog } = useConfirmDialog();

  const handleCreateCategory = async () => {
    if (newCategoryName.trim() === '') return;

    setIsLoading(true);
    try {
      TagManager.createCategory(newCategoryName.trim(), newCategoryColor);
      setNewCategoryName('');
      setNewCategoryColor('mint');
      setIsCreating(false);
      onUpdated();
    } catch (error) {
      console.error('Error creating category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCategory = (category: TagCategory) => {
    setEditingId(category.id);
    setEditCategoryName(category.name);
    setEditCategoryColor(category.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || editCategoryName.trim() === '') return;

    setIsLoading(true);
    try {
      TagManager.updateCategory(editingId, {
        name: editCategoryName.trim(),
        color: editCategoryColor
      });
      setEditingId(null);
      setEditCategoryName('');
      onUpdated();
    } catch (error) {
      console.error('Error updating category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditCategoryName('');
    setEditCategoryColor('mint');
  };

  const handleDeleteCategory = (category: TagCategory) => {
    showDialog(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? Tags in this category will become uncategorized.`,
      async () => {
        setIsLoading(true);
        try {
          TagManager.deleteCategory(category.id);
          onUpdated();
        } catch (error) {
          console.error('Error deleting category:', error);
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content category-management-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Manage Categories</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          <div className="modal-body">
            {isCreating ? (
              <div className="category-create-form">
                <h3>Create New Category</h3>
                <div className="form-group">
                  <label>Category Name</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name..."
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Color</label>
                  <div className="color-picker">
                    {Object.entries(TAG_COLORS).map(([colorKey, colorValue]) => (
                      <button
                        key={colorKey}
                        type="button"
                        className={`color-option ${newCategoryColor === colorKey ? 'selected' : ''}`}
                        style={{ backgroundColor: colorValue }}
                        onClick={() => setNewCategoryColor(colorKey as TagColor)}
                        title={colorKey}
                      />
                    ))}
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setIsCreating(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleCreateCategory}
                    disabled={isLoading || newCategoryName.trim() === ''}
                  >
                    {isLoading ? 'Creating...' : 'Create Category'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="category-list">
                  {categories.map(category => (
                    <div key={category.id} className="category-item">
                      {editingId === category.id ? (
                        <div className="category-edit-form">
                          <div className="form-group">
                            <input
                              type="text"
                              value={editCategoryName}
                              onChange={(e) => setEditCategoryName(e.target.value)}
                              className="form-input"
                            />
                          </div>
                          <div className="form-group">
                            <div className="color-picker small">
                              {Object.entries(TAG_COLORS).map(([colorKey, colorValue]) => (
                                <button
                                  key={colorKey}
                                  type="button"
                                  className={`color-option small ${editCategoryColor === colorKey ? 'selected' : ''}`}
                                  style={{ backgroundColor: colorValue }}
                                  onClick={() => setEditCategoryColor(colorKey as TagColor)}
                                  title={colorKey}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="category-actions">
                            <button
                              type="button"
                              className="secondary-button small"
                              onClick={handleCancelEdit}
                              disabled={isLoading}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="primary-button small"
                              onClick={handleSaveEdit}
                              disabled={isLoading || editCategoryName.trim() === ''}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="category-display">
                          <div className="category-info">
                            <span
                              className="category-color-indicator"
                              style={{ backgroundColor: TAG_COLORS[category.color] }}
                            />
                            <span className="category-name">{category.name}</span>
                          </div>
                          <div className="category-actions">
                            <button
                              type="button"
                              className="secondary-button small"
                              onClick={() => handleEditCategory(category)}
                              disabled={isLoading}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="danger-button small"
                              onClick={() => handleDeleteCategory(category)}
                              disabled={isLoading}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setIsCreating(true)}
                    disabled={isLoading}
                  >
                    Add New Category
                  </button>
                </div>
              </>
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