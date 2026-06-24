import { describe, expect, test } from 'bun:test';
import { emptyFlow } from '../emptyFlow.ts';
import { createConnectedNode } from './create.ts';
import { hydrate } from './hydrate.ts';
import { moveNode, removeNode, setNodeName } from './ops.ts';
import { edgesMap, layoutMap, nodesMap } from './schema.ts';
import { createUndoManager } from './useUndoManager.ts';

function entryDoc() {
  return hydrate(emptyFlow);
}

function wiredDoc() {
  return hydrate({
    id: 'f',
    name: 'F',
    theme: 'light',
    context: {},
    nodes: [
      { type: 'entry', id: 'entry' },
      {
        type: 'screen',
        id: 's1',
        name: 'S',
        kind: 'identifier-collect',
        traits: [],
        fields: [],
        fidelity: 'lo-fi',
      },
      {
        type: 'decision',
        id: 'd1',
        kind: 'user-exists',
        predicate: { slot: 'u', op: 'equals', value: true },
      },
      { type: 'outcome', id: 'o1', name: 'Yes', kind: 'authenticated' },
      { type: 'outcome', id: 'o2', name: 'No', kind: 'denied' },
    ],
    edges: [
      { id: 'e1', source: 'entry', target: 's1', trigger: { type: 'unconditional' } },
      { id: 'e2', source: 's1', target: 'd1', trigger: { type: 'interaction', action: 'submit' } },
      { id: 'e3', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
      { id: 'e4', source: 'd1', target: 'o2', trigger: { type: 'branch', value: false } },
    ],
    annotations: [],
    scenarios: [],
  });
}

describe('createUndoManager', () => {
  test('hydrated baseline is not on the undo stack', () => {
    const manager = createUndoManager(entryDoc());
    expect(manager.canUndo()).toBe(false);
    manager.destroy();
  });

  test('undo is a no-op when the stack is empty', () => {
    const doc = entryDoc();
    const manager = createUndoManager(doc);
    manager.undo();
    expect(manager.canUndo()).toBe(false);
    expect(nodesMap(doc).size).toBe(1);
    manager.destroy();
  });

  test('createConnectedNode undoes node, edge, and layout in one step', () => {
    const doc = entryDoc();
    const manager = createUndoManager(doc);
    const nodeId = createConnectedNode(doc, {
      sourceId: 'entry',
      sourceHandle: null,
      type: 'screen',
      position: { x: 120, y: 40 },
    });
    expect(nodeId).toBeTruthy();
    if (!nodeId) throw new Error('expected node id');
    expect(manager.canUndo()).toBe(true);

    manager.undo();
    expect(nodesMap(doc).has(nodeId)).toBe(false);
    expect(layoutMap(doc).has(nodeId)).toBe(false);
    expect([...edgesMap(doc).keys()]).toEqual([]);

    manager.redo();
    expect(nodesMap(doc).has(nodeId)).toBe(true);
    expect(layoutMap(doc).get(nodeId)).toEqual({ x: 120, y: 40 });
    expect([...edgesMap(doc).keys()]).toHaveLength(1);

    manager.destroy();
  });

  test('moveNode undoes independently of create', () => {
    const doc = entryDoc();
    const manager = createUndoManager(doc);
    const nodeId = createConnectedNode(doc, {
      sourceId: 'entry',
      sourceHandle: null,
      type: 'screen',
      position: { x: 10, y: 20 },
    });
    if (!nodeId) throw new Error('expected node id');
    moveNode(doc, nodeId, { x: 200, y: 300 });

    manager.undo();
    expect(layoutMap(doc).get(nodeId)).toEqual({ x: 10, y: 20 });
    expect(nodesMap(doc).has(nodeId)).toBe(true);

    manager.undo();
    expect(nodesMap(doc).has(nodeId)).toBe(false);

    manager.destroy();
  });

  test('removeNode cascade restores node and incident edges', () => {
    const doc = wiredDoc();
    const manager = createUndoManager(doc);
    moveNode(doc, 'd1', { x: 50, y: 60 });
    expect(removeNode(doc, 'd1').ok).toBe(true);
    expect(nodesMap(doc).has('d1')).toBe(false);
    expect([...edgesMap(doc).keys()].sort()).toEqual(['e1']);

    manager.undo();
    expect(nodesMap(doc).has('d1')).toBe(true);
    expect([...edgesMap(doc).keys()].sort()).toEqual(['e1', 'e2', 'e3', 'e4']);
    expect(layoutMap(doc).get('d1')).toEqual({ x: 50, y: 60 });

    manager.destroy();
  });

  test('setNodeName undoes in one step', () => {
    const doc = wiredDoc();
    const manager = createUndoManager(doc);
    setNodeName(doc, 's1', 'Renamed');
    expect(nodesMap(doc).get('s1')?.get('name')).toBe('Renamed');

    manager.undo();
    expect(nodesMap(doc).get('s1')?.get('name')).toBe('S');

    manager.destroy();
  });
});
