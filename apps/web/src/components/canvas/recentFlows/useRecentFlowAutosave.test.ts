import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import 'fake-indexeddb/auto';
import { emptyFlow } from '../emptyFlow.ts';
import { hydrate } from '../ydoc/hydrate.ts';
import { setNodeName } from '../ydoc/ops.ts';
import { docToArtifact, serializeBundle } from '../ydoc/persist.ts';
import { resetRecentFlowsDBForTests } from './store.ts';
import { AUTOSAVE_INTERVAL_MS, createRecentFlowAutosave } from './useRecentFlowAutosave.ts';

function entryDoc() {
  return hydrate(emptyFlow);
}

beforeEach(async () => {
  await resetRecentFlowsDBForTests();
});

afterEach(async () => {
  await resetRecentFlowsDBForTests();
});

function createFakeDocument() {
  const listeners = new Map<string, Set<() => void>>();
  let visibilityState: DocumentVisibilityState = 'visible';
  return {
    get visibilityState() {
      return visibilityState;
    },
    addEventListener(type: string, listener: () => void) {
      const set = listeners.get(type) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string, nextVisibility: DocumentVisibilityState = 'hidden') {
      visibilityState = nextVisibility;
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
}

function createFakeWindow() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    addEventListener(type: string, listener: () => void) {
      const set = listeners.get(type) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener);
    },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
}

describe('createRecentFlowAutosave', () => {
  test('does not save until the doc becomes dirty', async () => {
    const doc = entryDoc();
    const save = mock(async () => {});
    const autosave = createRecentFlowAutosave('session-1', doc, 'Untitled flow', {
      intervalMs: 1_000,
      save,
    });

    await autosave.flush();
    expect(save).not.toHaveBeenCalled();
    autosave.destroy();
  });

  test('saves on flush after a local edit', async () => {
    const doc = entryDoc();
    let savedSessionId = '';
    const captured: { payload: { name: string; bundle: string } | null } = { payload: null };
    const save = mock(async (sessionId: string, payload: { name: string; bundle: string }) => {
      savedSessionId = sessionId;
      captured.payload = payload;
    });
    const autosave = createRecentFlowAutosave('session-1', doc, 'Renamed flow', { save });

    setNodeName(doc, 'entry', 'Start');
    expect(autosave.isDirty()).toBe(true);

    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(savedSessionId).toBe('session-1');
    if (!captured.payload) throw new Error('expected payload');
    expect(captured.payload.name).toBe('Renamed flow');
    expect(captured.payload.bundle).toBe(serializeBundle(docToArtifact(doc)));
    expect(captured.payload.bundle).not.toContain('session-1');
    expect(autosave.isDirty()).toBe(false);

    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);
    autosave.destroy();
  });

  test('fires on the interval while dirty', async () => {
    const doc = entryDoc();
    const save = mock(async () => {});
    const autosave = createRecentFlowAutosave('session-1', doc, 'Untitled flow', {
      intervalMs: 50,
      save,
    });

    setNodeName(doc, 'entry', 'Edited');
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(1);
    autosave.destroy();
  });

  test('fires on visibilitychange when hidden', async () => {
    const doc = entryDoc();
    const save = mock(async () => {});
    const fakeDocument = createFakeDocument();
    const autosave = createRecentFlowAutosave('session-1', doc, 'Untitled flow', {
      save,
      document: fakeDocument,
    });

    setNodeName(doc, 'entry', 'Edited');
    fakeDocument.emit('visibilitychange', 'hidden');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(save).toHaveBeenCalledTimes(1);
    autosave.destroy();
  });

  test('fires on pagehide', async () => {
    const doc = entryDoc();
    const save = mock(async () => {});
    const fakeWindow = createFakeWindow();
    const autosave = createRecentFlowAutosave('session-1', doc, 'Untitled flow', {
      save,
      window: fakeWindow,
    });

    setNodeName(doc, 'entry', 'Edited');
    fakeWindow.emit('pagehide');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(save).toHaveBeenCalledTimes(1);
    autosave.destroy();
  });

  test('sessionId is not written into the serialized DSL bundle', async () => {
    const doc = entryDoc();
    const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    let capturedBundle = '';
    const save = mock(async (_id: string, payload: { name: string; bundle: string }) => {
      capturedBundle = payload.bundle;
    });
    const autosave = createRecentFlowAutosave(sessionId, doc, 'Untitled flow', { save });

    setNodeName(doc, 'entry', 'Start');
    await autosave.flush();
    expect(capturedBundle).not.toContain(sessionId);
    autosave.destroy();
  });

  test(`default interval is ${AUTOSAVE_INTERVAL_MS}ms`, () => {
    expect(AUTOSAVE_INTERVAL_MS).toBe(30_000);
  });
});
