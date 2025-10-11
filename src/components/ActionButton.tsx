import React from 'react';

interface ActionButtonProps {
  icon: string;
  onClick: () => void;
  title: string;
  variant?: 'default' | 'danger' | 'success' | 'warning' | 'primary';
  disabled?: boolean;
}

const ActionButton = React.memo<ActionButtonProps>(({
  icon,
  onClick,
  title,
  variant = 'default',
  disabled = false
}) => {
  return (
    <button
      className={`action-btn action-btn-${variant}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {icon}
    </button>
  );
});

ActionButton.displayName = 'ActionButton';

export default ActionButton;