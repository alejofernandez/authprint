import { describe, expect, test } from 'bun:test';
import type { Flow } from '@authprint/dsl';
import { hydrate } from './hydrate.ts';
import { docToArtifact } from './persist.ts';
import { type LayoutPositions, layoutMap } from './schema.ts';

const flow: Flow = {
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
    { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
  ],
  edges: [
    { id: 'e1', source: 'entry', target: 's1', trigger: { type: 'unconditional' } },
    { id: 'e2', source: 's1', target: 'o1', trigger: { type: 'interaction', action: 'submit' } },
  ],
  annotations: [],
  scenarios: [],
};

describe('docToArtifact', () => {
  test('empty layout when nothing has been positioned', () => {
    expect(docToArtifact(hydrate(flow)).layout).toEqual({});
  });

  test('returns flow + only the positioned nodes', () => {
    const layout: LayoutPositions = { s1: { x: 100, y: 200 } };
    const artifact = docToArtifact(hydrate(flow, layout));
    expect(artifact.flow.id).toBe('f');
    expect(artifact.flow.nodes).toHaveLength(3);
    expect(artifact.layout).toEqual(layout);
  });
});

describe('hydrate with layout', () => {
  test('seeds the layout map from the provided positions', () => {
    const layout: LayoutPositions = { entry: { x: 0, y: 0 }, s1: { x: 10, y: 20 } };
    expect(layoutMap(hydrate(flow, layout)).get('s1')).toEqual({ x: 10, y: 20 });
  });

  test('drops positions for nodes not in the flow (stale layout block)', () => {
    const layout: LayoutPositions = { s1: { x: 1, y: 2 }, ghost: { x: 9, y: 9 } };
    const map = layoutMap(hydrate(flow, layout));
    expect(map.has('s1')).toBe(true);
    expect(map.has('ghost')).toBe(false);
    expect(map.size).toBe(1);
  });

  test('no layout arg leaves the map empty (unchanged E24 behavior)', () => {
    expect(layoutMap(hydrate(flow)).size).toBe(0);
  });
});

describe('round-trip', () => {
  test('docToArtifact(hydrate(flow, layout)) preserves both halves', () => {
    const layout: LayoutPositions = { entry: { x: 5, y: 6 }, o1: { x: 300, y: 40 } };
    const artifact = docToArtifact(hydrate(flow, layout));
    expect(new Set(artifact.flow.nodes.map((n) => n.id))).toEqual(
      new Set(flow.nodes.map((n) => n.id)),
    );
    expect(artifact.layout).toEqual(layout);
  });
});
