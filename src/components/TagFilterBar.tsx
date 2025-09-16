import React, { useState } from 'react';
import { TagChip } from './TagChip';
import { useTagManager } from '@/hooks/useTagManager';
import type { Tag } from '@/lib/offline-storage';

interface TagFilterBarProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  className?: string;
}

export function TagFilterBar({ selectedTagIds, onTagsChange, className = '' }: TagFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { tags, isLoading } = useTagManager();

  // Only show tags that are actually in use
  const usedTags = tags.filter(tag => tag.usageCount > 0);
  const selectedTagsSet = new Set(selectedTagIds);

  const handleTagToggle = (tag: Tag) => {
    const newSelectedIds = selectedTagsSet.has(tag.id)
      ? selectedTagIds.filter(id => id !== tag.id)
      : [...selectedTagIds, tag.id];

    onTagsChange(newSelectedIds);
  };

  const handleClearAll = () => {
    onTagsChange([]);
  };

  if (isLoading || usedTags.length === 0) {
    return null;
  }

  const displayTags = isExpanded ? usedTags : usedTags.slice(0, 6);
  const hasMore = usedTags.length > 6;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">
          Filter by Tags
          {selectedTagIds.length > 0 && (
            <span className="ml-1 text-blue-600">
              ({selectedTagIds.length} selected)
            </span>
          )}
        </h3>

        <div className="flex items-center gap-2">
          {selectedTagIds.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          )}

          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {isExpanded ? 'Show less' : `Show all (${usedTags.length})`}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {displayTags.map(tag => (
          <TagChip
            key={tag.id}
            tag={tag}
            showCount
            onClick={() => handleTagToggle(tag)}
            className={`
              cursor-pointer transition-all duration-200
              ${selectedTagsSet.has(tag.id)
                ? 'ring-2 ring-blue-500 ring-offset-1 shadow-md'
                : 'hover:shadow-md'
              }
            `}
          />
        ))}
      </div>

      {selectedTagIds.length === 0 && (
        <p className="text-xs text-gray-500 mt-2">
          Click tags to filter ideas. Multiple tags will show ideas that have any of the selected tags.
        </p>
      )}
    </div>
  );
}