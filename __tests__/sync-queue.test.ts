/**
 * @jest-environment jsdom
 */

import 'fake-indexeddb/auto';
import { Timestamp } from 'firebase/firestore';
import type { Meal } from '@/lib/offline-storage';

if (!global.structuredClone) {
  global.structuredClone = (obj: unknown) => JSON.parse(JSON.stringify(obj));
}

type Storage = typeof import('@/lib/offline-storage');

const meal = (id: string, mealName: string): Meal => ({
  id,
  mealName,
  date: Timestamp.fromDate(new Date('2024-03-15T00:00:00')),
  uid: 'uid-1',
  tags: []
});

describe('sync queue', () => {
  let storage: Storage;

  beforeEach(() => {
    indexedDB = new (require('fake-indexeddb/lib/FDBFactory'))();
    storage = require('@/lib/offline-storage');
    storage.resetDbPromise();
  });

  test('bulk updates by name queue one merged item per meal', async () => {
    await storage.saveMeal(meal('a', 'Pasta'));
    await storage.saveMeal(meal('b', 'Pasta'));
    await storage.saveMeal(meal('c', 'Soup'));

    await storage.hideMealsByName('Pasta', true);
    await storage.updateMealTagsByName('Pasta', ['quick']);

    const queue = await storage.getSyncQueue();
    expect(queue).toHaveLength(3);
    expect(await storage.getSyncQueueCount()).toBe(3);

    const pastaItem = queue.find(item => item.entityId === 'a')!;
    // Still a create: the meal has never reached the cloud
    expect(pastaItem.operation).toBe('create');
    expect(pastaItem.payload).toMatchObject({ hidden: true, tags: ['quick'] });
  });

  test('deleteMealsByName replaces queued items with deletes', async () => {
    await storage.saveMeal(meal('a', 'Pasta'));
    await storage.saveMeal(meal('b', 'Pasta'));

    await storage.deleteMealsByName('Pasta');

    const queue = await storage.getSyncQueue();
    expect(queue.map(item => item.operation)).toEqual(['delete', 'delete']);
    expect(await storage.getAllMeals()).toHaveLength(0);
    expect(await storage.getMealCount()).toBe(0);
  });

  test('completeSyncItem removes the item and marks the meal synced', async () => {
    await storage.saveMeal(meal('a', 'Pasta'));
    const [item] = await storage.getSyncQueue();

    await storage.completeSyncItem(item);

    expect(await storage.getSyncQueue()).toHaveLength(0);
    expect(await storage.getMealById('a')).toMatchObject({ syncState: 'synced', pending: false });
  });

  test('completeSyncItem keeps an edit made while the push was in flight', async () => {
    await storage.saveMeal(meal('a', 'Pasta'));
    const [inFlight] = await storage.getSyncQueue();

    // Ensure the edit gets a later timestamp than the in-flight snapshot
    await new Promise(resolve => setTimeout(resolve, 2));
    await storage.updateMeal('a', { mealName: 'Pasta Bake' });

    await storage.completeSyncItem(inFlight);

    const queue = await storage.getSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].payload?.mealName).toBe('Pasta Bake');
    expect(await storage.getMealById('a')).toMatchObject({ syncState: 'pending', pending: true });
  });
});
