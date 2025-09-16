# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.7] - 2025-09-16

### Changed
- **Performance Optimization: Eliminated Full Reloads**: useMeals hook now uses optimistic updates instead of full data reloads for update/delete/hide operations
- **Performance Optimization: IndexedDB Efficiency**: hideMealsByName now uses indexed lookups and batch operations instead of scanning all meals
- **Performance Optimization: Firebase Batch Writes**: Cloud backup now uses Firestore batch writes (500 operations per batch) instead of individual setDoc calls
- **Performance Optimization: Atomic Transactions**: saveMeal operations now use atomic IndexedDB transactions for better consistency and performance

### Technical
- Optimized React state updates with local mutations instead of database reloads
- Added IndexedDB transaction batching for multi-meal operations
- Implemented Firebase writeBatch for improved cloud backup performance
- Added memoization for Ideas page hidden count calculation
- Reduced unnecessary component re-renders through optimistic updates

## [0.2.6] - 2025-09-16

### Fixed
- **CRITICAL: Cloud Backup Data Loss Bug**: Fixed cloud backup failing to backup meals by updating firestore-backup.ts to use enhanced storage system instead of legacy database
- **Database Consistency**: Unified all imports to use enhanced offline-storage.ts instead of legacy mealsStore.ts across codebase
- **Backup Reliability**: Cloud backup now correctly includes all locally stored meals including hidden meals

### Technical
- Updated firestore-backup.ts to import from @/lib/offline-storage instead of @/lib/mealsStore
- Updated test files (history.test.tsx, ideas.test.tsx) to mock enhanced storage system
- Consolidated index.tsx imports to use single storage system for consistency
- This fixes the critical issue where meals were saved to enhanced database but cloud backup read from legacy database

## [0.2.5] - 2025-09-16

### Changed
- **Import Message Position**: Success/error messages now appear in Import Data tab instead of top of page
- **Contextual Feedback**: Import messages display directly under file drop zone where user is working

### Technical
- Added dedicated import message state separate from global messages
- Enhanced UX by providing feedback closer to user interaction area

## [0.2.4] - 2025-09-16

### Fixed
- **Import User Experience**: Removed confusing automatic backup creation during import process
- **Import Success Messages**: Enhanced with clear statistics showing exactly what was imported

### Changed
- **Import Backup**: Disabled automatic backup creation to prevent confusing "Save As" dialog during import
- **Success Feedback**: Import now shows detailed results like "✅ Import successful! 6 new recipes imported"

### Technical
- Improved import workflow to focus on import action without backup side effects
- Enhanced success message formatting with emoji indicators and detailed statistics

## [0.2.3] - 2025-09-16

### Fixed
- **Import Data Functionality**: Fixed critical bug where import failed with "no file found" error
- **File Content Management**: Import now stores file content during preview instead of re-reading cleared file input
- **Backup Export Version**: Fixed hardcoded version number in backup exports to use current app version

### Technical
- Enhanced import workflow to properly handle file content between preview and import stages
- Added comprehensive debugging logs for import troubleshooting
- Improved state management for import preview and file content

## [0.2.2] - 2025-09-16

### Fixed
- **Import Validation Enhancement**: Improved legacy format detection and validation logic for better compatibility
- **Status Text Display**: Fixed "Up to Date" text wrapping to ensure single-line display next to Cloud Backup

### Technical
- Enhanced import manager validation logic for more robust file format detection
- Improved CSS layout for status indicators with white-space controls

## [0.2.1] - 2025-09-15

### Added
- **Progressive Web App (PWA) Implementation**: Complete conversion to PWA with full feature set
- **Web App Manifest**: App installation support across desktop and mobile platforms
- **Service Worker**: Comprehensive offline functionality with intelligent caching strategies
- **Native File Picker**: File System Access API for saving directly to Google Drive, OneDrive, and custom locations
- **Install Prompt Component**: Smart installation prompts with beforeinstallprompt handling
- **PWA Status Dashboard**: Real-time display of PWA capabilities and installation status
- **Database Migration System**: Automatic migration from legacy to enhanced IndexedDB schema
- **Comprehensive Testing Guide**: Complete PWA testing documentation with cross-platform instructions

