import React, { useMemo, useState } from 'react';
import ActionButton from '@/components/ActionButton';
import { useTagColors } from '@/hooks/useTagColors';
import { ExpandableRowContent } from './ExpandableRowContent';
import type { Idea } from '@/hooks/useIdeas';

interface IdeasTableRowProps {
  idea: Idea;
  onConfirmHide: (idea: Idea) => void;
  onTagsUpdated?: (mealName: string, tags: string[]) => void;
  onRenameDish?: (oldName: string, newName: string) => Promise<void>;
  onDeleteAllInstances?: (mealName: string) => Promise<void>;
  allExistingTags?: string[]; // Pre-computed unique tags for autocomplete (from parent)
  allIdeas?: Idea[]; // @deprecated — use allExistingTags instead
}

export const IdeasTableRow = React.memo<IdeasTableRowProps>(({
  idea,
  onConfirmHide,
  onTagsUpdated,
  onRenameDish,
  onDeleteAllInstances,
  allExistingTags: allExistingTagsProp,
  allIdeas = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Shared across rows: tag settings are parsed once per page, not per row
  const getTagColor = useTagColors();

  // Use the tags from the idea data
  const tagStrings = useMemo(() => idea.tags ?? [], [idea.tags]);

  // Use pre-computed tags from parent if available, otherwise fall back to computing from allIdeas
  const allExistingTags = useMemo(() => {
    if (allExistingTagsProp) return allExistingTagsProp;
    const tagSet = new Set<string>();
    for (const ideaItem of allIdeas) {
      if (ideaItem.tags) {
        for (const tag of ideaItem.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [allExistingTagsProp, allIdeas]);

  // Render tag chips with proper colors
  const renderedTagChips = useMemo(() => {
    return tagStrings.map(tag => (
      <span
        key={tag}
        className="tag-chip-small"
        style={{ backgroundColor: getTagColor(tag) }}
        title={tag}
      >
        {tag}
      </span>
    ));
  }, [tagStrings, getTagColor]);

  return (
    <>
      <tr key={idea.mealName} className={idea.hidden ? 'hidden-meal' : ''}>
        <td
          className="dish-name-cell"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {idea.mealName}
        </td>
        <td>
          {idea.lastMade
            .toDate()
            .toLocaleDateString('en-GB', {
              day: "numeric",
              month: "numeric",
            })}
        </td>
        <td className="tags-cell">
          <div className="tags-container">
            {renderedTagChips}
            {tagStrings.length === 0 && (
              <span className="no-tags">—</span>
            )}
          </div>
        </td>
        <td>
          <ActionButton
            icon="ℹ️"
            onClick={() => setIsExpanded(!isExpanded)}
            title="Show details"
            variant="default"
          />
        </td>
      </tr>

      {isExpanded && (
        <ExpandableRowContent
          idea={idea}
          tagStrings={tagStrings}
          allExistingTags={allExistingTags}
          getTagColor={getTagColor}
          onConfirmHide={onConfirmHide}
          onTagsUpdated={onTagsUpdated}
          onRenameDish={onRenameDish}
          onDeleteAllInstances={onDeleteAllInstances}
        />
      )}
    </>
  );
});

IdeasTableRow.displayName = 'IdeasTableRow';