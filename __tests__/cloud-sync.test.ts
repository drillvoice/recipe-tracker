const mockSignInEmail = jest.fn();
const mockSignOutUser = jest.fn();
const mockGetSyncQueue = jest.fn();
const mockCompleteSyncItem = jest.fn();
const mockUpdateSyncItem = jest.fn();
const mockMarkMealSyncState = jest.fn();
const mockAssignSyncQueueTargetUid = jest.fn();
const mockGetAllMeals = jest.fn();
const mockGetMealById = jest.fn();
const mockSaveMeal = jest.fn();
const mockUpsertMealFromCloud = jest.fn();
const mockDeleteMealFromCloud = jest.fn();

jest.mock('@/lib/auth', () => ({
  signInEmail: mockSignInEmail,
  signOutUser: mockSignOutUser
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(() => () => undefined)
}));

jest.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  isFirebaseConfigured: true
}));

jest.mock('@/lib/offline-storage', () => ({
  addToSyncQueue: jest.fn(),
  assignSyncQueueTargetUid: mockAssignSyncQueueTargetUid,
  getAllMeals: mockGetAllMeals,
  getMealById: mockGetMealById,
  getSyncQueue: mockGetSyncQueue,
  markMealSyncState: mockMarkMealSyncState,
  completeSyncItem: mockCompleteSyncItem,
  getSyncQueueCount: jest.fn().mockResolvedValue(0),
  saveMeal: mockSaveMeal,
  updateSyncItem: mockUpdateSyncItem,
  upsertMealFromCloud: mockUpsertMealFromCloud,
  deleteMealFromCloud: mockDeleteMealFromCloud
}));

const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();
const mockDoc = jest.fn(() => ({ path: 'x' }));
const mockCollection = jest.fn(() => ({ path: 'c' }));

class MockTimestamp {
  private millis: number;

  constructor(secondsOrMillis: number, nanoseconds?: number) {
    // Mirror Firestore's (seconds, nanoseconds) constructor when two args are given.
    this.millis = nanoseconds === undefined ? secondsOrMillis : secondsOrMillis * 1000 + nanoseconds / 1e6;
  }

  static fromDate(date: Date) {
    return new MockTimestamp(date.getTime());
  }

  toMillis() {
    return this.millis;
  }

  toDate() {
    return new Date(this.millis);
  }
}

jest.mock('firebase/firestore', () => ({
  collection: mockCollection,
  deleteDoc: mockDeleteDoc,
  doc: mockDoc,
  getDocs: mockGetDocs,
  onSnapshot: mockOnSnapshot,
  serverTimestamp: jest.fn(() => 'server-ts'),
  setDoc: mockSetDoc,
  Timestamp: MockTimestamp
}));

const { __private, syncNow, signInWithEmailPassword } = require('@/lib/cloud-sync');

