# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
```bash
npm run dev          # Start development server on localhost:3000
npm run build        # Build for production
npm run build:firebase # Build Firebase Cloud Functions
npm run start        # Start production server
npm test             # Run all tests
npm test -- <pattern>  # Run specific test file (e.g., npm test -- account.test.tsx)
```

### Code Quality
```bash
npm run lint         # Check linting issues
npm run lint:fix     # Auto-fix linting issues
npm run type-check   # TypeScript compilation check (no output)
```

### Firebase
```bash
npx firebase emulators:start  # Run local Firebase emulators
firebase deploy               # Deploy to Firebase Hosting and Functions
```

## Architecture Overview

### Data Flow & Storage Strategy
This is a **local-first** Progressive Web App with cloud backup. All operations write to IndexedDB first, then queue for cloud sync:

1. **Primary Storage**: IndexedDB (`recipe-tracker-enhanced` v2) with enhanced schema
2. **Cloud Backup**: Firebase Firestore under `users/{uid}/meals/{mealId}`
3. **Sync Strategy**: Anonymous authentication with automatic background sync

### Database Schema (IndexedDB)
The enhanced schema includes four object stores:
- `meals`: Core dish data with indexes on date and mealName
- `cache_meta`: Backup timestamps and metadata
- `settings`: App preferences and configuration
- `sync_queue`: Pending operations for cloud sync

### Browser Storage (localStorage)
- Tag management data (categories, colors, assignments)
- Tagline rotation state and timing

### Key Libraries & Modules

**Storage Layer (`src/lib/`)**:
- `offline-storage.ts`: Enhanced IndexedDB operations with metadata tracking (PRIMARY)
- `firestore-backup.ts`: Cloud backup operations to Firestore
- `migration.ts`: Database migration utilities and version management

**Data Management**:
- `export-manager.ts`: Multi-format export (JSON, CSV, Backup with checksums)
- `import-manager.ts`: Import with conflict resolution and preview
- `data-validator.ts`: Data integrity checks with 0-100 scoring
- `tag-manager.ts`: Complete tag management system with categories and colors
- `tagline-manager.ts`: Dynamic tagline rotation system

**Firebase Integration**:
- `firebase.ts`: Configuration with offline persistence enabled
- `firebase-auth.ts`: Authentication utilities and token management
- `auth.ts`: Legacy authentication helpers

### Component Architecture
- **Pages**: Next.js pages with server-side rendering disabled (SPA mode)
  - `index.tsx`: Main dish entry page with autocomplete and history accordion
  - `dishes.tsx`: Dish management with expandable rows and tag system
  - `tags.tsx`: Complete tag management interface with categories and colors
  - `account.tsx`: Data management dashboard (renamed from legacy account page)
- **Hooks**: `useMeals`, `useIdeas` for data management with automatic sync
- **Navigation**: Shared navigation component across all pages
- **Data Management Components**: Modular components in `src/components/data-management/`
- **Mobile-First**: Responsive design optimized for mobile usage with PWA capabilities

### Data Models
```typescript
interface Meal {
  id: string;
  mealName: string;    // Now refers to "dishes" in UI
  date: Timestamp;     // Firebase Timestamp for consistent serialization
  uid?: string;        // User ID for cloud sync
  pending?: boolean;   // Marks unsynced meals
  hidden?: boolean;    // For hide/show functionality
  tags?: string[];     // Associated tags for categorization
}

interface TagData {
  name: string;
  category?: string;
  customColor?: string;
  dishCount: number;
  lastUsed: Date;
}

interface CategoryData {
  name: string;
  color: string;
  tagCount: number;
}
```

## Data Management System Architecture

### Cloud Backup Process
1. User clicks "Backup to Cloud" → triggers `backupMealsToCloud()`
2. Ensures anonymous authentication via `ensureAuthentication()`
3. Uploads all local dishes to `users/{uid}/meals/{mealId}` using batch operations
4. Updates backup metadata in Firestore and local cache
5. UI shows real-time status: authentication, sync state, last backup time with unified dashboard

### Local Export System
Separate from cloud backup, provides file-based exports with native file system integration:
- **JSON**: Complete data with metadata
- **CSV**: Spreadsheet-compatible format
- **Backup**: Compressed with checksums for integrity
- **Native Save**: File System Access API for direct save to user's preferred location
- **PWA Integration**: Works offline with service worker caching

