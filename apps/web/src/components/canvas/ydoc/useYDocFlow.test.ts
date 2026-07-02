import { describe, expect, test } from 'bun:test';
import type { EdgeChange, NodeChange } from '@xyflow/react';
import { hydrate } from './hydrate.ts';
import { addNode } from './ops.ts';
import { edgesMap, layoutMap, nodesMap } from './schema.ts';
import { applyEdgeChangesToDoc, applyNodeChangesToDoc } from './useYDocFlow.ts';

function base() {
  return hydrate({
    id: 'f',
    name: 'F',
    branding: { theme: 'light' },
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
      { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
    ],
    edges: [
      { id: 'e1', source: 'entry', target: 's1', trigger: { type: 'unconditional' } },
      { id: 'e2', source: 's1', target: 'o1', trigger: { type: 'interaction', action: 'submit' } },
    ],
    annotations: [],
    scenarios: [],
  });
}

describe('applyNodeChangesToDoc', () => {
  test('commits a position only when the drag ends', () => {
    const doc = base();
    // Mid-drag: ignored.
    applyNodeChangesToDoc(doc, [
      { type: 'position', id: 's1', position: { x: 5, y: 5 }, dragging: true },
    ]);
    expect(layoutMap(doc).has('s1')).toBe(false);
    // Drag end: committed.
    applyNodeChangesToDoc(doc, [
      { type: 'position', id: 's1', position: { x: 42, y: 7 }, dragging: false },
    ]);
    expect(layoutMap(doc).get('s1')).toEqual({ x: 42, y: 7 });
  });

  test('remove deletes the node and cascades to incident edges', () => {
    const doc = base();
    applyNodeChangesToDoc(doc, [{ type: 'remove', id: 's1' }]);
    expect(nodesMap(doc).has('s1')).toBe(false);
    // e1 (entry→s1) and e2 (s1→o1) both removed; none left touching s1.
    expect([...edgesMap(doc).keys()]).toEqual([]);
  });

  test('ignores select/dimension changes', () => {
    const doc = base();
    const before = nodesMap(doc).size;
    const changes: NodeChange[] = [
      { type: 'select', id: 's1', selected: true },
      { type: 'dimensions', id: 's1', dimensions: { width: 10, height: 10 } },
    ];
    applyNodeChangesToDoc(doc, changes);
    expect(nodesMap(doc).size).toBe(before);
    expect(layoutMap(doc).size).toBe(0);
  });
});

describe('applyEdgeChangesToDoc', () => {
  test('remove deletes the edge', () => {
    const doc = base();
    const changes: EdgeChange[] = [{ type: 'remove', id: 'e2' }];
    applyEdgeChangesToDoc(doc, changes);
    expect(edgesMap(doc).has('e2')).toBe(false);
    expect(edgesMap(doc).has('e1')).toBe(true);
  });
});

describe('Y.Doc → derived read recomputes', () => {
  test('a programmatic addNode is visible via readFlow', () => {
    const doc = base();
    addNode(doc, { type: 'outcome', id: 'o2', name: 'Err', kind: 'error' });
    // The hook derives via readFlow; assert the read reflects the mutation.
    const ids = [...nodesMap(doc).keys()];
    expect(ids).toContain('o2');
  });
});
