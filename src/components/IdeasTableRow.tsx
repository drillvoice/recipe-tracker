import React, { useState } from 'react';
import ActionButton from '@/components/ActionButton';
import { TagChip } from '@/components/TagChip';
import { TagModal } from '@/components/TagModal';
import { useTagManager } from '@/hooks/useTagManager';
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
  const [showTagModal, setShowTagModal] = useState(false);
  const { getTagsByIds } = useTagManager();

  const ideaTags = getTagsByIds(idea.tags);

  const handleTagsUpdated = () => {
    if (onTagsUpdated) {
      onTagsUpdated();
    }
    setShowTagModal(false);
  };

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
          <div className="flex flex-wrap gap-1 min-h-[24px]">
            {ideaTags.map(tag => (
              <TagChip
                key={tag.id}
                tag={tag}
                size="small"
              />
            ))}
            {ideaTags.length === 0 && (
              <span className="text-xs text-gray-400">No tags</span>
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

      {showTagModal && (
        <TagModal
          isOpen={showTagModal}
          onClose={() => setShowTagModal(false)}
          mealId={`idea-${idea.mealName}`}
          mealName={idea.mealName}
          currentTagIds={idea.tags}
          onTagsUpdated={handleTagsUpdated}
        />
      )}
    </>
  );
});

IdeasTableRow.displayName = 'IdeasTableRow';

export default IdeasTableRow;