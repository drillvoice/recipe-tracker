import React, { useState } from 'react';
import ActionButton from '@/components/ActionButton';
import { TagManagementModal } from '@/components/TagManagementModal';
import type { Idea } from '@/hooks/useIdeas';

interface IdeasTableRowProps {
  idea: Idea;
  onConfirmHide: (idea: Idea) => void;
  onTagsUpdated?: (mealName: string, tags: string[]) => void;
}

const IdeasTableRow = React.memo<IdeasTableRowProps>(({
  idea,
  onConfirmHide,
  onTagsUpdated
}) => {
  const [showTagModal, setShowTagModal] = useState(false);

  const handleTagsUpdate = async (newTags: string[]) => {
    if (onTagsUpdated) {
      await onTagsUpdated(idea.mealName, newTags);
    }
    setShowTagModal(false);
  };

  // Use the tags from the idea data
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
        <td className="tags-cell">
          <div className="tags-container">
            {tagStrings.slice(0, 2).map(tag => (
              <span key={tag} className="tag-chip-small">
                {tag}
              </span>
            ))}
            {tagStrings.length > 2 && (
              <span className="more-tags">+{tagStrings.length - 2}</span>
            )}
            {tagStrings.length === 0 && (
              <span className="no-tags">—</span>
            )}
          </div>
        </td>
        <td>
          <div className="action-buttons">
            <ActionButton
              icon="🏷️"
              onClick={() => setShowTagModal(true)}
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

      <TagManagementModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        mealName={idea.mealName}
        currentTags={tagStrings}
        onTagsUpdate={handleTagsUpdate}
      />
    </>
  );
});

IdeasTableRow.displayName = 'IdeasTableRow';

export default IdeasTableRow;