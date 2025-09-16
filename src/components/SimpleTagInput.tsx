import React, { useState } from 'react';

interface SimpleTagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function SimpleTagInput({
  tags,
  onTagsChange,
  placeholder = "Add a tag...",
  className = ""
}: SimpleTagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !tags.includes(trimmedValue)) {
      onTagsChange([...tags, trimmedValue]);
      setInputValue('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className={className}>
      {/* Existing tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded border"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="text-gray-500 hover:text-gray-700 ml-1"
                aria-label={`Remove ${tag} tag`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add new tag */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleAddTag}
          disabled={!inputValue.trim()}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            inputValue.trim()
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          + Add
        </button>
      </div>
    </div>
  );
}