import { describe, expect, test } from 'bun:test';
import { emptyFlow } from '../emptyFlow.ts';
import { hydrate } from '../ydoc/hydrate.ts';
import { putScenario, setNodeName } from '../ydoc/ops.ts';
import { createUnexportedChangesTracker, trackedDocMaps } from './useUnexportedChanges.ts';

function entryDoc() {
  return hydrate(emptyFlow);
}

describe('createUnexportedChangesTracker', () => {
  test('starts clean; local edit marks unexported', () => {
    const doc = entryDoc();
    const tracker = createUnexportedChangesTracker(doc);
    expect(tracker.hasUnexportedChanges()).toBe(false);

    setNodeName(doc, 'entry', 'Renamed');
    expect(tracker.hasUnexportedChanges()).toBe(true);

    tracker.destroy();
  });

  test('markExported clears without a timer', () => {
    const doc = entryDoc();
    const tracker = createUnexportedChangesTracker(doc);
    setNodeName(doc, 'entry', 'Renamed');
    expect(tracker.hasUnexportedChanges()).toBe(true);

    tracker.markExported();
    expect(tracker.hasUnexportedChanges()).toBe(false);

    tracker.destroy();
  });

  test('scenario edits mark unexported (UF-032)', () => {
    const doc = entryDoc();
    const tracker = createUnexportedChangesTracker(doc);
    expect(tracker.hasUnexportedChanges()).toBe(false);

    putScenario(doc, { id: 'sc-1', name: 'One', initialContext: {}, inputScript: [] });
    expect(tracker.hasUnexportedChanges()).toBe(true);

    tracker.destroy();
  });

  test('observes all seven editable maps', () => {
    const doc = entryDoc();
    expect(trackedDocMaps(doc)).toHaveLength(7);
  });
});
