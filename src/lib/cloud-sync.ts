import { onAuthStateChanged, type Unsubscribe, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type QueryDocumentSnapshot,
  type DocumentData,
  Timestamp
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { sendReset, signInEmail, signOutUser, signUpEmail } from './auth';
import {
  assignSyncQueueTargetUid,
  completeSyncItem,
  getAllMeals,
  getMealById,
  getSyncQueue,
  getSyncQueueCount,
  markMealSyncState,
  saveMeal,
  updateSyncItem,
  upsertMealFromCloud,
  deleteMealFromCloud,
  type Meal,
  type SyncItem
} from './offline-storage';
import { notifyMealsChanged } from './meal-events';

// Queue items pushed concurrently per round; Firestore pipelines these writes.
const PUSH_CONCURRENCY = 25;

export interface CloudSyncStatus {
  isConfigured: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  userId?: string;
  email?: string | null;
  pendingCount: number;
  lastSyncAt: number;
  lastError: string | null;
  isSyncing: boolean;
  realtimeConnected: boolean;
}

export interface SyncNowResult {
  pushed: number;
  pulled: number;
  errors: string[];
}

let authUnsubscribe: Unsubscribe | null = null;
let mealSnapshotUnsubscribe: Unsubscribe | null = null;
let listenerUid: string | null = null;
let onlineListenerAttached = false;
let currentUser: User | null = null;
let isSyncing = false;
let activeSync: Promise<SyncNowResult> | null = null;
let realtimeConnected = false;
let lastSyncAt = 0;
let lastError: string | null = null;

function isBrowserOnline(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

function mealFreshness(meal: Meal): number {
  return meal.updatedAtMs ?? meal.date.toMillis();
}

// Payload dates come back from IndexedDB as plain {seconds, nanoseconds}
// objects; convert them so Firestore stores a real Timestamp, not a map.
function toTimestamp(date: Meal['date']): Timestamp {
  if (date && typeof date.toMillis === 'function') {
    return date;
  }

  const raw = date as unknown as { seconds: number; nanoseconds?: number };
  return new Timestamp(raw.seconds, raw.nanoseconds || 0);
}

function parseMealDoc(snapshot: QueryDocumentSnapshot<DocumentData>): Meal {
  const raw = snapshot.data();
  let parsedDate: Timestamp;

  if (raw.date && typeof raw.date.toMillis === 'function') {
    parsedDate = raw.date as Timestamp;
  } else if (raw.date && typeof raw.date.seconds === 'number') {
    parsedDate = new Timestamp(raw.date.seconds, raw.date.nanoseconds || 0);
  } else {
    parsedDate = Timestamp.fromDate(new Date());
  }

  return {
    id: snapshot.id,
    mealName: typeof raw.mealName === 'string' ? raw.mealName : 'Unknown dish',
    date: parsedDate,
    uid: typeof raw.uid === 'string' ? raw.uid : undefined,
    hidden: Boolean(raw.hidden),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    updatedAtMs: typeof raw.updatedAtMs === 'number' ? raw.updatedAtMs : parsedDate.toMillis(),
    pending: false,
    syncState: 'synced'
  };
}

function buildCloudPayload(meal: Meal, uid: string): Record<string, unknown> {
  return {
    id: meal.id,
    mealName: meal.mealName,
    date: meal.date,
    uid,
    hidden: meal.hidden || false,
    tags: meal.tags || [],
    updatedAtMs: meal.updatedAtMs ?? meal.date.toMillis(),
    lastUpdated: serverTimestamp()
  };
}

function stopMealListener(): void {
  if (mealSnapshotUnsubscribe) {
    mealSnapshotUnsubscribe();
    mealSnapshotUnsubscribe = null;
  }

  listenerUid = null;
  realtimeConnected = false;
}

// `local` may be passed when the caller already has the local copy, to skip
// a per-meal IndexedDB read (null means "known not to exist locally").
async function applyRemoteMeal(uid: string, meal: Meal, local?: Meal | null): Promise<boolean> {
  if (local === undefined) {
    local = await getMealById(meal.id);
  }

  if (!local || mealFreshness(meal) > mealFreshness(local)) {
    await upsertMealFromCloud({
      ...meal,
      uid,
      pending: false,
      syncState: 'synced'
    });
    return true;
  }

  return false;
}

async function initialPullAndMerge(uid: string): Promise<number> {
  if (!db) {
    return 0;
  }

  const mealCollection = collection(db, 'users', uid, 'meals');
  const cloudSnapshot = await getDocs(mealCollection);
  // Read local meals after the network fetch so edits made while it was in
  // flight are included in the comparison below.
  const localMeals = await getAllMeals();
  const cloudMeals = cloudSnapshot.docs.map(parseMealDoc);
  const cloudMealMap = new Map(cloudMeals.map((meal) => [meal.id, meal]));
  const localMealMap = new Map(localMeals.map((meal) => [meal.id, meal]));

  let pulled = 0;

  for (const cloudMeal of cloudMeals) {
    const didApply = await applyRemoteMeal(uid, cloudMeal, localMealMap.get(cloudMeal.id) ?? null);
    if (didApply) {
      pulled += 1;
    }
  }

  for (const localMeal of localMeals) {
    const cloudMeal = cloudMealMap.get(localMeal.id);
    const cloudFreshness = cloudMeal ? mealFreshness(cloudMeal) : -1;
    const localFresh = mealFreshness(localMeal);

    // A strictly fresher cloud copy was just applied above; re-saving the
    // stale local snapshot here would overwrite it and push old data back up.
    if (cloudMeal && cloudFreshness > localFresh) {
      continue;
    }

    if (!cloudMeal || localFresh > cloudFreshness || localMeal.uid !== uid) {
      await saveMeal(
        {
          ...localMeal,
          uid,
          pending: true,
          syncState: 'pending',
          updatedAtMs: localMeal.updatedAtMs ?? localFresh
        },
        { skipSyncQueue: false, preserveTimestamp: true }
      );
    }
  }

  if (pulled > 0) {
    notifyMealsChanged();
  }

  return pulled;
}

async function pushSyncItem(item: SyncItem, uid: string): Promise<string | null> {
  const targetUid = item.targetUid || uid;

  try {
    const mealDoc = doc(db!, 'users', targetUid, 'meals', item.entityId);

    if (item.operation === 'delete') {
      await deleteDoc(mealDoc);
    } else {
      const payload = item.payload;
      if (!payload || !payload.mealName || !payload.date) {
        throw new Error(`Sync payload for meal ${item.entityId} is incomplete.`);
      }

      const mealToUpload: Meal = {
        id: item.entityId,
        mealName: payload.mealName,
        date: toTimestamp(payload.date),
        uid: targetUid,
        hidden: payload.hidden || false,
        tags: payload.tags || [],
        updatedAtMs: payload.updatedAtMs ?? Date.now(),
        pending: false,
        syncState: 'synced'
      };

      await setDoc(mealDoc, buildCloudPayload(mealToUpload, targetUid), { merge: true });
    }

    await completeSyncItem(item);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync failure';

    const retryCount = (item.retryCount ?? 0) + 1;
    await updateSyncItem(item.id, {
      retryCount,
      lastError: message,
      targetUid,
      timestamp: Date.now()
    });

    if (item.operation !== 'delete') {
      await markMealSyncState(item.entityId, 'error', true);
    }

    return `Meal ${item.entityId}: ${message}`;
  }
}

// Split queue items into rounds of limited size that never contain two items
// for the same meal, so per-meal operation order is preserved.
function planPushRounds(items: SyncItem[]): SyncItem[][] {
  const rounds: SyncItem[][] = [];
  let current: SyncItem[] = [];
  let entitiesInRound = new Set<string>();

  for (const item of items) {
    if (current.length >= PUSH_CONCURRENCY || entitiesInRound.has(item.entityId)) {
      rounds.push(current);
      current = [];
      entitiesInRound = new Set();
    }
    current.push(item);
    entitiesInRound.add(item.entityId);
  }

  if (current.length > 0) {
    rounds.push(current);
  }

  return rounds;
}

async function flushSyncQueue(uid: string): Promise<{ pushed: number; errors: string[] }> {
  if (!db || !isBrowserOnline()) {
    return { pushed: 0, errors: [] };
  }

  const items = await getSyncQueue();
  let pushed = 0;
  const errors: string[] = [];

  // Push in concurrent rounds instead of one network round trip per item.
  for (const round of planPushRounds(items)) {
    const results = await Promise.all(round.map(item => pushSyncItem(item, uid)));
    for (const error of results) {
      if (error) {
        errors.push(error);
      } else {
        pushed += 1;
      }
    }
  }

  return { pushed, errors };
}

function startRealtimeListener(uid: string): void {
  if (!db) {
    return;
  }

  // Already listening for this account: avoid tearing down and re-reading
  // the whole collection (sign-in and onAuthStateChanged both call this).
  if (mealSnapshotUnsubscribe && listenerUid === uid) {
    return;
  }

  stopMealListener();
  listenerUid = uid;

  mealSnapshotUnsubscribe = onSnapshot(
    collection(db, 'users', uid, 'meals'),
    async (snapshot) => {
      realtimeConnected = true;

      const changes = snapshot.docChanges();
      // The first snapshot reports every document; read local meals once
      // instead of issuing one IndexedDB lookup per document.
      const localMealMap = changes.length > 1
        ? new Map((await getAllMeals()).map((meal) => [meal.id, meal]))
        : null;

      let changed = false;
      for (const change of changes) {
        const id = change.doc.id;
        if (change.type === 'removed') {
          await deleteMealFromCloud(id);
          changed = true;
          continue;
        }

        const cloudMeal = parseMealDoc(change.doc);
        const local = localMealMap ? localMealMap.get(id) ?? null : undefined;
        const didApply = await applyRemoteMeal(uid, cloudMeal, local);
        if (didApply) {
          changed = true;
        }
      }

      if (changed) {
        lastSyncAt = Date.now();
        lastError = null;
        notifyMealsChanged();
      }
    },
    (error) => {
      realtimeConnected = false;
      lastError = error.message;
    }
  );
}

async function performSignedInSync(uid: string): Promise<SyncNowResult> {
  const result: SyncNowResult = {
    pushed: 0,
    pulled: 0,
    errors: []
  };

  isSyncing = true;

  try {
    await assignSyncQueueTargetUid(uid);
    result.pulled += await initialPullAndMerge(uid);

    const flushResult = await flushSyncQueue(uid);
    result.pushed += flushResult.pushed;
    result.errors.push(...flushResult.errors);

    if (result.errors.length > 0) {
      lastError = result.errors.join(' | ');
    } else {
      lastError = null;
    }

    lastSyncAt = Date.now();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    lastError = message;
    result.errors.push(message);
    return result;
  } finally {
    isSyncing = false;
  }
}

function runSignedInSync(uid: string): Promise<SyncNowResult> {
  if (!isFirebaseConfigured || !db) {
    return Promise.resolve({ pushed: 0, pulled: 0, errors: ['Firebase is not configured.'] });
  }

  if (!isBrowserOnline()) {
    return Promise.resolve({
      pushed: 0,
      pulled: 0,
      errors: ['Device is offline. Sync will resume automatically when online.']
    });
  }

  // Share an in-flight sync rather than reporting an empty result.
  if (!activeSync) {
    activeSync = performSignedInSync(uid).finally(() => {
      activeSync = null;
    });
  }

  return activeSync;
}

async function startSyncForUser(uid: string): Promise<void> {
  await runSignedInSync(uid);
  startRealtimeListener(uid);
}

async function handleAuthenticatedUser(user: User): Promise<void> {
  currentUser = user;

  if (user.isAnonymous) {
    stopMealListener();
    return;
  }

  await startSyncForUser(user.uid);
}

function attachOnlineListener(): void {
  if (onlineListenerAttached || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('online', () => {
    if (currentUser && !currentUser.isAnonymous) {
      void runSignedInSync(currentUser.uid);
    }
  });

  onlineListenerAttached = true;
}

export function startCloudSync(): () => void {
  if (!isFirebaseConfigured || !auth) {
    return () => undefined;
  }

  attachOnlineListener();

  if (!authUnsubscribe) {
    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      currentUser = user;

      if (!user) {
        stopMealListener();
        return;
      }

      await handleAuthenticatedUser(user);
    });
  }

  return () => {
    if (authUnsubscribe) {
      authUnsubscribe();
      authUnsubscribe = null;
    }

    stopMealListener();
  };
}

export async function syncNow(): Promise<SyncNowResult> {
  if (!currentUser || currentUser.isAnonymous) {
    return {
      pushed: 0,
      pulled: 0,
      errors: ['Sign in with email/password to sync across devices.']
    };
  }

  return runSignedInSync(currentUser.uid);
}

// Sign-in resolves as soon as auth succeeds; the initial sync continues in
// the background (its progress is visible through getSyncStatus).
export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  const credential = await signInEmail(email, password);
  currentUser = credential.user;

  if (!credential.user.isAnonymous) {
    void startSyncForUser(credential.user.uid);
  }
}

export async function createAccountWithEmailPassword(email: string, password: string): Promise<void> {
  const credential = await signUpEmail(email, password);
  currentUser = credential.user;

  if (!credential.user.isAnonymous) {
    void startSyncForUser(credential.user.uid);
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendReset(email);
}

export async function signOutAndStopSync(): Promise<void> {
  stopMealListener();
  currentUser = null;
  await signOutUser();
}

export async function getSyncStatus(): Promise<CloudSyncStatus> {
  const pendingCount = await getSyncQueueCount();

  return {
    isConfigured: isFirebaseConfigured,
    isAuthenticated: Boolean(currentUser),
    isAnonymous: Boolean(currentUser?.isAnonymous),
    userId: currentUser?.uid,
    email: currentUser?.email,
    pendingCount,
    lastSyncAt,
    lastError,
    isSyncing,
    realtimeConnected
  };
}

export const __private = {
  mealFreshness,
  parseMealDoc,
  buildCloudPayload,
  flushSyncQueue,
  initialPullAndMerge,
  planPushRounds,
  runSignedInSync
};
