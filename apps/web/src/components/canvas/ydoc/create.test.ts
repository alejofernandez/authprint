import { describe, expect, test } from 'bun:test';
import type { Flow } from '@authprint/dsl';
import {
  connectNodes,
  createConnectedNode,
  defaultNode,
  triggerFor,
  validateConnection,
} from './create.ts';
import { hydrate } from './hydrate.ts';
import { edgesMap, layoutMap, nodesMap, readEdgeMap, readNodeMap } from './schema.ts';

function base(): Flow {
  return {
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
      { type: 'action', id: 'a1', name: 'A', kind: 'send-otp' },
      { type: 'external', id: 'x1', name: 'X', kind: 'google' },
      { type: 'outcome', id: 'o1', name: 'O', kind: 'authenticated' },
      { type: 'outcome', id: 'o2', name: 'O2', kind: 'denied' },
    ],
    edges: [],
    annotations: [],
    scenarios: [],
  };
}

describe('triggerFor', () => {
  test('entry → unconditional (any handle)', () => {
    expect(triggerFor('entry', null)).toEqual({ type: 'unconditional' });
  });
  test('screen default → interaction:submit, alt → interaction:back', () => {
    expect(triggerFor('screen', 'default')).toEqual({ type: 'interaction', action: 'submit' });
    expect(triggerFor('screen', 'alt')).toEqual({ type: 'interaction', action: 'back' });
  });
  test('decision true/false → branch', () => {
    expect(triggerFor('decision', 'true')).toEqual({ type: 'branch', value: true });
    expect(triggerFor('decision', 'false')).toEqual({ type: 'branch', value: false });
  });
  test('action success/error', () => {
    expect(triggerFor('action', 'on-success')).toEqual({ type: 'on-success' });
    expect(triggerFor('action', 'on-error')).toEqual({ type: 'on-error' });
  });
  test('external also denied/cancelled', () => {
    expect(triggerFor('external', 'on-denied')).toEqual({ type: 'on-denied' });
    expect(triggerFor('external', 'on-cancelled')).toEqual({ type: 'on-cancelled' });
  });
  test('outcome and unknown handles → null', () => {
    expect(triggerFor('outcome', null)).toBeNull();
    expect(triggerFor('decision', 'nonsense')).toBeNull();
    expect(triggerFor('action', 'on-denied')).toBeNull(); // action has no denied handle
  });
});

describe('defaultNode', () => {
  test('screen carries empty traits/fields + placeholder name', () => {
    const n = defaultNode('screen', 'x');
    expect(n).toMatchObject({
      type: 'screen',
      id: 'x',
      name: 'New screen',
      traits: [],
      fields: [],
    });
  });
  test('decision has a schema-valid (non-empty) placeholder slot', () => {
    const n = defaultNode('decision', 'x');
    expect(n.type === 'decision' && n.predicate.slot.length).toBeGreaterThan(0);
  });
});

describe('createConnectedNode', () => {
  test('adds a node + connecting edge with the handle trigger, and a layout entry', () => {
    const doc = hydrate(base());
    const id = createConnectedNode(doc, {
      sourceId: 's1',
      sourceHandle: 'default',
      type: 'outcome',
      position: { x: 400, y: 50 },
    });
    expect(id).not.toBeNull();
    const map = nodesMap(doc).get(id as string);
    expect(map).toBeDefined();
    const node = readNodeMap(map as Parameters<typeof readNodeMap>[0]);
    expect(node.type).toBe('outcome');
    expect(layoutMap(doc).get(id as string)).toEqual({ x: 400, y: 50 });

    const edge = [...edgesMap(doc).values()].map(readEdgeMap).find((e) => e.target === id);
    expect(edge?.source).toBe('s1');
    expect(edge?.trigger).toEqual({ type: 'interaction', action: 'submit' });
  });

  test('decision branch creates a branch-triggered edge', () => {
    const doc = hydrate(base());
    const id = createConnectedNode(doc, {
      sourceId: 'd1',
      sourceHandle: 'false',
      type: 'outcome',
      position: { x: 0, y: 0 },
    });
    const edge = [...edgesMap(doc).values()].map(readEdgeMap).find((e) => e.target === id);
    expect(edge?.trigger).toEqual({ type: 'branch', value: false });
  });

  test('returns null for an invalid source (outcome) and writes nothing', () => {
    const doc = hydrate(base());
    const before = nodesMap(doc).size;
    const id = createConnectedNode(doc, {
      sourceId: 'o1',
      sourceHandle: null,
      type: 'screen',
      position: { x: 0, y: 0 },
    });
    expect(id).toBeNull();
    expect(nodesMap(doc).size).toBe(before);
  });

  test('returns null for a missing source node', () => {
    const doc = hydrate(base());
    expect(
      createConnectedNode(doc, {
        sourceId: 'ghost',
        sourceHandle: 'default',
        type: 'screen',
        position: { x: 0, y: 0 },
      }),
    ).toBeNull();
  });
});

describe('connectNodes', () => {
  test('connects two existing nodes with the handle trigger', () => {
    const doc = hydrate(base());
    const id = connectNodes(doc, { sourceId: 'd1', sourceHandle: 'true', targetId: 'o1' });
    expect(id).not.toBeNull();
    const edge = [...edgesMap(doc).values()].map(readEdgeMap).find((e) => e.id === id);
    expect(edge).toMatchObject({
      source: 'd1',
      target: 'o1',
      trigger: { type: 'branch', value: true },
    });
  });
  test('null for an invalid source (outcome) or missing target', () => {
    const doc = hydrate(base());
    expect(connectNodes(doc, { sourceId: 'o1', sourceHandle: null, targetId: 's1' })).toBeNull();
    expect(
      connectNodes(doc, { sourceId: 's1', sourceHandle: 'default', targetId: 'ghost' }),
    ).toBeNull();
  });
});

describe('validateConnection', () => {
  const flow = base();
  test('valid: screen → outcome via its interaction handle', () => {
    expect(validateConnection(flow, { source: 's1', target: 'o1', sourceHandle: 'default' })).toBe(
      true,
    );
  });
  test('rejects self-loop, missing ends, target=entry, and outcome source', () => {
    expect(validateConnection(flow, { source: 's1', target: 's1', sourceHandle: 'default' })).toBe(
      false,
    );
    expect(validateConnection(flow, { source: 's1', target: null, sourceHandle: 'default' })).toBe(
      false,
    );
    expect(
      validateConnection(flow, { source: 's1', target: 'entry', sourceHandle: 'default' }),
    ).toBe(false);
    expect(validateConnection(flow, { source: 'o1', target: 's1', sourceHandle: null })).toBe(
      false,
    );
  });
  test('single-use handle: rejects a second edge from a filled branch, allows the open one', () => {
    const withBranch: Flow = {
      ...flow,
      edges: [{ id: 'e1', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } }],
    };
    // `true` branch is filled → reject; `false` branch is open → allow.
    expect(
      validateConnection(withBranch, { source: 'd1', target: 'o2', sourceHandle: 'true' }),
    ).toBe(false);
    expect(
      validateConnection(withBranch, { source: 'd1', target: 'o2', sourceHandle: 'false' }),
    ).toBe(true);
  });
  test('screen interaction handle stays open even with an existing edge', () => {
    const withInteraction: Flow = {
      ...flow,
      edges: [
        {
          id: 'e1',
          source: 's1',
          target: 'o1',
          trigger: { type: 'interaction', action: 'submit' },
        },
      ],
    };
    expect(
      validateConnection(withInteraction, { source: 's1', target: 'o2', sourceHandle: 'default' }),
    ).toBe(true);
  });
});