describe('cloud-sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSyncQueue.mockResolvedValue([]);
    mockGetAllMeals.mockResolvedValue([]);
    mockGetMealById.mockResolvedValue(null);
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockOnSnapshot.mockReturnValue(() => undefined);
  });

  test('syncNow returns guidance when user is not signed in', async () => {
    const result = await syncNow();

    expect(result.errors[0]).toContain('Sign in with email/password');
    expect(result.pushed).toBe(0);
    expect(result.pulled).toBe(0);
  });

  test('signInWithEmailPassword uses auth helper', async () => {
    mockSignInEmail.mockResolvedValue({
      user: { uid: 'u1', isAnonymous: false }
    });

    await signInWithEmailPassword('user@example.com', 'pw');

    expect(mockSignInEmail).toHaveBeenCalledWith('user@example.com', 'pw');
  });

  test('flushSyncQueue uploads create/update and deletes', async () => {
    mockGetSyncQueue.mockResolvedValue([
      {
        id: 'a',
        entityType: 'meal',
        entityId: 'm1',
        operation: 'create',
        payload: {
          mealName: 'Pasta',
          date: new MockTimestamp(1000),
          tags: ['t1'],
          updatedAtMs: 1000
        },
        timestamp: 1
      },
      {
        id: 'b',
        entityType: 'meal',
        entityId: 'm2',
        operation: 'delete',
        timestamp: 2
      }
    ]);

    const result = await __private.flushSyncQueue('uid-1');

    expect(result.errors).toHaveLength(0);
    expect(result.pushed).toBe(2);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockCompleteSyncItem).toHaveBeenCalledTimes(2);
    expect(mockCompleteSyncItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(mockMarkMealSyncState).not.toHaveBeenCalled();
  });

  test('flushSyncQueue uploads IndexedDB-cloned dates as real Timestamps', async () => {
    mockGetSyncQueue.mockResolvedValue([
      {
        id: 'a',
        entityType: 'meal',
        entityId: 'm1',
        operation: 'update',
        // Structured clone strips the Timestamp prototype
        payload: { mealName: 'Pasta', date: { seconds: 5, nanoseconds: 0 }, updatedAtMs: 1 },
        timestamp: 1
      }
    ]);

    const result = await __private.flushSyncQueue('uid-1');

    expect(result.errors).toHaveLength(0);
    const uploaded = mockSetDoc.mock.calls[0][1];
    expect(uploaded.date).toBeInstanceOf(MockTimestamp);
    expect(uploaded.date.toMillis()).toBe(5000);
  });

  test('flushSyncQueue records failures without blocking other items', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('denied'));
    mockGetSyncQueue.mockResolvedValue([
      { id: 'a', entityType: 'meal', entityId: 'm1', operation: 'update', payload: { mealName: 'A', date: new MockTimestamp(1), updatedAtMs: 1 }, timestamp: 1 },
      { id: 'b', entityType: 'meal', entityId: 'm2', operation: 'update', payload: { mealName: 'B', date: new MockTimestamp(1), updatedAtMs: 1 }, timestamp: 2 }
    ]);

    const result = await __private.flushSyncQueue('uid-1');

    expect(result.pushed).toBe(1);
    expect(result.errors).toEqual(['Meal m1: denied']);
    expect(mockUpdateSyncItem).toHaveBeenCalledWith('a', expect.objectContaining({ retryCount: 1, lastError: 'denied' }));
    expect(mockMarkMealSyncState).toHaveBeenCalledWith('m1', 'error', true);
    expect(mockCompleteSyncItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  test('planPushRounds keeps items for the same meal in separate rounds', () => {
    const item = (id: string, entityId: string) => ({ id, entityId, entityType: 'meal', operation: 'update', timestamp: 0 });
    const rounds = __private.planPushRounds([item('1', 'm1'), item('2', 'm2'), item('3', 'm1')]);

    expect(rounds.map((round: Array<{ id: string }>) => round.map(i => i.id))).toEqual([['1', '2'], ['3']]);
  });

  test('initialPullAndMerge applies newer cloud data and queues local-only records', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'cloud-1',
          data: () => ({
            mealName: 'Cloud Meal',
            date: new MockTimestamp(2000),
            uid: 'uid-1',
            hidden: false,
            tags: [],
            updatedAtMs: 2000
          })
        }
      ]
    });

    mockGetAllMeals.mockResolvedValue([
      {
        id: 'cloud-1',
        mealName: 'Local Stale',
        date: new MockTimestamp(1000),
        updatedAtMs: 1000
      },
      {
        id: 'local-only',
        mealName: 'Local New',
        date: new MockTimestamp(1500),
        updatedAtMs: 1500
      }
    ]);

    mockGetMealById.mockImplementation(async (id: string) => {
      if (id === 'cloud-1') {
        return {
          id: 'cloud-1',
          mealName: 'Local Stale',
          date: new MockTimestamp(1000),
          updatedAtMs: 1000
        };
      }
      return null;
    });

    const pulled = await __private.initialPullAndMerge('uid-1');

    expect(pulled).toBe(1);
    expect(mockUpsertMealFromCloud).toHaveBeenCalled();
    expect(mockSaveMeal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'local-only', uid: 'uid-1', pending: true }),
      { skipSyncQueue: false, preserveTimestamp: true }
    );
    // The stale local copy of cloud-1 must not overwrite the fresher cloud version
    expect(mockSaveMeal).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cloud-1' }),
      expect.anything()
    );
    expect(mockSaveMeal).toHaveBeenCalledTimes(1);
    // Local copies come from one getAllMeals read, not per-meal lookups
    expect(mockGetMealById).not.toHaveBeenCalled();
  });
});
