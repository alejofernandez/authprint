import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import 'fake-indexeddb/auto';
import {
  clearRecentFlows,
  listRecentFlows,
  MAX_RECENT_FLOWS,
  openRecentFlowsDB,
  RECENT_FLOWS_DB_NAME,
  removeRecentFlow,
  resetRecentFlowsDBForTests,
  saveRecentFlow,
} from './store.ts';

const BUNDLE_A = 'id: flow-a\nname: Flow A\n';
const BUNDLE_B = 'id: flow-b\nname: Flow B\n';

async function deleteRecentFlowsDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(RECENT_FLOWS_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await resetRecentFlowsDBForTests();
  await deleteRecentFlowsDatabase();
});

afterEach(async () => {
  await resetRecentFlowsDBForTests();
});

describe('recentFlows store', () => {
  test('openRecentFlowsDB returns a usable database', async () => {
    const db = await openRecentFlowsDB();
    expect(db.name).toBe(RECENT_FLOWS_DB_NAME);
    expect(db.objectStoreNames.contains('flows')).toBe(true);
  });

  test('save/list/remove/clear round-trip', async () => {
    await saveRecentFlow('session-1', { name: 'One', bundle: BUNDLE_A });
    await saveRecentFlow('session-2', { name: 'Two', bundle: BUNDLE_B });

    let recent = await listRecentFlows();
    expect(recent).toHaveLength(2);
    expect(recent[0]?.sessionId).toBe('session-2');
    expect(recent[0]?.name).toBe('Two');
    expect(recent[0]?.bundle).toBe(BUNDLE_B);

    await removeRecentFlow('session-2');
    recent = await listRecentFlows();
    expect(recent).toHaveLength(1);
    expect(recent[0]?.sessionId).toBe('session-1');

    await clearRecentFlows();
    expect(await listRecentFlows()).toHaveLength(0);
  });

  test('upsert bumps lastEditedAt and sorts newest first', async () => {
    await saveRecentFlow('session-old', { name: 'Old', bundle: BUNDLE_A });
    const firstEditedAt = (await listRecentFlows())[0]?.lastEditedAt;
    expect(firstEditedAt).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 5));

    await saveRecentFlow('session-new', { name: 'New', bundle: BUNDLE_B });
    const midEditedAt = (await listRecentFlows())[0]?.lastEditedAt;
    expect(midEditedAt).toBeGreaterThan(firstEditedAt ?? 0);

    await new Promise((resolve) => setTimeout(resolve, 5));

    await saveRecentFlow('session-old', { name: 'Old (edited)', bundle: BUNDLE_A });
    const recent = await listRecentFlows();
    const oldEntry = recent.find((entry) => entry.sessionId === 'session-old');
    expect(oldEntry?.name).toBe('Old (edited)');
    expect(oldEntry?.lastEditedAt).toBeGreaterThan(midEditedAt ?? 0);
    expect(recent[0]?.sessionId).toBe('session-old');
  });

  test(`evicts oldest entries beyond the ${MAX_RECENT_FLOWS}-entry cap`, async () => {
    for (let i = 0; i < MAX_RECENT_FLOWS + 3; i++) {
      await saveRecentFlow(`session-${i}`, {
        name: `Flow ${i}`,
        bundle: `id: flow-${i}\nname: Flow ${i}\n`,
      });
      if (i < MAX_RECENT_FLOWS + 2) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    const recent = await listRecentFlows();
    expect(recent).toHaveLength(MAX_RECENT_FLOWS);
    const ids = recent.map((entry) => entry.sessionId);
    expect(ids).not.toContain('session-0');
    expect(ids).not.toContain('session-1');
    expect(ids).not.toContain('session-2');
    expect(ids[0]).toBe(`session-${MAX_RECENT_FLOWS + 2}`);
  });
});
