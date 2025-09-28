import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'danger';
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default'
}: ConfirmDialogProps) {
  const previousOverflowRef = useRef<string | null>(null);

  useEffect(() => {
    const { style } = document.body;

    if (isOpen) {
      if (previousOverflowRef.current === null) {
        previousOverflowRef.current = style.overflow;
      }
      style.overflow = 'hidden';
    } else if (previousOverflowRef.current !== null) {
      style.overflow = previousOverflowRef.current;
      previousOverflowRef.current = null;
    }

    return () => {
      if (previousOverflowRef.current !== null) {
        style.overflow = previousOverflowRef.current;
        previousOverflowRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-content" onClick={e => e.stopPropagation()}>
        <h3 className="dialog-title">{title}</h3>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button 
            className="dialog-btn dialog-btn-secondary" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`dialog-btn dialog-btn-${variant === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}