### Changed
- **App Installation**: Users can now install as native-like app on desktop and mobile
- **Export Experience**: Native "Save As" dialogs replace traditional downloads in supported browsers
- **Offline Functionality**: Complete app functionality available without internet connection
- **Simplified Export Interface**: Single "Export All Data (JSON)" button with enhanced save options
- **Unified Database Layer**: All components consistently use enhanced IndexedDB schema

### Fixed
- **Critical Export/Import Compatibility**: Fixed "unrecognized JSON format" error when importing exported data
- **Mobile UI Status Positioning**: Fixed Cloud Backup status text positioning on mobile devices
- **Critical Cloud Backup Issue**: Fixed "0 meals backed up" error by consolidating database sources
- **Data Synchronization**: Resolved inconsistency between UI data display and cloud backup sources
- **Cross-Platform Compatibility**: PWA features gracefully degrade on unsupported browsers

### Technical
- Added comprehensive PWA infrastructure (manifest.json, sw.js, PWA utilities)
- Implemented File System Access API with fallback strategies
- Service worker with app shell, network-first, and cache-first strategies
- TypeScript interfaces for PWA features and file operations
- Enhanced Firestore security rules for proper data isolation
- Database migration utilities with automated legacy data transfer

## [0.2.0] - 2025-01-15

### Added
- **BREAKING**: Implemented true cloud backup functionality to Firestore
- Anonymous authentication with automatic sign-in for cloud services
- Real-time cloud backup status display showing authentication and sync state
- Comprehensive firestore-backup.ts module with full CRUD operations
- Cloud backup metadata tracking with timestamps and meal counts

### Changed
- **BREAKING**: "Backup Now" button now creates actual Firestore backup instead of local file download
- Replaced misleading local backup status with accurate cloud backup indicators
- Renamed "Enhanced Data Management" to "Local Data Management" for clarity
- Updated UI to clearly distinguish between cloud backup and local file operations
- Cloud backup shows real meal count, last backup time, and connection status

### Fixed
- Resolved user confusion about backup destination (cloud vs local)
- Fixed inaccurate backup status that showed "warning" after successful backups
- Improved user feedback with clear success/error messages for cloud operations

### Technical
- Added comprehensive test coverage for cloud backup functionality
- Proper error handling and retry logic for Firestore operations
- TypeScript interfaces for cloud backup status and results

## [0.1.0] - 2025-01-15

### Major Updates
- **BREAKING**: Updated Next.js from 14.2.32 to 15.5.3
- **BREAKING**: Updated React from 18.2.0 to 19.1.1
- **BREAKING**: Updated React DOM from 18.2.0 to 19.1.1

### Changed
- Updated GitHub Actions workflows to use actions/checkout@v5 and actions/setup-node@v5
- Updated build tool dependencies (browserslist, electron-to-chromium)
- Updated @types/react to 19.1.13 for React 19 compatibility
- Fixed ESLint lexical declaration error in import-manager.ts

### Infrastructure
- All dependency security patches applied
- Performance improvements from framework updates
- Enhanced future compatibility

## [0.0.7] - 2024-12-XX

### Added
- Complete UI transformation from Account to Data Management interface
- Anonymous-only authentication with comprehensive backup system
- Multi-format export/import (JSON, CSV, Backup)
- Data integrity dashboard with 0-100 scoring
- Cloud backup status indicators
- Enhanced IndexedDB schema with metadata tracking
- Migration system for database upgrades
- Comprehensive backup system test suite (23 tests)

### Changed
- Navigation updated: "Account" → "Data"
- Professional styling with 550+ lines of responsive CSS
- Enhanced offline-first architecture

### Security
- Removed email/password authentication
- Implemented secure anonymous-only system
- Added data validation and integrity checks

## Previous Versions

### [0.0.6] - Performance optimizations and testing improvements
### [0.0.5] - Code quality refactoring improvements
### [0.0.4] - UI/UX modernization and consistency improvements
### [0.0.3] - Advanced meal management: edit, delete, and hide functionality
### [0.0.2] - Mobile-friendly autocomplete for meal names
### [0.0.1] - Initial release