// Local IndexedDB store for recent flows (E42 / US-089). Persists the same
// canonical bundle shape as file export — see ADR 0002.

import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

export const RECENT_FLOWS_DB_NAME = 'authprint-recent-flows';
export const RECENT_FLOWS_STORE = 'flows';
export const MAX_RECENT_FLOWS = 20;

export type RecentFlowRecord = {
  sessionId: string;
  name: string;
  bundle: string;
  lastEditedAt: number;
};

export type RecentFlowEntry = Pick<
  RecentFlowRecord,
  'sessionId' | 'name' | 'lastEditedAt' | 'bundle'
>;

interface RecentFlowsDBSchema extends DBSchema {
  flows: {
    key: string;
    value: RecentFlowRecord;
    indexes: { 'by-last-edited': number };
  };
}

export type RecentFlowsDB = IDBPDatabase<RecentFlowsDBSchema>;

let dbPromise: Promise<RecentFlowsDB> | null = null;

if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  void navigator.storage.persist().catch(() => {});
}

export function openRecentFlowsDB(): Promise<RecentFlowsDB> {
  if (!dbPromise) {
    dbPromise = openDB<RecentFlowsDBSchema>(RECENT_FLOWS_DB_NAME, 1, {
      upgrade(db) {
        const store = db.createObjectStore(RECENT_FLOWS_STORE, { keyPath: 'sessionId' });
        store.createIndex('by-last-edited', 'lastEditedAt');
      },
    });
  }
  return dbPromise;
}

/** Test-only: close and reset the cached DB handle between tests. */
export async function resetRecentFlowsDBForTests(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  db?.close();
  dbPromise = null;
}

async function evictBeyondCap(db: RecentFlowsDB): Promise<void> {
  const tx = db.transaction(RECENT_FLOWS_STORE, 'readwrite');
  const store = tx.objectStore(RECENT_FLOWS_STORE);
  const all = await store.getAll();
  if (all.length <= MAX_RECENT_FLOWS) {
    await tx.done;
    return;
  }
  const sorted = [...all].sort((a, b) => a.lastEditedAt - b.lastEditedAt);
  const toRemove = sorted.slice(0, all.length - MAX_RECENT_FLOWS);
  for (const record of toRemove) {
    await store.delete(record.sessionId);
  }
  await tx.done;
}

export async function saveRecentFlow(
  sessionId: string,
  { name, bundle }: { name: string; bundle: string },
): Promise<void> {
  const db = await openRecentFlowsDB();
  const existing = await db.get(RECENT_FLOWS_STORE, sessionId);
  const now = Date.now();
  const lastEditedAt = existing && existing.lastEditedAt >= now ? existing.lastEditedAt + 1 : now;
  const record: RecentFlowRecord = {
    sessionId,
    name,
    bundle,
    lastEditedAt,
  };
  const tx = db.transaction(RECENT_FLOWS_STORE, 'readwrite');
  await tx.objectStore(RECENT_FLOWS_STORE).put(record);
  await tx.done;
  await evictBeyondCap(db);
}

export async function listRecentFlows(): Promise<RecentFlowEntry[]> {
  const db = await openRecentFlowsDB();
  const all = await db.getAll(RECENT_FLOWS_STORE);
  return [...all]
    .sort((a, b) => b.lastEditedAt - a.lastEditedAt || b.sessionId.localeCompare(a.sessionId))
    .slice(0, MAX_RECENT_FLOWS)
    .map(({ sessionId, name, bundle, lastEditedAt }) => ({
      sessionId,
      name,
      bundle,
      lastEditedAt,
    }));
}

export async function removeRecentFlow(sessionId: string): Promise<void> {
  const db = await openRecentFlowsDB();
  await db.delete(RECENT_FLOWS_STORE, sessionId);
}

export async function clearRecentFlows(): Promise<void> {
  const db = await openRecentFlowsDB();
  await db.clear(RECENT_FLOWS_STORE);
}
