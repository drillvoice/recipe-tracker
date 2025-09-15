# Recipe Tagging System Implementation Guide

## Overview
Implement a user-driven recipe tagging system for the Ideas page that allows users to create custom tags with their own colors and categorization for better organization and filtering.

## Core Requirements

### 1. Data Structure Changes
Extend the `Idea` interface to include a `tags` property:

```typescript
interface Idea {
  mealName: string;
  lastMade: string;
  count: number;
  hidden: boolean;
  tags: string[]; // Array of tag IDs
}

interface Tag {
  id: string;
  name: string;
  color: string; // User-selected hex color
  createdAt: Date;
  usageCount: number; // Track how many meals use this tag
}
```

- **Create separate tag storage** - tags are global entities, meals reference them by ID
- **Update storage layer** to persist tags separately from meals
- **Create tag management utilities** for CRUD operations

### 2. UI Components to Create

#### A. Enhanced Ideas Table Row
- Display tags as colored chips below meal name (using user-defined colors)
- Add tag edit button (🏷️) to action buttons
- Make meal name clickable to open tag modal

#### B. Tag Filter Bar
- **Flex-wrap layout** - tags wrap to new rows as needed (not horizontal scroll)
- Show "All" + all existing tags from the tag database
- Active state styling for selected filters
- Update filtered results in real-time

#### C. Tag Modal Component
- **Modal Structure**: Header with meal name, body with tag sections, footer with save/cancel
- **Current Tags Section**: Removable tag chips with × buttons
- **Available Tags Section**: All existing tags with selection checkboxes/buttons
- **Create New Tag Section**: 
  - Text input for tag name
  - Color picker for tag color
  - "Add Tag" button
- **No Categories**: Single flat list of all tags

### 3. Functionality Requirements

#### A. Tag Management
- **Global Tag System**: Tags exist independently and are reused across meals
- **Tag Creation**: Users create tags with custom names and colors
- **Tag Assignment**: Assign/unassign existing tags to meals
- **Tag Deletion**: Remove unused tags (with confirmation)
- **Color Customization**: Users choose tag colors via color picker

#### B. Filtering System
- **Filter by Tags**: Show/hide meals based on selected tag filters
- **Multiple Filters**: Support AND logic (meal must have all selected tags)
- **Filter State Persistence**: Remember active filters during session
- **Clear Filters**: Easy way to reset to "All"
- **Dynamic Filter List**: Filter bar updates as new tags are created

#### C. Modal Behavior
- **Open Triggers**: Meal name click OR tag button click
- **Close Triggers**: Save button, Cancel button, Escape key, outside click
- **State Management**: Load existing meal tags when opening
- **Real-time Updates**: Tag creation immediately available for assignment

### 4. Implementation Steps

#### Phase 1: Data Layer
1. Update `Idea` interface for tag references
2. Create `Tag` interface and tag storage utilities
3. Create `useTagManager` hook for tag CRUD operations
4. Update `useIdeas` hook to load tag data alongside meal data

#### Phase 2: Tag Management
1. Create `TagChip` component (displays tag with user color)
2. Create `ColorPicker` component for tag creation
3. Create `TagCreationForm` component 
4. Create tag deletion and management utilities

#### Phase 3: Modal & Assignment
1. Create `TagModal` component with:
   - Current tags display
   - Available tags selection
   - New tag creation form
2. Implement tag assignment/unassignment logic
3. Connect to existing meal data

#### Phase 4: Filtering & UI Integration
1. Create `TagFilterBar` component with flex-wrap layout
2. Implement filtering logic in Ideas page
3. Update `IdeasTableRow` to display user-colored tags
4. Add modal state management to Ideas page

### 5. Tag Creation Flow

```typescript
// User creates a new tag
const createTag = async (name: string, color: string) => {
  const newTag: Tag = {
    id: generateId(),
    name: name.trim(),
    color: color,
    createdAt: new Date(),
    usageCount: 0
  };
  
  await saveTag(newTag);
  return newTag;
};
```

### 6. Color System
- **Color Picker**: Use HTML5 color input or custom color picker
- **Default Colors**: Provide palette of suggested colors but allow custom hex
- **Color Validation**: Ensure sufficient contrast for readability
- **Color Preview**: Show real-time preview of tag appearance

### 7. CSS Considerations
**Dynamic Tag Colors**: Use CSS custom properties or inline styles

```css
.tag-chip {
  background-color: var(--tag-color);
  color: var(--tag-text-color); /* Auto-calculated for contrast */
}
```

**Filter Bar Layout**: 
```css
.tag-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
```

- **Tag Chips**: Consistent sizing regardless of color
- **Modal Layout**: Accommodate variable numbers of tags

### 8. State Management
- **Global Tag State**: All available tags loaded at app start
- **Modal State**: Open/closed, current meal, selected tags
- **Filter State**: Active tag filters, filtered meal list
- **Tag Creation State**: New tag form data

### 9. Tag Management Features

#### A. Tag Usage Tracking
- Track `usageCount` for each tag
- Show usage count in tag management interface
- Prevent deletion of tags in use (or show warning)

#### B. Tag Cleanup
- Identify unused tags for cleanup
- Bulk tag operations for power users
- Tag merging functionality (advanced feature)

#### C. Tag Organization
- Sort tags by usage, creation date, or alphabetically
- Search/filter through available tags in modal
- Recently used tags appear first

### 10. Performance Considerations
- **Memoize filtered results** with `useMemo`
- **Cache tag data** to avoid repeated lookups
- **Optimize color contrast calculations**
- **Lazy load** modal content until first use
- **Debounce tag search** if tag list becomes large

### 11. User Experience Details

#### A. Tag Creation UX
- **Instant Preview**: Show tag appearance while typing
- **Duplicate Prevention**: Check for existing tag names
- **Smart Defaults**: Suggest colors that aren't already heavily used
- **Quick Colors**: Provide common color shortcuts

#### B. Tag Assignment UX
- **Visual Feedback**: Clear selected/unselected states
- **Quick Toggle**: Easy to add/remove tags from meals
- **Search Tags**: Find tags quickly in large lists
- **Recent Tags**: Show recently used tags first

#### C. Filtering UX
- **Visual Active State**: Clear indication of active filters
- **Filter Count**: Show number of matching meals
- **Quick Clear**: Easy way to clear all filters
- **Filter Persistence**: Remember filters across page reloads

### 12. Implementation Notes
- **No Predefined Categories**: System is completely user-driven
- **Color Accessibility**: Auto-calculate text color for contrast
- **Tag Reusability**: Emphasize that tags are reusable across meals
- **Data Migration**: Handle existing meals without tags gracefully
- **Flexible Architecture**: Easy to add features like tag descriptions later

### 13. Testing Checklist
- [ ] Tags persist after page reload
- [ ] Custom colors display correctly
- [ ] Tag creation works with various color inputs
- [ ] Filtering works with multiple tag combinations
- [ ] Tag wrap behavior works on mobile
- [ ] Unused tags can be safely deleted
- [ ] Modal tag selection syncs with filter bar
- [ ] Color contrast is sufficient for accessibility
- [ ] Tag names handle special characters and lengths
- [ ] Performance remains good with 50+ tags

## Technical Notes
- Use CSS-in-JS or CSS custom properties for dynamic colors
- Consider using a color manipulation library for contrast calculations
- Implement proper TypeScript types for all tag operations
- Follow existing patterns in the codebase for consistency
- Plan for future features like tag hierarchies or descriptions

## Summary
This user-driven approach provides maximum flexibility while maintaining a clean, organized system that scales with user needs. The implementation focuses on simplicity and user control while providing robust filtering and organization capabilities.