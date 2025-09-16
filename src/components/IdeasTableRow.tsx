import React, { useState } from 'react';
import ActionButton from '@/components/ActionButton';
import { SimpleTagInput } from '@/components/SimpleTagInput';
import type { Idea } from '@/hooks/useIdeas';

interface IdeasTableRowProps {
  idea: Idea;
  onConfirmHide: (idea: Idea) => void;
  onTagsUpdated?: () => void;
}

const IdeasTableRow = React.memo<IdeasTableRowProps>(({
  idea,
  onConfirmHide,
  onTagsUpdated
}) => {
  const [showTagInput, setShowTagInput] = useState(false);

  const handleTagsChange = (newTags: string[]) => {
    // For now, just store the tags as simple strings
    // Later we can integrate with the tag management system
    console.log('Tags updated for', idea.mealName, ':', newTags);
    if (onTagsUpdated) {
      onTagsUpdated();
    }
  };

  // Convert tag IDs to simple strings for now
  const tagStrings = idea.tags || [];

  return (
    <>
      <tr key={idea.mealName} className={idea.hidden ? 'hidden-meal' : ''}>
        <td>{idea.mealName}</td>
        <td>
          {idea.lastMade
            .toDate()
            .toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
        </td>
        <td>
          <span className="count-badge">{idea.count}x</span>
        </td>
        <td>
          {showTagInput ? (
            <SimpleTagInput
              tags={tagStrings}
              onTagsChange={handleTagsChange}
              placeholder="Add tag..."
              className="min-w-48"
            />
          ) : (
            <div className="flex flex-wrap gap-1 min-h-[24px] items-center">
              {tagStrings.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                >
                  {tag}
                </span>
              ))}
              {tagStrings.length === 0 && (
                <span className="text-xs text-gray-400">No tags</span>
              )}
            </div>
          )}
        </td>
        <td>
          <div className="action-buttons">
            <ActionButton
              icon="🏷️"
              onClick={() => setShowTagInput(!showTagInput)}
              title="Manage tags"
              variant="default"
            />
            <ActionButton
              icon={idea.hidden ? "👁️" : "👁️‍🗨️"}
              onClick={() => onConfirmHide(idea)}
              title={idea.hidden ? "Show meal" : "Hide meal"}
              variant="default"
            />
          </div>
        </td>
      </tr>
    </>
  );
});

IdeasTableRow.displayName = 'IdeasTableRow';

export default IdeasTableRow;