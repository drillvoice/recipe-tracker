 Backup and Data Management Overview

This project uses a **local-first** approach to storing and backing up data. IndexedDB keeps everything available offline, while Firebase Firestore serves as a cloud backup using anonymous authentication. Manual export and import paths let users keep their own copies of the data.

---

## Offline Storage (IndexedDB)

- Database opened with [`idb`](https://github.com/jakearchibald/idb) under the name `chess-logger-offline`.
- Object stores include `sessions`, `cache_meta`, `statistics`, `settings`, `daily_goals`, and `sync_queue`.
- Helper layer (`offline-storage.ts`) exposes CRUD functions and metadata helpers such as `getSessions`, `addSession`, and `getLastBackupTimestamp`.
- Session transactions (`storage/sessions.ts`) handle reads and writes, plus bookkeeping for unsynced changes.

## Firestore Backup

- Firebase modules are loaded lazily. Anonymous auth (`signInAnonymously`) is established via `ensureAuthentication`.
- Firestore persistence is enabled for offline access.
- CRUD helpers write to IndexedDB first and then queue a cloud backup.
- `firestore-backup.ts` reads all local sessions and writes them to Firestore under `users/<uid>/trainingSessions/<sessionId>`.
- `backupDailyGoalsToCloud` handles daily goal settings. A weekly check (`isBackupNeeded`) prompts backups if the last one is over seven days old.

## Manual Export & Import

- `ExportManager` gathers sessions, daily goals, and settings into JSON or CSV formats. A custom `backup` format adds metadata, optional compression, and checksums.
- `ImportManager` validates input, previews conflicts, and performs imports with options to skip, overwrite, merge, or ask.
- Import runs can perform a dry run or create a pre-import backup.

## Applying the Pattern to Other Apps

To adapt this structure for another app (for example, a recipe tracker):

1. Define an IndexedDB schema for domain entities (recipes, ingredients, tags).
2. Provide a helper module with CRUD functions and metadata similar to `offline-storage.ts`.
3. Initialize Firebase with anonymous auth and Firestore persistence.
4. Implement backup routines that read from IndexedDB and write to Firestore under `users/<uid>/...`, tracking `lastBackupTimestamp`.
5. Offer manual export/import utilities that serialize your app's data, validate it on import, and handle conflicts.
6. Surface UI elements for "Backup Now" actions, status indicators, and optional scheduled backups.

The goal is to keep the app fully usable offline, while Firestore acts as a safety net and cross-device backup location. Manual exports provide an extra layer of user-controlled backup.