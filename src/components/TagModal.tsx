import React, { useState, useEffect } from 'react';
import { TagChip } from './TagChip';
import { TagCreationForm } from './TagCreationForm';
import { useTagManager } from '@/hooks/useTagManager';
import type { Tag } from '@/lib/offline-storage';

interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealId: string;
  mealName: string;
  currentTagIds?: string[];
  onTagsUpdated?: (tagIds: string[]) => void;
}

export function TagModal({
  isOpen,
  onClose,
  mealId,
  mealName,
  currentTagIds = [],
  onTagsUpdated
}: TagModalProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignedTagIds, setAssignedTagIds] = useState<Set<string>>(new Set(currentTagIds));
  const [isSaving, setIsSaving] = useState(false);

  const {
    tags,
    isLoading,
    error,
    assignTagToMeal,
    unassignTagFromMeal,
    clearError
  } = useTagManager();

  useEffect(() => {
    setAssignedTagIds(new Set(currentTagIds));
  }, [currentTagIds]);

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTagToggle = async (tag: Tag) => {
    const isAssigned = assignedTagIds.has(tag.id);

    try {
      if (isAssigned) {
        const success = await unassignTagFromMeal(mealId, tag.id);
        if (success) {
          const newSet = new Set(assignedTagIds);
          newSet.delete(tag.id);
          setAssignedTagIds(newSet);
        }
      } else {
        const success = await assignTagToMeal(mealId, tag.id);
        if (success) {
          const newSet = new Set(assignedTagIds);
          newSet.add(tag.id);
          setAssignedTagIds(newSet);
        }
      }
    } catch (err) {
      // Error handling is done by useTagManager
    }
  };

  const handleSaveAndClose = () => {
    if (onTagsUpdated) {
      onTagsUpdated(Array.from(assignedTagIds));
    }
    onClose();
  };

  const handleTagCreated = (newTag: Tag) => {
    setShowCreateForm(false);
    setSearchTerm('');
    handleTagToggle(newTag);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Manage Tags
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {mealName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {showCreateForm ? (
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Create New Tag
                </h3>
              </div>
              <TagCreationForm
                onTagCreated={handleTagCreated}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Search and Create */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search tags..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  New Tag
                </button>
              </div>

              {/* Current Tags */}
              {assignedTagIds.size > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Current Tags ({assignedTagIds.size})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {tags
                      .filter(tag => assignedTagIds.has(tag.id))
                      .map(tag => (
                        <TagChip
                          key={tag.id}
                          tag={tag}
                          removable
                          onRemove={() => handleTagToggle(tag)}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* Available Tags */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Available Tags ({filteredTags.filter(tag => !assignedTagIds.has(tag.id)).length})
                </h3>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500">Loading tags...</div>
                  </div>
                ) : filteredTags.filter(tag => !assignedTagIds.has(tag.id)).length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500">
                      {searchTerm ? 'No matching tags found' : 'No available tags'}
                    </div>
                    {!searchTerm && (
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="mt-2 text-blue-600 hover:text-blue-800 underline"
                      >
                        Create your first tag
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filteredTags
                      .filter(tag => !assignedTagIds.has(tag.id))
                      .map(tag => (
                        <TagChip
                          key={tag.id}
                          tag={tag}
                          showCount
                          onClick={() => handleTagToggle(tag)}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error.message}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!showCreateForm && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndClose}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}