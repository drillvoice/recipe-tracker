# Firebase Cloud Scheduler setup for dinner reminders

The frontend now records each user’s dinner reminder preferences in Firestore at
`users/{uid}/notificationSubscriptions/dinner`. Follow the steps below to finish
hooking Firebase Cloud Functions and Cloud Scheduler into production.

## 1. Prerequisites

1. **Use the Blaze plan.** Scheduled Cloud Functions require a project with
   billing enabled. Upgrade the Firebase project if it is still on the Spark
   plan.
2. **Install the CLI tools:** `firebase-tools` (v13+) and `gcloud`. Authenticate
   with the Firebase project you deploy to:

   ```bash
   firebase login
   firebase use <your-project-id>
   gcloud auth login
   ```

   > **Tip:** If the deploy command exits with `Failed to parse build specification: Unexpected key extensions`,
   > update to the newest Firebase CLI. That error indicates an outdated CLI version.

## 2. Enable required Google Cloud APIs

Run the following commands once for the project (replace `PROJECT_ID`):

```bash
gcloud config set project PROJECT_ID
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable pubsub.googleapis.com
```

The Pub/Sub API is required because scheduled functions are implemented on top
of Pub/Sub jobs.

## 3. Configure Firebase Cloud Messaging for the web client

Getting a valid FCM token from the browser requires the project to expose a
Web Push certificate (VAPID key) and to serve the messaging service worker from
the app root. Without these pieces, the `getFCMToken()` helper in
`src/lib/firebase.ts` short-circuits and tokens never reach Firestore.

1. In the Firebase Console, open **Project settings → Cloud Messaging**.
2. Under **Web configuration**, click **Generate key pair** (or **Manage** if
   one already exists) to create the VAPID key pair.
3. Copy the value labelled **Public key** and set it as an environment variable
   wherever the web app runs:

   ```bash
   # .env.local for local development and the corresponding production env vars
   NEXT_PUBLIC_FIREBASE_VAPID_KEY="<paste public key here>"
   ```

4. Make sure the variable is exported to the build **and** runtime environments
   for the hosting platform. For example, if deployments run through GitHub
   Actions, add a repository secret named `NEXT_PUBLIC_FIREBASE_VAPID_KEY` and
   pass it to the build step in `.github/workflows/firebase-hosting-merge.yml`
   and `.github/workflows/firebase-hosting-pull-request.yml`:

   ```yaml
   - run: npm ci && npm run build
     env:
       NEXT_PUBLIC_FIREBASE_VAPID_KEY: ${{ secrets.NEXT_PUBLIC_FIREBASE_VAPID_KEY }}
   ```

   Simply storing the key as a GitHub secret is not enough—the build must see it
   when bundling the client code.
5. Redeploy or restart the web app so that `process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY`
   is available to the browser bundle. You can confirm the value is wired up by
   checking the browser console for the log `FCM token retrieved: ✓` after
   enabling reminders.
6. Ensure the file `public/firebase-messaging-sw.js` is served from the
   application root (`https://<your-domain>/firebase-messaging-sw.js`). The
   service worker must load **before** calling `Notification.requestPermission`
   so that `navigator.serviceWorker.ready` resolves during token generation.
7. The site must be served over HTTPS (or `http://localhost` for development)
   because the Push API is only available on secure origins.

Once the environment variable is set and the service worker is reachable, the
frontend registers the worker, calls `getToken(...)` with the VAPID key, and
stores the resulting token in `users/{uid}/notificationSubscriptions/dinner`.

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
2. Open the browser console to confirm the app retrieved a token. You should
   see `Firebase Cloud Messaging supported and initialized` followed by
   `FCM token retrieved: ✓`. If you instead see `VAPID key not configured for
   FCM`, revisit step 3 to ensure the env var is present.
3. Wait for the scheduled Cloud Function to run (it executes every five
   minutes). Check the **Functions → Logs** tab in the Firebase Console for
   entries from `sendDueDinnerReminders`.
4. When a notification is delivered, the document’s `lastNotificationSentAt`
   field updates and `nextNotificationAt` jumps roughly 24 hours ahead in the
   user’s timezone.
5. If a notification fails because of an invalid FCM token, the document is
   marked `deliveryStatus = "deactivated"`. Clearing or re-enabling reminders in
   the UI will register a fresh token. Repeated failures with
   `deliveryStatus = "missing-token"` indicate that the frontend never obtained
   a token—double-check the VAPID key, service worker availability, and
   notification permissions.

Once these steps are complete, dinner reminders will continue to fire even when
the web app is closed because Cloud Scheduler triggers the `sendDueDinnerReminders`
function server-side.
