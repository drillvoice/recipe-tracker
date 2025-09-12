# Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /recipes/{userId}/items/{recipeId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /meals/{userId}/items/{mealId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Apply the Rules
1. Open the Firebase console and select your project.
2. Navigate to Firestore Database ➜ Rules.
3. Replace the existing rules with the snippet above and click **Publish**.

These rules require authentication for all accesses and restrict data to the owner's UID.
