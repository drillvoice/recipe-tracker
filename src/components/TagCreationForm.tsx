import React, { useState } from 'react';
import { ColorPicker } from './ColorPicker';
import { TagChip } from './TagChip';
import { useTagManager } from '@/hooks/useTagManager';
import type { Tag } from '@/lib/offline-storage';

interface TagCreationFormProps {
  onTagCreated?: (tag: Tag) => void;
  onCancel?: () => void;
  className?: string;
}

export function TagCreationForm({ onTagCreated, onCancel, className = '' }: TagCreationFormProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4ECDC4');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createTag, error, clearError } = useTagManager();

  const previewTag: Tag = {
    id: 'preview',
    name: name || 'Tag Name',
    color,
    createdAt: new Date(),
    usageCount: 0
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      const newTag = await createTag(name.trim(), color);
      if (newTag) {
        setName('');
        setColor('#4ECDC4');
        if (onTagCreated) {
          onTagCreated(newTag);
        }
      }
    } catch (err) {
      // Error handling is done by useTagManager
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setColor('#4ECDC4');
    clearError();
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {/* Preview */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Preview
        </label>
        <TagChip tag={previewTag} size="medium" />
      </div>

      {/* Tag Name */}
      <div>
        <label htmlFor="tag-name" className="block text-sm font-medium text-gray-700 mb-2">
          Tag Name
        </label>
        <input
          id="tag-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter tag name..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          maxLength={50}
          required
          disabled={isSubmitting}
        />
        <div className="mt-1 text-xs text-gray-500">
          {name.length}/50 characters
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color
        </label>
        <ColorPicker
          value={color}
          onChange={setColor}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={!name.trim() || isSubmitting}
          className={`
            flex-1 px-4 py-2 rounded-lg font-medium transition-colors
            ${!name.trim() || isSubmitting
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
            }
          `}
        >
          {isSubmitting ? 'Creating...' : 'Create Tag'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}