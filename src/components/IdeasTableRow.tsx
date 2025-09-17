import React, { useState } from 'react';
import ActionButton from '@/components/ActionButton';
import { TagManager, type TagCategory, TAG_COLORS } from '@/lib/tag-manager';
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
  const [categories, setCategories] = useState<TagCategory[]>([]);

  // Load categories for tag coloring
  React.useEffect(() => {
    const data = TagManager.getTagManagementData();
    setCategories(data.categories);
  }, []);

  const getTagColor = (tagName: string): string => {
    const data = TagManager.getTagManagementData();
    const tagData = data.tags[tagName];

    if (tagData?.customColor) {
      return TAG_COLORS[tagData.customColor];
    }

    if (tagData?.category) {
      const category = categories.find(c => c.id === tagData.category);
      if (category) {
        return TAG_COLORS[category.color];
      }
    }

    return TAG_COLORS.gray;
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
              <span
                key={tag}
                className="tag-chip-small"
                style={{
                  backgroundColor: getTagColor(tag),
                  color: getTagColor(tag) === TAG_COLORS.yellow || getTagColor(tag) === TAG_COLORS.beige ? '#374151' : '#1f2937'
                }}
              >
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