import { useState, useEffect, useCallback } from 'react';
import {
  getAllTags,
  saveTag,
  updateTag,
  deleteTag,
  addTagToMeal,
  removeTagFromMeal,
  getTagsByName,
  getMealsByTag,
  type Tag
} from '@/lib/offline-storage';

export interface TagManagerState {
  tags: Tag[];
  isLoading: boolean;
  error: Error | null;
}

export function useTagManager() {
  const [state, setState] = useState<TagManagerState>({
    tags: [],
    isLoading: true,
    error: null
  });

  const loadTags = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const tags = await getAllTags();
      // Sort tags by usage count (descending) and then by name
      tags.sort((a, b) => {
        if (b.usageCount !== a.usageCount) {
          return b.usageCount - a.usageCount;
        }
        return a.name.localeCompare(b.name);
      });
      setState(prev => ({ ...prev, tags, isLoading: false }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error('Failed to load tags'),
        isLoading: false
      }));
    }
  }, []);

  const createTag = useCallback(async (name: string, color: string): Promise<Tag | null> => {
    try {
      // Check for duplicate names
      const existingTags = await getTagsByName(name.trim());
      if (existingTags.length > 0) {
        throw new Error('A tag with this name already exists');
      }

      const newTag: Tag = {
        id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        color: color,
        createdAt: new Date(),
        usageCount: 0
      };

      await saveTag(newTag);

      // Optimistically update local state
      setState(prev => ({
        ...prev,
        tags: [...prev.tags, newTag].sort((a, b) => {
          if (b.usageCount !== a.usageCount) {
            return b.usageCount - a.usageCount;
          }
          return a.name.localeCompare(b.name);
        })
      }));

      return newTag;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error('Failed to create tag')
      }));
      return null;
    }
  }, []);

  const updateTagData = useCallback(async (id: string, updates: Partial<Tag>): Promise<boolean> => {
    try {
      const updatedTag = await updateTag(id, updates);
      if (updatedTag) {
        // Optimistically update local state
        setState(prev => ({
          ...prev,
          tags: prev.tags.map(tag => tag.id === id ? updatedTag : tag).sort((a, b) => {
            if (b.usageCount !== a.usageCount) {
              return b.usageCount - a.usageCount;
            }
            return a.name.localeCompare(b.name);
          })
        }));
        return true;
      }
      return false;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error('Failed to update tag')
      }));
      return false;
    }
  }, []);

  const deleteTagData = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Check if tag is in use
      const mealsUsingTag = await getMealsByTag(id);
      if (mealsUsingTag.length > 0) {
        throw new Error(`Cannot delete tag: it is used by ${mealsUsingTag.length} meal(s)`);
      }

      await deleteTag(id);

      // Optimistically update local state
      setState(prev => ({
        ...prev,
        tags: prev.tags.filter(tag => tag.id !== id)
      }));

      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error('Failed to delete tag')
      }));
      return false;
    }
  }, []);

  const assignTagToMeal = useCallback(async (mealId: string, tagId: string): Promise<boolean> => {
    try {
      const success = await addTagToMeal(mealId, tagId);
      if (success) {
        // Update usage count in local state
        setState(prev => ({
          ...prev,
          tags: prev.tags.map(tag =>
            tag.id === tagId
              ? { ...tag, usageCount: tag.usageCount + 1 }
              : tag
          ).sort((a, b) => {
            if (b.usageCount !== a.usageCount) {
              return b.usageCount - a.usageCount;
            }
            return a.name.localeCompare(b.name);
          })
        }));
      }
      return success;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error('Failed to assign tag to meal')
      }));
      return false;
    }
  }, []);

  const unassignTagFromMeal = useCallback(async (mealId: string, tagId: string): Promise<boolean> => {
    try {
      const success = await removeTagFromMeal(mealId, tagId);
      if (success) {
        // Update usage count in local state
        setState(prev => ({
          ...prev,
          tags: prev.tags.map(tag =>
            tag.id === tagId
              ? { ...tag, usageCount: Math.max(0, tag.usageCount - 1) }
              : tag
          ).sort((a, b) => {
            if (b.usageCount !== a.usageCount) {
              return b.usageCount - a.usageCount;
            }
            return a.name.localeCompare(b.name);
          })
        }));
      }
      return success;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error('Failed to unassign tag from meal')
      }));
      return false;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const getTagById = useCallback((id: string): Tag | undefined => {
    return state.tags.find(tag => tag.id === id);
  }, [state.tags]);

  const getTagsByIds = useCallback((ids: string[]): Tag[] => {
    return ids.map(id => state.tags.find(tag => tag.id === id)).filter(Boolean) as Tag[];
  }, [state.tags]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  return {
    ...state,
    loadTags,
    createTag,
    updateTag: updateTagData,
    deleteTag: deleteTagData,
    assignTagToMeal,
    unassignTagFromMeal,
    clearError,
    getTagById,
    getTagsByIds
  };
}