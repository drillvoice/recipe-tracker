import React from 'react';
import type { Tag } from '@/lib/offline-storage';

interface TagChipProps {
  tag: Tag;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

export function TagChip({
  tag,
  size = 'medium',
  showCount = false,
  removable = false,
  onRemove,
  onClick,
  className = ''
}: TagChipProps) {
  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1 text-sm',
    large: 'px-4 py-2 text-base'
  };

  const baseClasses = `
    inline-flex items-center gap-2 rounded-full font-medium
    border border-gray-200 transition-all duration-200
    ${sizeClasses[size]}
    ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
    ${className}
  `;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRemove) {
      onRemove();
    }
  };

  return (
    <span
      className={baseClasses}
      style={{
        backgroundColor: tag.color,
        color: getContrastColor(tag.color)
      }}
      onClick={handleClick}
    >
      <span className="truncate max-w-24">
        {tag.name}
      </span>

      {showCount && tag.usageCount > 0 && (
        <span className="bg-black bg-opacity-20 px-1.5 py-0.5 rounded-full text-xs font-bold">
          {tag.usageCount}
        </span>
      )}

      {removable && (
        <button
          onClick={handleRemove}
          className="ml-1 hover:bg-black hover:bg-opacity-20 rounded-full p-0.5 transition-colors"
          aria-label={`Remove ${tag.name} tag`}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
}

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  return brightness > 128 ? '#000000' : '#ffffff';
}