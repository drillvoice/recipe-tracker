# Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Account-scoped meal storage.
    match /users/{userId}/meals/{mealId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create, update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Apply the Rules
1. Open the Firebase console and select your project.
2. Navigate to Firestore Database ➜ Rules.
3. Replace the existing rules with the snippet above and click **Publish**.

These rules require authentication for all accesses and keep each user's data isolated under `users/{uid}/meals`.
