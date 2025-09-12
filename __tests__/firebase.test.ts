import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
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

afterEach(() => {
  jest.resetModules();
});

test('initializes firebase with persistence', async () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'domain';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'project';
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'bucket';
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'sender';
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'appid';
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = 'measure';

  const { auth, db } = require('@/lib/firebase');

  expect(initializeApp).toHaveBeenCalled();
  expect(getAuth).toHaveBeenCalledWith('app');
  expect(setPersistence).toHaveBeenCalledWith('auth', 'local');
  expect(getFirestore).toHaveBeenCalledWith('app');
  expect(enableIndexedDbPersistence).toHaveBeenCalledWith('db');
  expect(auth).toBe('auth');
  expect(db).toBe('db');
});
