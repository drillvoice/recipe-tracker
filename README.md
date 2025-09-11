# Recipe Tracker

A tiny web app for logging what you cooked each night.

## Features (MVP)
- Record a meal name and date.
- Anonymous authentication (Firebase Auth).
- Store entries in Firestore and list them chronologically.

## Tech Stack
- [Next.js](https://nextjs.org/) (deployed on Firebase Hosting)
- [Firebase Firestore](https://firebase.google.com/docs/firestore)
- [Firebase Auth](https://firebase.google.com/docs/auth)

## Getting Started

```bash
npm install
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
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
- Optional calendar integration and multi‑user support

## License
MIT
