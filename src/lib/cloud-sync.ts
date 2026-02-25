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
import { signInEmail, signOutUser } from './auth';
import {
  assignSyncQueueTargetUid,
  getAllMeals,
  getMealById,
  getSyncQueue,
  markMealSyncState,
  removeSyncItem,
  saveMeal,
  updateSyncItem,
  upsertMealFromCloud,
  deleteMealFromCloud,
  type Meal
} from './offline-storage';

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
let onlineListenerAttached = false;
let currentUser: User | null = null;
let isSyncing = false;
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

  realtimeConnected = false;
}

async function applyRemoteMeal(uid: string, meal: Meal): Promise<boolean> {
  const local = await getMealById(meal.id);

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
  const cloudMeals = cloudSnapshot.docs.map(parseMealDoc);
  const cloudMealMap = new Map(cloudMeals.map((meal) => [meal.id, meal]));
  const localMeals = await getAllMeals();

  let pulled = 0;

  for (const cloudMeal of cloudMeals) {
    const didApply = await applyRemoteMeal(uid, cloudMeal);
    if (didApply) {
      pulled += 1;
    }
  }

  for (const localMeal of localMeals) {
    const cloudMeal = cloudMealMap.get(localMeal.id);
    const cloudFreshness = cloudMeal ? mealFreshness(cloudMeal) : -1;
    const localFresh = mealFreshness(localMeal);

    if (!cloudMeal || localFresh > cloudFreshness || localMeal.uid !== uid) {
      await saveMeal(
        {
          ...localMeal,
          uid,
          pending: true,
          syncState: 'pending',
          updatedAtMs: localMeal.updatedAtMs ?? localFresh
        },
        { skipSyncQueue: false }
      );
    }
  }

  return pulled;
}

async function flushSyncQueue(uid: string): Promise<{ pushed: number; errors: string[] }> {
  if (!db || !isBrowserOnline()) {
    return { pushed: 0, errors: [] };
  }

  const items = await getSyncQueue();
  let pushed = 0;
  const errors: string[] = [];

  for (const item of items) {
    const targetUid = item.targetUid || uid;

    try {
      const mealDoc = doc(db, 'users', targetUid, 'meals', item.entityId);

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
          date: payload.date,
          uid: targetUid,
          hidden: payload.hidden || false,
          tags: payload.tags || [],
          updatedAtMs: payload.updatedAtMs ?? Date.now(),
          pending: false,
          syncState: 'synced'
        };

        await setDoc(mealDoc, buildCloudPayload(mealToUpload, targetUid), { merge: true });
        await markMealSyncState(item.entityId, 'synced', false);
      }

      await removeSyncItem(item.id);
      pushed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync failure';
      errors.push(`Meal ${item.entityId}: ${message}`);

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
    }
  }

  return { pushed, errors };
}

function startRealtimeListener(uid: string): void {
  if (!db) {
    return;
  }

  stopMealListener();

  mealSnapshotUnsubscribe = onSnapshot(
    collection(db, 'users', uid, 'meals'),
    async (snapshot) => {
      realtimeConnected = true;

      let changed = false;
      for (const change of snapshot.docChanges()) {
        const id = change.doc.id;
        if (change.type === 'removed') {
          await deleteMealFromCloud(id);
          changed = true;
          continue;
        }

        const cloudMeal = parseMealDoc(change.doc);
        const didApply = await applyRemoteMeal(uid, cloudMeal);
        if (didApply) {
          changed = true;
        }
      }

      if (changed) {
        lastSyncAt = Date.now();
        lastError = null;
      }
    },
    (error) => {
      realtimeConnected = false;
      lastError = error.message;
    }
  );
}

async function runSignedInSync(uid: string): Promise<SyncNowResult> {
  const result: SyncNowResult = {
    pushed: 0,
    pulled: 0,
    errors: []
  };

  if (!isFirebaseConfigured || !db) {
    result.errors.push('Firebase is not configured.');
    return result;
  }

  if (!isBrowserOnline()) {
    result.errors.push('Device is offline. Sync will resume automatically when online.');
    return result;
  }

  if (isSyncing) {
    return result;
  }

  isSyncing = true;

  try {
    await assignSyncQueueTargetUid(uid);
    result.pulled += await initialPullAndMerge(uid);

    const flushResult = await flushSyncQueue(uid);
    result.pushed += flushResult.pushed;
    result.errors.push(...flushResult.errors);

    result.pulled += await initialPullAndMerge(uid);

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

async function handleAuthenticatedUser(user: User): Promise<void> {
  currentUser = user;

  if (user.isAnonymous) {
    stopMealListener();
    return;
  }

  await runSignedInSync(user.uid);
  startRealtimeListener(user.uid);
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

export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  const credential = await signInEmail(email, password);
  currentUser = credential.user;

  if (!credential.user.isAnonymous) {
    await runSignedInSync(credential.user.uid);
    startRealtimeListener(credential.user.uid);
  }
}

export async function signOutAndStopSync(): Promise<void> {
  stopMealListener();
  currentUser = null;
  await signOutUser();
}

export async function getSyncStatus(): Promise<CloudSyncStatus> {
  const queue = await getSyncQueue();

  return {
    isConfigured: isFirebaseConfigured,
    isAuthenticated: Boolean(currentUser),
    isAnonymous: Boolean(currentUser?.isAnonymous),
    userId: currentUser?.uid,
    email: currentUser?.email,
    pendingCount: queue.length,
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
  runSignedInSync
};
