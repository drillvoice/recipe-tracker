# GitHub Actions workflow for the Firebase reminder dispatcher

This guide explains how to add an automated deployment workflow for the
`sendDueDinnerReminders` Cloud Function so you do not have to run `firebase deploy`
by hand every time the dispatcher code changes. The workflow uses the Firebase
CLI inside GitHub Actions and authenticates with a dedicated service account.

---

## When to run this workflow

Trigger the workflow whenever you merge or push changes that affect the
scheduled reminder function. Typical cases include:

- edits to any file in `functions/` (for example, updates to the reminder logic
  in `functions/src/reminders.ts`),
- changes to deployment instructions or configuration such as `scheduler.md`, or
- dependency updates that influence the Cloud Functions build.

The example workflow below runs automatically on pushes to `main` that modify
those paths, and it also exposes a **Run workflow** button in GitHub’s UI via a
manual `workflow_dispatch` trigger. Use the manual trigger if you need to
redeploy the dispatcher without a code change (for example after rotating
secrets or changing Firebase config via the CLI).

---

## 1. Create a Firebase deployment service account

1. In the [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts),
   select your Firebase project and click **Create service account**.
2. Give it a descriptive name such as “GitHub Actions Firebase deployer”.
3. Grant the following roles so it can deploy scheduled functions:
   - **Firebase Admin** (firebaseadmin.admin)
   - **Cloud Functions Admin** (cloudfunctions.admin)
   - **Cloud Scheduler Admin** (cloudscheduler.admin)
   - **Service Account User** (iam.serviceAccountUser)
   - **Pub/Sub Editor** (pubsub.editor) – required when the scheduler job needs
     to create or update the Pub/Sub topic behind the schedule.
4. After creating the service account, open it, switch to the **Keys** tab, and
   add a new JSON key. Download the file; this is the credential GitHub Actions
   will use.

---

## 2. Store the credentials as GitHub secrets

1. In your GitHub repository, go to **Settings → Secrets and variables → Actions**.
2. Add two repository secrets:
   - `FIREBASE_SERVICE_ACCOUNT` – paste the entire JSON key downloaded above.
   - `FIREBASE_PROJECT_ID` – the Firebase project ID (for example
     `my-recipe-tracker`).

These secrets are injected into the workflow so the Firebase CLI can authenticate
non-interactively.

---

## 3. Add the workflow file

Create `.github/workflows/firebase-reminder-deploy.yml` with the following
contents:

```yaml
defaults:
  run:
    shell: bash

name: Deploy Firebase reminder dispatcher

on:
  push:
    branches: [main]
    paths:
      - 'functions/**'
      - 'scheduler.md'
      - '.github/workflows/firebase-reminder-deploy.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js 18
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install Firebase CLI
        run: npm install --global firebase-tools@12

      - name: Install function dependencies
        working-directory: functions
        run: npm install

      - name: Build Cloud Functions package
        working-directory: functions
        run: npm run build

      - name: Deploy sendDueDinnerReminders
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
        run: |
          echo "$FIREBASE_SERVICE_ACCOUNT" > "$HOME/firebase-key.json"
          export GOOGLE_APPLICATION_CREDENTIALS="$HOME/firebase-key.json"
          firebase deploy \
            --project "$FIREBASE_PROJECT_ID" \
            --only functions:sendDueDinnerReminders \
            --non-interactive \
            --force
          rm "$HOME/firebase-key.json"
```

### Why these steps?
- **`firebase-tools@12`** matches the CLI version used locally in `scheduler.md`.
- Running `npm install` and `npm run build` inside `functions/` reproduces the
  deployment bundle (`lib/`) before calling `firebase deploy`.
- Exporting `GOOGLE_APPLICATION_CREDENTIALS` allows the Firebase CLI to use the
  service account JSON for authentication, so no human login or refresh token is
  needed.

---

## 4. Optional: schedule periodic redeployments

If you want to redeploy the dispatcher on a fixed cadence (for example, once a
week after rotating dependencies), add a `schedule` trigger to the `on:` block:

```yaml
  schedule:
    - cron: '0 6 * * 1'
```

The example above runs every Monday at 06:00 UTC. Scheduled runs are additive,
so you can keep the `push` and `workflow_dispatch` triggers alongside the cron
entry.

---

## 5. Monitoring and troubleshooting

- Each workflow run uploads the Firebase CLI logs to the Actions job output.
  Open the job details to review deployment progress or error messages.
- If a deployment fails because of missing permissions, confirm that the service
  account still has the roles listed in step 1 and that the JSON key has not
  been revoked.
- To validate that the scheduled function is up to date, check the timestamp of
  the latest deployment in the Firebase Console under **Functions → Trigger →
  sendDueDinnerReminders** after the workflow completes.

With this workflow in place, every change to the reminder dispatcher can be
pushed to Firebase consistently from GitHub without running commands locally.

