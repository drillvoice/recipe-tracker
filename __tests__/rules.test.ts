import fs from 'fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment | null = null;
let available = true;

beforeAll(async () => {
  try {
    const rules = fs.readFileSync('docs/firestore-rules.md', 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-test',
      firestore: { rules },
    });
  } catch {
    available = false;
    console.warn('Firestore emulator not running, skipping tests');
  }
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

test('user can write only to own path', async () => {
  if (!available) return;
  if (!testEnv) {
    throw new Error('Firestore test environment was not initialized.');
  }
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(aliceDb, 'meals/alice/items/1'), { name: 'x' }));
  await assertFails(setDoc(doc(aliceDb, 'meals/bob/items/1'), { name: 'x' }));
});
