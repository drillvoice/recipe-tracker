import { useState, useCallback, useMemo } from 'react';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

const DEFAULT_STATE: ConfirmDialogState = {
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {}
};

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>(DEFAULT_STATE);

  const showDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    setDialogState({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  }, []);

  const hideDialog = useCallback(() => {
    setDialogState(DEFAULT_STATE);
  }, []);

  const confirmAndClose = useCallback(() => {
    try {
      dialogState.onConfirm();
    } finally {
      hideDialog();
    }
  }, [dialogState, hideDialog]);

  const dialogProps = useMemo(() => ({
    isOpen: dialogState.isOpen,
    title: dialogState.title,
    message: dialogState.message,
    onConfirm: confirmAndClose,
    onCancel: hideDialog
  }), [dialogState.isOpen, dialogState.title, dialogState.message, confirmAndClose, hideDialog]);

  return {
    dialogProps,
    showDialog
  };
}