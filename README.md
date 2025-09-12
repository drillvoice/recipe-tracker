# Recipe Tracker

A small offline-capable web app for logging what you cooked each night. Meals are saved locally for instant feedback and synced to Firebase when a connection is available.

## Current Features
- Add a meal with a name and date.
- Automatic anonymous authentication with Firebase Auth.
- Offline storage via IndexedDB with background sync to Firestore.
- History page listing all meals chronologically.
- Ideas page showing unique meals, last made date, and how many times you've cooked them.
- Account page stub for future email/password sign in.

## Project Structure
```
src/
  lib/          # Firebase initialization and local meal store helpers
  pages/        # Next.js pages (index, history, ideas, account)
  styles/       # Global CSS styles
__tests__/      # Jest unit tests for pages and libraries
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
```

### Running Tests
The project uses Jest and Testing Library. Execute all tests with:
```bash
npm test
```

## Firebase Hosting Deployment
1. Install the [Firebase CLI](https://firebase.google.com/docs/cli) and log in.
2. Build and export the static site:
   ```bash
   npm run build
   npx next export -o public
   ```
3. Deploy to Firebase Hosting:
   ```bash
   firebase deploy
   ```

## Roadmap
- Search/filter by date or meal name
- Suggestions for meals not cooked recently
- Export/import meal history
- Optional calendar integration and multi-user support

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
