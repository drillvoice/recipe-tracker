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
