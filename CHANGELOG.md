# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2025-09-15

### Added
- **Database Migration System**: Automatic migration from legacy to enhanced IndexedDB schema
- **File System Access API**: Modern "Save As" dialog support for Chrome/Edge browsers
- **Enhanced Export Instructions**: Clear guidance for saving to Google Drive and other locations

### Changed
- **Simplified Export Interface**: Removed complex dropdowns and checkboxes for one-click JSON export
- **Unified Database Layer**: All components now consistently use enhanced IndexedDB schema
- **Improved Export Experience**: Single "Export All Data (JSON)" button includes all meals, settings, and metadata

### Fixed
- **Critical Cloud Backup Issue**: Fixed "0 meals backed up" error by consolidating database sources
- **Data Synchronization**: Resolved inconsistency between UI data display and cloud backup sources
- **Export Functionality**: Enhanced file save dialog with better location selection options

### Technical
- Added database migration utilities with automated legacy data transfer
- Updated all meal operations (save, load, export, backup) to use unified database
- Maintained complete backup system test coverage (23/23 tests passing)
- Enhanced CacheMetadata interface with migration tracking fields

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