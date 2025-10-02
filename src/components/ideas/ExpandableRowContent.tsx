import React, { useState } from 'react';
import ActionButton from '@/components/ActionButton';
import { TagManagementSection } from './TagManagementSection';
import type { Idea } from '@/hooks/useIdeas';

interface ExpandableRowContentProps {
  idea: Idea;
  tagStrings: string[];
  allExistingTags: string[];
  getTagColor: (tagName: string) => string;
  onConfirmHide: (idea: Idea) => void;
  onDirectHide?: (idea: Idea) => void;
  onTagsUpdated?: (mealName: string, tags: string[]) => void;
}

export const ExpandableRowContent = React.memo<ExpandableRowContentProps>(({
  idea,
  tagStrings,
  allExistingTags,
  getTagColor,
  onConfirmHide,
  onDirectHide,
  onTagsUpdated
}) => {
  const [showHideConfirm, setShowHideConfirm] = useState(false);

  const handleHideClick = () => {
    if (onDirectHide) {
      onDirectHide(idea);
    } else {
      setShowHideConfirm(true);
    }
  };

  const handleConfirmHide = () => {
    onConfirmHide(idea);
    setShowHideConfirm(false);
  };

  const handleCancelHide = () => {
    setShowHideConfirm(false);
  };

  return (
    <tr className="expanded-row">
      <td colSpan={4}>
        <div className="expanded-content">
          <div className="expanded-section">
            <div className="dish-stats">
              <span className="count-info">Made {idea.count} time{idea.count === 1 ? '' : 's'}</span>
            </div>
          </div>

          <TagManagementSection
            idea={idea}
            tagStrings={tagStrings}
            allExistingTags={allExistingTags}
            getTagColor={getTagColor}
            onTagsUpdated={onTagsUpdated}
          />

          <div className="expanded-section">
            <div className="dish-visibility-section">
              {!showHideConfirm ? (
                <ActionButton
                  icon="👁️‍🗨️"
                  onClick={handleHideClick}
                  title={`Hide "${idea.mealName}" from suggestions`}
                  variant="danger"
                />
              ) : (
                <div className="confirm-hide">
                  <span>Hide "{idea.mealName}"?</span>
                  <div className="confirm-buttons">
                    <ActionButton
                      icon="✓"
                      onClick={handleConfirmHide}
                      title="Yes, hide it"
                      variant="danger"
                    />
                    <ActionButton
                      icon="✕"
                      onClick={handleCancelHide}
                      title="Cancel"
                      variant="default"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
});

ExpandableRowContent.displayName = 'ExpandableRowContent';