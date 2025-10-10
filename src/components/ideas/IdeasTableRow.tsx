import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '@/components/ActionButton';
import {
  TagManager,
  TAG_COLORS,
  TAG_MANAGEMENT_UPDATED_EVENT,
  type TagCategory,
  type TagManagementData
} from '@/lib/tag-manager';
import { ExpandableRowContent } from './ExpandableRowContent';
import type { Idea } from '@/hooks/useIdeas';

interface IdeasTableRowProps {
  idea: Idea;
  onConfirmHide: (idea: Idea) => void;
  onDirectHide?: (idea: Idea) => void;
  onTagsUpdated?: (mealName: string, tags: string[]) => void;
  onRenameDish?: (oldName: string, newName: string) => Promise<void>;
  onDeleteAllInstances?: (mealName: string) => Promise<void>;
  allIdeas?: Idea[]; // For extracting all existing tags for autocomplete
}

export const IdeasTableRow = React.memo<IdeasTableRowProps>(({
  idea,
  onConfirmHide,
  onDirectHide,
  onTagsUpdated,
  onRenameDish,
  onDeleteAllInstances,
  allIdeas = []
}) => {
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tagMetadata, setTagMetadata] = useState<TagManagementData['tags']>({});
  const [isExpanded, setIsExpanded] = useState(false);

  // Load categories and tag metadata once and refresh when tag settings change
  useEffect(() => {
    const loadTagManagementData = () => {
      const data = TagManager.getTagManagementData();
      setCategories(data.categories);
      setTagMetadata(data.tags);
    };

    loadTagManagementData();

    if (typeof window === 'undefined') {
      return;
    }

    const handleTagManagementUpdate = () => {
      loadTagManagementData();
    };

    window.addEventListener(
      TAG_MANAGEMENT_UPDATED_EVENT,
      handleTagManagementUpdate
    );

    return () => {
      window.removeEventListener(
        TAG_MANAGEMENT_UPDATED_EVENT,
        handleTagManagementUpdate
      );
    };
  }, []);

  const getTagColor = useCallback(
    (tagName: string): string => {
      const metadata = tagMetadata[tagName];

      const customColor = metadata?.customColor;
      if (customColor && TAG_COLORS[customColor]) {
        return TAG_COLORS[customColor];
      }

      const categoryId = metadata?.category;
      if (categoryId) {
        const category = categories.find(c => c.id === categoryId);
        if (category) {
          return TAG_COLORS[category.color];
        }
      }

      return TAG_COLORS.gray;
    },
    [categories, tagMetadata]
  );

  // Use the tags from the idea data
  const tagStrings = useMemo(() => idea.tags ?? [], [idea.tags]);

  // Extract all unique tags from all ideas for autocomplete suggestions
  const allExistingTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const ideaItem of allIdeas) {
      if (ideaItem.tags) {
        for (const tag of ideaItem.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [allIdeas]);

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
          onDirectHide={onDirectHide}
          onTagsUpdated={onTagsUpdated}
          onRenameDish={onRenameDish}
          onDeleteAllInstances={onDeleteAllInstances}
        />
      )}
    </>
  );
});

IdeasTableRow.displayName = 'IdeasTableRow';