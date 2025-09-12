interface ActionButtonProps {
  icon: string;
  onClick: () => void;
  title: string;
  variant?: 'default' | 'danger' | 'success';
  disabled?: boolean;
}

export default function ActionButton({ 
  icon, 
  onClick, 
  title, 
  variant = 'default', 
  disabled = false 
}: ActionButtonProps) {
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
}