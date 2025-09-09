# Recipe Tracker

A tiny web app for logging what you cooked each night.

## Features (MVP)
- Record a meal name and date.
- Email/password authentication (Firebase Auth).
- Store entries in Firestore and list them chronologically.

## Tech Stack
- [Next.js](https://nextjs.org/) (deployed on Vercel)
- [Firebase Firestore](https://firebase.google.com/docs/firestore)
- [Firebase Auth](https://firebase.google.com/docs/auth)

## Getting Started

```bash
npm install
npm run dev
```

### Environment Variables (`.env.local`)
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCKmxmf4e1DnsQA8vymY0UUxLywFZutfLs
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=recipe-tracker-2081c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=recipe-tracker-2081c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=recipe-tracker-2081c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=629747044681
NEXT_PUBLIC_FIREBASE_APP_ID=1:629747044681:web:5fb420b7ff787c33518a98
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-HT0EXY8C6L
```

## Vercel Deployment
1. Create a Vercel project named **recipe-tracker** and connect this repo.
2. Add the above environment variables in Vercel’s dashboard.
3. Push to `main`; Vercel will build and deploy automatically.

## Roadmap
- Search/filter by date or meal name  
- Suggestions for meals not cooked recently  
- Export/import meal history  
- Optional calendar integration and multi‑user support

## License
MIT
