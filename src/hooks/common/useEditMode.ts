import { useState, useCallback } from 'react';

export interface UseEditModeReturn<T> {
  isEditing: boolean;
  editingId: string | null;
  editValues: T | null;
  startEdit: (id: string, initialValues: T) => void;
  cancelEdit: () => void;
  saveEdit: () => Promise<void>;
  updateEditValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setEditValues: (values: T) => void;
  isEditingItem: (id: string) => boolean;
}

/**
 * Hook for managing inline editing state
 *
 * @param onSave - Function called when saving edits
 * @returns Object with edit mode state and control functions
 *
 * @example
 * ```typescript
 * const {
 *   isEditing,
 *   editingId,
 *   editValues,
 *   startEdit,
 *   cancelEdit,
 *   saveEdit,
 *   updateEditValue,
 *   isEditingItem
 * } = useEditMode<{ name: string; description: string }>(
 *   async (id, values) => {
 *     await api.updateItem(id, values);
 *     refetchItems();
 *   }
 * );
 *
 * return (
 *   <div>
 *     {items.map(item => (
 *       <div key={item.id}>
 *         {isEditingItem(item.id) ? (
 *           <div>
 *             <input
 *               value={editValues?.name || ''}
 *               onChange={(e) => updateEditValue('name', e.target.value)}
 *             />
 *             <button onClick={saveEdit}>Save</button>
 *             <button onClick={cancelEdit}>Cancel</button>
 *           </div>
 *         ) : (
 *           <div>
 *             <span>{item.name}</span>
 *             <button onClick={() => startEdit(item.id, item)}>Edit</button>
 *           </div>
 *         )}
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useEditMode<T extends Record<string, any>>(
  onSave: (id: string, values: T) => Promise<void>
): UseEditModeReturn<T> {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<T | null>(null);

  const isEditing = editingId !== null;

  const startEdit = useCallback((id: string, initialValues: T) => {
    setEditingId(id);
    setEditValues({ ...initialValues });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValues(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editValues) {
      return;
    }

    try {
      await onSave(editingId, editValues);
      setEditingId(null);
      setEditValues(null);
    } catch (error) {
      // Let the caller handle the error
      throw error;
    }
  }, [editingId, editValues, onSave]);

  const updateEditValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    if (!editValues) {
      return;
    }

    setEditValues(prev => prev ? { ...prev, [field]: value } : null);
  }, [editValues]);

  const setEditValuesCallback = useCallback((values: T) => {
    setEditValues(values);
  }, []);

  const isEditingItem = useCallback((id: string) => {
    return editingId === id;
  }, [editingId]);

  return {
    isEditing,
    editingId,
    editValues,
    startEdit,
    cancelEdit,
    saveEdit,
    updateEditValue,
    setEditValues: setEditValuesCallback,
    isEditingItem
  };
}