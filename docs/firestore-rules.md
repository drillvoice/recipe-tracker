# Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profile documents (if needed in future)
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Meals collection - flat structure with uid field for user separation
    match /meals/{mealId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.uid;
    }
  }
}
```

## Apply the Rules
1. Open the Firebase console and select your project.
2. Navigate to Firestore Database ➜ Rules.
3. Replace the existing rules with the snippet above and click **Publish**.

These rules require authentication for all accesses and restrict data to the owner's UID.
