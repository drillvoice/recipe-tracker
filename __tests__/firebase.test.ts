import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => 'app'),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => 'app'),
}));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => 'auth'),
  setPersistence: jest.fn(),
  browserLocalPersistence: 'local',
}));
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => 'db'),
  enableIndexedDbPersistence: jest.fn(() => Promise.resolve()),
}));

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
  jest.resetModules();
  jest.clearAllMocks();
});

test('initializes firebase with persistence', async () => {
  const envCopy = { ...originalEnv } as NodeJS.ProcessEnv;
  envCopy.NEXT_PUBLIC_FIREBASE_API_KEY = 'key';
  envCopy.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'domain';
  envCopy.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'project';
  envCopy.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'bucket';
  envCopy.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'sender';
  envCopy.NEXT_PUBLIC_FIREBASE_APP_ID = 'appid';
  envCopy.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = 'measure';
  envCopy.NEXT_PUBLIC_FIREBASE_VAPID_KEY = 'vapid';

  process.env = envCopy;

  const {
    auth,
    db,
    ensureAuthPersistence,
    isFirebaseConfigured,
  } = require('@/lib/firebase');

  expect(isFirebaseConfigured).toBe(true);

  expect(initializeApp).toHaveBeenCalled();
  expect(getAuth).toHaveBeenCalledWith('app');
  expect(getFirestore).toHaveBeenCalledWith('app');
  expect(enableIndexedDbPersistence).toHaveBeenCalledWith('db');
  expect(auth).toBe('auth');
  expect(db).toBe('db');

  await ensureAuthPersistence();
  expect(setPersistence).toHaveBeenCalledWith('auth', 'local');
});

test('isFirebaseConfigured remains true with populated client env map', () => {
  jest.isolateModules(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_FIREBASE_API_KEY: 'key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'domain',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'project',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'bucket',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'sender',
      NEXT_PUBLIC_FIREBASE_APP_ID: 'appid',
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'measure',
      NEXT_PUBLIC_FIREBASE_VAPID_KEY: 'vapid',
    } as NodeJS.ProcessEnv;

    const { isFirebaseConfigured } = require('@/lib/firebase');

    expect(isFirebaseConfigured).toBe(true);
  });
});
