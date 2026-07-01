import { describe, expect, test } from 'bun:test';
import type { Node as DslNode, Edge } from '@authprint/dsl';
import { hydrate, readFlow } from './hydrate.ts';
import {
  addEdge,
  addNode,
  declareContextSlot,
  incidentEdgeIds,
  moveNode,
  removeEdge,
  removeNode,
  setDecisionPredicate,
  setEdgeRoute,
  setFlowName,
  setFlowTheme,
  setNodeKind,
  setNodeName,
  setScreenFidelity,
  setScreenFields,
  setScreenTraits,
} from './ops.ts';
import { edgeLayoutMap, edgesMap, layoutMap, metaMap, nodesMap } from './schema.ts';

// Minimal flow: entry → screen → (decision) → outcome, decision has both branches.
function base() {
  return hydrate({
    id: 'f',
    name: 'F',
    theme: 'light',
    context: { u: { type: 'boolean' } },
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

const newOutcome: DslNode = { type: 'outcome', id: 'o3', name: 'Err', kind: 'error' };

describe('addNode', () => {
  test('adds a node', () => {
    const doc = base();
    expect(addNode(doc, newOutcome)).toEqual({ ok: true });
    expect(nodesMap(doc).has('o3')).toBe(true);
  });
  test('rejects a duplicate id', () => {
    const doc = base();
    const r = addNode(doc, { ...newOutcome, id: 's1' });
    expect(r.ok).toBe(false);
  });
});

describe('removeNode', () => {
  test('cascades to incident edges, their routes, and the layout entry', () => {
    const doc = base();
    moveNode(doc, 'd1', { x: 10, y: 20 });
    setEdgeRoute(doc, 'e2', [{ x: 1, y: 2 }]);
    setEdgeRoute(doc, 'e3', [{ x: 3, y: 4 }]);
    expect(removeNode(doc, 'd1')).toEqual({ ok: true });
    expect(nodesMap(doc).has('d1')).toBe(false);
    expect(layoutMap(doc).has('d1')).toBe(false);
    expect(edgeLayoutMap(doc).has('e2')).toBe(false);
    expect(edgeLayoutMap(doc).has('e3')).toBe(false);
    expect(edgeLayoutMap(doc).has('e4')).toBe(false);
    // e2 (→d1), e3 (d1→), e4 (d1→) all gone; e1 (entry→s1) stays.
    expect([...edgesMap(doc).keys()].sort()).toEqual(['e1']);
  });
  test('is idempotent for an absent node', () => {
    const doc = base();
    expect(removeNode(doc, 'nope')).toEqual({ ok: true });
  });
});

describe('moveNode', () => {
  test('writes the layout entry', () => {
    const doc = base();
    expect(moveNode(doc, 's1', { x: 100, y: 200 })).toEqual({ ok: true });
    expect(layoutMap(doc).get('s1')).toEqual({ x: 100, y: 200 });
  });
  test('rejects an unknown node', () => {
    expect(moveNode(base(), 'nope', { x: 0, y: 0 }).ok).toBe(false);
  });
});

describe('addEdge / removeEdge', () => {
  test('adds an edge between existing nodes', () => {
    const doc = base();
    const edge: Edge = {
      id: 'e5',
      source: 's1',
      target: 'o1',
      trigger: { type: 'interaction', action: 'back' },
    };
    expect(addEdge(doc, edge)).toEqual({ ok: true });
    expect(edgesMap(doc).has('e5')).toBe(true);
  });
  test('rejects an edge to a nonexistent target', () => {
    const r = addEdge(base(), {
      id: 'e9',
      source: 's1',
      target: 'ghost',
      trigger: { type: 'interaction', action: 'x' },
    });
    expect(r.ok).toBe(false);
  });
  test('rejects a duplicate edge id', () => {
    expect(
      addEdge(base(), {
        id: 'e1',
        source: 's1',
        target: 'o1',
        trigger: { type: 'interaction', action: 'x' },
      }).ok,
    ).toBe(false);
  });
  test('removeEdge deletes the edge and its route', () => {
    const doc = base();
    setEdgeRoute(doc, 'e3', [{ x: 10, y: 20 }]);
    expect(removeEdge(doc, 'e3')).toEqual({ ok: true });
    expect(edgesMap(doc).has('e3')).toBe(false);
    expect(edgeLayoutMap(doc).has('e3')).toBe(false);
  });
});

describe('setEdgeRoute', () => {
  test('writes a route for an existing edge', () => {
    const doc = base();
    const points = [
      { x: 100, y: 200 },
      { x: 150, y: 250 },
    ];
    expect(setEdgeRoute(doc, 'e2', points)).toEqual({ ok: true });
    expect(edgeLayoutMap(doc).get('e2')).toEqual(points);
  });

  test('rejects an unknown edge', () => {
    expect(setEdgeRoute(base(), 'ghost', [{ x: 0, y: 0 }]).ok).toBe(false);
  });
});

describe('incidentEdgeIds', () => {
  test('finds edges touching a node on either end', () => {
    expect(incidentEdgeIds(base(), 'd1').sort()).toEqual(['e2', 'e3', 'e4']);
  });
});

describe('attribute edits', () => {
  const screenOf = (doc: ReturnType<typeof base>) =>
    readFlow(doc).nodes.find((n) => n.id === 's1') as Extract<DslNode, { type: 'screen' }>;

  test('setNodeName / setNodeKind write through', () => {
    const doc = base();
    setNodeName(doc, 's1', 'Email');
    setNodeKind(doc, 's1', 'password');
    const s = screenOf(doc);
    expect(s.name).toBe('Email');
    expect(s.kind).toBe('password');
  });

  test('setScreenFidelity, traits, fields replace cleanly and round-trip', () => {
    const doc = base();
    setScreenFidelity(doc, 's1', 'wireframe');
    setScreenTraits(doc, 's1', ['captcha', 'remember-me']);
    setScreenFields(doc, 's1', [
      { name: 'email', type: 'identifier', required: true },
      { name: 'pw', type: 'password', required: false },
    ]);
    const s = screenOf(doc);
    expect(s.fidelity).toBe('wireframe');
    expect(s.traits).toEqual(['captcha', 'remember-me']);
    expect(s.fields).toEqual([
      { name: 'email', type: 'identifier', required: true },
      { name: 'pw', type: 'password', required: false },
    ]);
    // Replacing again overwrites, not appends.
    setScreenTraits(doc, 's1', []);
    expect(screenOf(doc).traits).toEqual([]);
  });

  test('rejects an unknown node', () => {
    expect(setNodeName(base(), 'ghost', 'x').ok).toBe(false);
  });

  test('setDecisionPredicate writes through and round-trips', () => {
    const doc = base();
    setDecisionPredicate(doc, 'd1', { slot: 'risk.level', op: 'greater-than', value: 50 });
    const d = readFlow(doc).nodes.find((n) => n.id === 'd1') as Extract<
      DslNode,
      { type: 'decision' }
    >;
    expect(d.predicate).toEqual({ slot: 'risk.level', op: 'greater-than', value: 50 });
  });

  test('declareContextSlot adds a slot; rejects an empty name', () => {
    const doc = base();
    expect(declareContextSlot(doc, 'risk.level', { type: 'number' })).toEqual({ ok: true });
    expect(readFlow(doc).context['risk.level']).toEqual({ type: 'number' });
    expect(declareContextSlot(doc, '', { type: 'boolean' }).ok).toBe(false);
  });
});

describe('flow meta edits', () => {
  test('setFlowName / setFlowTheme write through metaMap and round-trip', () => {
    const doc = base();
    setFlowName(doc, 'Renamed flow');
    setFlowTheme(doc, 'dark');
    expect(metaMap(doc).get('name')).toBe('Renamed flow');
    expect(metaMap(doc).get('theme')).toBe('dark');
    expect(readFlow(doc).name).toBe('Renamed flow');
    expect(readFlow(doc).theme).toBe('dark');
  });
});

describe('compound consistency', () => {
  test('add node + connecting edge leaves the doc consistent', () => {
    const doc = base();
    addNode(doc, newOutcome);
    addEdge(doc, {
      id: 'e5',
      source: 'd1',
      target: 'o3',
      trigger: { type: 'branch', value: false },
    });
    expect(nodesMap(doc).has('o3')).toBe(true);
    expect(edgesMap(doc).get('e5')?.get('target')).toBe('o3');
  });
});
