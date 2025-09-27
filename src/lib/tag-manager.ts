import { getAllMeals, updateMeal } from './offline-storage';

// Color palette - 8 nice pastels
export const TAG_COLORS = {
  yellow: '#FEF3C7',
  peach: '#FED7AA',
  pink: '#FECACA',
  lavender: '#E9D5FF',
  blue: '#BFDBFE',
  mint: '#BBF7D0',
  beige: '#F3E8FF',
  gray: '#F3F4F6'
} as const;

export type TagColor = keyof typeof TAG_COLORS;

export interface TagCategory {
  id: string;
  name: string;
  color: TagColor;
  createdAt: number;
}

export interface TagInfo {
  name: string;
  category?: string;
  customColor?: TagColor; // Override category color
  count: number;
  lastUsed: number;
}

export interface TagManagementData {
  categories: TagCategory[];
  tags: Record<string, Omit<TagInfo, 'name' | 'count' | 'lastUsed'>>;
}

// Default categories
export const DEFAULT_CATEGORIES: TagCategory[] = [
  { id: 'cuisine', name: 'Cuisine', color: 'mint', createdAt: Date.now() },
  { id: 'protein', name: 'Protein', color: 'peach', createdAt: Date.now() },
  { id: 'cooking-method', name: 'Cooking Method', color: 'blue', createdAt: Date.now() },
  { id: 'dietary', name: 'Dietary', color: 'lavender', createdAt: Date.now() }
];

export const TAG_MANAGEMENT_UPDATED_EVENT = 'tag-management-updated';

export class TagManager {
  private static readonly STORAGE_KEY = 'dish-diary-tag-management';

  // Get tag management data from localStorage
  static getTagManagementData(): TagManagementData {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading tag management data:', error);
    }

    return {
      categories: DEFAULT_CATEGORIES,
      tags: {}
    };
  }

  // Save tag management data to localStorage
  static saveTagManagementData(data: TagManagementData): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(TAG_MANAGEMENT_UPDATED_EVENT, { detail: data })
        );
      }
    } catch (error) {
      console.error('Error saving tag management data:', error);
    }
  }

  // Get all unique tags from meals with usage stats
  static async getAllTags(): Promise<TagInfo[]> {
    const meals = await getAllMeals();
    const tagManagementData = this.getTagManagementData();
    const tagStats = new Map<string, { count: number; lastUsed: number }>();

    // Collect tag usage statistics
    meals.forEach(meal => {
      if (meal.tags && Array.isArray(meal.tags)) {
        const mealTime = meal.date.toMillis ? meal.date.toMillis() : (meal.date as unknown as Date).getTime();

        meal.tags.forEach(tag => {
          if (tag && typeof tag === 'string' && tag.trim()) {
            const tagName = tag.trim();
            const existing = tagStats.get(tagName);

            if (!existing || mealTime > existing.lastUsed) {
              tagStats.set(tagName, {
                count: (existing?.count || 0) + 1,
                lastUsed: mealTime
              });
            } else {
              tagStats.set(tagName, {
                ...existing,
                count: existing.count + 1
              });
            }
          }
        });
      }
    });

    // Combine with stored tag data
    const tags: TagInfo[] = [];
    tagStats.forEach((stats, tagName) => {
      const storedTag = tagManagementData.tags[tagName];
      tags.push({
        name: tagName,
        category: storedTag?.category,
        customColor: storedTag?.customColor,
        count: stats.count,
        lastUsed: stats.lastUsed
      });
    });

    // Sort alphabetically
    return tags.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Get the effective color for a tag (custom color or category color)
  static getTagColor(tag: TagInfo, categories: TagCategory[]): TagColor {
    if (tag.customColor) {
      return tag.customColor;
    }

    if (tag.category) {
      const category = categories.find(c => c.id === tag.category);
      if (category) {
        return category.color;
      }
    }

    return 'gray'; // default
  }

  // Update tag properties
  static async updateTag(
    tagName: string,
    updates: { category?: string; customColor?: TagColor }
  ): Promise<void> {
    const data = this.getTagManagementData();

    if (!data.tags[tagName]) {
      data.tags[tagName] = {};
    }

    if (updates.category !== undefined) {
      data.tags[tagName].category = updates.category;
    }

    if (updates.customColor !== undefined) {
      data.tags[tagName].customColor = updates.customColor;
    }

    this.saveTagManagementData(data);
  }

  // Rename a tag across all meals
  static async renameTag(oldName: string, newName: string): Promise<void> {
    const meals = await getAllMeals();
    const trimmedOldName = oldName.trim();
    const trimmedNewName = newName.trim();

    if (trimmedOldName === trimmedNewName) return;

    // Update all meals
    const updatePromises = meals
      .filter(meal => meal.tags && meal.tags.includes(trimmedOldName))
      .map(async meal => {
        const updatedTags = meal.tags!.map(tag =>
          tag === trimmedOldName ? trimmedNewName : tag
        );

        await updateMeal(meal.id, { tags: updatedTags });
      });

    await Promise.all(updatePromises);

    // Update tag management data
    const data = this.getTagManagementData();
    if (data.tags[trimmedOldName]) {
      data.tags[trimmedNewName] = data.tags[trimmedOldName];
      delete data.tags[trimmedOldName];
      this.saveTagManagementData(data);
    }
  }

  // Delete a tag from all meals
  static async deleteTag(tagName: string): Promise<void> {
    const meals = await getAllMeals();
    const trimmedTagName = tagName.trim();

    // Remove from all meals
    const updatePromises = meals
      .filter(meal => meal.tags && meal.tags.includes(trimmedTagName))
      .map(async meal => {
        const updatedTags = meal.tags!.filter(tag => tag !== trimmedTagName);
        await updateMeal(meal.id, { tags: updatedTags });
      });

    await Promise.all(updatePromises);

    // Remove from tag management data
    const data = this.getTagManagementData();
    if (data.tags[trimmedTagName]) {
      delete data.tags[trimmedTagName];
      this.saveTagManagementData(data);
    }
  }

  // Category management
  static createCategory(name: string, color: TagColor): string {
    const data = this.getTagManagementData();
    const id = name.toLowerCase().replace(/\s+/g, '-');

    const newCategory: TagCategory = {
      id,
      name,
      color,
      createdAt: Date.now()
    };

    data.categories.push(newCategory);
    this.saveTagManagementData(data);

    return id;
  }

  static updateCategory(id: string, updates: { name?: string; color?: TagColor }): void {
    const data = this.getTagManagementData();
    const category = data.categories.find(c => c.id === id);

    if (category) {
      if (updates.name) category.name = updates.name;
      if (updates.color) category.color = updates.color;
      this.saveTagManagementData(data);
    }
  }

  static deleteCategory(id: string): void {
    const data = this.getTagManagementData();
    data.categories = data.categories.filter(c => c.id !== id);

    // Remove category assignment from tags
    Object.values(data.tags).forEach(tag => {
      if (tag.category === id) {
        tag.category = undefined;
      }
    });

    this.saveTagManagementData(data);
  }
}