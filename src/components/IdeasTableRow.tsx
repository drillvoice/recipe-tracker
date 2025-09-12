import React from 'react';
import ActionButton from '@/components/ActionButton';
import type { Idea } from '@/hooks/useIdeas';

interface IdeasTableRowProps {
  idea: Idea;
  onConfirmHide: (idea: Idea) => void;
}

const IdeasTableRow = React.memo<IdeasTableRowProps>(({
  idea,
  onConfirmHide
}) => {
  return (
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
        <div className="action-buttons">
          <ActionButton
            icon={idea.hidden ? "👁️" : "👁️‍🗨️"}
            onClick={() => onConfirmHide(idea)}
            title={idea.hidden ? "Show meal" : "Hide meal"}
            variant="default"
          />
        </div>
      </td>
    </tr>
  );
});

IdeasTableRow.displayName = 'IdeasTableRow';

export default IdeasTableRow;