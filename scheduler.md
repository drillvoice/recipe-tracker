# Firebase Cloud Scheduler setup for dinner reminders

The frontend now records each user’s dinner reminder preferences in Firestore at
`users/{uid}/notificationSubscriptions/dinner`. Follow the steps below to finish
hooking Firebase Cloud Functions and Cloud Scheduler into production.

## 1. Prerequisites

1. **Use the Blaze plan.** Scheduled Cloud Functions require a project with
   billing enabled. Upgrade the Firebase project if it is still on the Spark
   plan.
2. **Install the CLI tools:** `firebase-tools` (v12+) and `gcloud`. Authenticate
   with the Firebase project you deploy to:

   ```bash
   firebase login
   firebase use <your-project-id>
   gcloud auth login
   ```

## 2. Enable required Google Cloud APIs

Run the following commands once for the project (replace `PROJECT_ID`):

```bash
gcloud config set project PROJECT_ID
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable pubsub.googleapis.com
```

The Pub/Sub API is required because scheduled functions are implemented on top
of Pub/Sub jobs.

## 3. Configure web push credentials

The frontend cannot request FCM tokens without a Web Push certificate. Configure
the VAPID key once per Firebase project:

1. Open the Firebase Console and navigate to **Project settings → Cloud
   Messaging**.
2. In the **Web configuration** card, click **Generate key pair** (or copy the
   existing public key if one is already listed).
3. Add the public key to your environments as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`:
   - Locally, add it to `.env.local` alongside the other Firebase keys.
   - For Vercel, set the variable in the project’s Environment Variables UI.
   - For the Firebase Hosting workflow, store it as a GitHub secret and export
     it before running `npm run build:firebase`.

Without this key you will see console warnings such as “VAPID key not
configured for FCM” and no test notification tokens will be generated.

## 4. Install and build the Cloud Functions package

From the repository root:

```bash
cd functions
npm install
npm run build
```

The build step compiles `src/` to `lib/`, which is what Firebase deploys.

## 5. Configure optional notification metadata (optional)

If you want to customise the push payload (for example to include a deep link),
add values to the Cloud Functions config before deploying:

```bash
firebase functions:config:set reminders.app_url="https://your-app-domain"
firebase functions:config:set reminders.notification_title="🍽️ Dinner Time!"
firebase functions:config:set reminders.notification_body="What did you eat for dinner today?"
```

These keys are not currently required by the code but can be wired in later to
override the defaults without another deployment.

## 6. Deploy the scheduled function

Deploy only the new reminder dispatcher:

```bash
firebase deploy --only functions:sendDueDinnerReminders
```

On the first deployment, Firebase will prompt to enable a Cloud Scheduler job.
Accept the prompt. You can confirm the job in the Firebase Console under
**Functions → Scheduled** or in the Google Cloud Console under **Cloud
Scheduler**.

## 7. Create the required Firestore index

The function queries the `notificationSubscriptions` collection group using the
fields `active` and `nextNotificationAt`. Create a composite index for that
query:

1. In the Firebase Console open **Firestore Database → Indexes**.
2. Click **Add Index → Collection group index**.
3. Set the collection group to `notificationSubscriptions`.
4. Add the following fields:
   - `active` – Ascending
   - `nextNotificationAt` – Ascending
5. Leave the **Query scope** as Collection Group and click **Create index**.

Alternatively, add the following entry to `firestore.indexes.json` and run
`firebase deploy --only firestore:indexes`:

```json
{
  "collectionGroup": "notificationSubscriptions",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "active", "order": "ASCENDING" },
    { "fieldPath": "nextNotificationAt", "order": "ASCENDING" }
  ]
}
```

## 8. Verify end-to-end scheduling

1. With the app deployed, enable dinner reminders in the UI. A document similar
   to `users/<uid>/notificationSubscriptions/dinner` should now contain the
   fields `token`, `timezone`, `reminderTime`, and `nextNotificationAt`.
2. Confirm the browser has a registered token: after enabling reminders, check
   the console for `FCM token obtained: Yes`. If you still see “No FCM token
   available for test notification”, revisit the VAPID setup in step 3.
3. Wait for the scheduled Cloud Function to run (it executes every five
   minutes). Check the **Functions → Logs** tab in the Firebase Console for
   entries from `sendDueDinnerReminders`.
4. When a notification is delivered, the document’s `lastNotificationSentAt`
   field updates and `nextNotificationAt` jumps roughly 24 hours ahead in the
   user’s timezone.
5. If a notification fails because of an invalid FCM token, the document is
   marked `deliveryStatus = "deactivated"`. Clearing or re-enabling reminders in
   the UI will register a fresh token.

Once these steps are complete, dinner reminders will continue to fire even when
the web app is closed because Cloud Scheduler triggers the `sendDueDinnerReminders`
function server-side.