### Import System
- File validation and format detection
- Conflict resolution with preview
- Dry-run capability before actual import
- Automatic backup creation before import

## Testing Strategy

### Test Structure
- `__tests__/`: Comprehensive Jest test suite with 23+ test files
- `fake-indexeddb`: Mocks IndexedDB for consistent testing
- Firebase mocking for auth and Firestore operations
- PWA testing with service worker and manifest validation
- Performance testing with large datasets (1000+ dishes)
- Visual regression tests (currently skipped)

### Key Test Files
- `backup-system.test.ts`: End-to-end backup/restore workflows
- `account.test.tsx`: Data management interface tests
- `performance.test.ts`: Load testing with large datasets
- `integration/`: Cross-component integration tests
- `tag-management.test.ts`: Tag system and category management tests
- `pwa-functionality.test.ts`: Progressive Web App feature tests

## Version Management Convention

### Automatic Version Updates
When making significant changes, always:
1. **Update version** in `package.json`, `src/pages/index.tsx` (UI indicator), and `src/lib/export-manager.ts`
2. **Update CHANGELOG.md** with detailed entry following Keep a Changelog format
3. **Use semantic versioning**: patch (0.0.X), minor (0.X.0), major (X.0.0)
4. **Mark breaking changes** with `BREAKING:` prefix in changelog
5. **Update service worker cache version** for PWA deployments

### Changelog Format
Follow the established pattern:
- `### Added` - New features
- `### Changed` - Modifications to existing features
- `### Fixed` - Bug fixes
- `### Technical` - Internal improvements

### Using @CHANGELOG.md in Prompts
When making changes, reference the changelog with `@CHANGELOG.md` to:
- Review recent changes and current version
- Understand the established changelog format and style
- Ensure new entries follow the existing pattern
- Maintain consistency in version numbering and release notes

## Firebase Configuration

### Environment Variables Required
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

### Firestore Data Structure
```
users/{uid}/
  meals/{mealId}          # Individual dish documents
  metadata/backup         # Backup timestamps and metadata
```

### Firebase Cloud Functions
- Automated deployment via GitHub Actions
- Node.js 20 runtime with v6 Firebase Functions SDK

## Key Architectural Patterns

### Error Handling
- Defensive programming for Firebase Timestamp serialization
- Graceful degradation when offline or authentication fails
- User-friendly error messages with specific guidance

### Performance Considerations
- IndexedDB operations are batched where possible
- Firestore queries use proper indexing and batch writes
- Large dataset operations are tested up to 1000+ dishes
- Component renders are optimized with React.memo and proper dependency arrays
- Service worker provides aggressive caching for offline performance
- Optimistic updates reduce perceived latency

### Security Model
- Anonymous authentication by default
- Optional email/password account linking
- All data scoped to authenticated user's UID
- No sensitive data in client-side code or commits
- Comprehensive Content Security Policy in next.config.js
- Security headers (HSTS, X-Frame-Options, etc.) configured
- Service worker follows secure contexts requirements

## Critical Development Notes

### Storage System (IMPORTANT)
**ALWAYS use `@/lib/offline-storage` as the primary storage system**
- Legacy mealsStore.ts and database-migration.ts have been completely removed
- All code uses the enhanced offline-storage system exclusively
- Tests MUST mock `@/lib/offline-storage` for consistent behavior
- Single source of truth prevents data consistency issues

### Test Environment Setup
- `jest.setup.ts` includes required polyfills (window.matchMedia for PWA tests)
- All tests must mock `@/lib/offline-storage` for storage operations
- PWA tests require mocking of service worker APIs
- Integration tests require comprehensive mocking of storage and Firebase functions

### PWA Features
- Progressive Web App with service worker (`public/sw.js`)
- Web App Manifest for installability (`public/manifest.json`)
- File System Access API for native file saving
- Offline-first architecture with comprehensive caching strategies
- Install prompts and PWA status indicators
- Background sync for data operations
- When pushing updates, update @CHANGELOG.md and increment the version number appropriately.

### UI/UX Terminology
- **"Dishes" not "Meals"**: The app uses "dishes" throughout the UI (previously "meals" in earlier versions)
- **Expandable Interfaces**: Tags and Dishes pages use expandable row patterns for compact mobile design
- **Unified Data Dashboard**: Account page transformed into comprehensive data management interface
- **Dynamic Taglines**: Home screen rotates through engaging taglines with randomized timing