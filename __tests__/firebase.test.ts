import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => 'app'),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => 'app'),
}));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(() => 'auth') }));
jest.mock('firebase/firestore', () => ({ getFirestore: jest.fn(() => 'db') }));

afterEach(() => {
  jest.resetModules();
});

test('initializes firebase with env config', () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'domain';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'project';
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'bucket';
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'sender';
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'appid';
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = 'measure';

  const { auth, db } = require('@/lib/firebaseClient');

  expect(initializeApp).toHaveBeenCalledWith({
    apiKey: 'key',
    authDomain: 'domain',
    projectId: 'project',
    storageBucket: 'bucket',
    messagingSenderId: 'sender',
    appId: 'appid',
    measurementId: 'measure'
  });
  expect(getAuth).toHaveBeenCalledWith('app');
  expect(getFirestore).toHaveBeenCalledWith('app');
  expect(auth).toBe('auth');
  expect(db).toBe('db');
});
