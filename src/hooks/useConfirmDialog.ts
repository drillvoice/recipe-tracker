import { useState } from 'react';

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

  const showDialog = (title: string, message: string, onConfirm: () => void) => {
    setDialogState({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  const hideDialog = () => {
    setDialogState(DEFAULT_STATE);
  };

  const confirmAndClose = () => {
    try {
      dialogState.onConfirm();
    } finally {
      hideDialog();
    }
  };

  return {
    dialogProps: {
      isOpen: dialogState.isOpen,
      title: dialogState.title,
      message: dialogState.message,
      onConfirm: confirmAndClose,
      onCancel: hideDialog
    },
    showDialog
  };
}