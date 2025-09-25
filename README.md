# Recipe Tracker

A Next.js web application for tracking meals with offline-first architecture. Built with TypeScript, Firebase, and IndexedDB for reliable local storage and cloud sync.

## Current Features
- **Meal Tracking**: Add meals with names and dates, with autocomplete suggestions based on previous entries
- **Offline Storage**: IndexedDB-based local storage ensures data persistence even when offline
- **Cloud Sync**: Automatic Firebase Firestore sync with anonymous authentication
- **History View**: Chronological listing of all meals with edit/delete capabilities
- **Ideas View**: Unique meal aggregation showing frequency and last cooked date
- **Mobile-Friendly**: Responsive design optimized for mobile devices
- **Data Management**: Hide/show meals, bulk operations, and conflict resolution

## Architecture

### Storage Layer
- **IndexedDB**: Primary storage using `idb` library with `recipe-tracker` database
- **Object Store**: Single `meals` store with meal objects containing id, mealName, date, uid, pending, and hidden flags
- **Offline-First**: All operations write to IndexedDB first, then queue for cloud sync

### Sync System
- **Anonymous Authentication**: Automatic Firebase Auth sign-in on app load
- **Background Sync**: Pending meals automatically sync to Firestore when online
- **Conflict Resolution**: Last-write-wins using server timestamps
- **Persistence**: Firebase offline persistence enabled for seamless offline experience

### Project Structure
```
src/
  lib/
    firebase.ts       # Firebase config and initialization
    auth.ts          # Authentication helpers
    mealsStore.ts    # IndexedDB operations and meal data models
  pages/             # Next.js pages (index, history, ideas, account)
  hooks/             # React hooks for data management (useMeals, useIdeas)
  components/        # Reusable UI components
  utils/             # Validation, rate limiting, performance utilities
  styles/           # Global CSS styles
__tests__/          # Comprehensive Jest test suite
```

## Getting Started
```bash
npm install
npm run dev
```
Visit `http://localhost:3000` to start using the app.

### Environment Variables
Create a `.env.local` file with the following values from your Firebase project:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
```

### Running Tests
The project uses Jest and Testing Library. Execute all tests with:
```bash
npm test
```

## Firebase Hosting Deployment
1. Install the [Firebase CLI](https://firebase.google.com/docs/cli) and log in.
2. Build the static site with the Firebase-specific target:
   ```bash
   npm run build:firebase
   ```
   The command sets `NEXT_DEPLOY_TARGET=firebase-hosting` so `next build` emits the `out` directory required by Firebase Hosting.
3. Deploy to Firebase Hosting:
   ```bash
   firebase deploy --only hosting
   ```

## Roadmap
- **Enhanced Backup System**: Manual export/import with multiple formats, conflict resolution, and metadata
- **Search & Filtering**: Advanced search by date, meal name, and frequency
- **Smart Suggestions**: Recommendations for meals not cooked recently
- **Calendar Integration**: Optional calendar view and scheduling
- **Multi-User Support**: Shared meal tracking for households

## Contributing
Pull requests are welcome! Please ensure `npm test` passes before submitting.

## License
MIT

## Sync Logic
Firestore persistence is enabled in `src/lib/firebase.ts`. Writes are queued locally when offline and synchronized in the background. Conflicts are resolved with a last-write-wins policy using server timestamps.

## Setup Notes
1. Create `.env.local` with Firebase keys as listed above.
2. On Vercel, set the same keys in the project settings.
3. To run emulators locally:
   ```bash
   npx firebase emulators:start
   ```
4. Seed sample data by adding meals in the UI while offline and reconnecting.
5. To verify cross-device sync, sign in with the same account on two browsers and add meals; they should appear on both after sync.

## Deployment
- **Vercel:** Use the default Next.js build (`npm run build`). No additional configuration is required.
- **Firebase Hosting:** Run `npm run build:firebase` to generate the static `out` directory expected by the Firebase Hosting workflow.
