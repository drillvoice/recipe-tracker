# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
```bash
npm run dev          # Start development server on localhost:3000
npm run build        # Build for production
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
firebase deploy               # Deploy to Firebase Hosting
```

## Architecture Overview

### Data Flow & Storage Strategy
This is a **local-first** application with cloud backup. All operations write to IndexedDB first, then queue for cloud sync:

1. **Primary Storage**: IndexedDB (`recipe-tracker-enhanced` v2) with enhanced schema
2. **Cloud Backup**: Firebase Firestore under `users/{uid}/meals/{mealId}`
3. **Sync Strategy**: Anonymous authentication with automatic background sync

### Database Schema (IndexedDB)
The enhanced schema includes four object stores:
- `meals`: Core meal data with indexes on date and mealName
- `cache_meta`: Backup timestamps and metadata
- `settings`: App preferences and configuration
- `sync_queue`: Pending operations for cloud sync

### Key Libraries & Modules

**Storage Layer (`src/lib/`)**:
- `offline-storage.ts`: Enhanced IndexedDB operations with metadata tracking
- `firestore-backup.ts`: Cloud backup operations to Firestore
- `mealsStore.ts`: Legacy compatibility layer (being phased out)

**Data Management**:
- `export-manager.ts`: Multi-format export (JSON, CSV, Backup with checksums)
- `import-manager.ts`: Import with conflict resolution and preview
- `data-validator.ts`: Data integrity checks with 0-100 scoring

**Firebase Integration**:
- `firebase.ts`: Configuration with offline persistence enabled
- `auth.ts`: Email/password authentication helpers (for account linking)

### Component Architecture
- **Pages**: Next.js pages with server-side rendering disabled (SPA mode)
- **Hooks**: `useMeals`, `useIdeas` for data management with automatic sync
- **Navigation**: Shared navigation component across all pages
- **Mobile-First**: Responsive design optimized for mobile usage

### Data Models
```typescript
interface Meal {
  id: string;
  mealName: string;
  date: Timestamp;     // Firebase Timestamp for consistent serialization
  uid?: string;        // User ID for cloud sync
  pending?: boolean;   // Marks unsynced meals
  hidden?: boolean;    // For hide/show functionality
}
```

## Backup System Architecture

### Cloud Backup Process
1. User clicks "Backup to Cloud" → triggers `backupMealsToCloud()`
2. Ensures anonymous authentication via `ensureAuthentication()`
3. Uploads all local meals to `users/{uid}/meals/{mealId}`
4. Updates backup metadata in Firestore and local cache
5. UI shows real-time status: authentication, sync state, last backup time

### Local Export System
Separate from cloud backup, provides file-based exports:
- **JSON**: Complete data with metadata
- **CSV**: Spreadsheet-compatible format
- **Backup**: Compressed with checksums for integrity

### Import System
- File validation and format detection
- Conflict resolution with preview
- Dry-run capability before actual import
- Automatic backup creation before import

## Testing Strategy

### Test Structure
- `__tests__/`: Comprehensive Jest test suite
- `fake-indexeddb`: Mocks IndexedDB for consistent testing
- Firebase mocking for auth and Firestore operations
- Visual regression tests (currently skipped)

### Key Test Files
- `backup-system.test.ts`: End-to-end backup/restore workflows
- `account.test.tsx`: Data management interface tests
- `performance.test.ts`: Load testing with large datasets
- `integration/`: Cross-component integration tests

## Version Management Convention

### Automatic Version Updates
When making significant changes, always:
1. **Update version** in `package.json`, `src/pages/index.tsx` (UI indicator), and `src/lib/export-manager.ts`
2. **Update CHANGELOG.md** with detailed entry following Keep a Changelog format
3. **Use semantic versioning**: patch (0.0.X), minor (0.X.0), major (X.0.0)
4. **Mark breaking changes** with `BREAKING:` prefix in changelog

### Changelog Format
Follow the established pattern:
- `### Added` - New features
- `### Changed` - Modifications to existing features
- `### Fixed` - Bug fixes
- `### Technical` - Internal improvements

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
  meals/{mealId}          # Individual meal documents
  metadata/backup         # Backup timestamps and metadata
```

## Key Architectural Patterns

### Error Handling
- Defensive programming for Firebase Timestamp serialization
- Graceful degradation when offline or authentication fails
- User-friendly error messages with specific guidance

### Performance Considerations
- IndexedDB operations are batched where possible
- Firestore queries use proper indexing
- Large dataset operations are tested up to 1000+ meals
- Component renders are optimized with proper dependency arrays

### Security Model
- Anonymous authentication by default
- Optional email/password account linking
- All data scoped to authenticated user's UID
- No sensitive data in client-side code or commits