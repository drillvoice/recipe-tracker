import { useCallback, useSyncExternalStore } from 'react';
import {
  TagManager,
  TAG_COLORS,
  TAG_MANAGEMENT_UPDATED_EVENT,
  TAG_MANAGEMENT_STORAGE_KEY,
  type TagManagementData
} from '@/lib/tag-manager';

// Tag settings live in localStorage as JSON. Every dish row needs them for
// chip colors, so they are parsed once into this shared cache instead of
// once per row, and re-read only when the settings change.
let cached: TagManagementData | null = null;
const listeners = new Set<() => void>();

const SERVER_SNAPSHOT: TagManagementData = { categories: [], tags: {} };

function invalidate(): void {
  cached = null;
  listeners.forEach(listener => listener());
}

function handleStorage(event: StorageEvent): void {
  // Another tab changed the settings (null key means storage was cleared)
  if (event.key === null || event.key === TAG_MANAGEMENT_STORAGE_KEY) {
    invalidate();
  }
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener(TAG_MANAGEMENT_UPDATED_EVENT, invalidate);
    window.addEventListener('storage', handleStorage);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener(TAG_MANAGEMENT_UPDATED_EVENT, invalidate);
      window.removeEventListener('storage', handleStorage);
      // Nothing is listening for changes any more, so re-read on next use
      cached = null;
    }
  };
}

function getSnapshot(): TagManagementData {
  if (!cached) {
    cached = TagManager.getTagManagementData();
  }
  return cached;
}

function getServerSnapshot(): TagManagementData {
  return SERVER_SNAPSHOT;
}

/** Returns a function mapping a tag name to its chip background color. */
export function useTagColors(): (tagName: string) => string {
  const { categories, tags } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useCallback(
    (tagName: string): string => {
      const metadata = tags[tagName];

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
    [categories, tags]
  );
}
