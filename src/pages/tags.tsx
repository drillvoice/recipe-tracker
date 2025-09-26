import Head from "next/head";
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import CategoryManagementModal from "@/components/CategoryManagementModal";
import { TagManager, type TagInfo, type TagCategory, TAG_COLORS, type TagColor } from "@/lib/tag-manager";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

export default function Tags() {
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<{
    name: string;
    originalName: string;
    category: string;
    customColor: TagColor | '';
  } | null>(null);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { dialogProps, showDialog } = useConfirmDialog();

  useEffect(() => {
    loadTagsAndCategories();
  }, []);

  const loadTagsAndCategories = async () => {
    try {
      setIsLoading(true);
      const [tagList, managementData] = await Promise.all([
        TagManager.getAllTags(),
        TagManager.getTagManagementData()
      ]);
      setTags(tagList);
      setCategories(managementData.categories);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagClick = (tag: TagInfo) => {
    if (expandedTag === tag.name) {
      // Clicking the same tag collapses it
      setExpandedTag(null);
      setEditingTag(null);
    } else {
      // Clicking a different tag expands it and starts editing
      setExpandedTag(tag.name);
      setEditingTag({
        name: tag.name,
        originalName: tag.name,
        category: tag.category || '',
        customColor: tag.customColor || ''
      });
    }
  };

  const handleSaveTag = async () => {
    if (!editingTag || editingTag.name.trim() === '') return;

    setIsUpdating(true);
    try {
      // Rename tag if name changed
      if (editingTag.name.trim() !== editingTag.originalName) {
        await TagManager.renameTag(editingTag.originalName, editingTag.name.trim());
      }

      // Update category and color
      await TagManager.updateTag(editingTag.name.trim(), {
        category: editingTag.category || undefined,
        customColor: editingTag.customColor || undefined
      });

      setExpandedTag(null);
      setEditingTag(null);
      loadTagsAndCategories();
    } catch (error) {
      console.error('Error updating tag:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setExpandedTag(null);
    setEditingTag(null);
  };

  const handleDeleteTag = (tag: TagInfo) => {
    showDialog(
      'Delete Tag',
      `Are you sure you want to delete "${tag.name}"? This will remove it from all ${tag.count} dish${tag.count === 1 ? '' : 'es'}.`,
      async () => {
        setIsUpdating(true);
        try {
          await TagManager.deleteTag(tag.name);
          setExpandedTag(null);
          setEditingTag(null);
          loadTagsAndCategories();
        } catch (error) {
          console.error('Error deleting tag:', error);
        } finally {
          setIsUpdating(false);
        }
      }
    );
  };

  const handleCategoriesUpdated = () => {
    setShowCategoryManagement(false);
    loadTagsAndCategories();
  };

  const getTagColor = (tag: TagInfo): string => {
    const colorKey = TagManager.getTagColor(tag, categories);
    return TAG_COLORS[colorKey];
  };

  return (
    <>
      <Head>
        <title>DishDiary - Tags</title>
      </Head>
      <main className="container">
        <Navigation currentPage="tags" />

        <div className="page-header">
          <h1>Tags</h1>
          <button
            className="secondary-button"
            onClick={() => setShowCategoryManagement(true)}
            title="Manage categories"
          >
            Categories
          </button>
        </div>

        <p className="subtitle">
          {tags.length > 0
            ? `${tags.length} tag${tags.length === 1 ? '' : 's'} across ${categories.length} categories`
            : 'No tags found - add some tags to your dishes to get started!'
          }
        </p>

        {isLoading ? (
          <div className="form">
            <p>Loading tags...</p>
          </div>
        ) : tags.length > 0 ? (
          <div className="tags-list">
            {tags.map(tag => {
              const isExpanded = expandedTag === tag.name;
              const effectiveColor = editingTag?.customColor ||
                (editingTag?.category ? categories.find(c => c.id === editingTag.category)?.color : undefined) ||
                getTagColor(tag);

              return (
                <div key={tag.name} className="tag-list-item">
                  <button
                    className={`tag-item-header ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => handleTagClick(tag)}
                    style={{ borderLeft: `4px solid ${getTagColor(tag)}` }}
                    disabled={isUpdating}
                  >
                    <div className="tag-item-info">
                      <span className="tag-name">{tag.name}</span>
                      <span className="tag-stats">
                        {tag.count} dish{tag.count === 1 ? '' : 'es'}
                        {tag.lastUsed && (
                          <>
                            <span className="separator">•</span>
                            <span className="last-used">
                              Last used: {new Date(tag.lastUsed).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="tag-item-meta">
                      {tag.category && (
                        <span className="tag-category">
                          {categories.find(c => c.id === tag.category)?.name || tag.category}
                        </span>
                      )}
                      <span
                        className="tag-color-indicator"
                        style={{ backgroundColor: getTagColor(tag) }}
                      />
                    </div>
                  </button>

                  {isExpanded && editingTag && (
                    <div className="tag-edit-panel">
                      <div className="tag-preview-compact">
                        <div
                          className="tag-preview-chip-compact"
                          style={{
                            backgroundColor: TAG_COLORS[effectiveColor as TagColor] || TAG_COLORS.gray,
                            color: (effectiveColor === 'yellow' || effectiveColor === 'beige') ? '#374151' : '#1f2937'
                          }}
                        >
                          {editingTag.name.trim() || tag.name}
                        </div>
                      </div>

                      <div className="edit-form-compact">
                        <div className="form-row">
                          <div className="form-group-compact">
                            <label>Name</label>
                            <input
                              type="text"
                              value={editingTag.name}
                              onChange={(e) => setEditingTag({...editingTag, name: e.target.value})}
                              className="form-input-compact"
                              disabled={isUpdating}
                            />
                          </div>
                          <div className="form-group-compact">
                            <label>Category</label>
                            <select
                              value={editingTag.category}
                              onChange={(e) => setEditingTag({...editingTag, category: e.target.value})}
                              className="form-select-compact"
                              disabled={isUpdating}
                            >
                              <option value="">No category</option>
                              {categories.map(category => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="form-group-compact">
                          <label>Custom Color</label>
                          <div className="color-picker-compact">
                            <button
                              type="button"
                              className={`color-option-compact ${editingTag.customColor === '' ? 'selected' : ''}`}
                              onClick={() => setEditingTag({...editingTag, customColor: ''})}
                              disabled={isUpdating}
                              title="Use category color"
                            >
                              Default
                            </button>
                            {Object.entries(TAG_COLORS).map(([colorKey, colorValue]) => (
                              <button
                                key={colorKey}
                                type="button"
                                className={`color-option-compact ${editingTag.customColor === colorKey ? 'selected' : ''}`}
                                style={{ backgroundColor: colorValue }}
                                onClick={() => setEditingTag({...editingTag, customColor: colorKey as TagColor})}
                                disabled={isUpdating}
                                title={colorKey}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="edit-actions">
                          <button
                            type="button"
                            className="danger-button small"
                            onClick={() => handleDeleteTag(tag)}
                            disabled={isUpdating}
                          >
                            Delete
                          </button>
                          <div className="action-group">
                            <button
                              type="button"
                              className="secondary-button small"
                              onClick={handleCancelEdit}
                              disabled={isUpdating}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="primary-button small"
                              onClick={handleSaveTag}
                              disabled={isUpdating || editingTag.name.trim() === ''}
                            >
                              {isUpdating ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="form">
            <p>No tags found yet.</p>
            <p>Start adding tags to your dishes to organize and categorize them!</p>
          </div>
        )}

        {showCategoryManagement && (
          <CategoryManagementModal
            categories={categories}
            onClose={() => setShowCategoryManagement(false)}
            onUpdated={handleCategoriesUpdated}
          />
        )}

        <ConfirmDialog
          {...dialogProps}
          confirmText="Delete"
          variant="danger"
        />

        <div className="version-indicator">
          v0.4.2
        </div>
      </main>
    </>
  );
}